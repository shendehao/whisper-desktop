<template>
  <div class="admin-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">设备黑名单</h1>
        <p class="page-sub">平台级设备指纹封禁，对所有租户生效（仅超级管理员）</p>
      </div>
      <div class="page-actions">
        <el-button type="primary" @click="dlgVisible = true">添加</el-button>
      </div>
    </div>
    <el-table :data="list" v-loading="loading" border>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="device_fp" label="设备指纹" min-width="220" show-overflow-tooltip />
      <el-table-column prop="reason" label="原因" min-width="150" />
      <el-table-column prop="is_active" label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.is_active ? 'danger' : 'info'" size="small">{{ row.is_active ? '生效' : '失效' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="添加时间" width="180" />
      <el-table-column label="操作" width="100">
        <template #default="{ row }">
          <el-button size="small" type="danger" @click="handleDelete(row)">移除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-dialog v-model="dlgVisible" title="添加设备黑名单" width="420px" @opened="focusFirst">
      <el-form label-width="80px" @submit.prevent="handleAdd">
        <el-form-item label="设备指纹">
          <el-input ref="fpInput" v-model="form.device_fp" placeholder="设备指纹哈希" @keydown.enter.prevent="handleAdd" />
        </el-form-item>
        <el-form-item label="原因">
          <el-input v-model="form.reason" placeholder="可选" @keydown.enter.prevent="handleAdd" />
        </el-form-item>
        <button type="submit" style="display:none" />
      </el-form>
      <template #footer>
        <el-button @click="dlgVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleAdd">添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick } from "vue";
import { getDeviceBlacklist, createDeviceBlacklist, deleteDeviceBlacklist, type DeviceBlacklistItem } from "@/api/admin";
import { ElMessage, ElMessageBox, type InputInstance } from "element-plus";

const fpInput = ref<InputInstance | null>(null);
function focusFirst() { nextTick(() => fpInput.value?.focus()); }

const list = ref<DeviceBlacklistItem[]>([]);
const loading = ref(false);
const dlgVisible = ref(false);
const submitting = ref(false);
const form = reactive({ device_fp: "", reason: "" });

async function fetch() {
  loading.value = true;
  try { list.value = (await getDeviceBlacklist()).data; }
  catch { ElMessage.error("获取设备黑名单失败"); }
  finally { loading.value = false; }
}

async function handleAdd() {
  if (!form.device_fp.trim()) { ElMessage.warning("设备指纹不能为空"); return; }
  submitting.value = true;
  try {
    await createDeviceBlacklist({ device_fp: form.device_fp, reason: form.reason || undefined });
    ElMessage.success("添加成功"); dlgVisible.value = false; form.device_fp = ""; form.reason = ""; fetch();
  } catch (e: any) { ElMessage.error(e?.response?.data?.detail || "添加失败"); }
  finally { submitting.value = false; }
}

async function handleDelete(row: DeviceBlacklistItem) {
  try { await ElMessageBox.confirm(`移除设备「${row.device_fp.slice(0, 16)}...」？`, "确认"); } catch { return; }
  try { await deleteDeviceBlacklist(row.id); ElMessage.success("已移除"); fetch(); }
  catch (e: any) { ElMessage.error(e?.response?.data?.detail || "操作失败"); }
}

onMounted(fetch);
</script>
