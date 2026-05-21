import axios from "axios";
import { useUserStore } from "@/stores/user";
import router from "@/router";

export function getApiBase(): string {
  return localStorage.getItem("whisper_server_url") || import.meta.env.VITE_API_BASE || "https://commu.fun";
}

const http = axios.create({
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

http.interceptors.request.use((config) => {
  config.baseURL = getApiBase();
  const userStore = useUserStore();
  const isLoginRequest = String(config.url || "").includes("packer_login");
  if (userStore.token && !isLoginRequest) {
    config.headers.Authorization = `Bearer ${userStore.token}`;
  } else if (isLoginRequest) {
    delete config.headers.Authorization;
  }
  return config;
});

let isLoggingOut = false;

http.interceptors.response.use(
  (res) => res,
  (err) => {
    if (
      err.response?.status === 401 &&
      !isLoggingOut &&
      !err.config?.url?.includes("packer_login") &&
      !err.config?.headers?.["X-Session-Check"]
    ) {
      isLoggingOut = true;
      const userStore = useUserStore();
      userStore.logout();
      router.replace({ name: "Login" }).finally(() => {
        isLoggingOut = false;
      });
    }
    return Promise.reject(err);
  }
);

export default http;
