<template>
  <!-- 强制更新：全屏阻塞 modal -->
  <transition name="overlay-fade">
    <div v-if="isForceUpdate" class="force-overlay">
      <div
        class="force-card"
        v-motion
        :initial="{ opacity: 0, scale: 0.92 }"
        :enter="{ opacity: 1, scale: 1, transition: { duration: 240 } }"
      >
        <div class="badge-force">
          <Icon icon="ant-design:warning-outlined" />
          <span>强制更新</span>
        </div>
        <h2 class="title">必须更新到 v{{ info?.latest_version }}</h2>
        <p class="subtitle">当前版本 v{{ info?.current_version }} 已不再受支持，请立即升级以继续使用。</p>
        <div class="changelog">
          <div class="changelog-title">更新内容</div>
          <pre class="changelog-body">{{ info?.update_content || '（未填写更新说明）' }}</pre>
        </div>
        <div v-if="phase !== 'idle'" class="progress">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: percent + '%' }" />
          </div>
          <div class="progress-meta">
            <span>{{ phaseText }}</span>
            <span v-if="phase === 'downloading'">{{ percent.toFixed(1) }}% · {{ speedText }}</span>
          </div>
        </div>
        <div class="actions">
          <el-button type="primary" size="large" :loading="phase === 'downloading' || phase === 'installing'" :disabled="phase !== 'idle' && phase !== 'failed'" @click="handleDownload">
            <Icon icon="ant-design:download-outlined" /> &nbsp;{{ primaryBtnText }}
          </el-button>
          <el-button v-if="phase === 'failed'" size="large" plain @click="openInBrowser">浏览器下载</el-button>
        </div>
        <p class="hint">{{ hintText }}</p>
      </div>
    </div>
  </transition>

  <!-- 可选更新：右下角悬浮卡片 -->
  <transition name="slide-up">
    <div v-if="showOptional" class="optional-card"
      v-motion
      :initial="{ opacity: 0, y: 20 }"
      :enter="{ opacity: 1, y: 0, transition: { duration: 220 } }"
    >
      <div class="opt-head">
        <div class="opt-icon">
          <Icon icon="ant-design:star-outlined" />
        </div>
        <div class="opt-text">
          <div class="opt-title">发现新版本 v{{ info?.latest_version }}</div>
          <div class="opt-sub">当前版本 v{{ info?.current_version }}</div>
        </div>
        <button class="opt-close" @click="dismiss" title="稍后提醒">
          <Icon icon="ant-design:close-outlined" />
        </button>
      </div>
      <pre v-if="info?.update_content" class="opt-changelog">{{ info.update_content }}</pre>
      <div v-if="phase !== 'idle'" class="progress">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: percent + '%' }" />
        </div>
        <div class="progress-meta">
          <span>{{ phaseText }}</span>
          <span v-if="phase === 'downloading'">{{ percent.toFixed(1) }}% · {{ speedText }}</span>
        </div>
      </div>
      <div class="opt-actions">
        <el-button size="small" plain :disabled="phase !== 'idle' && phase !== 'failed'" @click="skip">跳过此版本</el-button>
        <el-button size="small" type="primary" :loading="phase === 'downloading' || phase === 'installing'" :disabled="phase !== 'idle' && phase !== 'failed'" @click="handleDownload">{{ primaryBtnText }}</el-button>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { ElMessage } from "element-plus";
import { Icon } from "@iconify/vue";
import {
  updateInfo,
  shouldShowPrompt,
  isForceUpdate,
  skipCurrentVersion,
  dismissPrompt,
  openDownload,
  downloadUpdateInApp,
  installDownloadedUpdate,
  type DownloadProgress,
} from "@/composables/useUpdateCheck";

const info = computed(() => updateInfo.value);
const showOptional = computed(() => shouldShowPrompt.value && !isForceUpdate.value);

// phase: idle → downloading → installing | failed
const phase = ref<"idle" | "downloading" | "installing" | "failed">("idle");
const percent = ref(0);
const speedBps = ref(0);
const errorMsg = ref("");

const phaseText = computed(() => {
  switch (phase.value) {
    case "downloading": return "正在下载更新包…";
    case "installing": return "启动安装器…应用即将退出";
    case "failed": return `下载失败：${errorMsg.value}`;
    default: return "";
  }
});

const primaryBtnText = computed(() => {
  if (phase.value === "downloading") return "下载中";
  if (phase.value === "installing") return "准备安装";
  if (phase.value === "failed") return "重试下载";
  return "一键升级";
});

const hintText = computed(() => {
  if (phase.value === "installing") return "安装器即将启动，应用会自动退出。安装完成后请重新启动。";
  if (phase.value === "failed") return "请检查网络后重试，或使用浏览器下载后手动安装。";
  return "点击一键升级后将自动下载并启动安装器，无需手动操作。";
});

function fmtBytes(n: number): string {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / 1024 / 1024).toFixed(1) + " MB";
}
const speedText = computed(() => fmtBytes(speedBps.value) + "/s");

async function handleDownload() {
  const url = info.value?.update_url;
  if (!url) {
    ElMessage.warning("下载地址为空，请联系管理员");
    return;
  }
  phase.value = "downloading";
  percent.value = 0;
  speedBps.value = 0;
  errorMsg.value = "";
  try {
    const path = await downloadUpdateInApp(url, (p: DownloadProgress) => {
      percent.value = Math.min(100, p.percent || 0);
      speedBps.value = p.speed_bps || 0;
    });
    phase.value = "installing";
    percent.value = 100;
    await installDownloadedUpdate(path);
    // 应用即将 exit，不需要 toast
  } catch (e: any) {
    phase.value = "failed";
    errorMsg.value = String(e?.message || e || "未知错误");
    ElMessage.error("软件内更新失败：" + errorMsg.value);
  }
}

async function openInBrowser() {
  const url = info.value?.update_url;
  if (!url) return;
  try { await openDownload(url); } catch { /* ignored */ }
}

function skip() {
  skipCurrentVersion();
  ElMessage.info("已跳过此版本，下次发布新版本时再提醒");
}

function dismiss() {
  dismissPrompt();
}
</script>

<style scoped>
/* ============== 强制更新阻塞遮罩 ============== */
.force-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: var(--bg-overlay);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.force-card {
  width: 100%;
  max-width: 520px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-xl);
  padding: 36px 36px 28px;
  box-shadow: var(--shadow-lg);
  position: relative;
}

.badge-force {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--danger-soft);
  color: var(--danger);
  font-size: 12px;
  font-weight: 600;
  border-radius: 999px;
  margin-bottom: 18px;
}
.badge-force svg { width: 14px; height: 14px; }

.title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 8px;
  letter-spacing: -0.01em;
}
.subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0 0 24px;
  line-height: 1.6;
}

.changelog {
  background: var(--bg-base);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-md);
  padding: 16px;
  margin-bottom: 24px;
  max-height: 220px;
  overflow-y: auto;
}
.changelog-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 10px;
}
.changelog-body {
  margin: 0;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.65;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

.actions {
  display: flex;
  justify-content: center;
}
.actions .el-button { min-width: 200px; }

.hint {
  text-align: center;
  font-size: 12px;
  color: var(--text-tertiary);
  margin: 16px 0 0;
}

/* ============== 可选更新悬浮卡 ============== */
.optional-card {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 360px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: 16px;
  z-index: 9998;
}

.opt-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.opt-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background: var(--brand);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.opt-icon svg { width: 18px; height: 18px; }

.opt-text { flex: 1; min-width: 0; }
.opt-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.4;
}
.opt-sub {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 2px;
}

.opt-close {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-tertiary);
  padding: 4px;
  border-radius: var(--radius-sm);
  transition: background 0.15s, color 0.15s;
}
.opt-close:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.opt-close svg { width: 16px; height: 16px; }

.opt-changelog {
  margin: 12px 0 0;
  padding: 10px 12px;
  background: var(--bg-base);
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-secondary);
  max-height: 120px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.opt-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

/* ============== 进度条 ============== */
.progress {
  margin: 16px 0 12px;
}
.progress-bar {
  height: 6px;
  background: var(--bg-base);
  border-radius: 999px;
  overflow: hidden;
  border: 1px solid var(--border-base);
}
.progress-fill {
  height: 100%;
  background: var(--brand);
  transition: width 0.18s ease;
}
.progress-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 6px;
  font-variant-numeric: tabular-nums;
}

/* ============== 过渡动画 ============== */
.overlay-fade-enter-active,
.overlay-fade-leave-active { transition: opacity 0.24s ease; }
.overlay-fade-enter-from,
.overlay-fade-leave-to { opacity: 0; }

.slide-up-enter-active,
.slide-up-leave-active { transition: transform 0.24s ease, opacity 0.24s ease; }
.slide-up-enter-from { transform: translateY(20px); opacity: 0; }
.slide-up-leave-to { transform: translateY(20px); opacity: 0; }
</style>
