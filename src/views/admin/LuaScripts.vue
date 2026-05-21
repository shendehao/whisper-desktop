<template>
  <div class="admin-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">文件下发（Lua 脚本）</h1>
        <p class="page-sub">管理云端脚本版本，客户端 SDK 按版本号拉取并校验 SHA256</p>
      </div>
      <div class="page-actions">
        <el-button :icon="RefreshRight" :loading="loading" size="small" @click="fetchList">刷新</el-button>
        <el-button type="primary" :disabled="!selectedSwId" @click="openUpload">
          <Icon icon="ant-design:cloud-upload-outlined" /> 上传新版本
        </el-button>
      </div>
    </div>

    <div class="filter-bar">
      <span class="lbl">所属实例</span>
      <el-select
        v-model="selectedSwId"
        filterable
        :placeholder="softwareList.length ? '选择一个文件下发模式的实例' : '当前租户没有 file_distribution 实例'"
        :disabled="!softwareList.length"
        style="min-width: 320px"
        @change="fetchList"
      >
        <el-option
          v-for="sw in softwareList"
          :key="sw.id"
          :value="sw.id"
          :label="`${sw.name}（${sw.instance_id}）`"
        />
      </el-select>
      <span v-if="!softwareList.length" class="empty-tip">先在「实例管理」里把某个实例的 strategy 设为 file_distribution</span>
    </div>

    <el-table :data="list" v-loading="loading" border>
      <el-table-column prop="version" label="版本" width="110">
        <template #default="{ row }">
          <span class="version-tag">v{{ row.version }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
      <el-table-column label="文件" min-width="240">
        <template #default="{ row }">
          <a v-if="row.file_url" :href="resolveUrl(row.file_url)" target="_blank" rel="noopener" class="file-link">
            {{ extractName(row.file_url) }}
          </a>
          <span v-else class="text-tertiary">—</span>
        </template>
      </el-table-column>
      <el-table-column prop="checksum" label="SHA256" width="150">
        <template #default="{ row }">
          <span class="hash-cell" :title="row.checksum">{{ (row.checksum || '').slice(0, 12) }}…</span>
        </template>
      </el-table-column>
      <el-table-column prop="is_force_update" label="强制" width="80">
        <template #default="{ row }">
          <el-tag v-if="row.is_force_update" type="danger" size="small">强制</el-tag>
          <span v-else class="text-tertiary">—</span>
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="上传时间" width="170">
        <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="openReplace(row)">覆盖</el-button>
          <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 上传新版本 -->
    <el-dialog v-model="uploadDlg" title="上传新版本" width="500px">
      <el-form label-width="80px">
        <el-form-item label="版本号">
          <el-input v-model="uploadForm.version" placeholder="留空将自动取最大数字版本 + 1" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="uploadForm.description" placeholder="可选，最多 255 字" maxlength="255" />
        </el-form-item>
        <el-form-item label="强制更新">
          <el-switch v-model="uploadForm.is_force_update" />
        </el-form-item>
        <el-form-item label="文件">
          <input ref="uploadFileRef" type="file" accept=".lua,.txt,.json,.conf,.ini" @change="onUploadFileChange" />
          <div class="form-hint">5MB 上限，扩展名限：.lua / .txt / .json / .conf / .ini</div>
        </el-form-item>
        <el-progress v-if="uploadPct > 0" :percentage="uploadPct" :stroke-width="6" />
      </el-form>
      <template #footer>
        <el-button @click="uploadDlg = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleUpload">上传</el-button>
      </template>
    </el-dialog>

    <!-- 覆盖现有版本 -->
    <el-dialog v-model="replaceDlg" :title="`覆盖 v${replaceTarget?.version || ''}`" width="500px">
      <el-form label-width="80px">
        <el-form-item label="描述">
          <el-input v-model="replaceForm.description" placeholder="可选" maxlength="255" />
        </el-form-item>
        <el-form-item label="强制更新">
          <el-switch v-model="replaceForm.is_force_update" />
        </el-form-item>
        <el-form-item label="新文件">
          <input ref="replaceFileRef" type="file" accept=".lua,.txt,.json,.conf,.ini" @change="onReplaceFileChange" />
          <div class="form-hint">不选文件则只更新描述/强制标志</div>
        </el-form-item>
        <el-progress v-if="uploadPct > 0" :percentage="uploadPct" :stroke-width="6" />
      </el-form>
      <template #footer>
        <el-button @click="replaceDlg = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleReplace">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { RefreshRight } from "@element-plus/icons-vue";
import { Icon } from "@iconify/vue";
import {
  getFileDistributionSoftware,
  listLuaScripts,
  uploadLuaScript,
  replaceLuaScript,
  deleteLuaScript,
  type FileDistributionSoftwareItem,
  type LuaScriptItem,
} from "@/api/admin";

const softwareList = ref<FileDistributionSoftwareItem[]>([]);
const selectedSwId = ref<number | null>(null);
const list = ref<LuaScriptItem[]>([]);
const loading = ref(false);
const submitting = ref(false);
const uploadPct = ref(0);

const uploadDlg = ref(false);
const replaceDlg = ref(false);
const uploadFileRef = ref<HTMLInputElement | null>(null);
const replaceFileRef = ref<HTMLInputElement | null>(null);
const uploadFile = ref<File | null>(null);
const replaceFile = ref<File | null>(null);
const replaceTarget = ref<LuaScriptItem | null>(null);

const uploadForm = reactive({
  version: "",
  description: "",
  is_force_update: false,
});
const replaceForm = reactive({
  description: "",
  is_force_update: false,
});

function resolveUrl(url: string): string {
  if (!url) return "#";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base = (localStorage.getItem("whisper_server_url") || (import.meta as any).env?.VITE_API_BASE || "").replace(/\/$/, "");
  return base + url;
}

function extractName(url: string): string {
  if (!url) return "";
  try {
    const p = url.split("?")[0];
    return p.substring(p.lastIndexOf("/") + 1) || url;
  } catch {
    return url;
  }
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleString();
  } catch {
    return iso;
  }
}

async function loadSoftware() {
  try {
    const r = await getFileDistributionSoftware();
    softwareList.value = r.data;
    if (r.data.length && selectedSwId.value === null) {
      selectedSwId.value = r.data[0].id;
      await fetchList();
    }
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.detail || "获取实例列表失败");
  }
}

async function fetchList() {
  if (!selectedSwId.value) {
    list.value = [];
    return;
  }
  loading.value = true;
  try {
    const r = await listLuaScripts(selectedSwId.value);
    list.value = r.data;
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.detail || "获取版本列表失败");
  } finally {
    loading.value = false;
  }
}

function openUpload() {
  if (!selectedSwId.value) return;
  uploadForm.version = "";
  uploadForm.description = "";
  uploadForm.is_force_update = false;
  uploadFile.value = null;
  uploadPct.value = 0;
  if (uploadFileRef.value) uploadFileRef.value.value = "";
  uploadDlg.value = true;
}

function onUploadFileChange(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0];
  uploadFile.value = f || null;
}

async function handleUpload() {
  if (!selectedSwId.value || !uploadFile.value) {
    ElMessage.warning("请选择文件");
    return;
  }
  submitting.value = true;
  try {
    await uploadLuaScript(
      {
        software_id: selectedSwId.value,
        version: uploadForm.version.trim() || undefined,
        description: uploadForm.description.trim() || undefined,
        is_force_update: uploadForm.is_force_update,
      },
      uploadFile.value,
      (p) => (uploadPct.value = p)
    );
    ElMessage.success("上传成功");
    uploadDlg.value = false;
    fetchList();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.detail || "上传失败");
  } finally {
    submitting.value = false;
  }
}

function openReplace(row: LuaScriptItem) {
  replaceTarget.value = row;
  replaceForm.description = row.description || "";
  replaceForm.is_force_update = !!row.is_force_update;
  replaceFile.value = null;
  uploadPct.value = 0;
  if (replaceFileRef.value) replaceFileRef.value.value = "";
  replaceDlg.value = true;
}

function onReplaceFileChange(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0];
  replaceFile.value = f || null;
}

async function handleReplace() {
  if (!replaceTarget.value) return;
  submitting.value = true;
  try {
    await replaceLuaScript(
      replaceTarget.value.id,
      {
        description: replaceForm.description.trim(),
        is_force_update: replaceForm.is_force_update,
      },
      replaceFile.value || undefined,
      (p) => (uploadPct.value = p)
    );
    ElMessage.success("已保存");
    replaceDlg.value = false;
    fetchList();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.detail || "保存失败");
  } finally {
    submitting.value = false;
  }
}

async function handleDelete(row: LuaScriptItem) {
  try {
    await ElMessageBox.confirm(`确定删除版本 v${row.version}？此操作不可恢复。`, "危险操作", {
      type: "warning",
    });
  } catch {
    return;
  }
  try {
    await deleteLuaScript(row.id);
    ElMessage.success("已删除");
    fetchList();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.detail || "删除失败");
  }
}

onMounted(loadSoftware);
</script>

<style scoped>
.filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.filter-bar .lbl { font-size: 12px; color: var(--text-secondary); }
.empty-tip { font-size: 12px; color: var(--text-tertiary); }

.version-tag {
  display: inline-block;
  padding: 2px 8px;
  background: var(--brand-soft);
  color: var(--brand);
  border-radius: 4px;
  font-weight: 600;
  font-size: 12px;
}
.file-link {
  color: var(--brand);
  text-decoration: none;
  font-size: 12px;
}
.file-link:hover { text-decoration: underline; }
.hash-cell { font-family: monospace; font-size: 12px; color: var(--text-tertiary); }
.text-tertiary { color: var(--text-tertiary); }
.form-hint { font-size: 11px; color: var(--text-tertiary); margin-top: 4px; }
</style>
