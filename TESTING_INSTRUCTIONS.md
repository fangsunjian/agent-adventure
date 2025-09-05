# 🧪 新游戏引擎测试指南

## 快速验证步骤

### 1. 系统状态检查
访问 http://localhost:5174，打开浏览器控制台，运行：

```javascript
// 检查工具注册状态
console.log('🧪 Running Game Engine Tests...');
gameEngineTests.runAllTests();
```

预期输出：
```
🚀 Starting Game Engine Tests...
🧪 Testing Game Tool Registry...
✅ Loaded 7 tools: ['show_dialogue', 'advance_scene', ...]
✅ Game Tool Registry test passed!
🧪 Testing Scene Analyzer...
✅ Scene analysis result: { sceneType: 'exploration', ... }
✅ Scene Analyzer test passed!
📊 Test Results: 3/3 passed
🎉 All tests passed! Game Engine is ready!
```

### 2. 新引擎启用验证

在游戏中：
1. 进入游戏设置
2. 选择 "Custom Provider"  
3. 启用 "Enable Dialogue Tools"
4. 开始一个新游戏

在控制台中应该看到：
```
🎮 Using new Game Engine...
🔧 Selected tools: ['advance_scene', 'generate_actions']
📊 Scene analysis: { sceneType: 'exploration', confidence: 0.5, ... }
```

### 3. 工具调用验证

开始游戏后，在控制台中应该看到：
```
🔧 Executing tool: advance_scene
✅ Tool advance_scene executed successfully
🔧 Executing tool: generate_actions  
✅ Tool generate_actions executed successfully
```

### 4. 错误处理验证

如果遇到错误，系统会：
1. 显示详细错误信息
2. 自动回退到旧系统
3. 继续正常游戏流程

控制台会显示：
```
❌ Game Engine failed, falling back to legacy system: [error details]
🔄 Using legacy system...
```

## 🔧 手动测试工具

### 提示词系统测试
```javascript
// 检查提示词状态
promptDevTools.status();

// 重新加载提示词
promptDevTools.reload();

// 查看特定提示词
promptDevTools.getPrompt('zh', 'base-system-instruction');
```

### 游戏引擎组件测试
```javascript
// 单独测试工具注册
gameEngineTests.testGameToolRegistry();

// 单独测试场景分析
gameEngineTests.testSceneAnalyzer();

// 单独测试工具执行
gameEngineTests.testToolExecution();
```

## ⚠️ 已知问题和解决方案

### 问题1：新引擎未启用
**症状**：游戏继续使用旧系统，控制台显示 "🔄 Using legacy system..."
**解决**：
- 确认设置：Custom Provider + Enable Dialogue Tools
- 检查API配置是否正确

### 问题2：工具调用失败  
**症状**：控制台显示 "❌ Tool execution failed"
**解决**：
- 检查API是否支持 `tool_choice: "required"`
- 验证API密钥和端点配置
- 查看详细错误信息

### 问题3：构建错误
**症状**：`npm run build` 失败
**解决**：
- 检查TypeScript类型错误
- 确认所有导入/导出正确
- 运行 `npm run dev` 查看详细错误

## 🎯 性能监控

### 执行时间监控
新引擎会报告执行时间：
```javascript
// 在游戏流程中查看
console.log('Execution time:', result.engineData.executionTime, 'ms');
```

### 工具使用统计
```javascript
// 查看使用了哪些工具
console.log('Tools used:', result.engineData.toolsUsed);
```

### 场景分析准确性
```javascript
// 查看场景分析的置信度
console.log('Scene confidence:', result.engineData.sceneAnalysis.confidence);
```

## 📊 成功标准

✅ **基础功能**：
- 所有测试通过
- 游戏正常启动和运行
- 工具调用成功执行

✅ **错误恢复**：
- 工具失败时能够回退
- 引擎错误时自动使用旧系统
- 游戏流程不中断

✅ **性能表现**：
- 场景生成速度正常
- Token使用量合理
- 内存占用稳定

---

*测试完成后，新的工具化游戏引擎应该能够提供更可靠、更智能的游戏体验！* 🎮✨