import { createRouter, createWebHashHistory } from "vue-router";
import { useUserStore } from "@/stores/user";

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: "/login",
      name: "Login",
      component: () => import("@/views/Login.vue"),
      meta: { guest: true },
    },
    {
      path: "/",
      redirect: "/admin/dashboard",
    },
    {
      path: "/admin",
      component: () => import("@/views/admin/Layout.vue"),
      meta: { requiresAuth: true },
      children: [
        {
          path: "dashboard",
          name: "Dashboard",
          component: () => import("@/views/admin/Dashboard.vue"),
        },
        {
          path: "cards",
          name: "Cards",
          component: () => import("@/views/admin/Cards.vue"),
        },
        {
          path: "software",
          name: "Software",
          component: () => import("@/views/admin/Software.vue"),
          meta: { minRole: "admin" },
        },
        {
          path: "cloud-vars",
          name: "CloudVars",
          component: () => import("@/views/admin/CloudVars.vue"),
          meta: { minRole: "admin" },
        },
        {
          path: "announcements",
          name: "Announcements",
          component: () => import("@/views/admin/Announcements.vue"),
          meta: { minRole: "admin" },
        },
        {
          path: "blacklist",
          name: "Blacklist",
          component: () => import("@/views/admin/Blacklist.vue"),
          meta: { perm: "blacklist_manage" },
        },
        {
          path: "device-blacklist",
          name: "DeviceBlacklist",
          component: () => import("@/views/admin/DeviceBlacklist.vue"),
          meta: { minRole: "superadmin" },
        },
        {
          path: "sub-accounts",
          name: "SubAccounts",
          component: () => import("@/views/admin/SubAccounts.vue"),
          meta: { minRole: "admin" },
        },
        {
          path: "logs",
          name: "Logs",
          component: () => import("@/views/admin/Logs.vue"),
        },
        {
          path: "users",
          name: "Users",
          component: () => import("@/views/admin/Users.vue"),
          meta: { minRole: "superadmin" },
        },
        {
          path: "monitor",
          name: "Monitor",
          component: () => import("@/views/admin/Monitor.vue"),
          meta: { minRole: "superadmin" },
        },
        {
          path: "global-logs",
          name: "GlobalLogs",
          component: () => import("@/views/admin/GlobalLogs.vue"),
          meta: { minRole: "superadmin" },
        },
        {
          path: "cloud-update",
          name: "CloudUpdate",
          component: () => import("@/views/admin/CloudUpdate.vue"),
          meta: { minRole: "superadmin" },
        },
        {
          path: "lua-scripts",
          name: "LuaScripts",
          component: () => import("@/views/admin/LuaScripts.vue"),
          meta: { minRole: "admin" },
        },
        {
          path: "docs",
          name: "Docs",
          component: () => import("@/views/admin/Docs.vue"),
        },
        {
          path: "settings",
          name: "Settings",
          component: () => import("@/views/admin/Settings.vue"),
          meta: { minRole: "superadmin" },
        },
      ],
    },
  ],
});

const ROLE_LEVEL: Record<string, number> = { sub_account: 0, admin: 1, superadmin: 2 };

let checkedToken = "";

router.beforeEach(async (to, _from, next) => {
  const userStore = useUserStore();

  if (to.meta.requiresAuth && userStore.token && checkedToken !== userStore.token) {
    const tokenToCheck = userStore.token;
    const valid = await userStore.validateSession();
    if (!valid) {
      checkedToken = "";
      return next({ name: "Login" });
    }
    checkedToken = tokenToCheck;
  }

  if (to.meta.requiresAuth && !userStore.isLoggedIn) {
    return next({ name: "Login" });
  }
  if (to.meta.guest && userStore.isLoggedIn) {
    return next({ name: "Dashboard" });
  }
  const minRole = to.meta.minRole as string | undefined;
  if (minRole) {
    const userLevel = ROLE_LEVEL[userStore.role] ?? 0;
    const requiredLevel = ROLE_LEVEL[minRole] ?? 0;
    if (userLevel < requiredLevel) return next({ name: "Dashboard" });
  }
  const perm = to.meta.perm as string | undefined;
  if (perm && !userStore.hasPermission(perm)) {
    return next({ name: "Dashboard" });
  }
  next();
});

export default router;
