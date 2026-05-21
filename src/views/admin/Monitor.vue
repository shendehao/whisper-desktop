<template>
  <div class="admin-page monitor">
    <div class="page-header">
      <div>
        <h1 class="page-title">系统监控</h1>
        <p class="page-sub">
          平台聚合数据，仅超级管理员可见
          <span v-if="stats?.now_cn" class="sample-time">· 采集时间 {{ stats.now_cn }}</span>
        </p>
      </div>
      <div class="header-actions">
        <el-button :icon="RefreshIcon" :loading="loading" @click="fetch">刷新</el-button>
      </div>
    </div>

    <!-- 资源监控（CPU / 内存 / 磁盘 / 进程时长） -->
    <div class="metric-grid">
      <div class="metric-card">
        <div class="metric-head">
          <Icon icon="ant-design:dashboard-outlined" />
          <span>CPU 使用率</span>
        </div>
        <div class="metric-value" :class="cpuLevel">{{ fmtPercent(stats?.cpu_percent) }}</div>
        <div class="metric-bar">
          <div class="metric-fill" :class="cpuLevel" :style="{ width: barWidth(stats?.cpu_percent) + '%' }" />
        </div>
      </div>

      <div class="metric-card">
        <div class="metric-head">
          <Icon icon="ant-design:database-outlined" />
          <span>内存</span>
        </div>
        <div class="metric-value" :class="ramLevel">{{ fmtPercent(stats?.ram_percent) }}</div>
        <div class="metric-bar">
          <div class="metric-fill" :class="ramLevel" :style="{ width: barWidth(stats?.ram_percent) + '%' }" />
        </div>
        <div class="metric-sub" v-if="stats?.ram_used_mb != null">
          {{ stats.ram_used_mb }} MB / {{ stats.ram_total_mb }} MB
        </div>
      </div>

      <div class="metric-card">
        <div class="metric-head">
          <Icon icon="ant-design:hdd-outlined" />
          <span>磁盘</span>
        </div>
        <div class="metric-value" :class="diskLevel">{{ fmtPercent(stats?.disk_percent) }}</div>
        <div class="metric-bar">
          <div class="metric-fill" :class="diskLevel" :style="{ width: barWidth(stats?.disk_percent) + '%' }" />
        </div>
        <div class="metric-sub" v-if="stats?.disk_used_gb != null">
          {{ stats.disk_used_gb }} GB / {{ stats.disk_total_gb }} GB
        </div>
      </div>

      <div class="metric-card">
        <div class="metric-head">
          <Icon icon="ant-design:clock-circle-outlined" />
          <span>进程运行时长</span>
        </div>
        <div class="metric-value uptime">{{ stats?.uptime_str || "—" }}</div>
        <div class="metric-sub" v-if="stats?.proc_start">启动：{{ stats.proc_start }}</div>
      </div>
    </div>

    <!-- 业务聚合数据 -->
    <div class="panel">
      <div class="panel-head"><div class="panel-title">业务概览</div></div>
      <div class="biz-grid">
        <div v-for="b in bizItems" :key="b.label" class="biz-cell">
          <div class="biz-label">{{ b.label }}</div>
          <div class="biz-value" :style="{ color: b.color }">{{ b.value }}</div>
        </div>
      </div>
    </div>

    <!-- 数据库表统计 -->
    <div class="panel">
      <div class="panel-head"><div class="panel-title">数据库表统计</div></div>
      <el-table :data="dbStatsRows" stripe size="small" style="width: 100%">
        <el-table-column prop="label" label="表" min-width="160" />
        <el-table-column prop="value" label="行数" align="right" min-width="120">
          <template #default="{ row }">
            <span v-if="typeof row.value === 'number'" class="row-count">{{ row.value.toLocaleString() }}</span>
            <span v-else class="row-error">{{ row.value }}</span>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="stats?.db_error" class="db-error">数据库错误：{{ stats.db_error }}</div>
    </div>

    <!-- 最近安全/错误事件 -->
    <div class="panel">
      <div class="panel-head">
        <div class="panel-title">最近安全 / 错误事件（最多 10 条）</div>
      </div>
      <el-table :data="stats?.recent_errors || []" size="small" style="width: 100%" empty-text="暂无安全/错误事件">
        <el-table-column prop="timestamp" label="时间" min-width="200" />
        <el-table-column prop="event_type" label="类型" min-width="100">
          <template #default="{ row }">
            <span class="event-tag" :class="'tag-' + (row.event_type || 'info')">{{ row.event_type }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="message" label="内容" min-width="320" show-overflow-tooltip />
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { Icon } from "@iconify/vue";
import { Refresh as RefreshIcon } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { getSystemMonitor, type SystemStats } from "@/api/admin";

const stats = ref<SystemStats | null>(null);
const loading = ref(false);

const bizItems = computed(() => [
  { label: "主账号数", value: stats.value?.total_users ?? "--", color: "var(--brand)" },
  { label: "子账号数", value: stats.value?.total_sub_accounts ?? "--", color: "#8b5cf6" },
  { label: "实例总数", value: stats.value?.total_software ?? "--", color: "#06b6d4" },
  { label: "卡密总数", value: stats.value?.total_cards ?? "--", color: "var(--success)" },
  { label: "今日访问", value: stats.value?.total_access_today ?? "--", color: "var(--warning)" },
]);

const dbStatsRows = computed(() => {
  const d = stats.value?.db_stats || {};
  return Object.entries(d).map(([label, value]) => ({ label, value }));
});

function fmtPercent(v?: number | null): string {
  if (v == null || isNaN(Number(v))) return "—";
  return Number(v).toFixed(1) + "%";
}

function barWidth(v?: number | null): number {
  if (v == null || isNaN(Number(v))) return 0;
  return Math.max(0, Math.min(100, Number(v)));
}

function level(v?: number | null): "low" | "mid" | "high" {
  if (v == null) return "low";
  const n = Number(v);
  if (n >= 85) return "high";
  if (n >= 60) return "mid";
  return "low";
}

const cpuLevel = computed(() => level(stats.value?.cpu_percent));
const ramLevel = computed(() => level(stats.value?.ram_percent));
const diskLevel = computed(() => level(stats.value?.disk_percent));

async function fetch() {
  loading.value = true;
  try {
    stats.value = (await getSystemMonitor()).data;
  } catch {
    ElMessage.error("获取系统监控数据失败");
  } finally {
    loading.value = false;
  }
}

// 无感静默刷新：仅更新资源指标，不触发 loading
async function silentRefresh() {
  try {
    const res = (await getSystemMonitor()).data;
    if (res && stats.value) {
      stats.value.cpu_percent = res.cpu_percent;
      stats.value.ram_percent = res.ram_percent;
      stats.value.ram_used_mb = res.ram_used_mb;
      stats.value.ram_total_mb = res.ram_total_mb;
      stats.value.disk_percent = res.disk_percent;
      stats.value.disk_used_gb = res.disk_used_gb;
      stats.value.disk_total_gb = res.disk_total_gb;
      stats.value.uptime_str = res.uptime_str;
      stats.value.proc_start = res.proc_start;
      stats.value.now_cn = res.now_cn;
    }
  } catch {
    // 静默失败，不弹错误
  }
}

let pollTimer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  fetch();
  pollTimer = setInterval(silentRefresh, 3000);
});

onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
});
</script>

<style scoped>
.monitor { display: flex; flex-direction: column; gap: 18px; }

.page-header { display: flex; justify-content: space-between; align-items: flex-end; }
.page-title { font-size: 22px; font-weight: 700; color: var(--text-primary); margin: 0; letter-spacing: -0.01em; }
.page-sub { color: var(--text-tertiary); font-size: 13px; margin: 4px 0 0; }
.sample-time { font-variant-numeric: tabular-nums; }

/* —— 资源监控卡片 —— */
.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}
@media (max-width: 1200px) { .metric-grid { grid-template-columns: repeat(2, 1fr); } }

.metric-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-lg);
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.metric-head {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
}
.metric-head svg { width: 14px; height: 14px; }

.metric-value {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  line-height: 1.15;
}
.metric-value.low { color: var(--success); }
.metric-value.mid { color: var(--warning); }
.metric-value.high { color: var(--danger); }
.metric-value.uptime { color: var(--text-primary); font-size: 20px; }

.metric-bar {
  height: 5px;
  background: var(--bg-base);
  border-radius: 999px;
  overflow: hidden;
  border: 1px solid var(--border-base);
}
.metric-fill { height: 100%; transition: width 0.6s ease; }
.metric-fill.low { background: var(--success); }
.metric-fill.mid { background: var(--warning); }
.metric-fill.high { background: var(--danger); }

.metric-sub {
  font-size: 12px;
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

/* —— 通用 panel —— */
.panel {
  background: var(--bg-elevated);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-lg);
  padding: 18px 20px;
}
.panel-head { margin-bottom: 12px; }
.panel-title { font-size: 14px; font-weight: 600; color: var(--text-primary); }

/* —— 业务概览 —— */
.biz-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}
@media (max-width: 1200px) { .biz-grid { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 768px) { .biz-grid { grid-template-columns: repeat(2, 1fr); } }
.biz-cell {
  border: 1px solid var(--border-base);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  background: var(--bg-base);
}
.biz-label { font-size: 12px; color: var(--text-tertiary); margin-bottom: 6px; }
.biz-value {
  font-size: 24px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

/* —— 表统计 —— */
.row-count { font-variant-numeric: tabular-nums; font-weight: 500; color: var(--text-primary); }
.row-error { color: var(--danger); font-size: 12px; }
.db-error {
  margin-top: 10px;
  padding: 8px 12px;
  background: var(--danger-soft);
  color: var(--danger);
  font-size: 12px;
  border-radius: var(--radius-sm);
}

/* —— 事件标签 —— */
.event-tag {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}
.tag-error { background: var(--danger-soft); color: var(--danger); }
.tag-security { background: rgba(99, 102, 241, 0.12); color: #6366f1; }
.tag-warn { background: rgba(245, 158, 11, 0.14); color: var(--warning); }
.tag-info { background: rgba(99, 102, 241, 0.08); color: var(--text-secondary); }
</style>
