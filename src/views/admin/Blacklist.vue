<template>
  <div class="admin-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">我的黑名单</h1>
        <p class="page-sub">租户级 IP / 硬件码黑名单，仅作用于当前租户名下实例</p>
      </div>
      <div class="page-actions">
        <el-button type="primary" @click="dlgVisible = true">添加</el-button>
      </div>
    </div>
    <el-table :data="list" v-loading="loading" border>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="type" label="类型" width="90">
        <template #default="{ row }">
          <el-tag size="small">{{ row.type === 'hwid' ? '硬件码' : 'IP' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="value" label="值" min-width="200" show-overflow-tooltip />
      <el-table-column prop="reason" label="原因" min-width="150" />
      <el-table-column prop="created_at" label="添加时间" width="180" />
      <el-table-column label="操作" width="100">
        <template #default="{ row }">
          <el-button size="small" type="danger" @click="handleDelete(row)">移除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-dialog v-model="dlgVisible" title="添加黑名单" width="420px" @opened="focusFirst">
      <el-form label-width="70px" @submit.prevent="handleAdd">
        <el-form-item label="类型">
          <el-radio-group v-model="form.type">
            <el-radio value="hwid">硬件码</el-radio>
            <el-radio value="ip">IP</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="值">
          <el-input ref="valueInput" v-model="form.value" placeholder="HWID 或 IP 地址" @keydown.enter.prevent="handleAdd" />
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
import { getBlacklist, createBlacklist, deleteBlacklist, type BlacklistItem } from "@/api/admin";
import { ElMessage, ElMessageBox, type InputInstance } from "element-plus";

const valueInput = ref<InputInstance | null>(null);
function focusFirst() { nextTick(() => valueInput.value?.focus()); }

const list = ref<BlacklistItem[]>([]);
const loading = ref(false);
const dlgVisible = ref(false);
const submitting = ref(false);
const form = reactive({ type: "hwid" as "hwid" | "ip", value: "", reason: "" });

async function fetch() {
  loading.value = true;
  try { list.value = (await getBlacklist()).data; }
  catch { ElMessage.error("获取黑名单失败"); }
  finally { loading.value = false; }
}

async function handleAdd() {
  if (!form.value.trim()) { ElMessage.warning("值不能为空"); return; }
  submitting.value = true;
  try {
    await createBlacklist({ type: form.type, value: form.value, reason: form.reason || undefined });
    ElMessage.success("添加成功"); dlgVisible.value = false; form.value = ""; form.reason = ""; fetch();
  } catch (e: any) { ElMessage.error(e?.response?.data?.detail || "添加失败"); }
  finally { submitting.value = false; }
}

async function handleDelete(row: BlacklistItem) {
  try { await ElMessageBox.confirm(`移除「${row.value}」？`, "确认"); } catch { return; }
  try { await deleteBlacklist(row.id); ElMessage.success("已移除"); fetch(); }
  catch (e: any) { ElMessage.error(e?.response?.data?.detail || "操作失败"); }
}

onMounted(fetch);
</script>
