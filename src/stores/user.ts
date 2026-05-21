import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { authApi } from "@/api/auth";

export type UserRole = "superadmin" | "admin" | "sub_account";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
}

export const useUserStore = defineStore("user", () => {
  const token = ref(localStorage.getItem("whisper_token") || "");
  const username = ref(localStorage.getItem("whisper_username") || "");
  const userId = ref(Number(localStorage.getItem("whisper_user_id")) || 0);
  const role = ref<UserRole>((localStorage.getItem("whisper_role") as UserRole) || "admin");
  const parentId = ref<number | null>(readJson<number | null>("whisper_parent_id", null));
  const permissions = ref<string[]>(readJson<string[]>("whisper_permissions", []));
  const sessionValid = ref(!!localStorage.getItem("whisper_token"));

  const isLoggedIn = computed(() => !!token.value && sessionValid.value);
  const isSuperAdmin = computed(() => role.value === "superadmin");
  const isAdmin = computed(() => role.value === "admin");
  const isSubAccount = computed(() => role.value === "sub_account");

  function hasPermission(perm: string): boolean {
    if (role.value === "superadmin" || role.value === "admin") return true;
    return permissions.value.includes(perm);
  }

  async function login(user: string, pass: string) {
    const res = await authApi.login(user, pass);
    if (res.code === 0) {
      token.value = res.token;
      username.value = res.username;
      userId.value = res.user_id;
      role.value = res.role || "admin";
      parentId.value = res.parent_id ?? null;
      permissions.value = res.permissions || [];
      sessionValid.value = true;
      localStorage.setItem("whisper_token", res.token);
      localStorage.setItem("whisper_username", res.username);
      localStorage.setItem("whisper_user_id", String(res.user_id));
      localStorage.setItem("whisper_role", res.role || "admin");
      localStorage.setItem("whisper_parent_id", JSON.stringify(res.parent_id ?? null));
      localStorage.setItem("whisper_permissions", JSON.stringify(res.permissions || []));
    }
    return res;
  }

  async function validateSession(): Promise<boolean> {
    if (!token.value) return false;
    try {
      const { default: http } = await import("@/api");
      const res = await http.get("/api/desktop/dashboard", {
        headers: { "X-Session-Check": "1" },
      });
      return res.status === 200;
    } catch {
      logout();
      return false;
    }
  }

  function logout() {
    token.value = "";
    username.value = "";
    userId.value = 0;
    role.value = "admin";
    parentId.value = null;
    permissions.value = [];
    sessionValid.value = false;
    localStorage.removeItem("whisper_token");
    localStorage.removeItem("whisper_username");
    localStorage.removeItem("whisper_user_id");
    localStorage.removeItem("whisper_role");
    localStorage.removeItem("whisper_parent_id");
    localStorage.removeItem("whisper_permissions");
  }

  return { token, username, userId, role, parentId, permissions, isLoggedIn, isSuperAdmin, isAdmin, isSubAccount, hasPermission, login, logout, sessionValid, validateSession };
});
