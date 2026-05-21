<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
    <div class="max-w-lg mx-auto pt-16 px-4">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold text-gray-800">Whisper 验证</h1>
      </div>
      <router-view />
      <div class="text-center mt-8">
        <el-link type="info" @click="$router.push('/login')">管理员登录 →</el-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts"></script>
