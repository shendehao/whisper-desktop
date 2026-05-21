<template>
  <div class="admin-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">实例管理</h1>
        <p class="page-sub">按 owner_id 隔离的实例（软件）资源</p>
      </div>
      <div class="page-actions">
        <el-button type="primary" @click="openCreate">新建实例</el-button>
      </div>
    </div>

    <el-table :data="list" v-loading="loading" border>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="name" label="名称" min-width="120" />
      <el-table-column prop="instance_id" label="实例ID" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">
          <span class="font-mono">{{ row.instance_id }}</span>
          <el-button size="small" link @click="copyText(row.instance_id)" title="复制">
            <el-icon><DocumentCopy /></el-icon>
          </el-button>
        </template>
      </el-table-column>
      <el-table-column prop="version" label="版本" width="80" />
      <el-table-column prop="access_count" label="访问次数" width="90" />
      <el-table-column prop="strategy" label="实例类型" width="120">
        <template #default="{ row }">
          {{ row.strategy === 'file_distribution' ? '下发文件专用' : '通用验证' }}
        </template>
      </el-table-column>
      <el-table-column label="签名密钥" min-width="180">
        <template #default="{ row }">
          <template v-if="row.secret_key">
            <span class="font-mono">{{ secretVisible[row.id] ? row.secret_key : '••••••••' }}</span>
            <el-button size="small" link @click="secretVisible[row.id] = !secretVisible[row.id]" :title="secretVisible[row.id] ? '隐藏' : '显示'">
              <el-icon><View v-if="!secretVisible[row.id]" /><Hide v-else /></el-icon>
            </el-button>
            <el-button size="small" link @click="copyText(row.secret_key)" title="复制">
              <el-icon><DocumentCopy /></el-icon>
            </el-button>
          </template>
          <span v-else class="text-gray-400">-</span>
        </template>
      </el-table-column>
      <el-table-column prop="encrypt_enabled" label="加密" width="70" align="center">
        <template #default="{ row }">
          <span :style="{ color: row.encrypt_enabled ? '#67c23a' : '#909399' }">{{ row.encrypt_enabled ? '✓' : '✗' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="openEdit(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 新建/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑实例' : '新建实例'" width="520px" @opened="focusFirst">
      <el-form label-width="90px" @submit.prevent="handleSubmit">
        <el-form-item label="名称">
          <el-input ref="nameInput" v-model="form.name" placeholder="软件名称" @keydown.enter.prevent="handleSubmit" />
        </el-form-item>
        <el-form-item label="版本">
          <el-input v-model="form.version" placeholder="1.0.0" @keydown.enter.prevent="handleSubmit" />
        </el-form-item>
        <el-form-item label="策略">
          <el-select v-model="form.strategy" style="width: 100%">
            <el-option label="通用验证" value="general" />
            <el-option label="文件下发" value="file_distribution" />
          </el-select>
        </el-form-item>
        <el-form-item label="加密">
          <el-switch v-model="form.encrypt_enabled" />
        </el-form-item>
        <el-form-item label="加密密钥" v-if="form.encrypt_enabled">
          <el-input v-model="form.encrypt_key" placeholder="64 位十六进制字符串 (AES-256)" @keydown.enter.prevent="handleSubmit">
            <template #append>
              <el-button @click="generateEncryptKey">随机生成</el-button>
            </template>
          </el-input>
          <span class="text-gray-400 text-xs">必须是 64 个十六进制字符（0-9, a-f），与 C++ stub 一致</span>
        </el-form-item>
        <button type="submit" style="display:none" />
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <!-- 新建成功弹窗 -->
    <el-dialog v-model="showCreatedDialog" title="实例创建成功" width="520px">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="实例ID">
          <span class="font-mono">{{ createdInfo.instance_id }}</span>
          <el-button size="small" link @click="copyText(createdInfo.instance_id)">
            <el-icon><DocumentCopy /></el-icon>
          </el-button>
        </el-descriptions-item>
        <el-descriptions-item label="签名密钥">
          <span class="font-mono">{{ createdInfo.secret_key }}</span>
          <el-button size="small" link @click="copyText(createdInfo.secret_key)">
            <el-icon><DocumentCopy /></el-icon>
          </el-button>
        </el-descriptions-item>
      </el-descriptions>
      <p class="text-gray-500 text-sm mt-2">请妥善保存签名密钥，用于 C++ Stub 加壳对接。</p>
      <template #footer>
        <el-button type="primary" @click="showCreatedDialog = false">我已保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick } from "vue";
import { getSoftwareList, createSoftware, updateSoftware, deleteSoftware, type SoftwareItem } from "@/api/admin";
import { ElMessage, ElMessageBox, type InputInstance } from "element-plus";
import { DocumentCopy, View, Hide } from "@element-plus/icons-vue";

const nameInput = ref<InputInstance | null>(null);
function focusFirst() { nextTick(() => nameInput.value?.focus()); }

const list = ref<SoftwareItem[]>([]);
const loading = ref(false);
const dialogVisible = ref(false);
const isEdit = ref(false);
const editId = ref(0);
const submitting = ref(false);
const form = reactive({ name: "", version: "1.0.0", strategy: "general", encrypt_enabled: false, encrypt_key: "" });
const secretVisible = reactive<Record<number, boolean>>({});

const showCreatedDialog = ref(false);
const createdInfo = reactive({ instance_id: "", secret_key: "" });

async function fetch() {
  loading.value = true;
  try {
    const res = await getSoftwareList();
    list.value = res.data;
  } catch {
    ElMessage.error("获取列表失败");
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  isEdit.value = false;
  form.name = ""; form.version = "1.0.0"; form.strategy = "general"; form.encrypt_enabled = false; form.encrypt_key = "";
  dialogVisible.value = true;
}

function openEdit(row: SoftwareItem) {
  isEdit.value = true;
  editId.value = row.id;
  form.name = row.name;
  form.version = row.version;
  form.strategy = row.strategy || "general";
  form.encrypt_enabled = row.encrypt_enabled ?? false;
  form.encrypt_key = row.encrypt_key || "";
  dialogVisible.value = true;
}

async function handleSubmit() {
  if (!form.name.trim()) { ElMessage.warning("名称不能为空"); return; }
  if (form.encrypt_enabled && !form.encrypt_key.trim()) { ElMessage.warning("开启加密时必须填写加密密钥"); return; }
  submitting.value = true;
  try {
    const payload: any = {
      name: form.name, version: form.version, strategy: form.strategy,
      encrypt_enabled: form.encrypt_enabled,
    };
    if (form.encrypt_enabled) payload.encrypt_key = form.encrypt_key;
    if (isEdit.value) {
      await updateSoftware(editId.value, payload);
      ElMessage.success("更新成功");
    } else {
      const res = await createSoftware(payload);
      createdInfo.instance_id = res.data.instance_id || "";
      createdInfo.secret_key = res.data.secret_key || "";
      showCreatedDialog.value = true;
      ElMessage.success("创建成功");
    }
    dialogVisible.value = false;
    fetch();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.detail || "操作失败");
  } finally {
    submitting.value = false;
  }
}

async function handleDelete(row: SoftwareItem) {
  try { await ElMessageBox.confirm(`确定删除「${row.name}」？此操作将删除所有关联的卡密和数据！`, "危险操作", { type: "warning" }); } catch { return; }
  try {
    await deleteSoftware(row.id);
    ElMessage.success("已删除");
    fetch();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.detail || "删除失败");
  }
}

function copyText(text: string) {
  navigator.clipboard.writeText(text);
  ElMessage.success("已复制到剪贴板");
}

function generateEncryptKey() {
  // 用 crypto.getRandomValues 生成 32 字节 (256-bit) 随机数据并转为 64 位 hex
  const bytes = new Uint8Array(32);
  (window.crypto || (window as any).msCrypto).getRandomValues(bytes);
  form.encrypt_key = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  ElMessage.success("已生成 64 位随机密钥");
}

onMounted(fetch);
</script>

<style scoped>
.font-mono { font-family: 'Courier New', Courier, monospace; }
</style>
