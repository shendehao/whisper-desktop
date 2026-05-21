<template>
  <div class="admin-page sa-dashboard">
    <div class="page-header">
      <div>
        <h1 class="page-title">数据面板</h1>
        <p class="page-sub">全平台总览（超级管理员视角）</p>
      </div>
      <div class="page-actions">
        <el-button :icon="RefreshRight" :loading="loading" size="small" @click="fetchData">
          刷新数据
        </el-button>
      </div>
    </div>

    <!-- 4 张主卡 -->
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-icon" style="color: var(--brand)">
          <Icon icon="ant-design:team-outlined" />
        </div>
        <div class="stat-body">
          <div class="stat-label">总用户数</div>
          <div class="stat-value tabular-nums">{{ loaded ? data.total_main_users.toLocaleString() : '--' }}</div>
          <div class="stat-foot muted">主用户 · 子账号 {{ data.total_sub_users || 0 }}</div>
        </div>
        <div class="stat-tag tag-ok">活跃</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="color: var(--info)">
          <Icon icon="ant-design:appstore-outlined" />
        </div>
        <div class="stat-body">
          <div class="stat-label">软件实例</div>
          <div class="stat-value tabular-nums">{{ loaded ? data.total_software.toLocaleString() : '--' }}</div>
          <div class="stat-foot muted">运行中</div>
        </div>
        <div class="stat-tag tag-info">实例</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="color: var(--warning)">
          <Icon icon="ant-design:key-outlined" />
        </div>
        <div class="stat-body">
          <div class="stat-label">卡密统计</div>
          <div class="stat-value tabular-nums">{{ loaded ? data.total_cards.toLocaleString() : '--' }}</div>
          <div class="stat-foot warn">总生成 · {{ data.used_cards || 0 }} 已使用</div>
        </div>
        <div class="stat-tag tag-warn">卡密</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="color: var(--success)">
          <Icon icon="ant-design:thunderbolt-outlined" />
        </div>
        <div class="stat-body">
          <div class="stat-label">今日调用</div>
          <div class="stat-value tabular-nums">{{ loaded ? data.today_access.toLocaleString() : '--' }}</div>
          <div class="stat-foot ok">实时 · 次请求</div>
        </div>
        <div class="stat-tag tag-ok">实时</div>
      </div>
    </div>

    <!-- 当前账号维度 -->
    <div class="my-stats">
      <div class="my-stats-head">
        <Icon icon="ant-design:user-outlined" />
        <span>当前账号</span>
      </div>
      <div class="my-stats-grid">
        <div class="my-stat-item">
          <span class="my-stat-label">我的实例</span>
          <span class="my-stat-value tabular-nums" style="color: var(--info)">{{ loaded ? data.my_software.toLocaleString() : '--' }}</span>
        </div>
        <div class="my-stat-item">
          <span class="my-stat-label">我的卡密</span>
          <span class="my-stat-value tabular-nums" style="color: var(--warning)">{{ loaded ? data.my_cards.toLocaleString() : '--' }}</span>
        </div>
        <div class="my-stat-item">
          <span class="my-stat-label">已使用</span>
          <span class="my-stat-value tabular-nums" style="color: var(--success)">{{ loaded ? data.my_used_cards.toLocaleString() : '--' }}</span>
        </div>
      </div>
    </div>

    <!-- 实例访问分布 + 系统动态 -->
    <div class="grid-2">
      <div class="panel">
        <div class="panel-head">
          <div>
            <div class="panel-title">实例访问分布</div>
            <div class="panel-sub">按 access_count 降序前 20 个实例</div>
          </div>
        </div>
        <v-chart
          v-if="data.software_distribution.length > 0"
          :option="chartOption"
          autoresize
          style="height: 320px"
        />
        <div v-else class="empty-tip">暂无实例数据</div>
      </div>

      <div class="panel side">
        <div class="panel-head">
          <div class="panel-title">系统动态</div>
        </div>
        <div class="event-list">
          <div v-for="(ev, i) in data.recent_events" :key="i" class="event-row">
            <div class="event-time tabular-nums">{{ formatTime(ev.timestamp) }}</div>
            <div class="event-type">
              <span class="type-tag" :class="typeClass(ev.event_type)">{{ typeLabel(ev.event_type) }}</span>
            </div>
            <div class="event-msg" :title="ev.message">{{ ev.message }}</div>
          </div>
          <div v-if="data.recent_events.length === 0" class="empty-tip small">暂无事件</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue";
import { ElMessage } from "element-plus";
import { RefreshRight } from "@element-plus/icons-vue";
import { Icon } from "@iconify/vue";
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import VChart from "vue-echarts";
import { getSuperadminDashboard, type SuperadminDashboardData } from "@/api/admin";

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent]);

const loading = ref(false);
const loaded = ref(false);

const data = reactive<SuperadminDashboardData>({
  total_main_users: 0,
  total_sub_users: 0,
  total_software: 0,
  total_cards: 0,
  used_cards: 0,
  today_access: 0,
  software_distribution: [],
  recent_events: [],
  my_software: 0,
  my_cards: 0,
  my_used_cards: 0,
});

const chartOption = computed(() => {
  const labels = data.software_distribution.map((s) => s.name || "(未命名)");
  const values = data.software_distribution.map((s) => Number(s.access_count) || 0);
  return {
    tooltip: {
      trigger: "axis",
      backgroundColor: "#1d2129",
      borderWidth: 0,
      textStyle: { color: "#fff", fontSize: 12 },
    },
    grid: { left: 48, right: 16, top: 16, bottom: 60 },
    xAxis: {
      type: "category",
      data: labels,
      boundaryGap: false,
      axisLine: { lineStyle: { color: "var(--border-base)" } },
      axisTick: { show: false },
      axisLabel: {
        color: "var(--text-tertiary)",
        fontSize: 11,
        rotate: 35,
        interval: 0,
        formatter: (v: string) => (v.length > 8 ? v.slice(0, 7) + "…" : v),
      },
    },
    yAxis: {
      type: "value",
      minInterval: 1,
      splitLine: { lineStyle: { color: "var(--border-base)", opacity: 0.4 } },
      axisLabel: { color: "var(--text-tertiary)", fontSize: 11 },
    },
    series: [
      {
        type: "line",
        data: values,
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        lineStyle: { color: "#6366f1", width: 2 },
        itemStyle: { color: "#6366f1" },
        areaStyle: {
          color: {
            type: "linear",
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(99,102,241,0.30)" },
              { offset: 1, color: "rgba(99,102,241,0.00)" },
            ],
          },
        },
      },
    ],
  };
});

function formatTime(iso: string | null): string {
  if (!iso) return "--";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "--";
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    if (sameDay) return `${hh}:${mm}:${ss}`;
    const m2 = String(d.getMonth() + 1).padStart(2, "0");
    const d2 = String(d.getDate()).padStart(2, "0");
    return `${m2}-${d2} ${hh}:${mm}`;
  } catch {
    return "--";
  }
}

function typeLabel(t: string): string {
  const m: Record<string, string> = {
    info: "信息",
    error: "错误",
    warn: "警告",
    warning: "警告",
    security: "安全",
    perm_change: "权限",
    audit: "审计",
  };
  return m[t] || t || "信息";
}

function typeClass(t: string): string {
  if (["error"].includes(t)) return "tag-danger";
  if (["warn", "warning", "security"].includes(t)) return "tag-warn";
  if (["audit", "perm_change"].includes(t)) return "tag-info";
  return "tag-ok";
}

async function fetchData() {
  loading.value = true;
  try {
    const r = await getSuperadminDashboard();
    Object.assign(data, r.data);
    loaded.value = true;
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.detail || "获取数据失败");
  } finally {
    loading.value = false;
  }
}

onMounted(fetchData);
</script>

<style scoped>
/* —— 4 大卡（带右上角 tag） —— */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}
@media (max-width: 1100px) {
  .stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

.stat-card {
  position: relative;
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
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.stat-icon svg { width: 22px; height: 22px; }

.stat-body { flex: 1; min-width: 0; }
.stat-label {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-bottom: 2px;
}
.stat-value {
  font-size: 22px;
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
.stat-foot.muted { color: var(--text-tertiary); }

.stat-tag {
  position: absolute;
  top: 10px;
  right: 12px;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 999px;
  font-weight: 500;
  letter-spacing: 0.2px;
}
.tag-ok { background: rgba(16, 185, 129, 0.12); color: #10b981; }
.tag-info { background: rgba(99, 102, 241, 0.12); color: #6366f1; }
.tag-warn { background: rgba(245, 158, 11, 0.12); color: #f59e0b; }
.tag-danger { background: rgba(239, 68, 68, 0.12); color: #ef4444; }

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
  min-height: 320px;
  animation: panel-in 0.45s ease both;
  animation-delay: 0.22s;
}
@keyframes panel-in {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
.panel.side { padding: 14px 0 14px 0; }
.panel.side .panel-head { padding: 0 16px; }

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

/* —— 系统动态列表 —— */
.event-list {
  display: flex;
  flex-direction: column;
  max-height: 320px;
  overflow-y: auto;
}
.event-row {
  display: grid;
  grid-template-columns: 70px 56px 1fr;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border-base);
  font-size: 12px;
  transition: background 0.15s;
}
.event-row:hover { background: var(--bg-hover, rgba(127,127,127,0.06)); }
.event-row:last-child { border-bottom: none; }
.event-time { color: var(--text-tertiary); }
.event-type { display: flex; }
.type-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
}
.event-msg {
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-tip {
  text-align: center;
  color: var(--text-tertiary);
  padding: 60px 0;
  font-size: 13px;
}
.empty-tip.small { padding: 30px 0; font-size: 12px; }

/* —— 当前账号统计条 —— */
.my-stats {
  background: var(--bg-elevated);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-md);
  padding: 12px 16px;
  animation: panel-in 0.45s ease both;
  animation-delay: 0.2s;
}
.my-stats-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 10px;
}
.my-stats-head svg { width: 14px; height: 14px; color: var(--text-secondary); }
.my-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.my-stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 14px;
  background: var(--bg-base);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-md);
}
.my-stat-label {
  font-size: 12px;
  color: var(--text-tertiary);
}
.my-stat-value {
  font-size: 20px;
  font-weight: 700;
  line-height: 1.2;
}
</style>
