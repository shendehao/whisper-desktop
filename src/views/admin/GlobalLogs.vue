<template>
  <div class="admin-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">全局日志</h1>
        <p class="page-sub">平台所有租户的事件日志（仅超级管理员）</p>
      </div>
    </div>
    <el-table :data="list" v-loading="loading" border>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="timestamp" label="时间" width="180" />
      <el-table-column prop="event_type" label="类型" width="100">
        <template #default="{ row }">
          <el-tag size="small">{{ row.event_type }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="message" label="消息" min-width="300" show-overflow-tooltip />
      <el-table-column prop="software_id" label="软件ID" width="90" />
    </el-table>
    <el-pagination class="mt-4" :total="total" :page-size="30" v-model:current-page="page" @current-change="fetch" layout="prev, pager, next" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { getGlobalLogs, type EventItem } from "@/api/admin";
import { ElMessage } from "element-plus";

const list = ref<EventItem[]>([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);

async function fetch() {
  loading.value = true;
  try {
    const res = await getGlobalLogs({ page: page.value, page_size: 30 });
    list.value = res.data.items;
    total.value = res.data.total;
  } catch { ElMessage.error("获取全局日志失败"); }
  finally { loading.value = false; }
}

onMounted(fetch);
</script>
