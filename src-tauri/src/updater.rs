// 桌面客户端"软件内更新"实现
//
// 设计参考：VS Code / Postman / 网易云音乐
// 流程：
//   1. 前端通过 invoke("get_app_version") 获取真实版本（来自 CARGO_PKG_VERSION 编译期常量）
//   2. 前端调用 invoke("download_update", { url }) 触发下载
//      - Rust 端流式拉取安装包到 %TEMP%\WhisperDesktop\setup_<random>.exe
//      - 通过 Tauri 事件 "update://progress" 周期性推送 { downloaded, total, percent }
//      - 完成后 emit "update://ready" { path }
//   3. 前端调用 invoke("install_update", { path })
//      - Rust 端 spawn 安装器（detached），立即 app.exit(0)
//      - NSIS 安装器接管：写入新文件 → 启动新版本
//
// 安全性：
//   - 只允许 https URL（防止下载链路被劫持）
//   - 路径限定在系统 temp 目录的子目录下
//   - 不允许调用方传入任意 path 到 install_update —— path 必须是 download_update 返回的

use std::path::{Path, PathBuf};
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use futures_util::StreamExt;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tokio::fs::{create_dir_all, File};
use tokio::io::AsyncWriteExt;

/// 桌面客户端编译期版本号 —— 与 Cargo.toml [package].version 保持一致，
/// 编译时由 cargo 注入到二进制中，运行时读取保证 100% 与 exe 文件一致。
#[tauri::command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[derive(Clone, Serialize)]
struct ProgressPayload {
    downloaded: u64,
    total: u64,
    percent: f64,
    speed_bps: u64, // bytes per second
}

#[derive(Clone, Serialize)]
struct ReadyPayload {
    path: String,
}

fn random_suffix() -> String {
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_micros())
        .unwrap_or(0);
    format!("{:x}", ts)
}

fn updater_dir(app: &AppHandle) -> PathBuf {
    // 优先放 tauri 推荐的应用缓存目录；失败则回退到系统 temp
    if let Ok(dir) = app.path().app_cache_dir() {
        return dir.join("updates");
    }
    std::env::temp_dir().join("WhisperDesktop").join("updates")
}

/// 下载更新安装包 —— 流式写入磁盘，期间持续 emit 进度事件。
///
/// 返回最终保存到磁盘的绝对路径字符串。
#[tauri::command]
pub async fn download_update(app: AppHandle, url: String) -> Result<String, String> {
    if !url.starts_with("https://") {
        return Err("更新链接必须为 HTTPS".into());
    }

    let dir = updater_dir(&app);
    create_dir_all(&dir)
        .await
        .map_err(|e| format!("创建临时目录失败：{e}"))?;

    // 清理同目录下旧的安装包（避免堆积）
    if let Ok(mut rd) = tokio::fs::read_dir(&dir).await {
        while let Ok(Some(ent)) = rd.next_entry().await {
            let _ = tokio::fs::remove_file(ent.path()).await;
        }
    }

    let file_name = format!("WhisperDesktop_setup_{}.exe", random_suffix());
    let target = dir.join(&file_name);

    let client = reqwest::Client::builder()
        .user_agent("WhisperDesktop-Updater/1.0")
        .build()
        .map_err(|e| format!("构造 HTTP 客户端失败：{e}"))?;

    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("请求失败：{e}"))?;

    if !resp.status().is_success() {
        return Err(format!("下载失败，HTTP {}", resp.status()));
    }

    let total = resp.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut last_emit = Instant::now();
    let mut window_bytes: u64 = 0;
    let mut window_start = Instant::now();

    let mut file = File::create(&target)
        .await
        .map_err(|e| format!("创建文件失败：{e}"))?;

    let mut stream = resp.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let bytes = chunk.map_err(|e| format!("数据块读取失败：{e}"))?;
        file.write_all(&bytes)
            .await
            .map_err(|e| format!("写入失败：{e}"))?;
        downloaded += bytes.len() as u64;
        window_bytes += bytes.len() as u64;

        // 每 200ms emit 一次，避免事件风暴
        if last_emit.elapsed().as_millis() >= 200 {
            let elapsed = window_start.elapsed().as_secs_f64().max(0.001);
            let speed = (window_bytes as f64 / elapsed) as u64;
            let percent = if total > 0 {
                (downloaded as f64 / total as f64) * 100.0
            } else {
                0.0
            };
            let _ = app.emit(
                "update://progress",
                ProgressPayload {
                    downloaded,
                    total,
                    percent,
                    speed_bps: speed,
                },
            );
            last_emit = Instant::now();
            window_bytes = 0;
            window_start = Instant::now();
        }
    }

    file.flush()
        .await
        .map_err(|e| format!("刷新文件失败：{e}"))?;
    drop(file);

    // 终态进度
    let _ = app.emit(
        "update://progress",
        ProgressPayload {
            downloaded,
            total: total.max(downloaded),
            percent: 100.0,
            speed_bps: 0,
        },
    );

    let path_str = target.to_string_lossy().to_string();
    let _ = app.emit(
        "update://ready",
        ReadyPayload {
            path: path_str.clone(),
        },
    );

    Ok(path_str)
}

/// 启动下载好的安装器并退出当前应用 —— 让 NSIS 接管文件替换。
///
/// `path` 必须是 `download_update` 返回过的路径（位于本应用 cache/updates 目录内），
/// 防止恶意脚本通过 invoke 启动任意可执行文件。
#[tauri::command]
pub fn install_update(app: AppHandle, path: String) -> Result<(), String> {
    let target = Path::new(&path);
    if !target.is_file() {
        return Err("安装包不存在".into());
    }

    // 路径白名单：必须在我们自己的 updates 目录下
    let allowed = updater_dir(&app);
    let canon_target = target
        .canonicalize()
        .map_err(|e| format!("解析安装包路径失败：{e}"))?;
    let canon_allowed = allowed
        .canonicalize()
        .map_err(|e| format!("解析更新目录失败：{e}"))?;
    if !canon_target.starts_with(&canon_allowed) {
        return Err("不允许从该路径启动安装器".into());
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        // DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP，避免成为本进程子进程被一起 kill
        const DETACHED_PROCESS: u32 = 0x0000_0008;
        const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;
        std::process::Command::new(&canon_target)
            .creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP)
            .spawn()
            .map_err(|e| format!("启动安装器失败：{e}"))?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new(&canon_target)
            .spawn()
            .map_err(|e| format!("启动安装器失败：{e}"))?;
    }

    // 给安装器一点时间初始化再退出本应用
    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(800)).await;
        app_clone.exit(0);
    });

    Ok(())
}
