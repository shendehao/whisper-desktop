<template>
  <div class="admin-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">事件日志</h1>
        <p class="page-sub">当前租户名下实例产生的业务事件</p>
      </div>
      <div class="page-actions">
        <el-select v-model="eventType" placeholder="全部类型" clearable @change="fetchLogs" style="width: 160px">
          <el-option label="info" value="info" />
          <el-option label="warning" value="warning" />
          <el-option label="error" value="error" />
        </el-select>
      </div>
    </div>
    <el-table :data="logs" v-loading="loading" border>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="event_type" label="类型" width="90">
        <template #default="{ row }">
          <el-tag :type="typeTag(row.event_type)" size="small">{{ row.event_type }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="message" label="内容" min-width="300" show-overflow-tooltip />
      <el-table-column prop="timestamp" label="时间" width="180">
        <template #default="{ row }">{{ row.timestamp ? new Date(row.timestamp).toLocaleString() : '-' }}</template>
      </el-table-column>
    </el-table>
    <div class="mt-4 flex justify-end">
      <el-pagination
        v-model:current-page="page"
        :page-size="30"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="fetchLogs"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { getLogs, type EventItem } from "@/api/admin";
import { ElMessage } from "element-plus";

const logs = ref<EventItem[]>([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const eventType = ref("");

function typeTag(t: string) {
  return { info: "info", warning: "warning", error: "danger" }[t] || "info";
}

async function fetchLogs() {
  loading.value = true;
  try {
    const res = await getLogs({
      page: page.value,
      page_size: 30,
      event_type: eventType.value || undefined,
    });
    logs.value = res.data.items;
    total.value = res.data.total;
  } catch {
    ElMessage.error("获取日志失败");
  } finally {
    loading.value = false;
  }
}

onMounted(fetchLogs);
</script>
