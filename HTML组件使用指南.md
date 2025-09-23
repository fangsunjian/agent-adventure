# HTML组件使用指南

## 📖 概述

HTML组件是Agent Adventure中的一个强大功能，让你可以创建自定义的交互式界面，并且让AI在游戏对话中调用你的组件功能。

## 🚀 快速开始

### 1. 创建HTML组件

1. **进入创建页面** → 点击"创建"按钮
2. **添加资料卡** → 点击"添加资料卡"
3. **选择类型** → 选择"HTML组件"
4. **编写代码** → 使用三栏编辑器编写HTML/CSS/JavaScript

### 2. 使用默认模板

系统会自动填入一个完整的测试模板，包含：
- 基础界面元素（按钮、输入框、选择器）
- AI功能测试
- 数据保存/加载功能
- 实时日志系统
- **4个AI工具示例**

## 🛠️ 游戏API

在HTML组件中，你可以使用`window.gameAPI`访问以下功能：

### AI服务
```javascript
// 调用AI生成内容
const response = await window.gameAPI.ai.generate('你的提示词');
console.log('AI回应:', response);
```

### 数据存储
```javascript
// 保存数据（自动添加组件ID前缀）
await window.gameAPI.storage.save('my_data', { score: 100 });

// 加载数据
const data = await window.gameAPI.storage.load('my_data');
console.log('加载的数据:', data);
```

### 游戏交互
```javascript
// 发送数据到游戏引擎
window.gameAPI.game.sendData({ action: 'player_action' });

// 更新游戏状态
window.gameAPI.game.updateState({ health: 90 });

// 记录日志（不等待响应）
window.gameAPI.game.logMessage('玩家完成了任务', 'info');
```

## 🤖 AI工具注册

最强大的功能是让AI调用你的组件功能：

### 基础工具注册
```javascript
// 注册一个简单的工具
await window.gameAPI.tools.register({
  name: 'get_player_score',
  description: '获取玩家当前分数',
  parameters: {
    type: 'object',
    properties: {},
    required: []
  },
  handler: () => {
    return {
      success: true,
      score: playerData.score,
      message: `玩家当前分数: ${playerData.score}`
    };
  }
});
```

### 带参数的工具
```javascript
await window.gameAPI.tools.register({
  name: 'update_player_score',
  description: '更新玩家分数',
  parameters: {
    type: 'object',
    properties: {
      newScore: { 
        type: 'number', 
        description: '新的分数值' 
      },
      reason: { 
        type: 'string', 
        description: '分数变化原因' 
      }
    },
    required: ['newScore']
  },
  handler: (params) => {
    const { newScore, reason } = params;
    playerData.score = newScore;
    
    return {
      success: true,
      message: `分数已更新为 ${newScore}${reason ? `，原因：${reason}` : ''}`
    };
  }
});
```

### 便捷创建方法
```javascript
// 数据查询工具
const queryTool = window.gameAPI.tools.create.dataQuery(
  'query_inventory',
  '查询玩家背包',
  (params) => {
    return { items: playerInventory, count: playerInventory.length };
  }
);
await window.gameAPI.tools.register(queryTool);

// 状态更新工具
const updateTool = window.gameAPI.tools.create.stateUpdate(
  'update_health',
  '更新玩家血量',
  (params) => {
    playerData.health = params.updates.health;
    return { success: true, newHealth: playerData.health };
  }
);
await window.gameAPI.tools.register(updateTool);

// 计算工具
const calcTool = window.gameAPI.tools.create.calculation(
  'calculate_damage',
  '计算伤害值',
  {
    type: 'object',
    properties: {
      attack: { type: 'number', description: '攻击力' },
      defense: { type: 'number', description: '防御力' }
    },
    required: ['attack', 'defense']
  },
  (params) => {
    const damage = Math.max(1, params.attack - params.defense);
    return { damage, message: `造成${damage}点伤害` };
  }
);
await window.gameAPI.tools.register(calcTool);
```

### 工具管理
```javascript
// 查看已注册的工具
const tools = await window.gameAPI.tools.list();
console.log('已注册的工具:', tools);

// 取消注册工具
await window.gameAPI.tools.unregister('tool_name');

// 批量注册工具
await window.gameAPI.tools.registerBatch([tool1, tool2, tool3]);
```

## 🎮 在游戏中使用

### 1. 运行组件
- 游戏页面会自动检测HTML组件
- 点击右下角的代码图标按钮
- 在全屏模式下与组件交互

### 2. AI调用
一旦注册了工具，AI就可以在游戏对话中调用：
- AI会根据游戏情况自动判断何时使用工具
- 工具调用结果会反馈给AI，影响后续对话
- 玩家可以看到工具的执行效果

## 💡 最佳实践

### 1. 错误处理
```javascript
try {
  const result = await window.gameAPI.ai.generate(prompt);
  // 处理成功情况
} catch (error) {
  console.error('AI调用失败:', error);
  // 处理错误情况
}
```

### 2. 参数验证
```javascript
handler: (params) => {
  // 验证必要参数
  if (!params.requiredField) {
    return {
      success: false,
      error: '缺少必要参数: requiredField'
    };
  }
  
  // 执行工具逻辑
  return { success: true, result: '...' };
}
```

### 3. 状态管理
```javascript
// 使用组件内的状态管理
let componentState = {
  data: {},
  initialized: false
};

// 定期保存重要状态
setInterval(async () => {
  await window.gameAPI.storage.save('component_state', componentState);
}, 30000); // 每30秒自动保存
```

## 🔧 调试技巧

### 1. 日志记录
```javascript
// 使用游戏日志系统
window.gameAPI.game.logMessage('调试信息', 'info');
window.gameAPI.game.logMessage('警告信息', 'warning');
window.gameAPI.game.logMessage('错误信息', 'error');
```

### 2. 控制台调试
在游戏页面的浏览器控制台中：
```javascript
// 查看工具统计
GameToolRegistry.getToolStatistics()

// 查看工具健康状态
GameToolRegistry.getToolHealth()

// 测试工具调用
await testAIToolCall('your_tool_name', { param: 'value' })
```

## 📚 示例场景

### 场景1：RPG角色状态管理
创建一个管理玩家属性的组件，AI可以查询和更新血量、魔法值等。

### 场景2：小游戏集成
创建一个小游戏（如猜数字、记忆游戏），AI可以获取游戏结果并据此推进剧情。

### 场景3：数据可视化
创建图表显示游戏数据，AI可以调用工具获取统计信息并生成报告。

### 场景4：自定义计算器
创建特定游戏机制的计算工具，AI可以调用进行复杂的游戏计算。

## 🚨 注意事项

1. **安全性**：HTML组件在沙盒环境中运行，但仍要注意不要执行恶意代码
2. **性能**：避免在工具处理函数中执行耗时操作
3. **数据持久化**：重要数据应该及时保存，组件刷新时数据会丢失
4. **AI调用限制**：合理设计工具，避免AI过度调用影响性能

## 🔗 相关文档

- [HTML组件技术文档](./HtmlComponent.md)
- [开发进度报告](./HTML_COMPONENT_PROGRESS.md)
- [系统架构说明](./大更新.md)

---

**享受创建吧！** 🎨 HTML组件让你的游戏拥有无限可能性。