<template>
  <div class="login-scene" :class="{ light: !isDark }">
    <!-- 明暗切换 -->
    <button class="theme-toggle" @click="themeStore.toggle()" title="切换明暗">
      <svg v-if="isDark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="5" />
        <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
      </svg>
    </button>

    <!-- 背景 -->
    <div class="bg-noise"></div>
    <div class="bg-spot"></div>

    <!-- 卡片 -->
    <div class="card">
      <!-- Logo 区 -->
      <div class="brand">
        <img src="/img/logo.png" alt="Whisper" class="brand-logo" />
        <div class="brand-text">
          <span class="brand-name">Whisper</span>
          <span class="brand-sep"></span>
          <span class="brand-tag">管理后台</span>
        </div>
      </div>

      <!-- 分割线 -->
      <div class="divider"></div>

      <!-- 表单 -->
      <form @submit.prevent="handleLogin" class="form">
        <div class="field" :class="{ shake: errors.username }">
          <label>账户</label>
          <div class="input-box" :class="{ focus: focusState.username, error: errors.username }">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
            <input
              v-model="form.username"
              type="text"
              autocomplete="username"
              placeholder="输入用户名"
              @focus="focusState.username = true; errors.username = ''"
              @blur="focusState.username = false"
              @keydown.enter.prevent="focusPwd"
            />
          </div>
          <transition name="fade">
            <span class="err" v-if="errors.username">{{ errors.username }}</span>
          </transition>
        </div>

        <div class="field" :class="{ shake: errors.password }">
          <label>密码</label>
          <div class="input-box" :class="{ focus: focusState.password, error: errors.password }">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            <input
              ref="pwdInput"
              v-model="form.password"
              :type="showPwd ? 'text' : 'password'"
              autocomplete="current-password"
              placeholder="输入密码"
              @focus="focusState.password = true; errors.password = ''"
              @blur="focusState.password = false"
              @keyup.enter="handleLogin"
            />
            <button type="button" class="toggle-pwd" @click="showPwd = !showPwd" tabindex="-1">
              <svg v-if="!showPwd" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            </button>
          </div>
          <transition name="fade">
            <span class="err" v-if="errors.password">{{ errors.password }}</span>
          </transition>
        </div>

        <button type="submit" class="btn-submit" :disabled="loading">
          <template v-if="!loading">登 录</template>
          <template v-else>
            <svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round" />
            </svg>
          </template>
        </button>
      </form>

      <p class="footer-ver">Whisper Desktop v{{ currentVersion }}</p>
      <p class="footer-links">
        <a href="https://commu.fun/privacy.html" target="_blank">隐私声明</a>
        <span class="link-sep">|</span>
        <a href="https://commu.fun/terms.html" target="_blank">用户使用协议</a>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from "vue";
import { useRouter } from "vue-router";
import { useUserStore } from "@/stores/user";
import { useThemeStore } from "@/stores/theme";
import { ElMessage } from "element-plus";
import { currentVersion } from "@/composables/useUpdateCheck";

const router = useRouter();
const userStore = useUserStore();
const themeStore = useThemeStore();
const isDark = computed(() => themeStore.dark);
const loading = ref(false);
const showPwd = ref(false);
const form = reactive({ username: "", password: "" });
const errors = reactive({ username: "", password: "" });
const focusState = reactive({ username: false, password: false });
const pwdInput = ref<HTMLInputElement | null>(null);
function focusPwd() { pwdInput.value?.focus(); }

async function handleLogin() {
  errors.username = form.username.trim() ? "" : "请输入用户名";
  errors.password = form.password.trim() ? "" : "请输入密码";
  if (errors.username || errors.password) return;

  loading.value = true;
  try {
    const res = await userStore.login(form.username, form.password);
    if (res.code === 0) {
      ElMessage.success("登录成功");
      router.push("/admin/dashboard");
    } else {
      ElMessage.error(res.message || "登录失败");
    }
  } catch {
    ElMessage.error("网络错误，请检查服务器连接");
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
/* ===== 暗色变量（默认） ===== */
.login-scene {
  --bg: #111113;
  --card-bg: #18181b;
  --card-border: #27272a;
  --input-bg: #09090b;
  --input-border: #27272a;
  --text-primary: #fafafa;
  --text-secondary: #a1a1aa;
  --text-muted: #71717a;
  --text-placeholder: #3f3f46;
  --icon-color: #52525b;
  --sep-color: #3f3f46;
  --divider: #27272a;
  --accent: #6366f1;
  --accent-hover: #4f46e5;
  --accent-text: #ffffff;
  --accent-shadow: rgba(99,102,241,.18);
  --err: #ef4444;
  /* 暗色背景下 logo 反色以保持可见性 */
  --logo-invert: brightness(0) invert(1);
  --spot-color: rgba(99,102,241,.08);
  --noise-opacity: .028;
  --ver-color: #27272a;
  --toggle-bg: rgba(255,255,255,.06);
  --toggle-color: #a1a1aa;
}

/* ===== 亮色变量 ===== */
.login-scene.light {
  --bg: #f4f4f5;
  --card-bg: #ffffff;
  --card-border: #e4e4e7;
  --input-bg: #fafafa;
  --input-border: #d4d4d8;
  --text-primary: #18181b;
  --text-secondary: #52525b;
  --text-muted: #71717a;
  --text-placeholder: #a1a1aa;
  --icon-color: #a1a1aa;
  --sep-color: #d4d4d8;
  --divider: #e4e4e7;
  --accent: #6366f1;
  --accent-hover: #4f46e5;
  --accent-text: #ffffff;
  --accent-shadow: rgba(99,102,241,.18);
  --err: #dc2626;
  --logo-invert: none;
  --spot-color: rgba(99,102,241,.05);
  --noise-opacity: .015;
  --ver-color: #d4d4d8;
  --toggle-bg: rgba(0,0,0,.05);
  --toggle-color: #52525b;
}

/* ===== 场景 ===== */
.login-scene {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  overflow: hidden;
  transition: background .3s;
}

/* 明暗切换按钮 */
.theme-toggle {
  position: absolute;
  top: 24px;
  right: 24px;
  z-index: 10;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: none;
  background: var(--toggle-bg);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background .2s;
}
.theme-toggle:hover { background: var(--card-border); }
.theme-toggle svg {
  width: 18px;
  height: 18px;
  color: var(--toggle-color);
  transition: color .2s;
}

.bg-noise {
  position: absolute;
  inset: 0;
  opacity: var(--noise-opacity);
  background: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size: 200px;
  pointer-events: none;
}

.bg-spot {
  position: absolute;
  width: 500px;
  height: 500px;
  top: -120px;
  right: -100px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--spot-color) 0%, transparent 70%);
  pointer-events: none;
  animation: spot-drift 8s ease-in-out infinite alternate;
}
@keyframes spot-drift {
  0%   { transform: translate(0, 0) scale(1); }
  100% { transform: translate(-30px, 20px) scale(1.08); }
}

/* ===== 卡片 ===== */
.card {
  position: relative;
  width: 380px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  padding: 40px 32px 28px;
  z-index: 1;
  transition: background .3s, border-color .3s;
  animation: card-enter 0.55s cubic-bezier(0.34,1.56,0.64,1) both;
}
@keyframes card-enter {
  from { opacity: 0; transform: translateY(30px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

/* ===== 品牌区 ===== */
.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}
.brand-logo {
  width: 56px;
  height: 56px;
  object-fit: contain;
  filter: var(--logo-invert);
}
.brand-text {
  display: flex;
  align-items: center;
  gap: 10px;
}
.brand-name {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: 1px;
  transition: color .3s;
}
.brand-sep {
  width: 1px;
  height: 14px;
  background: var(--sep-color);
  transition: background .3s;
}
.brand-tag {
  font-size: 13px;
  color: var(--text-muted);
  letter-spacing: 1px;
  transition: color .3s;
}

/* ===== 分割线 ===== */
.divider {
  height: 1px;
  background: var(--divider);
  margin: 28px 0;
  transition: background .3s;
}

/* ===== 表单 ===== */
.form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.field label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 8px;
  transition: color .3s;
}

.input-box {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 44px;
  padding: 0 12px;
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: 10px;
  transition: border-color .2s, box-shadow .2s, background .3s;
}
.input-box.focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-shadow), 0 0 16px -4px var(--accent-shadow);
}
.input-box.error {
  border-color: var(--err);
  box-shadow: 0 0 0 2px rgba(220,38,38,.08);
}

.input-box svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--icon-color);
  transition: color .2s;
}
.input-box.focus svg { color: var(--accent); }

.input-box input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 14px;
  font-family: inherit;
  caret-color: var(--accent);
  transition: color .3s;
}
.input-box input::placeholder { color: var(--text-placeholder); }
/* 隐藏 Edge/WebView2 自带的密码可见性/清除按钮，避免与自定义按钮重复 */
.input-box input::-ms-reveal,
.input-box input::-ms-clear { display: none; }

.toggle-pwd {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  display: flex;
}
.toggle-pwd svg { width: 16px; height: 16px; color: var(--icon-color); }
.toggle-pwd:hover svg { color: var(--text-secondary); }

.err {
  display: block;
  font-size: 12px;
  color: var(--err);
  margin-top: 5px;
}

/* shake 动画 */
.shake {
  animation: shakeX .4s ease;
}
@keyframes shakeX {
  0%,100% { transform: translateX(0); }
  20% { transform: translateX(-6px); }
  40% { transform: translateX(5px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(2px); }
}

/* fade transition */
.fade-enter-active { transition: opacity .2s, transform .2s; }
.fade-leave-active { transition: opacity .15s; }
.fade-enter-from { opacity: 0; transform: translateY(-4px); }
.fade-leave-to { opacity: 0; }

/* ===== 按钮 ===== */
.btn-submit {
  height: 44px;
  border: none;
  border-radius: 10px;
  background: var(--accent);
  color: var(--accent-text);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 3px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 4px;
  transition: background .2s, transform .15s, box-shadow .2s, color .3s;
}
.btn-submit:hover:not(:disabled) {
  background: var(--accent-hover);
  box-shadow: 0 6px 20px rgba(99,102,241,.32);
}
.btn-submit:active:not(:disabled) {
  transform: scale(.98);
}
.btn-submit:disabled {
  opacity: .6;
  cursor: not-allowed;
}

.spinner {
  width: 20px;
  height: 20px;
  color: var(--accent-text);
  animation: spin .6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ===== 底部 ===== */
.footer-ver {
  text-align: center;
  color: var(--ver-color);
  font-size: 11px;
  margin: 24px 0 0;
  transition: color .3s;
}
.footer-links {
  text-align: center;
  margin-top: 8px;
  font-size: 11px;
}
.footer-links a {
  color: var(--text-muted);
  text-decoration: none;
  transition: color .2s;
}
.footer-links a:hover {
  color: var(--accent);
  text-decoration: underline;
}
.footer-links .link-sep {
  color: var(--text-placeholder);
  margin: 0 6px;
}
</style>
