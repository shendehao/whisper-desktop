<template>
  <div class="admin-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">云变量</h1>
        <p class="page-sub">动态下发到客户端的运行时变量，按实例隔离</p>
      </div>
      <div class="page-actions">
        <el-button type="primary" @click="openCreate">新增变量</el-button>
      </div>
    </div>
    <el-form :inline="true" class="mb-4">
      <el-form-item label="软件">
        <el-select v-model="filterSwId" placeholder="全部" clearable @change="fetch" style="width: 220px">
          <el-option v-for="sw in swList" :key="sw.id" :label="sw.name" :value="sw.id" />
        </el-select>
      </el-form-item>
    </el-form>
    <el-table :data="list" v-loading="loading" border>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="key" label="Key" min-width="150" />
      <el-table-column prop="value" label="Value" min-width="200" show-overflow-tooltip />
      <el-table-column label="所属软件" min-width="140">
        <template #default="{ row }">
          {{ swNameById(row.software_id) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160">
        <template #default="{ row }">
          <el-button size="small" @click="openEdit(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-dialog v-model="dlgVisible" :title="isEdit ? '编辑变量' : '新增变量'" width="460px" @opened="focusFirst">
      <el-form label-width="80px" @submit.prevent="handleSubmit">
        <el-form-item label="软件" v-if="!isEdit">
          <el-select v-model="form.software_id" placeholder="选择软件" style="width: 100%">
            <el-option v-for="sw in swList" :key="sw.id" :label="sw.name" :value="sw.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="Key">
          <el-input ref="keyInput" v-model="form.key" @keydown.enter.prevent="handleSubmit" />
        </el-form-item>
        <el-form-item label="Value">
          <el-input v-model="form.value" type="textarea" :rows="3" />
        </el-form-item>
        <button type="submit" style="display:none" />
      </el-form>
      <template #footer>
        <el-button @click="dlgVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick } from "vue";
import { getSoftwareList, getCloudVars, createCloudVar, updateCloudVar, deleteCloudVar, type SoftwareItem, type CloudVarItem } from "@/api/admin";
import { ElMessage, ElMessageBox, type InputInstance } from "element-plus";

const keyInput = ref<InputInstance | null>(null);
function focusFirst() { nextTick(() => keyInput.value?.focus()); }

const swList = ref<SoftwareItem[]>([]);
const list = ref<CloudVarItem[]>([]);
const loading = ref(false);
const filterSwId = ref<number | undefined>(undefined);
const dlgVisible = ref(false);
const isEdit = ref(false);
const editId = ref(0);
const submitting = ref(false);
const form = reactive({ software_id: 0, key: "", value: "" });

async function fetch() {
  loading.value = true;
  try {
    const res = await getCloudVars(filterSwId.value);
    list.value = res.data;
  } catch { ElMessage.error("获取云变量失败"); }
  finally { loading.value = false; }
}
async function loadSw() {
  try { swList.value = (await getSoftwareList()).data; }
  catch { ElMessage.error("加载软件列表失败"); }
}

function swNameById(id: number): string {
  const sw = swList.value.find((s) => s.id === id);
  return sw ? sw.name : `#${id}`;
}

function openCreate() { isEdit.value = false; form.software_id = swList.value[0]?.id || 0; form.key = ""; form.value = ""; dlgVisible.value = true; }
function openEdit(row: CloudVarItem) { isEdit.value = true; editId.value = row.id; form.key = row.key; form.value = row.value; form.software_id = row.software_id; dlgVisible.value = true; }

async function handleSubmit() {
  if (!form.key.trim()) { ElMessage.warning("Key 不能为空"); return; }
  submitting.value = true;
  try {
    if (isEdit.value) { await updateCloudVar(editId.value, { key: form.key, value: form.value }); }
    else { await createCloudVar({ software_id: form.software_id, key: form.key, value: form.value }); }
    ElMessage.success("操作成功"); dlgVisible.value = false; fetch();
  } catch (e: any) { ElMessage.error(e?.response?.data?.detail || "操作失败"); }
  finally { submitting.value = false; }
}

async function handleDelete(row: CloudVarItem) {
  try { await ElMessageBox.confirm(`删除变量「${row.key}」？`, "确认"); } catch { return; }
  try { await deleteCloudVar(row.id); ElMessage.success("已删除"); fetch(); }
  catch (e: any) { ElMessage.error(e?.response?.data?.detail || "删除失败"); }
}

onMounted(() => { loadSw(); fetch(); });
</script>
