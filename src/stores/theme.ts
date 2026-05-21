import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";

// 默认浅色（除非用户显式切换过到暗色）
const initial = localStorage.getItem("whisper_theme") === "dark";

export const useThemeStore = defineStore("theme", () => {
  const dark = ref(initial);

  function toggle() {
    dark.value = !dark.value;
  }
  function set(val: boolean) {
    dark.value = val;
  }

  watch(
    dark,
    (val) => {
      localStorage.setItem("whisper_theme", val ? "dark" : "light");
      document.documentElement.setAttribute("data-theme", val ? "dark" : "light");
      // 同步原生窗口标题栏主题
      try {
        getCurrentWindow().setTheme(val ? "dark" : "light");
      } catch {
        // 非 Tauri 环境忽略
      }
    },
    { immediate: true }
  );

  return { dark, toggle, set };
});
