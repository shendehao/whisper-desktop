<template>
  <div class="app-shell">
    <!-- ============== 侧边栏 ============== -->
    <aside class="sidebar">
      <div class="brand">
        <img src="/img/logo.png" alt="Whisper" class="brand-logo" />
        <div class="brand-meta">
          <div class="brand-name">Whisper</div>
          <div class="brand-tag">管理后台</div>
        </div>
      </div>

      <nav class="nav">
        <div v-for="group in visibleGroups" :key="group.title" class="nav-group">
          <div class="nav-group-title">{{ group.title }}</div>
          <router-link
            v-for="item in group.items"
            :key="item.path"
            :to="item.path"
            class="nav-item"
            :class="{ active: $route.path === item.path }"
          >
            <span class="nav-icon"><Icon :icon="item.icon" /></span>
            <span class="nav-label">{{ item.label }}</span>
            <span v-if="item.badge" class="nav-badge">{{ item.badge }}</span>
          </router-link>
        </div>
      </nav>

      <div class="sidebar-footer">
        <div class="user-chip">
          <div class="avatar">{{ avatarChar }}</div>
          <div class="user-meta">
            <div class="user-name">{{ userStore.username }}</div>
            <div class="user-role">{{ roleLabel }}</div>
          </div>
        </div>
        <div class="ver">v{{ currentVersion }}</div>
      </div>
    </aside>

    <!-- ============== 主区 ============== -->
    <div class="main-area">
      <header class="topbar">
        <div class="crumbs">
          <span class="crumb-home"><Icon icon="ant-design:home-outlined" /></span>
          <span class="crumb-sep">/</span>
          <span class="crumb-current">{{ currentLabel }}</span>
        </div>
        <div class="topbar-actions">
          <button class="icon-btn" :title="checking ? '检查中…' : '检查更新'" @click="handleCheckUpdate" :disabled="checking">
            <Icon :icon="checking ? 'ant-design:loading-outlined' : 'ant-design:reload-outlined'" :class="{ spinning: checking }" />
          </button>
          <button class="icon-btn" :title="isDark ? '切换浅色' : '切换深色'" @click="themeStore.toggle()">
            <Icon :icon="isDark ? 'ant-design:bulb-outlined' : 'ant-design:bulb-filled'" />
          </button>
          <button class="logout-btn" @click="handleLogout">
            <Icon icon="ant-design:logout-outlined" />
            <span>退出</span>
          </button>
        </div>
      </header>

      <main class="content">
        <router-view v-slot="{ Component }">
          <transition name="page-slide" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>

    <!-- 更新弹窗（全局） -->
    <UpdatePrompt />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { Icon } from "@iconify/vue";
import { useUserStore } from "@/stores/user";
import { useThemeStore } from "@/stores/theme";
import UpdatePrompt from "@/components/UpdatePrompt.vue";
import {
  startAutoCheck,
  stopAutoCheck,
  checkUpdate,
  checking,
  currentVersion,
} from "@/composables/useUpdateCheck";

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const themeStore = useThemeStore();
const isDark = computed(() => themeStore.dark);

interface MenuItem {
  path: string;
  label: string;
  icon: string;
  role?: "admin+" | "superadmin";
  perm?: string;
  group: "business" | "ops";
  badge?: string;
}

const allMenus: MenuItem[] = [
  // —— 业务管理：所有租户均可见（含超管作为租户身份）——
  { path: "/admin/dashboard", label: "数据面板", icon: "ant-design:dashboard-outlined", group: "business" },
  { path: "/admin/software", label: "实例管理", icon: "ant-design:appstore-outlined", role: "admin+", group: "business" },
  { path: "/admin/lua-scripts", label: "文件下发", icon: "ant-design:cloud-download-outlined", role: "admin+", group: "business" },
  { path: "/admin/cards", label: "卡密管理", icon: "ant-design:key-outlined", group: "business" },
  { path: "/admin/cloud-vars", label: "云变量", icon: "ant-design:database-outlined", role: "admin+", group: "business" },
  { path: "/admin/announcements", label: "公告管理", icon: "ant-design:notification-outlined", role: "admin+", group: "business" },
  { path: "/admin/blacklist", label: "我的黑名单", icon: "ant-design:stop-outlined", perm: "blacklist_manage", group: "business" },
  { path: "/admin/sub-accounts", label: "子账号", icon: "ant-design:team-outlined", role: "admin+", group: "business" },
  { path: "/admin/logs", label: "事件日志", icon: "ant-design:file-text-outlined", group: "business" },
  { path: "/admin/docs", label: "接入文档", icon: "ant-design:read-outlined", group: "business" },
  // —— 运维管理：仅超级管理员（平台级能力，与业务数据隔离）——
  { path: "/admin/users", label: "租户管理", icon: "ant-design:user-switch-outlined", role: "superadmin", group: "ops" },
  { path: "/admin/device-blacklist", label: "设备黑名单", icon: "ant-design:mobile-outlined", role: "superadmin", group: "ops" },
  { path: "/admin/monitor", label: "系统监控", icon: "ant-design:line-chart-outlined", role: "superadmin", group: "ops" },
  { path: "/admin/cloud-update", label: "云更新推送", icon: "ant-design:cloud-upload-outlined", role: "superadmin", group: "ops" },
  { path: "/admin/global-logs", label: "全局日志", icon: "ant-design:history-outlined", role: "superadmin", group: "ops" },
  { path: "/admin/settings", label: "系统设置", icon: "ant-design:setting-outlined", role: "superadmin", group: "ops" },
];

const visibleMenus = computed(() => {
  const role = userStore.role;
  return allMenus.filter((m) => {
    if (m.role === "superadmin" && role !== "superadmin") return false;
    if (m.role === "admin+" && role === "sub_account") return false;
    if (m.perm && role === "sub_account" && !userStore.hasPermission(m.perm)) return false;
    return true;
  });
});

const visibleGroups = computed(() => {
  const business = visibleMenus.value.filter((m) => m.group === "business");
  const ops = visibleMenus.value.filter((m) => m.group === "ops");
  const groups: { title: string; items: MenuItem[] }[] = [];
  if (business.length) groups.push({ title: "业务管理", items: business });
  if (ops.length) groups.push({ title: "运维管理", items: ops });
  return groups;
});

const currentLabel = computed(() => {
  const m = allMenus.find((x) => x.path === route.path);
  return m?.label || "管理后台";
});

const roleLabel = computed(() => {
  const map: Record<string, string> = {
    superadmin: "超级管理员",
    admin: "主账号",
    sub_account: "子账号",
  };
  return map[userStore.role] || "用户";
});

const avatarChar = computed(() => (userStore.username || "U").charAt(0).toUpperCase());

async function handleCheckUpdate() {
  const info = await checkUpdate(false);
  if (info && !info.has_update) {
    ElMessage.success(`已是最新版本 v${currentVersion.value}`);
  }
}

function handleLogout() {
  userStore.logout();
  router.push("/login");
}

onMounted(() => {
  // 登录态下启动自动轮询：立即检查一次，之后每 30 分钟一次
  startAutoCheck();
});
onBeforeUnmount(() => {
  stopAutoCheck();
});
</script>

<style scoped>
/* ============== 整体布局 ============== */
.app-shell {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: var(--bg-base);
}

/* ============== 侧边栏 ============== */
.sidebar {
  width: 196px;
  flex-shrink: 0;
  background: var(--bg-sidebar);
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-sidebar);
  position: relative;
}


/* —— 品牌 —— */
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 16px 14px;
  border-bottom: 1px solid var(--border-sidebar);
}
.brand-logo {
  width: 28px;
  height: 28px;
  object-fit: contain;
  /* 白色圆形底盘：保证 logo 在浅色/深色主题下都清晰可见 */
  background: #fff;
  border-radius: 50%;
  padding: 3px;
  box-sizing: content-box;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.06);
  flex-shrink: 0;
  display: block;
}

/* 预留上一版背景色块样式到备用类 */
.brand-logo-fallback {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  background: var(--brand);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
}
.brand-logo-fallback svg { width: 16px; height: 16px; }
.brand-meta { line-height: 1.2; }
.brand-name {
  color: var(--text-sidebar-active);
  font-weight: 600;
  font-size: 14px;
  letter-spacing: 0.02em;
}
.brand-tag {
  color: var(--text-sidebar-muted);
  font-size: 11px;
  margin-top: 1px;
}

/* —— 导航 —— */
.nav {
  flex: 1;
  overflow-y: auto;
  padding: 8px 8px 12px;
}
.nav-group + .nav-group { margin-top: 12px; }
.nav-group-title {
  font-size: 11px;
  color: var(--text-sidebar-muted);
  letter-spacing: 0.06em;
  padding: 8px 10px 4px;
  font-weight: 500;
  text-transform: uppercase;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  margin: 1px 0;
  border-radius: var(--radius-sm);
  color: var(--text-sidebar);
  text-decoration: none;
  font-size: 13px;
  position: relative;
  transition: background 0.2s ease, color 0.2s ease, transform 0.18s ease, box-shadow 0.2s ease;
}
.nav-item:hover {
  background: var(--bg-sidebar-hover);
  color: var(--text-sidebar-active);
  transform: translateX(3px);
}
.nav-item:active {
  transform: translateX(1px) scale(0.98);
}
.nav-item.active {
  background: var(--bg-sidebar-active);
  color: var(--text-sidebar-active);
  box-shadow: inset 3px 0 0 0 var(--brand);
}

.nav-icon {
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.nav-icon svg { width: 16px; height: 16px; }

.nav-label { flex: 1; }
.nav-badge {
  background: var(--brand);
  color: #fff;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  font-weight: 500;
}

/* —— 侧边栏底部用户 —— */
.sidebar-footer {
  border-top: 1px solid var(--border-sidebar);
  padding: 10px 12px;
}
.user-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px;
  border-radius: var(--radius-sm);
  transition: background 0.15s;
}
.user-chip:hover { background: var(--bg-sidebar-hover); }
.avatar {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  background: var(--brand);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 13px;
  flex-shrink: 0;
}
.user-meta { min-width: 0; flex: 1; }
.user-name {
  color: var(--text-sidebar-active);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.user-role {
  color: var(--text-sidebar-muted);
  font-size: 11px;
  margin-top: 1px;
}
.ver {
  color: var(--text-sidebar-muted);
  font-size: 10px;
  text-align: center;
  margin-top: 8px;
  letter-spacing: 0.04em;
}

/* ============== 主区 ============== */
.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.topbar {
  height: 44px;
  flex-shrink: 0;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-header);
  border-bottom: 1px solid var(--border-base);
}

.crumbs {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
  font-size: 12px;
}
.crumb-home { color: var(--text-tertiary); display: inline-flex; }
.crumb-home svg { width: 14px; height: 14px; }
.crumb-sep { color: var(--text-tertiary); }
.crumb-current { color: var(--text-primary); font-weight: 500; }

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-btn {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s, color 0.2s, transform 0.15s;
}
.icon-btn:hover:not(:disabled) {
  color: var(--text-primary);
  background: var(--bg-hover);
  transform: scale(1.12);
}
.icon-btn:active:not(:disabled) {
  transform: scale(0.92);
}
.icon-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.icon-btn svg { width: 14px; height: 14px; }
.icon-btn .spinning { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.logout-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  height: 28px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-base);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 12px;
  transition: color 0.15s, border-color 0.15s;
}
.logout-btn:hover {
  color: var(--danger);
  border-color: var(--danger);
}
.logout-btn svg { width: 13px; height: 13px; }

.content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 18px;
  background: var(--bg-base);
}
/* ============== 页面切换动效 ============== */
.page-slide-enter-active {
  transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.34,1.56,0.64,1);
}
.page-slide-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.page-slide-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
.page-slide-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
