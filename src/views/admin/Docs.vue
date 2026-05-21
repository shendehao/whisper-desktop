<template>
  <div class="admin-page docs-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">接入文档</h1>
        <p class="page-sub">SDK / API 对接指南，服务器端 GUIDE.md 实时渲染</p>
      </div>
      <div class="page-actions">
        <el-button :icon="RefreshRight" :loading="loading" size="small" @click="fetch">刷新</el-button>
        <span v-if="updatedAt" class="updated-hint">最后更新：{{ formatTime(updatedAt) }}</span>
      </div>
    </div>

    <div v-if="loading && !html" class="loading-block">
      <el-skeleton :rows="12" animated />
    </div>

    <div v-else-if="error" class="error-block">
      <Icon icon="ant-design:warning-outlined" class="err-icon" />
      <div class="err-msg">{{ error }}</div>
      <el-button size="small" @click="fetch">重试</el-button>
    </div>

    <div v-else class="doc-container panel" v-html="html" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { RefreshRight } from "@element-plus/icons-vue";
import { Icon } from "@iconify/vue";
import { getGuide } from "@/api/admin";

const html = ref("");
const updatedAt = ref<string | null>(null);
const loading = ref(false);
const error = ref("");

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleString();
  } catch {
    return iso;
  }
}

async function fetch() {
  loading.value = true;
  error.value = "";
  try {
    const r = await getGuide();
    html.value = r.data.html;
    updatedAt.value = r.data.updated_at;
  } catch (e: any) {
    error.value = e?.response?.data?.detail || "获取接入文档失败";
  } finally {
    loading.value = false;
  }
}

onMounted(fetch);
</script>

<style scoped>
.loading-block { padding: 20px; }
.error-block { text-align: center; padding: 48px 20px; }
.err-icon { font-size: 36px; color: var(--warning); margin-bottom: 12px; }
.err-msg { color: var(--text-secondary); font-size: 13px; margin-bottom: 12px; }
.updated-hint { font-size: 11px; color: var(--text-tertiary); }

.doc-container {
  padding: 20px 24px;
  line-height: 1.75;
  font-size: 14px;
  overflow-x: auto;
}
.doc-container :deep(h1) { font-size: 22px; margin: 32px 0 12px; border-bottom: 1px solid var(--border-base); padding-bottom: 8px; }
.doc-container :deep(h2) { font-size: 18px; margin: 24px 0 10px; }
.doc-container :deep(h3) { font-size: 15px; margin: 20px 0 8px; }
.doc-container :deep(code) {
  background: var(--bg-base);
  padding: 2px 5px;
  border-radius: 3px;
  font-size: 12px;
  font-family: Menlo, Consolas, monospace;
}
.doc-container :deep(pre) {
  background: var(--bg-base);
  padding: 14px 16px;
  border-radius: var(--radius-md);
  overflow-x: auto;
  font-size: 12px;
  line-height: 1.6;
}
.doc-container :deep(pre code) { background: transparent; padding: 0; }
.doc-container :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0;
  font-size: 13px;
}
.doc-container :deep(th),
.doc-container :deep(td) {
  border: 1px solid var(--border-base);
  padding: 8px 10px;
  text-align: left;
}
.doc-container :deep(th) { background: var(--bg-base); font-weight: 600; }
.doc-container :deep(a) { color: var(--brand); }
.doc-container :deep(blockquote) {
  border-left: 3px solid var(--brand);
  padding: 8px 14px;
  margin: 12px 0;
  background: var(--brand-soft);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}
</style>
