<template>
  <el-card shadow="always" class="rounded-xl">
    <div class="text-center mb-6">
      <h2 class="text-lg font-semibold">卡密验证</h2>
      <p class="text-gray-400 text-sm mt-1">输入您的卡密进行授权验证</p>
    </div>
    <el-form @submit.prevent="handleVerify">
      <el-form-item>
        <el-input
          v-model="cardKey"
          placeholder="请输入卡密"
          size="large"
          clearable
        />
      </el-form-item>
      <el-form-item>
        <el-button
          type="primary"
          size="large"
          class="w-full"
          :loading="loading"
          @click="handleVerify"
        >
          验证
        </el-button>
      </el-form-item>
    </el-form>

    <el-result
      v-if="result"
      :icon="result.code === 0 ? 'success' : 'error'"
      :title="result.code === 0 ? '验证通过' : '验证失败'"
      :sub-title="result.msg"
    >
      <template #extra v-if="result.code === 0 && result.data">
        <div class="text-left space-y-2">
          <p><strong>状态：</strong>{{ result.data.status }}</p>
          <p><strong>过期时间：</strong>{{ result.data.expire_date }}</p>
          <p><strong>机器码：</strong>{{ result.data.hwid }}</p>
        </div>
      </template>
    </el-result>
  </el-card>
</template>

<script setup lang="ts">
import { ref } from "vue";
import http from "@/api/index";
import { ElMessage } from "element-plus";

const cardKey = ref("");
const loading = ref(false);
const result = ref<any>(null);

async function handleVerify() {
  if (!cardKey.value.trim()) {
    ElMessage.warning("请输入卡密");
    return;
  }
  loading.value = true;
  result.value = null;
  try {
    const { data } = await http.post("/api/v2/check", {
      key: cardKey.value.trim(),
      hwid: "desktop-client-hwid-placeholder",
      instance_id: "default",
    });
    result.value = data;
  } catch (err: any) {
    result.value = { code: -1, msg: err.message || "网络错误" };
  } finally {
    loading.value = false;
  }
}
</script>
