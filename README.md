# Agent Adventure

**Last Updated: 2025-01-28**
**🚀 当前状态: 准备开始重构V2 - 桌面级现代化升级**

Agent Adventure 是一个由 AI 驱动的动态文字冒险游戏社区平台。该应用使用 Google Gemini 生成叙述内容和 Imagen 生成插图，为用户创造独特且沉浸式的故事体验。

项目目前正准备进行大规模重构，从移动端优先的应用升级为**现代化的桌面级全栈应用**，采用最新的 React 生态系统最佳实践。

## 项目概述

Agent Adventure 是一个基于 React + TypeScript 构建的现代 Web 应用，集成了 Supabase 作为后端服务，提供用户认证、数据存储和社区功能。

### 技术架构

**前端技术栈：**
- React 19.1.1 + TypeScript
- Vite 作为构建工具
- CSS-in-JS 响应式设计
- PWA 支持（渐进式 Web 应用）

**后端服务：**
- Supabase (PostgreSQL 数据库)
- 用户认证和授权 (Row Level Security)
- 实时数据同步

**AI 集成：**
- Google Gemini API (文本生成)
- Google Imagen API (图片生成)
- 自定义 OpenAI 兼容端点支持

### 核心功能

**🎮 动态故事生成**
- AI 根据玩家选择实时生成丰富的故事内容
- 支持多轮对话和复杂剧情分支
- 智能的故事总结和里程碑记录系统

**🎨 AI 生成视觉内容**
- 每个场景可配备精美的 AI 生成图片
- 动态背景和封面图片支持
- 优雅的图片加载和错误处理

**👥 社区平台**
- 用户注册、登录、个人资料管理
- 故事创作、编辑、发布和分享
- 公开/私有故事访问控制
- 故事分类和搜索功能

**📚 资料库系统**
- 丰富的资料卡管理（角色、地点、道具、任务等）
- 智能引用和占位符替换
- 支持自定义资料卡类型

**💾 进度保存**
- 自动游戏进度保存到数据库
- 跨设备同步游戏状态
- 最近游玩记录管理

**⚙️ 高度自定义**
- 灵活的 AI 后端配置（Gemini/自定义端点）
- 丰富的 LLM 参数调节（温度、Top-P、Top-K 等）
- UI 主题、缩放、透明度个性化设置
- 中英双语界面支持

### 应用结构

```
agent-adventure/
├── components/           # React 组件
│   ├── ActionsPanel.tsx     # 游戏操作面板
│   ├── BottomNavBar.tsx     # 底部导航栏
│   ├── SceneDisplay.tsx     # 场景展示组件
│   ├── StoryCard.tsx        # 故事卡片组件
│   └── ...
├── pages/               # 页面组件
│   ├── HomePage.tsx         # 主页
│   ├── ExplorePage.tsx      # 探索页
│   ├── CreatePage.tsx       # 创作页
│   ├── GamePage.tsx         # 游戏页
│   ├── ProfilePage.tsx      # 个人资料页
│   └── AuthPage.tsx         # 认证页面
├── services/            # 服务层
│   ├── aiService.ts         # AI 服务接口
│   ├── geminiService.ts     # Gemini API 集成
│   └── supabaseClient.ts    # Supabase 客户端
├── contexts/            # React Context
│   └── AuthContext.tsx      # 认证上下文
├── hooks/               # 自定义 Hooks
│   └── useLocalStorage.ts   # 本地存储 Hook
├── types.ts             # TypeScript 类型定义
├── constants.ts         # 常量和配置
└── supabase/            # 数据库相关
    └── migrations/          # 数据库迁移文件
```

### 数据模型

**Stories 表（故事）**
- 基本信息：标题、描述、封面、分类、可见性
- 创作内容：资料库、背景设定、开场白
- 关系：创作者 ID、创建时间

**Profiles 表（用户资料）**
- 用户基本信息：用户名、头像
- 关系：对应 Supabase Auth 用户

**Playthroughs 表（游戏进度）**
- 游戏状态：对话历史、回合数、角色名
- 总结数据：故事总结、里程碑记录
- 关系：用户 ID、故事 ID

**Library Cards（资料卡）**
- 类型：角色、地点、道具、任务、设定、自定义
- 内容：名称、描述、关键词、AI 指令

## 🚀 重构计划 V2 (2025-01-28)

### 重构目标
基于 [Gemini 项目分析结果](./重构计划V2.md)，将 Agent Adventure 重构为现代化的桌面级应用：

**目标技术栈：**
- **Frontend**: React + TypeScript + Vite (保持)
- **Styling**: Tailwind CSS (从CDN迁移到构建流程)
- **State Management**: TanStack Query (React Query) + Zustand
- **UI Components**: shadcn/ui (基于 Radix UI)
- **AI SDKs**: Vercel AI SDK (支持多providers)
- **PWA**: Vite PWA plugin
- **Quality Control**: Storybook + Testing

**核心改进：**
- ✅ 从移动端优先升级到桌面级体验
- ✅ 现代化状态管理替代Props drilling
- ✅ 专业UI组件库和设计系统
- ✅ 性能优化和包体积优化
- ✅ 完整的开发工具链和质量控制

📋 [查看详细重构计划](./重构计划V2.md)

## 最新开发进展

### 🔧 当前开发状态 (2025-09-26)

**✅ V2重构已完成功能：**
- ⚡ **现代化技术栈**: React 19 + TypeScript + Vite 7
- 🎨 **UI组件系统**: shadcn/ui + Radix UI + Tailwind CSS 4.1
- 🗂️ **状态管理**: TanStack Query + Zustand
- 🧭 **路由系统**: React Router Dom 7.9
- 📱 **PWA支持**: 完整的渐进式Web应用功能
- 🧪 **开发工具**: Storybook + Vitest测试框架
- 🏗️ **组件库**: 完整的桌面级UI设计系统
- 💾 **数据层**: 完善的数据获取和缓存机制
- 🎮 **HTML组件系统**: 完整的可视化组件开发和AI工具集成

**🚀 V2重构成果：**
- 📚 **原有功能完整保留**: Supabase集成、用户认证、故事创作、AI对话、图片生成
- 🖥️ **桌面级体验**: 专业的多面板布局、可调整窗口、键盘快捷键支持
- ⚡ **性能大幅提升**: 代码分割、懒加载、优化的包体积
- 🔧 **开发体验升级**: 组件文档、类型安全、自动化测试
- 🎨 **现代化界面**: 统一的设计系统、响应式布局、主题切换

**🔄 进行中的优化：**
- 移动端适配的最终调优
- HTML组件编辑器的Monaco Editor升级
- 社区功能的桌面端优化

## 开发环境设置

### 前置条件
- Node.js 18+ 
- npm 或 yarn
- Supabase 账户和项目

### 安装和运行

1. **克隆仓库**
   ```bash
   git clone <repository-url>
   cd agent-adventure
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **配置环境**
   - 在 `services/supabaseClient.ts` 中配置 Supabase URL 和 API Key
   - 确保 Supabase 项目中已创建相应的数据表和 RLS 策略

4. **启动开发服务器**
   ```bash
   npm run dev
   ```

5. **构建生产版本**
   ```bash
   npm run build
   npm run preview
   ```

### 数据库设置

项目使用 Supabase PostgreSQL 数据库，需要创建以下表结构：

- `profiles` - 用户资料表
- `stories` - 故事内容表  
- `playthroughs` - 游戏进度表

数据库迁移文件位于 `supabase/migrations/` 目录中。

## 技术特色

### 🎯 智能 AI 集成
- **双模型支持**：同时支持 Google Gemini 和自定义 OpenAI 兼容端点
- **上下文管理**：智能的对话历史压缩和总结
- **动态参数调节**：实时调整 AI 模型参数以获得最佳体验

### 🏗️ 现代架构设计
- **组件化开发**：高度模块化的 React 组件设计
- **类型安全**：全面的 TypeScript 类型定义
- **状态管理**：React Context + Hooks 的轻量级状态管理
- **响应式设计**：适配移动端和桌面端的现代 UI

### 🔐 安全性考虑
- **Row Level Security**：数据库层面的用户数据隔离
- **认证集成**：基于 Supabase Auth 的安全认证系统
- **API 密钥管理**：安全的密钥存储和管理机制

### 🌐 用户体验
- **PWA 支持**：可安装的 Web 应用体验
- **离线能力**：Service Worker 支持基础离线功能
- **多语言**：完整的中英双语界面
- **主题系统**：深色/浅色模式切换

---

**Agent Adventure** - 让每个人都能成为故事的创作者和冒险家 🚀