# 提示词管理 / Prompt Management

这个文件夹包含了Agent Adventure游戏中使用的所有AI提示词，支持动态加载和运行时修改。

This folder contains all the AI prompts used in the Agent Adventure game, with support for dynamic loading and runtime modification.

## 文件结构 / File Structure

```
prompts/
├── index.ts              # 静态提示词备份 / Static prompt backup
├── en/                   # 英文提示词文本文件 / English prompt text files
│   ├── base-system-instruction.txt
│   └── dialogue-tool-description.txt
├── zh/                   # 中文提示词文本文件 / Chinese prompt text files
│   ├── base-system-instruction.txt
│   └── dialogue-tool-description.txt
├── README.md            # 这个文件 / This file
scripts/
└── copy-prompts.js      # 构建脚本：复制提示词到public目录 / Build script
utils/
├── dynamicPromptLoader.ts # 动态提示词加载器 / Dynamic prompt loader
├── promptInitializer.ts   # 提示词初始化器 / Prompt initializer
└── promptDevTools.ts      # 开发者调试工具 / Developer tools
```

## 🚀 快速开始 / Quick Start

### 动态修改提示词 / Dynamic Prompt Modification

1. **编辑提示词文件**
   ```bash
   # 编辑中文基础提示词
   nano prompts/zh/base-system-instruction.txt
   
   # 编辑英文对话工具描述
   nano prompts/en/dialogue-tool-description.txt
   ```

2. **复制到public目录**
   ```bash
   npm run copy-prompts
   ```

3. **在浏览器中立即生效**
   ```javascript
   // 浏览器控制台
   promptDevTools.reload()
   ```

### 构建时自动处理 / Automatic Build Processing

```bash
# 构建时自动复制提示词
npm run build

# 开发时手动复制
npm run copy-prompts
```

## 🔧 开发调试 / Development & Debugging

### 浏览器控制台工具 / Browser Console Tools

应用启动后，可在浏览器控制台使用以下命令：
After app startup, use these commands in browser console:

```javascript
// 📊 查看提示词缓存状态 / Check prompt cache status
promptDevTools.status()

// 🔄 重新加载所有提示词 / Reload all prompts
promptDevTools.reload()

// 🗑️ 清除提示词缓存 / Clear prompt cache
promptDevTools.clear()

// 📄 查看特定提示词内容 / View specific prompt content
promptDevTools.getPrompt('zh', 'base-system-instruction')
promptDevTools.getPrompt('en', 'dialogue-tool-description')
```

### 系统架构 / System Architecture

```
应用启动 → 预加载提示词 → 缓存到内存 → AI服务使用
App Start → Preload Prompts → Cache in Memory → AI Service Uses

运行时修改文件 → copy-prompts.js → public/prompts/ → fetch API → 更新缓存
Runtime File Edit → copy-prompts.js → public/prompts/ → fetch API → Update Cache
```

## 📝 使用方法 / Usage Methods

### 1. 开发时快速测试 / Development Quick Testing

```bash
# 修改提示词文件
vim prompts/zh/base-system-instruction.txt

# 复制到public目录
npm run copy-prompts

# 浏览器控制台重新加载
# promptDevTools.reload()
```

### 2. 生产环境部署 / Production Deployment

```bash
# 修改提示词文件
nano prompts/en/dialogue-tool-description.txt

# 构建（自动复制）
npm run build

# 部署dist目录
```

### 3. 在代码中使用 / Using in Code

```typescript
// 静态导入（备用）
import { PROMPTS } from '../prompts';

// 动态加载（推荐）
import { DynamicPromptLoader } from '../utils/dynamicPromptLoader';

// 同步获取（需要预加载）
const baseInstruction = DynamicPromptLoader.getBaseSystemInstructionSync('zh');

// 异步获取
const description = await DynamicPromptLoader.getDialogueToolDescription('en');
```

## 🎯 提示词类型说明 / Prompt Types

### baseSystemInstruction
**游戏的核心系统提示词** / **Core system prompt for the game**

包含内容 / Contents:
- ✅ JSON格式规则 / JSON formatting rules
- ✅ 对话工具使用规则 / Dialogue tool usage rules  
- ✅ 禁止的speaker名称 / Forbidden speaker names
- ✅ 游戏世界观和行为指导 / Game world and behavior guidance

### dialogueToolDescription
**对话工具功能描述** / **Dialogue tool description**

功能 / Function:
- 🎭 指导AI何时使用show_dialogue工具
- 🚫 防止工具滥用（系统、叙述等）
- 📝 规范对话格式和speaker命名

## ⚠️ 维护注意事项 / Maintenance Notes

### 开发流程 / Development Workflow

1. **编辑文本文件** → 修改 `prompts/{language}/*.txt`
   Edit text files → Modify `prompts/{language}/*.txt`

2. **同步更新静态备份** → 更新 `prompts/index.ts`
   Sync static backup → Update `prompts/index.ts`

3. **测试提示词效果** → 使用开发者工具验证
   Test prompt effects → Use dev tools to verify

4. **确保双语一致** → 中英文逻辑保持同步
   Ensure bilingual consistency → Keep CN/EN logic in sync

### 故障排除 / Troubleshooting

```javascript
// 检查提示词是否成功加载
promptDevTools.status()

// 如果加载失败，查看控制台错误
// 手动重试加载
promptDevTools.reload()

// 清除缓存并重新开始
promptDevTools.clear()
```

### 性能优化 / Performance Optimization

- ✅ 应用启动时预加载所有提示词
- ✅ 内存缓存避免重复请求
- ✅ 错误时自动fallback到静态备份
- ✅ 开发时支持热重载

### 最佳实践 / Best Practices

1. **测试先行** - 修改前在控制台测试提示词效果
2. **渐进式修改** - 小步骤迭代，避免大幅度改动
3. **版本控制** - 重要修改前备份当前版本
4. **双语同步** - 确保中英文提示词逻辑一致
5. **监控日志** - 关注控制台的提示词加载状态

---

*本文档涵盖了Agent Adventure项目中的动态提示词管理系统。如有问题，请查看浏览器控制台的详细日志信息。*

*This documentation covers the dynamic prompt management system in the Agent Adventure project. For issues, check the detailed logs in the browser console.*