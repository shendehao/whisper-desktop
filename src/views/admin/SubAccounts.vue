<template>
  <div class="admin-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">子账号</h1>
        <p class="page-sub">当前租户名下的协作账号及其细粒度权限</p>
      </div>
      <div class="page-actions">
        <el-button type="primary" @click="openCreate">创建子账号</el-button>
      </div>
    </div>
    <el-table :data="list" v-loading="loading" border>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="username" label="用户名" min-width="140" />
      <el-table-column prop="is_active" label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.is_active ? 'success' : 'danger'" size="small">{{ row.is_active ? '正常' : '禁用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="permissions" label="权限" min-width="200">
        <template #default="{ row }">
          <span class="text-xs">{{ parsePerms(row.permissions) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="创建时间" width="180" />
      <el-table-column label="操作" width="220">
        <template #default="{ row }">
          <el-button size="small" @click="openEdit(row)">编辑权限</el-button>
          <el-button size="small" :type="row.is_active ? 'warning' : 'success'" @click="toggleActive(row)">{{ row.is_active ? '禁用' : '启用' }}</el-button>
          <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 创建弹窗 -->
    <el-dialog v-model="createDlg" title="创建子账号" width="500px" @opened="focusFirst">
      <el-form label-width="80px" @submit.prevent="handleCreate">
        <el-form-item label="用户名">
          <el-input ref="usernameInput" v-model="createForm.username" placeholder="3-50 个字符" @keydown.enter.prevent="handleCreate" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="createForm.email" placeholder="子账号邮箱（必填）" @keydown.enter.prevent="handleCreate" />
        </el-form-item>
        <el-form-item label="验证码">
          <div class="code-row">
            <el-input v-model="createForm.code" placeholder="邮箱收到的 6 位验证码" maxlength="10" @keydown.enter.prevent="handleCreate" />
            <el-button :disabled="codeCooldown > 0 || sendingCode" :loading="sendingCode" @click="sendCode">
              {{ codeCooldown > 0 ? `${codeCooldown}s 后重试` : '发送验证码' }}
            </el-button>
          </div>
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="createForm.password" type="password" show-password placeholder="至少 6 位" @keydown.enter.prevent="handleCreate" />
        </el-form-item>
        <el-form-item label="权限">
          <el-checkbox-group v-model="createForm.permissions">
            <el-checkbox v-for="p in allPerms" :key="p.value" :value="p.value">{{ p.label }}</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <button type="submit" style="display:none" />
      </el-form>
      <template #footer>
        <el-button @click="createDlg = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleCreate">创建</el-button>
      </template>
    </el-dialog>

    <!-- 编辑权限弹窗 -->
    <el-dialog v-model="editDlg" title="编辑权限" width="460px">
      <el-checkbox-group v-model="editPerms">
        <el-checkbox v-for="p in allPerms" :key="p.value" :value="p.value">{{ p.label }}</el-checkbox>
      </el-checkbox-group>
      <template #footer>
        <el-button @click="editDlg = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleEditPerms">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onBeforeUnmount, nextTick } from "vue";
import {
  getSubAccounts,
  createSubAccount,
  updateSubAccount,
  deleteSubAccount,
  sendSubaccountCode,
  type SubAccountItem,
} from "@/api/admin";
import { ElMessage, ElMessageBox, type InputInstance } from "element-plus";

const usernameInput = ref<InputInstance | null>(null);
function focusFirst() { nextTick(() => usernameInput.value?.focus()); }

const allPerms = [
  { value: "card_create", label: "生成卡密" },
  { value: "card_edit", label: "编辑卡密(备注/解绑/解绑上限)" },
  { value: "card_ban", label: "封禁/解封卡密" },
  { value: "card_delete", label: "删除卡密" },
  { value: "blacklist_manage", label: "黑名单管理" },
];

const list = ref<SubAccountItem[]>([]);
const loading = ref(false);
const submitting = ref(false);
const createDlg = ref(false);
const editDlg = ref(false);
const editId = ref(0);
const editPerms = ref<string[]>([]);
const createForm = reactive({
  username: "",
  email: "",
  password: "",
  code: "",
  permissions: [] as string[],
});

// —— 邮箱验证码倒计时 ——
const sendingCode = ref(false);
const codeCooldown = ref(0);
let cooldownTimer: ReturnType<typeof setInterval> | null = null;

function startCooldown(seconds: number) {
  codeCooldown.value = seconds;
  if (cooldownTimer) clearInterval(cooldownTimer);
  cooldownTimer = setInterval(() => {
    codeCooldown.value -= 1;
    if (codeCooldown.value <= 0 && cooldownTimer) {
      clearInterval(cooldownTimer);
      cooldownTimer = null;
    }
  }, 1000);
}

async function sendCode() {
  const email = createForm.email.trim();
  if (!email || !email.includes("@")) {
    ElMessage.warning("请先填写有效邮箱");
    return;
  }
  sendingCode.value = true;
  try {
    const r = await sendSubaccountCode(email);
    const cd = r.data?.cooldown_seconds || 60;
    startCooldown(cd);
    ElMessage.success("验证码已发送，请查收邮箱");
  } catch (e: any) {
    const detail = e?.response?.data?.detail;
    if (detail && typeof detail === "object" && detail.message) {
      ElMessage.error(detail.message);
      if (detail.retry_after) startCooldown(Number(detail.retry_after) || 60);
    } else {
      ElMessage.error(detail || "发送失败");
    }
  } finally {
    sendingCode.value = false;
  }
}

onBeforeUnmount(() => {
  if (cooldownTimer) clearInterval(cooldownTimer);
});

function parsePerms(raw: string | null): string {
  if (!raw) return "无";
  try { const arr = JSON.parse(raw); return arr.length ? arr.join(", ") : "无"; } catch { return raw; }
}

async function fetch() {
  loading.value = true;
  try { list.value = (await getSubAccounts()).data; }
  catch { ElMessage.error("获取子账号列表失败"); }
  finally { loading.value = false; }
}

function openCreate() {
  createForm.username = "";
  createForm.email = "";
  createForm.password = "";
  createForm.code = "";
  createForm.permissions = [];
  codeCooldown.value = 0;
  if (cooldownTimer) { clearInterval(cooldownTimer); cooldownTimer = null; }
  createDlg.value = true;
}
function openEdit(row: SubAccountItem) {
  editId.value = row.id;
  try { editPerms.value = JSON.parse(row.permissions || "[]"); } catch { editPerms.value = []; }
  editDlg.value = true;
}

async function handleCreate() {
  const username = createForm.username.trim();
  const email = createForm.email.trim();
  const password = createForm.password.trim();
  const code = createForm.code.trim();
  if (!username || !email || !password || !code) {
    ElMessage.warning("用户名、邮箱、密码、验证码均必填");
    return;
  }
  if (!email.includes("@")) {
    ElMessage.warning("邮箱格式无效");
    return;
  }
  if (password.length < 6) {
    ElMessage.warning("密码至少 6 位");
    return;
  }
  submitting.value = true;
  try {
    await createSubAccount({
      username,
      email,
      password,
      code,
      permissions: createForm.permissions,
    });
    ElMessage.success("创建成功");
    createDlg.value = false;
    fetch();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.detail || "创建失败");
  } finally {
    submitting.value = false;
  }
}

async function handleEditPerms() {
  submitting.value = true;
  try {
    await updateSubAccount(editId.value, { permissions: editPerms.value });
    ElMessage.success("权限已更新"); editDlg.value = false; fetch();
  } catch (e: any) { ElMessage.error(e?.response?.data?.detail || "更新失败"); }
  finally { submitting.value = false; }
}

async function toggleActive(row: SubAccountItem) {
  try { await updateSubAccount(row.id, { is_active: !row.is_active }); row.is_active = !row.is_active; ElMessage.success("已更新"); }
  catch (e: any) { ElMessage.error(e?.response?.data?.detail || "操作失败"); }
}

async function handleDelete(row: SubAccountItem) {
  try { await ElMessageBox.confirm(`确定删除子账号「${row.username}」？`, "危险操作", { type: "warning" }); } catch { return; }
  try { await deleteSubAccount(row.id); ElMessage.success("已删除"); fetch(); }
  catch (e: any) { ElMessage.error(e?.response?.data?.detail || "删除失败"); }
}

onMounted(fetch);
</script>

<style scoped>
.code-row {
  display: flex;
  gap: 8px;
  width: 100%;
}
.code-row :deep(.el-input) {
  flex: 1;
}
.code-row .el-button {
  flex-shrink: 0;
  min-width: 110px;
}
</style>
