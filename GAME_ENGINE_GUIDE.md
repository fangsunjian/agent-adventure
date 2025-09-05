# 🎮 新游戏引擎使用指南

## 概述

Agent Adventure 已经升级为完全工具化的游戏系统！新系统使用 `tool_choice: "required"` 确保 100% 的可靠工具调用，提供更一致和智能的游戏体验。

## 🔧 系统架构

### 核心组件

1. **GameToolRegistry** - 工具注册和管理系统
2. **SceneAnalyzer** - 智能场景分析器
3. **GameEngine** - 主游戏引擎
4. **动态工具加载** - 根据场景自动选择最合适的工具

### 工具类型

#### 核心工具（始终可用）
- `advance_scene` - 推进游戏场景
- `show_dialogue` - 显示NPC对话
- `generate_actions` - 生成玩家行动选项
- `show_system_message` - 显示系统消息

#### 总结系统工具（按需加载）
- `create_minor_summary` - 创建小总结
- `create_major_summary` - 创建大总结
- `update_memory` - 更新游戏记忆

## 🚀 快速开始

### 1. 启用新游戏引擎

新引擎会在以下条件下自动启用：
- 使用 Custom Provider
- 启用 Dialogue Tools 选项

```javascript
// 在游戏设置中
settings.provider = 'custom';
settings.enableDialogueTools = true;
```

### 2. 浏览器控制台测试

访问 http://localhost:5174，打开浏览器控制台，运行测试：

```javascript
// 运行所有测试
gameEngineTests.runAllTests();

// 单独测试组件
gameEngineTests.testGameToolRegistry();
gameEngineTests.testSceneAnalyzer();
gameEngineTests.testToolExecution();
```

### 3. 查看工具状态

```javascript
// 查看已注册的工具
console.log('可用工具:', GameToolRegistry.getTools().map(t => t.name));

// 查看场景分析结果
const analysis = SceneAnalyzer.analyze(history, memories, story);
console.log('场景分析:', analysis);
```

## 🔍 调试和监控

### 控制台日志
新系统提供详细的调试日志：

- `🎮 Using new Game Engine...` - 新引擎启动
- `🔧 Selected tools: [...]` - 选中的工具
- `📊 Scene analysis:` - 场景分析结果
- `🔧 Executing tool: xxx` - 工具执行
- `✅ Tool xxx executed successfully` - 工具成功执行

### 错误处理
系统具有多层错误处理：

1. **工具级错误** - 单个工具失败时的回退机制
2. **引擎级错误** - 整个引擎失败时回退到旧系统
3. **JSON修复** - 使用 jsonrepair 处理格式问题

## 📈 性能优化

### 动态工具加载
系统根据场景类型智能选择工具，减少不必要的token使用：

```javascript
// 探索场景 - 加载基础工具
SceneType.EXPLORATION → ['advance_scene', 'generate_actions']

// 对话场景 - 加载对话相关工具  
SceneType.DIALOGUE → ['show_dialogue', 'advance_scene']

// 总结场景 - 加载总结工具
SceneType.SUMMARY → ['create_minor_summary', 'update_memory']
```

### Interleaved Thinking 支持
系统准备好支持 OpenRouter 的 Interleaved Thinking 功能，在复杂场景中提供多步推理能力。

## 🛠️ 故障排除

### 常见问题

1. **新引擎未启用**
   - 检查 `settings.provider === 'custom'`
   - 检查 `settings.enableDialogueTools === true`

2. **工具调用失败**
   - 查看控制台错误日志
   - 检查 API 配置是否正确
   - 验证 `tool_choice: "required"` 是否被API支持

3. **场景分析错误**
   - 系统会自动回退到安全的默认场景
   - 查看 `scene_analysis` 日志了解详情

### 开发者工具

```javascript
// 提示词管理工具
promptDevTools.status();
promptDevTools.reload();

// 游戏引擎测试
gameEngineTests.runAllTests();

// 查看通信日志
// 在游戏页面的调试面板中查看详细通信记录
```

## 🔄 回退机制

如果新引擎出现问题，系统会自动回退：

1. **工具失败** → 使用fallback数据继续游戏
2. **引擎失败** → 回退到原有的 `getNextSceneWithTools`
3. **API错误** → 显示友好的错误信息并提供重试选项

## 📊 系统监控

游戏引擎提供详细的执行信息：

```javascript
// 引擎执行结果包含
{
  scene: SceneFragment,           // 生成的场景
  rawResponse: string,           // 原始AI响应  
  toolCalls: ToolCall[],         // 执行的工具调用
  engineData: {                  // 引擎数据
    sceneAnalysis: Analysis,     // 场景分析
    toolsUsed: string[],         // 使用的工具
    executionTime: number        // 执行时间
  }
}
```

## 🎯 最佳实践

1. **测试优先** - 使用控制台测试验证系统状态
2. **监控日志** - 关注控制台输出了解系统行为
3. **渐进启用** - 在确认系统稳定后再全面使用
4. **备用方案** - 保持旧系统可用作为备用

---

## 🎉 完成状态

✅ **第一阶段完成** - 核心工具重构
- GameToolRegistry 工具注册系统
- 核心工具：advance_scene, show_dialogue, generate_actions
- SceneAnalyzer 场景分析器
- GameEngine 主引擎
- 完整的错误处理和回退机制

**下一步计划：**
- Interleaved Thinking 集成
- 更多特殊工具（物品管理、战斗系统等）
- 性能优化和用户体验改进

---

*新的工具化游戏引擎已准备就绪！享受更智能、更可靠的游戏体验！* 🎮✨