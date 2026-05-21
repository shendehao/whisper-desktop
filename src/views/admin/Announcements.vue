<template>
  <div class="admin-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">公告管理</h1>
        <p class="page-sub">客户端登录或运行时拉取的公告，按实例区分</p>
      </div>
      <div class="page-actions">
        <el-button type="primary" @click="openCreate">新建公告</el-button>
      </div>
    </div>
    <el-table :data="list" v-loading="loading" border>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="title" label="标题" min-width="180" />
      <el-table-column prop="is_active" label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.is_active ? 'success' : 'info'" size="small">{{ row.is_active ? '启用' : '禁用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="所属软件" min-width="140">
        <template #default="{ row }">
          {{ row.software_id ? swNameById(row.software_id) : '全局' }}
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="创建时间" width="180" />
      <el-table-column label="操作" width="200">
        <template #default="{ row }">
          <el-button size="small" @click="openEdit(row)">编辑</el-button>
          <el-button size="small" :type="row.is_active ? 'warning' : 'success'" @click="toggleActive(row)">{{ row.is_active ? '禁用' : '启用' }}</el-button>
          <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-dialog v-model="dlgVisible" :title="isEdit ? '编辑公告' : '新建公告'" width="560px" @opened="focusFirst">
      <el-form label-width="80px" @submit.prevent="handleSubmit">
        <el-form-item label="标题">
          <el-input ref="titleInput" v-model="form.title" @keydown.enter.prevent="handleSubmit" />
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="form.content" type="textarea" :rows="5" />
        </el-form-item>
        <el-form-item label="软件" v-if="!isEdit">
          <el-select v-model="form.software_id" placeholder="全局公告" clearable style="width: 100%">
            <el-option v-for="sw in swList" :key="sw.id" :label="sw.name" :value="sw.id" />
          </el-select>
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
import { getSoftwareList, getAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement, type SoftwareItem, type AnnouncementItem } from "@/api/admin";
import { ElMessage, ElMessageBox, type InputInstance } from "element-plus";

const titleInput = ref<InputInstance | null>(null);
function focusFirst() { nextTick(() => titleInput.value?.focus()); }

const swList = ref<SoftwareItem[]>([]);
const list = ref<AnnouncementItem[]>([]);
const loading = ref(false);
const dlgVisible = ref(false);
const isEdit = ref(false);
const editId = ref(0);
const submitting = ref(false);
const form = reactive({ title: "", content: "", software_id: undefined as number | undefined });

async function fetch() {
  loading.value = true;
  try { list.value = (await getAnnouncements()).data; }
  catch { ElMessage.error("获取公告失败"); }
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

function openCreate() { isEdit.value = false; form.title = ""; form.content = ""; form.software_id = undefined; dlgVisible.value = true; }
function openEdit(row: AnnouncementItem) { isEdit.value = true; editId.value = row.id; form.title = row.title; form.content = row.content; dlgVisible.value = true; }

async function handleSubmit() {
  if (!form.title.trim()) { ElMessage.warning("标题不能为空"); return; }
  submitting.value = true;
  try {
    if (isEdit.value) { await updateAnnouncement(editId.value, { title: form.title, content: form.content }); }
    else { await createAnnouncement({ title: form.title, content: form.content, software_id: form.software_id }); }
    ElMessage.success("操作成功"); dlgVisible.value = false; fetch();
  } catch (e: any) { ElMessage.error(e?.response?.data?.detail || "操作失败"); }
  finally { submitting.value = false; }
}

async function toggleActive(row: AnnouncementItem) {
  try { await updateAnnouncement(row.id, { is_active: !row.is_active }); row.is_active = !row.is_active; ElMessage.success("已更新"); }
  catch (e: any) { ElMessage.error(e?.response?.data?.detail || "操作失败"); }
}

async function handleDelete(row: AnnouncementItem) {
  try { await ElMessageBox.confirm(`删除公告「${row.title}」？`, "确认"); } catch { return; }
  try { await deleteAnnouncement(row.id); ElMessage.success("已删除"); fetch(); }
  catch (e: any) { ElMessage.error(e?.response?.data?.detail || "删除失败"); }
}

onMounted(() => { loadSw(); fetch(); });
</script>
