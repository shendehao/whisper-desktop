<template>
  <div class="admin-page cloud-update">
    <div class="page-header">
      <div>
        <h1 class="page-title">云更新推送</h1>
        <p class="page-sub">向所有桌面客户端发布新版本，下次启动或定时检查时收到通知</p>
      </div>
      <div class="page-actions">
        <el-button :icon="RefreshRight" :loading="loadingStatus" size="small" @click="fetchStatus">刷新状态</el-button>
      </div>
    </div>

    <!-- 当前推送状态卡 -->
    <div v-if="cfg.latest_version" class="status-card" :class="cfg.active ? 'ok' : 'muted'">
      <Icon :icon="cfg.active ? 'ant-design:check-circle-filled' : 'ant-design:info-circle-outlined'" class="status-icon" />
      <div class="status-body">
        <div class="status-title">
          {{ cfg.active ? `当前正在推送 v${cfg.latest_version}` : `上次推送已撤销（v${cfg.latest_version}）` }}
        </div>
        <div class="status-meta">
          <el-tag :type="cfg.force_update ? 'danger' : 'info'" size="small" effect="light">
            {{ cfg.force_update ? '强制更新' : '可选更新' }}
          </el-tag>
          <span v-if="cfg.min_version">最低兼容版本：v{{ cfg.min_version }}</span>
          <span v-if="cfg.pushed_at">推送时间：{{ formatTime(cfg.pushed_at) }}</span>
        </div>
      </div>
      <el-button v-if="cfg.active" type="danger" plain :loading="cancelling" @click="handleCancel">
        <Icon icon="ant-design:stop-outlined" /> 撤销推送
      </el-button>
    </div>
    <div v-else class="status-card info">
      <Icon icon="ant-design:info-circle-outlined" class="status-icon" />
      <div class="status-body">
        <div class="status-title">当前尚未推送任何桌面客户端更新</div>
      </div>
    </div>

    <!-- 推送表单 -->
    <div class="panel">
      <div class="panel-head">
        <div class="panel-title">发布新版本</div>
      </div>

      <el-form label-width="110px" @submit.prevent>
        <!-- 拖拽上传 -->
        <el-form-item label="安装包">
          <div
            class="drop-zone"
            :class="{ active: dragOver, uploading, success: !!form.update_url }"
            @click="handlePickFile"
            @dragover.prevent="dragOver = true"
            @dragleave.prevent="dragOver = false"
            @drop.prevent="handleDrop"
          >
            <input ref="fileInputRef" type="file" hidden accept=".exe,.msi,.dmg,.zip" @change="handleInputChange" />

            <template v-if="!form.update_url && !uploading">
              <Icon icon="ant-design:cloud-upload-outlined" class="dz-icon" />
              <div class="dz-title">拖拽安装包到此处，或点击选择文件</div>
              <div class="dz-sub">支持 .exe / .msi / .dmg / .zip · 最大 200MB</div>
            </template>

            <template v-else-if="uploading">
              <Icon icon="ant-design:loading-outlined" class="dz-icon spin" />
              <div class="dz-title">{{ uploadStatus }}</div>
              <el-progress :percentage="uploadPct" :stroke-width="6" style="width: 80%; margin-top: 12px" />
            </template>

            <template v-else>
              <Icon icon="ant-design:check-circle-filled" class="dz-icon success" />
              <div class="dz-title">{{ uploadedFilename }}</div>
              <div class="dz-sub">{{ uploadedSize }} · SHA256: {{ uploadedSha.slice(0, 16) }}…</div>
              <el-button size="small" plain style="margin-top: 10px" @click.stop="resetUpload">
                <Icon icon="ant-design:reload-outlined" /> 重新选择
              </el-button>
            </template>
          </div>
        </el-form-item>

        <el-form-item label="最新版本号" required>
          <el-input
            v-model="form.latest_version"
            :readonly="versionLocked"
            placeholder="上传安装包后自动从 PE 元数据填充"
          >
            <template #append>
              <el-button @click="versionLocked = !versionLocked">
                <Icon :icon="versionLocked ? 'ant-design:lock-outlined' : 'ant-design:unlock-outlined'" />
              </el-button>
            </template>
          </el-input>
          <div class="form-hint">
            <span v-if="versionBadge" class="version-badge">已从 {{ versionBadge }} 自动读取</span>
            <span v-else>上传后将自动从 PE 元数据读取版本号；如需覆盖请点击右侧锁图标</span>
          </div>
        </el-form-item>

        <el-form-item label="最低兼容版本">
          <el-input v-model="form.min_version" placeholder="可选，如 2.0.0" />
          <div class="form-hint">低于此版本的客户端将被自动判定为强制更新</div>
        </el-form-item>

        <el-form-item label="下载地址" required>
          <el-input v-model="form.update_url" placeholder="上传后自动填充，或粘贴外部链接" />
        </el-form-item>

        <el-form-item label="更新说明">
          <el-input
            v-model="form.update_content"
            type="textarea"
            :rows="5"
            placeholder="1. 修复...&#10;2. 新增...&#10;3. 优化..."
          />
          <div class="form-hint">支持多行文本，将原样显示在客户端的更新对话框中</div>
        </el-form-item>

        <el-form-item label="强制更新">
          <el-switch v-model="form.force_update" active-text="强制" inactive-text="可选" />
          <div class="form-hint">勾选后客户端必须更新才能继续使用，未更新将无法登录</div>
        </el-form-item>

        <el-form-item label-width="0">
          <el-button type="primary" :loading="pushing" @click="handlePush">
            <Icon icon="ant-design:rocket-outlined" /> 推送到所有客户端
          </el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { RefreshRight } from "@element-plus/icons-vue";
import { Icon } from "@iconify/vue";
import {
  getCloudUpdateStatus,
  uploadCloudUpdateInstaller,
  pushCloudUpdate,
  cancelCloudUpdate,
  type CloudUpdateConfig,
} from "@/api/admin";

const cfg = ref<CloudUpdateConfig>({});
const loadingStatus = ref(false);
const pushing = ref(false);
const cancelling = ref(false);

const form = reactive({
  latest_version: "",
  min_version: "",
  update_url: "",
  update_content: "",
  force_update: false,
});

const versionLocked = ref(true);
const versionBadge = ref("");
const fileInputRef = ref<HTMLInputElement | null>(null);
const dragOver = ref(false);

const uploading = ref(false);
const uploadPct = ref(0);
const uploadStatus = ref("");
const uploadedFilename = ref("");
const uploadedSize = ref("");
const uploadedSha = ref("");

function fmtSize(b: number): string {
  if (b < 1024) return b + " B";
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
  return (b / 1024 / 1024).toFixed(2) + " MB";
}

function formatTime(iso?: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

async function fetchStatus() {
  loadingStatus.value = true;
  try {
    const r = await getCloudUpdateStatus();
    cfg.value = r.data.cfg || {};
    if (cfg.value.latest_version && !form.latest_version) {
      form.latest_version = cfg.value.latest_version;
      form.min_version = cfg.value.min_version || "";
      form.update_url = cfg.value.update_url || "";
      form.update_content = cfg.value.update_content || "";
      form.force_update = !!cfg.value.force_update;
    }
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.detail || "获取状态失败");
  } finally {
    loadingStatus.value = false;
  }
}

function handlePickFile() {
  if (uploading.value) return;
  fileInputRef.value?.click();
}

function handleInputChange(e: Event) {
  const files = (e.target as HTMLInputElement).files;
  if (files && files[0]) doUpload(files[0]);
}

function handleDrop(e: DragEvent) {
  dragOver.value = false;
  const files = e.dataTransfer?.files;
  if (files && files[0]) doUpload(files[0]);
}

async function doUpload(file: File) {
  if (file.size > 200 * 1024 * 1024) {
    ElMessage.error("文件超过 200MB 限制");
    return;
  }
  uploading.value = true;
  uploadPct.value = 0;
  uploadStatus.value = `正在上传 ${file.name}...`;
  try {
    const r = await uploadCloudUpdateInstaller(file, (p) => {
      uploadPct.value = p;
      uploadStatus.value = `正在上传 ${file.name}... ${p}%`;
    });
    uploadedFilename.value = r.data.filename;
    uploadedSize.value = fmtSize(r.data.size);
    uploadedSha.value = r.data.sha256;
    form.update_url = r.data.url;
    if (r.data.detected_version) {
      form.latest_version = r.data.detected_version;
      versionLocked.value = true;
      versionBadge.value = r.data.version_source === "pe" ? "PE 元数据" : "文件名";
      ElMessage.success(`上传成功，已自动识别版本 v${r.data.detected_version}`);
    } else {
      versionLocked.value = false;
      versionBadge.value = "";
      ElMessage.warning("上传成功，但未能识别版本号，请手动填写");
    }
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.detail || "上传失败");
  } finally {
    uploading.value = false;
  }
}

function resetUpload() {
  form.update_url = "";
  uploadedFilename.value = "";
  uploadedSize.value = "";
  uploadedSha.value = "";
  versionBadge.value = "";
  if (fileInputRef.value) fileInputRef.value.value = "";
}

async function handlePush() {
  if (!form.latest_version.trim() || !form.update_url.trim()) {
    ElMessage.warning("版本号和下载地址必填");
    return;
  }
  try {
    await ElMessageBox.confirm(
      `确认推送 v${form.latest_version} 到所有桌面客户端？`,
      "确认推送",
      { type: "warning" }
    );
  } catch {
    return;
  }
  pushing.value = true;
  try {
    const r = await pushCloudUpdate({
      latest_version: form.latest_version.trim(),
      update_url: form.update_url.trim(),
      update_content: form.update_content.trim(),
      min_version: form.min_version.trim(),
      force_update: form.force_update,
    });
    cfg.value = r.data.cfg || {};
    ElMessage.success(r.data.message || "已推送");
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.detail || "推送失败");
  } finally {
    pushing.value = false;
  }
}

async function handleCancel() {
  try {
    await ElMessageBox.confirm("撤销后客户端将不再收到此次更新通知，确认继续？", "确认撤销", {
      type: "warning",
    });
  } catch {
    return;
  }
  cancelling.value = true;
  try {
    const r = await cancelCloudUpdate();
    cfg.value = r.data.cfg || {};
    ElMessage.success(r.data.message || "已撤销");
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.detail || "撤销失败");
  } finally {
    cancelling.value = false;
  }
}

onMounted(fetchStatus);
</script>

<style scoped>
.status-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-md);
  margin-bottom: 12px;
}
.status-card.ok { border-color: rgba(35, 195, 67, 0.4); background: rgba(35, 195, 67, 0.05); }
.status-card.muted { border-color: var(--border-base); }
.status-card.info { border-color: rgba(60, 126, 255, 0.3); background: rgba(60, 126, 255, 0.05); }
.status-icon { font-size: 22px; flex-shrink: 0; color: var(--success); }
.status-card.muted .status-icon { color: var(--text-tertiary); }
.status-card.info .status-icon { color: var(--brand); }
.status-body { flex: 1; min-width: 0; }
.status-title { font-weight: 600; color: var(--text-primary); font-size: 14px; }
.status-meta { margin-top: 4px; display: flex; gap: 12px; font-size: 12px; color: var(--text-tertiary); flex-wrap: wrap; align-items: center; }

.panel {
  background: var(--bg-elevated);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-md);
  padding: 16px 20px;
}
.panel-head { margin-bottom: 12px; }
.panel-title { font-size: 13px; font-weight: 600; color: var(--text-primary); }

.drop-zone {
  width: 100%;
  border: 2px dashed var(--border-base);
  border-radius: var(--radius-md);
  background: var(--bg-base);
  padding: 32px 20px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.drop-zone:hover:not(.uploading) { border-color: var(--brand); }
.drop-zone.active { border-color: var(--brand); background: var(--brand-soft); }
.drop-zone.uploading { cursor: wait; }
.drop-zone.success { border-color: var(--success); }
.dz-icon { font-size: 32px; color: var(--text-tertiary); margin-bottom: 8px; }
.dz-icon.success { color: var(--success); }
.dz-icon.spin { animation: spin 1s linear infinite; color: var(--brand); }
.dz-title { font-weight: 600; color: var(--text-primary); font-size: 13px; }
.dz-sub { font-size: 11px; color: var(--text-tertiary); margin-top: 4px; }

.form-hint { font-size: 11px; color: var(--text-tertiary); margin-top: 4px; line-height: 1.5; }
.version-badge {
  display: inline-block;
  padding: 1px 6px;
  background: var(--brand-soft);
  color: var(--brand);
  border-radius: 4px;
  font-size: 11px;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>
