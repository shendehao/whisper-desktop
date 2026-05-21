<template>
  <div class="admin-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">租户管理</h1>
        <p class="page-sub">所有主账号（租户）列表，仅超级管理员可见</p>
      </div>
      <div class="header-actions">
        <el-button :icon="RefreshIcon" :loading="loading" @click="fetch">刷新</el-button>
      </div>
    </div>

    <el-table :data="list" v-loading="loading" border>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="username" label="用户名" min-width="140" />
      <el-table-column prop="is_active" label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.is_active ? 'success' : 'danger'" size="small">
            {{ row.is_active ? '正常' : '已停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="注册时间" min-width="180" />
      <el-table-column prop="last_login" label="最后登录" min-width="180" />
      <el-table-column label="操作" width="280" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="openEdit(row)">编辑</el-button>
          <el-button
            size="small"
            :type="row.is_active ? 'warning' : 'success'"
            @click="toggleActive(row)"
          >
            {{ row.is_active ? '停用' : '启用' }}
          </el-button>
          <el-button size="small" type="danger" @click="openResetPwd(row)">重置密码</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 编辑弹窗 -->
    <el-dialog v-model="editDlg" title="编辑租户信息" width="460px">
      <el-form label-width="80px">
        <el-form-item label="用户名">
          <el-input v-model="editForm.username" placeholder="留空表示不修改" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="editForm.email" placeholder="留空表示不修改" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="editForm.is_active" active-text="启用" inactive-text="停用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDlg = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 重置密码弹窗 -->
    <el-dialog v-model="pwdDlg" title="重置密码" width="420px">
      <el-form label-width="80px">
        <el-form-item label="目标账号">
          <el-input :model-value="pwdForm.username" disabled />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input
            v-model="pwdForm.password"
            type="password"
            show-password
            placeholder="至少 6 位"
            @keydown.enter.prevent="handleResetPwd"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pwdDlg = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleResetPwd">确认重置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { Refresh as RefreshIcon } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { getUsers, updateUser, resetUserPassword, type UserItem } from "@/api/admin";

const list = ref<UserItem[]>([]);
const loading = ref(false);
const submitting = ref(false);

const editDlg = ref(false);
const editForm = reactive<{ id: number; username: string; email: string; is_active: boolean }>({
  id: 0,
  username: "",
  email: "",
  is_active: true,
});

const pwdDlg = ref(false);
const pwdForm = reactive<{ id: number; username: string; password: string }>({
  id: 0,
  username: "",
  password: "",
});

async function fetch() {
  loading.value = true;
  try {
    list.value = (await getUsers()).data;
  } catch {
    ElMessage.error("获取用户列表失败");
  } finally {
    loading.value = false;
  }
}

function openEdit(row: UserItem) {
  editForm.id = row.id;
  editForm.username = row.username || "";
  editForm.email = "";
  editForm.is_active = !!row.is_active;
  editDlg.value = true;
}

async function handleEdit() {
  submitting.value = true;
  try {
    const payload: Record<string, unknown> = { is_active: editForm.is_active };
    const trimmedName = (editForm.username || "").trim();
    const trimmedEmail = (editForm.email || "").trim();
    if (trimmedName) payload.username = trimmedName;
    if (trimmedEmail) payload.email = trimmedEmail;
    await updateUser(editForm.id, payload);
    ElMessage.success("已保存");
    editDlg.value = false;
    fetch();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.detail || "保存失败");
  } finally {
    submitting.value = false;
  }
}

async function toggleActive(row: UserItem) {
  const next = !row.is_active;
  try {
    if (!next) {
      await ElMessageBox.confirm(`确定停用租户「${row.username}」？停用后他将无法登录。`, "确认操作", {
        type: "warning",
      });
    }
  } catch {
    return;
  }
  try {
    await updateUser(row.id, { is_active: next });
    row.is_active = next;
    ElMessage.success(next ? "已启用" : "已停用");
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.detail || "操作失败");
  }
}

function openResetPwd(row: UserItem) {
  pwdForm.id = row.id;
  pwdForm.username = row.username;
  pwdForm.password = "";
  pwdDlg.value = true;
}

async function handleResetPwd() {
  if (!pwdForm.password || pwdForm.password.length < 6) {
    ElMessage.warning("密码至少 6 位");
    return;
  }
  submitting.value = true;
  try {
    await resetUserPassword(pwdForm.id, pwdForm.password);
    ElMessage.success("已重置密码");
    pwdDlg.value = false;
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.detail || "重置失败");
  } finally {
    submitting.value = false;
  }
}

onMounted(fetch);
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 14px;
}
</style>
