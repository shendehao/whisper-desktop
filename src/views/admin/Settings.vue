<template>
  <div class="settings">
    <div class="page-header">
      <div>
        <h1 class="page-title">系统设置</h1>
        <p class="page-sub">仅超级管理员可见的平台级配置</p>
      </div>
    </div>

    <!-- ① 应用更新 -->
    <div class="panel">
      <div class="panel-head">
        <div class="panel-title">应用更新</div>
        <div class="panel-sub">客户端会每 30 分钟自动从云端检查一次更新</div>
      </div>
      <div class="kv">
        <div class="kv-row">
          <span class="kv-k">当前版本</span>
          <span class="kv-v"><b>v{{ currentVersion }}</b></span>
        </div>
        <div class="kv-row">
          <span class="kv-k">最新版本</span>
          <span class="kv-v">
            <template v-if="updateInfo">
              <b>v{{ updateInfo.latest_version || "--" }}</b>
              <span v-if="updateInfo.has_update" class="badge badge-warn">有新版本可更新</span>
              <span v-else class="badge badge-ok">已是最新</span>
            </template>
            <span v-else class="text-tertiary">--</span>
          </span>
        </div>
        <div class="kv-row">
          <span class="kv-k">最近检查</span>
          <span class="kv-v">{{ lastCheckLabel }}</span>
        </div>
      </div>
      <div v-if="updPhase !== 'idle'" class="upd-progress">
        <div class="upd-bar"><div class="upd-fill" :style="{ width: updPercent + '%' }" /></div>
        <div class="upd-meta">
          <span>{{ updPhaseText }}</span>
          <span v-if="updPhase === 'downloading'">{{ updPercent.toFixed(1) }}% · {{ updSpeedText }}</span>
        </div>
      </div>
      <div class="panel-actions">
        <el-button type="primary" :icon="RefreshRight" :loading="checking" :disabled="updPhase === 'downloading' || updPhase === 'installing'" @click="onCheck">
          {{ checking ? "检查中…" : "立即检查更新" }}
        </el-button>
        <el-button
          v-if="updateInfo?.has_update"
          type="success"
          :icon="Download"
          :loading="updPhase === 'downloading' || updPhase === 'installing'"
          :disabled="updPhase === 'downloading' || updPhase === 'installing'"
          @click="onDownload"
        >
          {{ updPhase === 'failed' ? '重试升级' : '一键升级' }}
        </el-button>
      </div>
    </div>

    <!-- ② 系统信息 -->
    <div class="panel">
      <div class="panel-head">
        <div class="panel-title">系统信息</div>
      </div>
      <div class="kv">
        <div class="kv-row"><span class="kv-k">产品</span><span class="kv-v">Whisper Desktop</span></div>
        <div class="kv-row"><span class="kv-k">API 地址</span><span class="kv-v mono">{{ apiBase }}</span></div>
        <div class="kv-row"><span class="kv-k">Token 有效期</span><span class="kv-v">24 小时</span></div>
        <div class="kv-row"><span class="kv-k">CORS 策略</span><span class="kv-v mono">tauri://localhost, https://tauri.localhost</span></div>
      </div>
    </div>

    <!-- ③ 危险操作 -->
    <div class="panel danger">
      <div class="panel-head">
        <div class="panel-title">危险操作</div>
        <div class="panel-sub">谨慎执行，操作不可撤销</div>
      </div>
      <div class="danger-row">
        <div>
          <div class="danger-title">强制所有用户下线</div>
          <div class="danger-desc">将清除所有 session_nonce，所有用户需重新登录</div>
        </div>
        <el-button type="danger" plain @click="clearAllSessions">执行</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { RefreshRight, Download } from "@element-plus/icons-vue";
import {
  checkUpdate,
  checking,
  updateInfo,
  lastCheckAt,
  currentVersion,
  downloadUpdateInApp,
  installDownloadedUpdate,
  type DownloadProgress,
} from "@/composables/useUpdateCheck";
const apiBase = (import.meta.env.VITE_API_BASE as string) || "https://commu.fun";

const lastCheckLabel = computed(() => {
  if (!lastCheckAt.value) return "尚未检查";
  const d = new Date(lastCheckAt.value);
  return d.toLocaleString("zh-CN", { hour12: false });
});

async function onCheck() {
  const info = await checkUpdate(false);
  if (info && !info.has_update) ElMessage.success(`已是最新版本 v${currentVersion.value}`);
}

// 软件内升级状态
const updPhase = ref<"idle" | "downloading" | "installing" | "failed">("idle");
const updPercent = ref(0);
const updSpeed = ref(0);
const updError = ref("");
const updPhaseText = computed(() => {
  switch (updPhase.value) {
    case "downloading": return "正在下载更新包…";
    case "installing": return "启动安装器…应用即将退出";
    case "failed": return `升级失败：${updError.value}`;
    default: return "";
  }
});
function fmtBytes(n: number): string {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / 1024 / 1024).toFixed(1) + " MB";
}
const updSpeedText = computed(() => fmtBytes(updSpeed.value) + "/s");

async function onDownload() {
  const url = updateInfo.value?.update_url;
  if (!url) {
    ElMessage.warning("下载地址为空，请联系管理员");
    return;
  }
  updPhase.value = "downloading";
  updPercent.value = 0;
  updSpeed.value = 0;
  updError.value = "";
  try {
    const path = await downloadUpdateInApp(url, (p: DownloadProgress) => {
      updPercent.value = Math.min(100, p.percent || 0);
      updSpeed.value = p.speed_bps || 0;
    });
    updPhase.value = "installing";
    updPercent.value = 100;
    await installDownloadedUpdate(path);
    // 应用即将退出
  } catch (e: any) {
    updPhase.value = "failed";
    updError.value = String(e?.message || e || "未知错误");
    ElMessage.error("软件内升级失败：" + updError.value);
  }
}

async function clearAllSessions() {
  try {
    await ElMessageBox.confirm("确定要强制所有用户下线？此操作不可撤销。", "危险操作", { type: "warning" });
    ElMessage.info("功能即将上线");
  } catch { /* user cancel */ }
}

onMounted(() => {
  // 进入页面时静默检查，便于看到“最新版本”和“最近检查”
  if (!updateInfo.value) checkUpdate(true);
});
</script>

<style scoped>
.settings { display: flex; flex-direction: column; gap: 20px; }

.page-header { display: flex; justify-content: space-between; align-items: flex-end; }
.page-title { font-size: 22px; font-weight: 700; color: var(--text-primary); margin: 0; letter-spacing: -0.01em; }
.page-sub { color: var(--text-tertiary); font-size: 13px; margin: 4px 0 0; }

.panel {
  background: var(--bg-elevated);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-lg);
  padding: 20px 22px;
  box-shadow: var(--shadow-sm);
}
.panel.danger { border-color: rgba(239, 68, 68, 0.25); }
.panel-head { margin-bottom: 14px; }
.panel-title { font-size: 15px; font-weight: 600; color: var(--text-primary); }
.panel-sub { font-size: 12px; color: var(--text-tertiary); margin-top: 2px; }

.kv { display: flex; flex-direction: column; }
.kv-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 0;
  border-bottom: 1px solid var(--border-base);
  font-size: 13px;
}
.kv-row:last-child { border-bottom: none; }
.kv-k { color: var(--text-tertiary); }
.kv-v { color: var(--text-primary); display: inline-flex; align-items: center; gap: 8px; }
.kv-v.mono { font-family: ui-monospace, SFMono-Regular, "JetBrains Mono", Consolas, monospace; font-size: 12.5px; }
.text-tertiary { color: var(--text-tertiary); }

.badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  font-weight: 600;
}
.badge-ok { background: rgba(16, 185, 129, 0.12); color: var(--success); }
.badge-warn { background: rgba(245, 158, 11, 0.14); color: var(--warning); }

.panel-actions { margin-top: 16px; display: flex; gap: 10px; }

.upd-progress { margin-top: 14px; }
.upd-bar {
  height: 6px;
  background: var(--bg-base);
  border: 1px solid var(--border-base);
  border-radius: 999px;
  overflow: hidden;
}
.upd-fill {
  height: 100%;
  background: var(--brand);
  transition: width 0.18s ease;
}
.upd-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 6px;
  font-variant-numeric: tabular-nums;
}

.danger-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 4px 0;
}
.danger-title { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.danger-desc { font-size: 12px; color: var(--text-tertiary); margin-top: 2px; }
</style>
