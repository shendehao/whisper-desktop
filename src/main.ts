import { createApp } from "vue";
import { createPinia } from "pinia";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import zhCn from "element-plus/es/locale/lang/zh-cn";
import { MotionPlugin } from "@vueuse/motion";
import App from "./App.vue";
import router from "./router";
import "./styles/tokens.css";
import "./styles/main.css";
import "./styles/element-overrides.css";
import { resolveCurrentVersion } from "@/composables/useUpdateCheck";

// 启动时立即从 Rust 端拉取真实版本号（编译期常量），避免登录页 / 设置页显示构建缓存里的旧版本
resolveCurrentVersion();

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(ElementPlus, { locale: zhCn });
app.use(MotionPlugin);
app.mount("#app");
