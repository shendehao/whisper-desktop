/**
 * 桌面客户端云更新（成熟版）
 *
 * 设计要点（对齐 VS Code / Postman / 网易云的更新流）：
 *   - 当前版本从 Tauri Rust 命令 `get_app_version` 读取（来自 CARGO_PKG_VERSION 编译期常量），
 *     保证与 exe 文件 100% 一致，不会因为构建缓存 / localStorage 而失真。
 *   - 浏览器环境下退化到 package.json 注入的 VITE_APP_VERSION。
 *   - 检查到新版本后由 UpdatePrompt 组件触发 Rust 端 `download_update`：流式下载 + 进度事件。
 *   - 下载完成后调用 `install_update` —— Rust 端启动 NSIS 安装器并 exit(0)。
 */

import { ref, computed } from "vue";
import http from "@/api";

export interface UpdateInfo {
  has_update: boolean;
  force_update: boolean;
  latest_version: string | null;
  current_version: string;
  update_url: string;
  update_content: string;
  min_version: string;
  pushed_at: string | null;
}

// 运行时版本号——优先从 Tauri Rust 命令获取（编译期注入，绝对可信）
export const currentVersion = ref<string>(
  (import.meta as any).env?.VITE_APP_VERSION || "0.0.0"
);

/** 兼容旧引用，保持只读字符串语义；启动后会被 resolveCurrentVersion 异步覆盖 */
export const CURRENT_VERSION: string = currentVersion.value;

let versionResolved = false;
/** 应用启动时调用一次，把版本号同步到 Rust 真实值 */
export async function resolveCurrentVersion(): Promise<string> {
  if (versionResolved) return currentVersion.value;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const v = await invoke<string>("get_app_version");
    if (v && typeof v === "string") {
      currentVersion.value = v;
    }
  } catch {
    /* 非 Tauri 环境（浏览器调试）保留 VITE_APP_VERSION */
  }
  versionResolved = true;
  return currentVersion.value;
}

const SKIP_VER_KEY = "whisper_skip_ver";
const LAST_CHECK_KEY = "whisper_last_check";

// 全局响应式状态
export const updateInfo = ref<UpdateInfo | null>(null);
export const checking = ref(false);
export const lastError = ref<string>("");
export const lastCheckAt = ref<number>(Number(localStorage.getItem(LAST_CHECK_KEY) || 0));

// 计算属性：是否应显示弹窗
export const shouldShowPrompt = computed(() => {
  const info = updateInfo.value;
  if (!info || !info.has_update) return false;
  if (info.force_update) return true; // 强制更新永远显示
  const skipped = localStorage.getItem(SKIP_VER_KEY);
  if (skipped && skipped === info.latest_version) return false;
  return true;
});

export const isForceUpdate = computed(
  () => !!(updateInfo.value?.has_update && updateInfo.value?.force_update)
);

/** 主动检查更新；silent=false 时无更新会抛出/返回 null，由调用方决定是否 toast。 */
export async function checkUpdate(silent = true): Promise<UpdateInfo | null> {
  checking.value = true;
  lastError.value = "";
  try {
    // 确保拿到 Rust 层的真实版本号后再发请求
    const ver = await resolveCurrentVersion();
    const res = await http.get<UpdateInfo>("/api/desktop/check-update", {
      params: { current_version: ver },
    });
    // 后端返回的 current_version 可能有清理/规范化，用本地认知的才是顶级可信源
    res.data.current_version = ver;
    updateInfo.value = res.data;
    lastCheckAt.value = Date.now();
    localStorage.setItem(LAST_CHECK_KEY, String(lastCheckAt.value));
    return res.data;
  } catch (e: any) {
    lastError.value = e?.message || "检查更新失败";
    if (!silent) throw e;
    return null;
  } finally {
    checking.value = false;
  }
}

let timer: number | null = null;

/** 启动自动轮询，默认 30 分钟一次。重复调用会先清除旧定时器。 */
export function startAutoCheck(intervalMs = 30 * 60 * 1000) {
  if (timer !== null) {
    clearInterval(timer);
  }
  checkUpdate(true);
  timer = window.setInterval(() => checkUpdate(true), intervalMs);
}

export function stopAutoCheck() {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

/** 用户点击"跳过此版本"——记录到 localStorage，下次同版本不再提示（强制更新除外）。 */
export function skipCurrentVersion() {
  const v = updateInfo.value?.latest_version;
  if (v) {
    localStorage.setItem(SKIP_VER_KEY, v);
  }
  updateInfo.value = null;
}

/** 用户点击"稍后提醒"——临时关闭本轮弹窗，30 分钟后下次轮询会再次出现。 */
export function dismissPrompt() {
  updateInfo.value = null;
}

/** 打开下载链接（优先用 Tauri shell 插件，浏览器环境 fallback 到 window.open）。
 *  仅在软件内下载安装失败时作为兼容出口 ——主流程走 Rust 端 download_update/install_update。
 */
export async function openDownload(url: string) {
  try {
    const { open } = await import("@tauri-apps/plugin-shell");
    await open(url);
    return;
  } catch {
    /* fallback */
  }
  window.open(url, "_blank");
}

/** 软件内下载更新包。 */
export interface DownloadProgress {
  downloaded: number;
  total: number;
  percent: number;
  speed_bps: number;
}

export async function downloadUpdateInApp(
  url: string,
  onProgress?: (p: DownloadProgress) => void
): Promise<string> {
  const { invoke } = await import("@tauri-apps/api/core");
  const { listen } = await import("@tauri-apps/api/event");
  const un = await listen<DownloadProgress>("update://progress", (e) => {
    if (onProgress) onProgress(e.payload);
  });
  try {
    return await invoke<string>("download_update", { url });
  } finally {
    un();
  }
}

/** 启动安装器，应用会在 ~800ms 后自动退出让 NSIS 接管。 */
export async function installDownloadedUpdate(path: string): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("install_update", { path });
}
