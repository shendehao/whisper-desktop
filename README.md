# Whisper Desktop

Whisper 卡密管理系统桌面客户端，基于 **Tauri 2 + Vue 3 + Element Plus** 构建。

## 功能特性

- 卡密批量生成、查询、封禁、解绑管理
- 多软件实例隔离（租户模型）
- 云变量 / 公告 / 黑名单管理
- 子账号权限体系（超管 / 主账号 / 子账号）
- Lua 脚本云端下发
- 软件内自动更新（云更新推送）
- 暗色 / 亮色主题切换
- 实时数据面板与 ECharts 趋势图

## 技术栈

| 层 | 技术 |
|---|------|
| 桌面框架 | Tauri 2 (Rust) |
| 前端框架 | Vue 3 + TypeScript |
| UI 组件 | Element Plus |
| 状态管理 | Pinia |
| 路由 | Vue Router 4 |
| 图表 | ECharts + vue-echarts |
| 样式 | TailwindCSS + CSS Variables |
| 构建 | Vite 6 |

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器（仅前端）
npm run dev

# 启动 Tauri 开发模式（含 Rust 后端）
npm run tauri dev

# 构建生产版本
npm run tauri build
```

## 项目结构

```
whisper-desktop/
├── src/                  # Vue 前端源码
│   ├── api/              # API 请求层
│   ├── composables/      # 组合式函数
│   ├── router/           # 路由配置
│   ├── stores/           # Pinia 状态管理
│   ├── styles/           # 全局样式 & 主题
│   └── views/            # 页面组件
├── src-tauri/            # Tauri / Rust 后端
│   ├── src/              # Rust 源码
│   ├── icons/            # 应用图标
│   ├── Cargo.toml        # Rust 依赖
│   └── tauri.conf.json   # Tauri 配置
├── package.json
└── vite.config.ts
```

## License

MIT
