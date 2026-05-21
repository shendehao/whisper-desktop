<template>
  <div class="admin-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">卡密管理</h1>
        <p class="page-sub">所有卡密按 owner_id 隔离，仅显示当前租户名下的实例数据</p>
      </div>
      <div class="page-actions">
        <span class="page-stat" v-if="total > 0">共 <b>{{ total }}</b> 条</span>
        <el-button type="primary" @click="showGenDialog = true" v-if="userStore.hasPermission('card_create')">批量生成</el-button>
      </div>
    </div>

    <!-- 筛选区（1）查询条件 -->
    <div class="panel filter-panel">
      <div class="filter-row">
        <div class="filter-item">
          <label class="filter-label">软件</label>
          <el-select v-model="filter.software_id" placeholder="全部" clearable @change="onFilterChange" style="width: 200px">
            <el-option v-for="sw in softwareList" :key="sw.id" :label="sw.name" :value="sw.id" />
          </el-select>
        </div>
        <div class="filter-item flex-1" style="min-width: 240px">
          <label class="filter-label">搜索</label>
          <el-input v-model="filter.keyword" placeholder="试试输入卡密、HWID 片段、IP、备注..." clearable @keyup.enter="onFilterChange">
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </div>
        <el-button type="primary" @click="onFilterChange">查询</el-button>
      </div>
    </div>

    <!-- 筛选区（2）状态分段 -->
    <div class="status-bar">
      <el-radio-group v-model="statusModel" size="default" @change="onStatusChange">
        <el-radio-button label="">全部</el-radio-button>
        <el-radio-button label="unused">未使用</el-radio-button>
        <el-radio-button label="used">已激活</el-radio-button>
        <el-radio-button label="expired">已过期</el-radio-button>
        <el-radio-button label="banned">已封禁</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 批量操作栏 -->
    <transition name="fade-down">
      <div class="batch-bar" v-if="selectedIds.length">
        <span class="batch-count">
          <el-icon><Select /></el-icon>
          已选 <b>{{ selectedIds.length }}</b> 张
        </span>
        <span class="batch-divider" />
        <el-button type="danger" size="small" @click="handleBatchBan" v-if="userStore.hasPermission('card_ban')">封禁</el-button>
        <el-button type="warning" size="small" @click="handleBatchUnban" v-if="userStore.hasPermission('card_ban')">解封</el-button>
        <el-button size="small" @click="handleBatchResetHwid" v-if="userStore.hasPermission('card_edit')">重置机器码</el-button>
        <el-dropdown trigger="click" v-if="userStore.hasPermission('card_edit') || userStore.hasPermission('blacklist_manage')">
          <el-button size="small">
            更多操作 <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-if="userStore.hasPermission('card_edit')" @click="openBatchRemarks">设置备注</el-dropdown-item>
              <el-dropdown-item v-if="userStore.hasPermission('card_edit')" @click="openBatchUnbindLimit">设置解绑上限</el-dropdown-item>
              <el-dropdown-item v-if="userStore.hasPermission('blacklist_manage')" divided @click="handleBatchBanFirstIp">
                <el-icon><Lock /></el-icon> 封禁选中卡密的首次IP
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <span class="batch-spacer" />
        <el-button type="danger" size="small" plain @click="handleBatchDelete" v-if="userStore.hasPermission('card_delete')">删除</el-button>
        <el-button size="small" link @click="clearSelection" title="取消选择">
          <el-icon><Close /></el-icon>
        </el-button>
      </div>
    </transition>

    <!-- 表格 -->
    <el-table :data="cards" v-loading="loading" border stripe @selection-change="onSelectionChange" row-key="id" size="default">
      <template #empty>
        <div class="table-empty">
          <el-icon class="empty-icon"><Box /></el-icon>
          <p>暂无卡密数据</p>
          <p class="empty-sub" v-if="hasActiveFilter">试试清除筛选条件</p>
          <p class="empty-sub" v-else-if="userStore.hasPermission('card_create')">点击右上角“批量生成”按钮创建首批卡密</p>
        </div>
      </template>
      <el-table-column type="selection" width="45" />
      <el-table-column prop="key" label="卡密" min-width="260">
        <template #default="{ row }">
          <div class="key-cell">
            <el-tooltip :content="row.key" placement="top" :show-after="500">
              <span class="font-mono key-text">{{ row.key }}</span>
            </el-tooltip>
            <el-button class="key-copy" size="small" link @click="copyText(row.key)" title="复制卡密">
              <el-icon><DocumentCopy /></el-icon>
            </el-button>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="software_name" label="软件" width="120" show-overflow-tooltip />
      <el-table-column prop="status" label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="statusTag(row.status)" size="small" effect="light">{{ statusLabel(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="duration_unit" label="时长" width="100">
        <template #default="{ row }">
          <span class="tabular-nums">{{ row.duration_unit === 'permanent' ? '永久' : `${row.duration_value ?? '-'} ${unitLabel(row.duration_unit)}` }}</span>
        </template>
      </el-table-column>
      <el-table-column label="解绑" width="95" align="center">
        <template #header>
          <el-tooltip content="已解绑次数 / 解绑上限" placement="top">
            <span>解绑 <el-icon style="font-size: 12px; vertical-align: -1px"><InfoFilled /></el-icon></span>
          </el-tooltip>
        </template>
        <template #default="{ row }">
          <span class="tabular-nums">{{ row.unbind_count }} / {{ row.unbind_limit ?? '∞' }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="hwid" label="HWID" min-width="130">
        <template #default="{ row }">
          <div v-if="row.hwid" class="hwid-cell" :title="row.hwid" @click="copyText(row.hwid)">
            <span class="font-mono text-secondary">{{ row.hwid }}</span>
          </div>
          <span v-else class="text-tertiary">未绑定</span>
        </template>
      </el-table-column>
      <el-table-column prop="first_ip" label="首次IP" width="130">
        <template #default="{ row }">
          <span v-if="row.first_ip" class="font-mono tabular-nums">{{ row.first_ip }}</span>
          <span v-else class="text-tertiary">-</span>
        </template>
      </el-table-column>
      <el-table-column prop="expire_date" label="到期时间" width="160">
        <template #default="{ row }">
          <span class="tabular-nums">{{ row.expire_date ? new Date(row.expire_date).toLocaleString() : '永久' }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="remarks" label="备注" min-width="100" show-overflow-tooltip>
        <template #default="{ row }">
          <span v-if="row.remarks">{{ row.remarks }}</span>
          <span v-else class="text-tertiary">-</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="170" fixed="right" align="center">
        <template #default="{ row }">
          <div class="action-icons">
            <el-button size="small" link @click="openEdit(row)" v-if="userStore.hasPermission('card_edit')" title="编辑">
              <el-icon><Edit /></el-icon>
            </el-button>
            <el-button size="small" link @click="handleToggleStatus(row)" v-if="userStore.hasPermission('card_ban')" :title="row.status === 'banned' ? '启用' : '停用'">
              <el-icon><VideoPlay v-if="row.status === 'banned'" /><VideoPause v-else /></el-icon>
            </el-button>
            <el-dropdown trigger="click" placement="bottom-end">
              <el-button size="small" link title="更多">
                <el-icon><MoreFilled /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item v-if="userStore.hasPermission('card_edit')" @click="handleResetHwid(row)">
                    <el-icon><Refresh /></el-icon> 重置机器码
                  </el-dropdown-item>
                  <el-dropdown-item v-if="userStore.hasPermission('card_edit')" @click="handleResetUnbindCount(row)">
                    <el-icon><RefreshLeft /></el-icon> 重置解绑次数
                  </el-dropdown-item>
                  <el-dropdown-item @click="copyText(row.key)">
                    <el-icon><DocumentCopy /></el-icon> 复制卡密
                  </el-dropdown-item>
                  <el-dropdown-item v-if="row.first_ip && userStore.hasPermission('blacklist_manage')" @click="handleBanSingleIp(row)">
                    <el-icon><Lock /></el-icon> 封禁首次IP
                  </el-dropdown-item>
                  <el-dropdown-item v-if="userStore.hasPermission('card_delete')" divided @click="handleSingleDelete(row)" class="is-danger">
                    <el-icon><Delete /></el-icon> 删除卡密
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <div class="mt-4 flex justify-end">
      <el-pagination
        v-model:current-page="filter.page"
        :page-size="filter.page_size"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="fetchCards"
      />
    </div>

    <!-- 批量生成弹窗 -->
    <el-dialog v-model="showGenDialog" title="批量生成卡密" width="520px" @open="loadSoftwareForGen">
      <el-form label-width="100px" @submit.prevent="handleGenerate">
        <el-form-item label="所属软件">
          <el-select v-model="genForm.software_id" placeholder="选择软件" style="width: 100%">
            <el-option v-for="sw in softwareList" :key="sw.id" :label="sw.name" :value="sw.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="生成数量">
          <el-input-number v-model="genForm.count" :min="1" :max="500" />
        </el-form-item>
        <el-form-item label="时长类型">
          <el-select v-model="genForm.duration_unit">
            <el-option label="小时" value="hour" />
            <el-option label="天" value="day" />
            <el-option label="永久" value="permanent" />
          </el-select>
        </el-form-item>
        <el-form-item label="时长数值" v-if="genForm.duration_unit !== 'permanent'">
          <el-input-number v-model="genForm.duration_value" :min="1" />
        </el-form-item>
        <el-form-item label="解绑上限">
          <el-checkbox v-model="genForm.unbind_unlimited">不限</el-checkbox>
          <el-input-number v-if="!genForm.unbind_unlimited" v-model="genForm.unbind_limit" :min="0" class="ml-2" />
          <span class="text-gray-400 text-xs ml-2">0 = 不可解绑；N = 最多解绑 N 次</span>
        </el-form-item>
        <el-form-item label="前缀">
          <el-input v-model="genForm.prefix" placeholder="可选，如 VIP-" style="width: 160px" @keydown.enter.prevent="handleGenerate" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="genForm.remarks" placeholder="可选" @keydown.enter.prevent="handleGenerate" />
        </el-form-item>
        <button type="submit" style="display:none" />
      </el-form>
      <template #footer>
        <el-button @click="showGenDialog = false">取消</el-button>
        <el-button type="primary" :loading="genLoading" @click="handleGenerate">生成</el-button>
      </template>
    </el-dialog>

    <!-- 生成结果弹窗 -->
    <el-dialog v-model="showResultDialog" title="生成完成" width="520px">
      <p class="mb-2">成功生成 <b>{{ generatedKeys.length }}</b> 张卡密</p>
      <el-input type="textarea" :model-value="generatedKeys.join('\n')" :rows="8" readonly />
      <template #footer>
        <el-button @click="copyKeys">复制全部</el-button>
        <el-button type="primary" @click="showResultDialog = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 单卡编辑弹窗 -->
    <el-dialog v-model="showEditDialog" title="编辑卡密" width="480px">
      <el-form label-width="100px">
        <el-form-item label="卡密">
          <span class="font-mono text-sm">{{ editForm.key }}</span>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="editForm.status">
            <el-option label="未使用" value="unused" />
            <el-option label="已激活" value="used" />
            <el-option label="已过期" value="expired" />
            <el-option label="已封禁" value="banned" />
          </el-select>
        </el-form-item>
        <el-form-item label="解绑上限">
          <el-checkbox v-model="editForm.unbind_unlimited">不限</el-checkbox>
          <el-input-number v-if="!editForm.unbind_unlimited" v-model="editForm.unbind_limit" :min="0" class="ml-2" />
          <span class="text-gray-400 text-xs ml-2">0 = 不可解绑</span>
        </el-form-item>
        <el-form-item label="已解绑次数">
          <el-input-number v-model="editForm.unbind_count" :min="0" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="editForm.remarks" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" :loading="editSubmitting" @click="handleEditSubmit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 批量设置备注 -->
    <el-dialog v-model="showBatchRemarks" title="批量设置备注" width="420px">
      <p class="mb-2 text-gray-500">将为 {{ selectedIds.length }} 张卡密设置备注：</p>
      <el-input v-model="batchRemarksValue" type="textarea" :rows="3" placeholder="输入备注内容 (留空将清除备注)" />
      <template #footer>
        <el-button @click="showBatchRemarks = false">取消</el-button>
        <el-button type="primary" @click="submitBatchRemarks">确定</el-button>
      </template>
    </el-dialog>

    <!-- 批量设置解绑上限 -->
    <el-dialog v-model="showBatchUnbindLimit" title="批量设置解绑上限" width="420px">
      <p class="mb-2 text-gray-500">将为 {{ selectedIds.length }} 张卡密设置解绑上限：</p>
      <el-checkbox v-model="batchUnbindUnlimited">不限</el-checkbox>
      <el-input-number v-if="!batchUnbindUnlimited" v-model="batchUnbindLimitValue" :min="0" class="ml-2" />
      <p class="text-gray-400 text-xs mt-2">0 = 不可解绑；N = 最多解绑 N 次</p>
      <template #footer>
        <el-button @click="showBatchUnbindLimit = false">取消</el-button>
        <el-button type="primary" @click="submitBatchUnbindLimit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  Edit, Refresh, RefreshLeft, VideoPlay, VideoPause, DocumentCopy, Delete,
  Search, ArrowDown, MoreFilled, InfoFilled, Box, Select, Close, Lock,
} from "@element-plus/icons-vue";
import {
  getCards,
  getSoftwareList,
  batchGenerateCards,
  batchUpdateCardStatus,
  batchDeleteCards,
  updateCard,
  resetCardHwid,
  batchResetCardHwid,
  batchSetCardRemarks,
  batchSetCardUnbindLimit,
  batchBanCardFirstIp,
  type CardItem,
  type SoftwareItem,
} from "@/api/admin";
import { useUserStore } from "@/stores/user";

const userStore = useUserStore();
const loading = ref(false);
const cards = ref<CardItem[]>([]);
const total = ref(0);
const softwareList = ref<SoftwareItem[]>([]);
const selectedIds = ref<number[]>([]);

const filter = reactive({
  software_id: undefined as number | undefined,
  status: undefined as string | undefined,
  keyword: "",
  page: 1,
  page_size: 20,
});

const showGenDialog = ref(false);
const genLoading = ref(false);
const genForm = reactive({
  software_id: undefined as number | undefined,
  count: 10,
  duration_unit: "day",
  duration_value: 30,
  unbind_limit: 0,
  unbind_unlimited: true,
  prefix: "",
  remarks: "",
});

const showResultDialog = ref(false);
const generatedKeys = ref<string[]>([]);

// 单卡编辑
const showEditDialog = ref(false);
const editSubmitting = ref(false);
const editForm = reactive({
  id: 0,
  key: "",
  status: "unused" as "unused" | "used" | "expired" | "banned",
  unbind_limit: 0,
  unbind_unlimited: true,
  unbind_count: 0,
  remarks: "",
});

// 批量备注/解绑上限
const showBatchRemarks = ref(false);
const batchRemarksValue = ref("");
const showBatchUnbindLimit = ref(false);
const batchUnbindLimitValue = ref<number>(0);
const batchUnbindUnlimited = ref(true);

function statusTag(s: string) {
  return { unused: "info", used: "success", expired: "warning", banned: "danger" }[s] || "info";
}
function statusLabel(s: string) {
  return { unused: "未使用", used: "已激活", expired: "已过期", banned: "已封禁" }[s] || s;
}
function unitLabel(u: string) {
  return { hour: "小时", day: "天" }[u] || u;
}

async function loadSoftware() {
  try {
    const res = await getSoftwareList();
    softwareList.value = res.data;
  } catch {
    ElMessage.error("加载软件列表失败，筛选和生成功能可能不可用");
  }
}

function loadSoftwareForGen() {
  if (!softwareList.value.length) loadSoftware();
}

async function fetchCards() {
  loading.value = true;
  try {
    const res = await getCards({
      software_id: filter.software_id,
      status: filter.status,
      keyword: filter.keyword || undefined,
      page: filter.page,
      page_size: filter.page_size,
    });
    cards.value = res.data.items;
    total.value = res.data.total;
  } catch {
    ElMessage.error("获取卡密列表失败");
  } finally {
    loading.value = false;
  }
}

function onSelectionChange(rows: CardItem[]) {
  selectedIds.value = rows.map((r) => r.id);
}

async function handleGenerate() {
  if (!genForm.software_id) {
    ElMessage.warning("请选择软件");
    return;
  }
  genLoading.value = true;
  try {
    const res = await batchGenerateCards({
      software_id: genForm.software_id,
      count: genForm.count,
      duration_unit: genForm.duration_unit,
      duration_value: genForm.duration_unit === "permanent" ? undefined : genForm.duration_value,
      // 不限 = null；其他情况包括 0（不可解绑）都原值上报
      unbind_limit: genForm.unbind_unlimited ? undefined : genForm.unbind_limit,
      prefix: genForm.prefix || undefined,
      remarks: genForm.remarks || undefined,
    });
    generatedKeys.value = res.data.keys || [];
    showGenDialog.value = false;
    showResultDialog.value = true;
    fetchCards();
  } catch {
    ElMessage.error("生成失败");
  } finally {
    genLoading.value = false;
  }
}

async function handleBatchBan() {
  try { await ElMessageBox.confirm(`确定封禁选中的 ${selectedIds.value.length} 张卡密？`, "确认"); } catch { return; }
  try {
    const res = await batchUpdateCardStatus({ card_ids: selectedIds.value, status: "banned" });
    ElMessage.success(`已封禁 ${res.data.updated} 张`);
    fetchCards();
  } catch { ElMessage.error("操作失败"); }
}

async function handleBatchUnban() {
  try { await ElMessageBox.confirm(`确定解封选中的 ${selectedIds.value.length} 张卡密？`, "确认"); } catch { return; }
  try {
    const res = await batchUpdateCardStatus({ card_ids: selectedIds.value, status: "unused" });
    ElMessage.success(`已解封 ${res.data.updated} 张`);
    fetchCards();
  } catch { ElMessage.error("操作失败"); }
}

async function handleBatchDelete() {
  try { await ElMessageBox.confirm(`确定删除选中的 ${selectedIds.value.length} 张卡密？此操作不可恢复！`, "警告", { type: "warning" }); } catch { return; }
  try {
    const res = await batchDeleteCards(selectedIds.value);
    ElMessage.success(`已删除 ${res.data.deleted} 张`);
    fetchCards();
  } catch { ElMessage.error("删除失败"); }
}

async function handleBatchResetHwid() {
  try { await ElMessageBox.confirm(`确定重置选中的 ${selectedIds.value.length} 张卡密的机器码？`, "确认"); } catch { return; }
  try {
    const res = await batchResetCardHwid(selectedIds.value);
    ElMessage.success(`已重置 ${res.data.updated} 张`);
    fetchCards();
  } catch { ElMessage.error("操作失败"); }
}

function openBatchRemarks() {
  batchRemarksValue.value = "";
  showBatchRemarks.value = true;
}

async function submitBatchRemarks() {
  try {
    const res = await batchSetCardRemarks(selectedIds.value, batchRemarksValue.value);
    ElMessage.success(`已设置 ${res.data.updated} 张的备注`);
    showBatchRemarks.value = false;
    fetchCards();
  } catch { ElMessage.error("操作失败"); }
}

function openBatchUnbindLimit() {
  batchUnbindLimitValue.value = 0;
  batchUnbindUnlimited.value = true;
  showBatchUnbindLimit.value = true;
}

async function submitBatchUnbindLimit() {
  try {
    const limit = batchUnbindUnlimited.value ? null : batchUnbindLimitValue.value;
    const res = await batchSetCardUnbindLimit(selectedIds.value, limit);
    ElMessage.success(`已设置 ${res.data.updated} 张的解绑上限`);
    showBatchUnbindLimit.value = false;
    fetchCards();
  } catch { ElMessage.error("操作失败"); }
}

// 单行操作
function openEdit(row: CardItem) {
  editForm.id = row.id;
  editForm.key = row.key;
  editForm.status = row.status as any;
  editForm.unbind_unlimited = row.unbind_limit === null || row.unbind_limit === undefined;
  editForm.unbind_limit = row.unbind_limit ?? 0;
  editForm.unbind_count = row.unbind_count ?? 0;
  editForm.remarks = row.remarks ?? "";
  showEditDialog.value = true;
}

async function handleEditSubmit() {
  editSubmitting.value = true;
  try {
    await updateCard(editForm.id, {
      status: editForm.status,
      // 不限 → null；其他原值上报（0 = 不可解绑）
      unbind_limit: editForm.unbind_unlimited ? null : editForm.unbind_limit,
      unbind_count: editForm.unbind_count,
      remarks: editForm.remarks,
    });
    ElMessage.success("保存成功");
    showEditDialog.value = false;
    fetchCards();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.detail || "保存失败");
  } finally {
    editSubmitting.value = false;
  }
}

async function handleResetHwid(row: CardItem) {
  try { await ElMessageBox.confirm(`确定重置「${row.key}」的机器码？`, "确认"); } catch { return; }
  try {
    await resetCardHwid(row.id);
    ElMessage.success("已重置机器码");
    row.hwid = null;
  } catch { ElMessage.error("操作失败"); }
}

async function handleResetUnbindCount(row: CardItem) {
  try { await ElMessageBox.confirm(`确定将「${row.key}」的「已解绑次数」清零？`, "重置解绑次数"); } catch { return; }
  try {
    await updateCard(row.id, { unbind_count: 0 });
    ElMessage.success("已重置解绑次数");
    row.unbind_count = 0;
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.detail || "操作失败");
  }
}

async function handleToggleStatus(row: CardItem) {
  const newStatus = row.status === "banned" ? "unused" : "banned";
  const action = newStatus === "banned" ? "封禁" : "解封";
  try { await ElMessageBox.confirm(`确定${action}「${row.key}」？`, "确认"); } catch { return; }
  try {
    await batchUpdateCardStatus({ card_ids: [row.id], status: newStatus });
    ElMessage.success(`已${action}`);
    row.status = newStatus;
  } catch { ElMessage.error("操作失败"); }
}

async function handleSingleDelete(row: CardItem) {
  try { await ElMessageBox.confirm(`确定删除「${row.key}」？此操作不可恢复！`, "警告", { type: "warning" }); } catch { return; }
  try {
    await batchDeleteCards([row.id]);
    ElMessage.success("已删除");
    fetchCards();
  } catch { ElMessage.error("删除失败"); }
}

function copyText(text: string) {
  navigator.clipboard.writeText(text);
  ElMessage.success("已复制到剪贴板");
}

// el-radio-group v-model 需要一个实际值，'' = 全部
const statusModel = computed({
  get: () => filter.status ?? "",
  set: (v: string) => { filter.status = v || undefined; },
});
function onStatusChange(v: string | number | boolean | undefined) {
  filter.status = (v as string) || undefined;
  filter.page = 1;
  fetchCards();
}
function onFilterChange() {
  filter.page = 1;
  fetchCards();
}
const hasActiveFilter = computed(() => !!filter.software_id || !!filter.status || !!filter.keyword);
function clearSelection() { selectedIds.value = []; }

async function handleBatchBanFirstIp() {
  try {
    await ElMessageBox.confirm(
      `将选中的 ${selectedIds.value.length} 张卡密的首次激活IP加入租户黑名单，该操作不影响卡密本身状态。确认继续？`,
      "封禁首次IP", { type: "warning" }
    );
  } catch { return; }
  try {
    const res = await batchBanCardFirstIp(selectedIds.value);
    const { banned, skipped_no_ip, already_exists } = res.data;
    const parts = [`新增封禁 ${banned} 个IP`];
    if (already_exists) parts.push(`${already_exists} 个已在黑名单`);
    if (skipped_no_ip) parts.push(`${skipped_no_ip} 张未激活已跳过`);
    ElMessage.success(parts.join("、"));
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.detail || "封禁失败");
  }
}

async function handleBanSingleIp(row: CardItem) {
  if (!row.first_ip) return;
  try {
    await ElMessageBox.confirm(`将首次激活IP 「${row.first_ip}」加入租户黑名单？`, "封禁首次IP", { type: "warning" });
  } catch { return; }
  try {
    const res = await batchBanCardFirstIp([row.id]);
    const { banned, already_exists } = res.data;
    if (banned > 0) ElMessage.success(`IP 「${row.first_ip}」 已加入黑名单`);
    else if (already_exists > 0) ElMessage.info(`IP 「${row.first_ip}」 已在黑名单中`);
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.detail || "封禁失败");
  }
}

function copyKeys() {
  navigator.clipboard.writeText(generatedKeys.value.join("\n"));
  ElMessage.success("已复制到剪贴板");
}

onMounted(() => {
  loadSoftware();
  fetchCards();
});
</script>

<style scoped>
.font-mono { font-family: 'JetBrains Mono', 'Courier New', Courier, monospace; }

.page-stat {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-right: 4px;
}
.page-stat b {
  color: var(--text-primary);
  font-weight: 600;
  margin: 0 2px;
}

/* 筛选区面板 */
.filter-panel {
  padding: 14px 18px;
}
.filter-row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
}
.filter-label {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
}
.flex-1 { flex: 1; }

/* 状态分段栏 */
.status-bar {
  display: flex;
  align-items: center;
}

/* 批量操作栏 */
.batch-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--brand-soft);
  border: 1px solid var(--brand);
  border-radius: var(--radius-md);
  flex-wrap: wrap;
}
.batch-count {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
}
.batch-count b {
  color: var(--brand);
  font-weight: 600;
}
.batch-divider {
  width: 1px;
  height: 16px;
  background: var(--border-base);
}
.batch-spacer { flex: 1; min-width: 0; }

/* 卡密列 */
.key-cell {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.key-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}
.key-copy {
  flex-shrink: 0;
  opacity: 0.5;
  transition: opacity 0.15s;
}
.el-table__row:hover .key-copy { opacity: 1; }

/* 表格空态 */
.table-empty {
  padding: 40px 16px 32px;
  text-align: center;
  color: var(--text-tertiary);
}
.table-empty .empty-icon {
  font-size: 48px;
  color: var(--border-strong);
  margin-bottom: 8px;
}
.table-empty p { margin: 4px 0; font-size: 14px; }
.table-empty .empty-sub { font-size: 12px; color: var(--text-tertiary); }

/* HWID 单元格：截断 + 点击复制 */
.hwid-cell {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}
.hwid-cell:hover { color: var(--brand); }

/* 辅助文本色 */
.text-secondary { color: var(--text-secondary); }
.text-tertiary { color: var(--text-tertiary); }

/* 批量栏 进场动画 */
.fade-down-enter-active,
.fade-down-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.fade-down-enter-from { opacity: 0; transform: translateY(-6px); }
.fade-down-leave-to { opacity: 0; transform: translateY(-6px); }
</style>

<style>
/* 下拉菜单危险项颜色（不能 scoped，另外需要）*/
.el-dropdown-menu__item.is-danger {
  color: var(--danger) !important;
}
.el-dropdown-menu__item .el-icon {
  margin-right: 4px;
}
</style>
