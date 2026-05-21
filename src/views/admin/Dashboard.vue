<template>
  <SuperadminDashboard v-if="userStore.isSuperAdmin" />
  <div v-else class="admin-page dashboard">
    <div class="page-header">
      <div>
        <h1 class="page-title">数据面板</h1>
        <p class="page-sub">租户视角，按 owner_id 隔离的业务概览</p>
      </div>
      <div class="page-actions">
        <el-button :icon="RefreshRight" @click="fetchData" :loading="loading" size="small">刷新</el-button>
      </div>
    </div>

    <!-- 4 张主卡 -->
    <div class="stat-grid">
      <div v-for="item in statCards" :key="item.label" class="stat-card">
        <div class="stat-icon" :style="{ color: item.iconColor }">
          <Icon :icon="item.icon" />
        </div>
        <div class="stat-body">
          <div class="stat-label">{{ item.label }}</div>
          <div class="stat-value tabular-nums">{{ loaded ? (Number(item.value) || 0).toLocaleString() : '--' }}</div>
          <div class="stat-foot" :class="item.trendCls">{{ item.foot }}</div>
        </div>
      </div>
    </div>

    <!-- 趋势 + 详细 -->
    <div class="grid-2">
      <div class="panel">
        <div class="panel-head">
          <div>
            <div class="panel-title">近 7 日访问趋势</div>
            <div class="panel-sub">来自当前租户名下所有实例的聚合访问</div>
          </div>
        </div>
        <v-chart :option="chartOption" autoresize style="height: 260px" />
      </div>

      <div class="panel side">
        <div class="panel-head">
          <div class="panel-title">数据明细</div>
        </div>
        <div class="detail-list">
          <div v-for="m in detailItems" :key="m.label" class="detail-row">
            <div class="detail-left">
              <span class="dot" :style="{ background: m.color }" />
              <span>{{ m.label }}</span>
            </div>
            <div class="detail-val tabular-nums">{{ m.value }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { getDashboard, getDashboardChart, type DashboardStats } from "@/api/admin";
import { ElMessage } from "element-plus";
import { RefreshRight } from "@element-plus/icons-vue";
import { Icon } from "@iconify/vue";
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import VChart from "vue-echarts";
import { useUserStore } from "@/stores/user";
import SuperadminDashboard from "./SuperadminDashboard.vue";

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent]);

const userStore = useUserStore();

const data = ref<DashboardStats | null>(null);
const chartDates = ref<string[]>([]);
const chartCounts = ref<number[]>([]);
const loading = ref(false);
const loaded = ref(false);

/* 4 张主卡：用语义化色（brand / success / warning / danger） */
const statCards = computed(() => {
  const d = data.value;
  const total = d?.total_cards ?? 0;
  const used = d?.used_cards ?? 0;
  const usedRate = total ? Math.round((used / total) * 1000) / 10 : 0;
  return [
    {
      label: "总卡密数",
      value: total,
      icon: "ant-design:key-outlined",
      iconColor: "var(--brand)",
      foot: `${d?.total_software ?? 0} 个实例`,
      trendCls: "muted",
    },
    {
      label: "已激活",
      value: used,
      icon: "ant-design:check-circle-outlined",
      iconColor: "var(--success)",
      foot: `激活率 ${usedRate}%`,
      trendCls: "ok",
    },
    {
      label: "未使用",
      value: d?.unused_cards ?? 0,
      icon: "ant-design:clock-circle-outlined",
      iconColor: "var(--info)",
      foot: "等待激活",
      trendCls: "muted",
    },
    {
      label: "今日事件",
      value: d?.today_events ?? 0,
      icon: "ant-design:thunderbolt-outlined",
      iconColor: "var(--warning)",
      foot: "近 24 小时",
      trendCls: "muted",
    },
  ];
});

const detailItems = computed(() => {
  const d = data.value;
  return [
    { label: "未使用", value: d?.unused_cards ?? "--", color: "#3b82f6" },
    { label: "已激活", value: d?.used_cards ?? "--", color: "#10b981" },
    { label: "已过期", value: d?.expired_cards ?? "--", color: "#f59e0b" },
    { label: "已封禁", value: d?.banned_cards ?? "--", color: "#ef4444" },
    { label: "软件数", value: d?.total_software ?? "--", color: "#6366f1" },
    { label: "今日事件", value: d?.today_events ?? "--", color: "#64748b" },
  ];
});

const chartOption = computed(() => ({
  tooltip: {
    trigger: "axis",
    backgroundColor: "#1d2129",
    borderWidth: 0,
    textStyle: { color: "#fff", fontSize: 12 },
  },
  grid: { left: 36, right: 16, top: 12, bottom: 24 },
  xAxis: {
    type: "category",
    data: chartDates.value,
    boundaryGap: false,
    axisLine: { lineStyle: { color: "#e5e6eb" } },
    axisTick: { show: false },
    axisLabel: { color: "#86909c", fontSize: 11 },
  },
  yAxis: {
    type: "value",
    minInterval: 1,
    splitLine: { lineStyle: { color: "#f0f0f0" } },
    axisLabel: { color: "#86909c", fontSize: 11 },
  },
  series: [
    {
      type: "line",
      data: chartCounts.value,
      smooth: false,
      symbol: "circle",
      symbolSize: 4,
      lineStyle: { color: "#165dff", width: 1.6 },
      itemStyle: { color: "#165dff" },
    },
  ],
}));

async function fetchData() {
  loading.value = true;
  try {
    const [statsRes, chartRes] = await Promise.all([getDashboard(), getDashboardChart(7)]);
    data.value = statsRes.data;
    chartDates.value = chartRes.data.dates;
    chartCounts.value = chartRes.data.counts;
    loaded.value = true;
  } catch {
    ElMessage.error("获取统计数据失败");
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  // 超管视图由 SuperadminDashboard.vue 自行加载，避免重复请求租户接口
  if (!userStore.isSuperAdmin) fetchData();
});
</script>

<style scoped>
/* —— 4 大卡 —— */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}
@media (max-width: 1100px) {
  .stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-md);
  transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s ease;
  animation: card-in 0.4s cubic-bezier(0.34,1.56,0.64,1) both;
}
.stat-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.08);
}
.stat-card:nth-child(1) { animation-delay: 0s; }
.stat-card:nth-child(2) { animation-delay: 0.06s; }
.stat-card:nth-child(3) { animation-delay: 0.12s; }
.stat-card:nth-child(4) { animation-delay: 0.18s; }
@keyframes card-in {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}

.stat-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.stat-icon svg { width: 20px; height: 20px; }

.stat-body { flex: 1; min-width: 0; }
.stat-label {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-bottom: 2px;
}
.stat-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.2;
}
.stat-foot {
  margin-top: 2px;
  font-size: 11px;
  color: var(--text-tertiary);
}
.stat-foot.ok { color: var(--success); }
.stat-foot.warn { color: var(--warning); }
.stat-foot.bad { color: var(--danger); }

/* —— 下半部 2 列 —— */
.grid-2 {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 10px;
}
@media (max-width: 1100px) {
  .grid-2 { grid-template-columns: 1fr; }
}

.panel {
  background: var(--bg-elevated);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  animation: panel-in 0.45s ease both;
  animation-delay: 0.22s;
}
@keyframes panel-in {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
.panel-head { margin-bottom: 10px; }
.panel-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.panel-sub {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 2px;
}

.detail-list { display: flex; flex-direction: column; }
.detail-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 8px;
  border-bottom: 1px solid var(--border-base);
  border-radius: 4px;
  font-size: 12px;
  transition: background 0.15s;
}
.detail-row:hover { background: var(--bg-hover, rgba(127,127,127,0.06)); }
.detail-row:last-child { border-bottom: none; }
.detail-left {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.detail-val {
  color: var(--text-primary);
  font-weight: 600;
}
</style>
