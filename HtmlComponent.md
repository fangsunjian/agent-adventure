# HTML组件开发计划

## 概述
实现一个全功能的HTML组件系统，作为Library的新类型，支持HTML/CSS/JS代码编辑、运行时展示和AI工具交互。

## 目标
1. 为故事创作者提供可视化HTML组件编辑器
2. 游戏运行时提供HTML组件展示窗口 
3. 为AI提供HTML组件操作工具
4. 建立数据驱动的AI工具接口系统

## 技术架构

### 1. 类型系统扩展
```typescript
// types.ts 扩展
export type LibraryCardType = 'character' | 'location' | 'item' | 'quest' | 'setting' | 'custom' | 'map' | 'html';

export interface HtmlComponentData {
  html: string;
  css: string;
  js: string;
  toolDefinitions?: HtmlToolDefinition[]; // AI工具定义
  previewUrl?: string; // 运行时预览URL
}

export interface HtmlToolDefinition {
  name: string;
  description: string;
  parameters: any;
  jsFunction: string; // 对应的JS函数名
}

// LibraryCard扩展
export interface LibraryCard {
  // 现有字段...
  htmlData?: HtmlComponentData; // HTML组件数据
}
```

### 2. 组件架构

#### 2.1 编辑器组件 (创建页面)
- **HtmlComponentEditor.tsx**
  - 代码编辑器(HTML/CSS/JS三栏)
  - 实时预览窗口
  - AI工具定义编辑器
  - 语法高亮和错误检查

#### 2.2 运行时组件 (游戏页面)
- **HtmlComponentViewer.tsx**
  - 安全的HTML渲染容器(iframe沙盒)
  - 与父窗口的消息通信
  - 尺寸和样式控制

#### 2.3 库编辑器集成
- **LibraryCardEditorModal.tsx** (修改)
  - 添加HTML类型选项
  - 集成HtmlComponentEditor

### 3. 游戏引擎集成

#### 3.1 工具注册系统扩展
```typescript
// GameToolRegistry.ts
static registerContentBasedTools(activeStory: Story) {
  // 现有地图工具检测...
  
  // HTML组件工具检测
  const htmlComponents = activeStory.library.filter(card => 
    card.type === 'html' && card.htmlData
  );
  
  if (htmlComponents.length > 0) {
    this.registerHtmlComponentTools(htmlComponents);
    toolsRegistered.push('html_component_tools');
  }
  
  return toolsRegistered;
}

private static registerHtmlComponentTools(htmlComponents: LibraryCard[]) {
  // 为每个HTML组件注册其定义的AI工具
  htmlComponents.forEach(component => {
    if (component.htmlData?.toolDefinitions) {
      component.htmlData.toolDefinitions.forEach(toolDef => {
        this.register({
          name: `${component.id}_${toolDef.name}`,
          description: toolDef.description,
          parameters: toolDef.parameters,
          handler: async (args, context) => {
            // 调用HTML组件中的对应JS函数
            return this.executeHtmlComponentFunction(
              component.id, 
              toolDef.jsFunction, 
              args,
              context
            );
          },
          requiredFor: ['exploration', 'action'],
          priority: 1
        });
      });
    }
  });
}
```

#### 3.2 HTML组件运行时系统
- **HtmlComponentRuntime.ts**
  - 组件实例管理
  - 沙盒环境控制
  - 与AI工具的数据交换
  - 安全性控制

### 4. 开发阶段计划

#### 阶段1: 基础架构 (1-2天)
- [ ] 扩展类型系统
- [ ] 创建基础HTML组件编辑器
- [ ] 实现简单的代码编辑和预览功能
- [ ] 集成到LibraryCard编辑器

#### 阶段2: 运行时系统 (2-3天) 
- [ ] 开发安全的HTML渲染容器
- [ ] 实现父子窗口通信机制
- [ ] 创建HTML组件查看器
- [ ] 集成到游戏页面

#### 阶段3: AI工具集成 (2-3天)
- [ ] 设计AI工具定义格式
- [ ] 实现工具自动注册系统
- [ ] 开发HTML-AI数据交换机制
- [ ] 实现工具执行和结果处理

#### 阶段4: 优化和完善 (1-2天)
- [ ] 安全性加固
- [ ] 性能优化
- [ ] 错误处理完善
- [ ] 用户体验优化

## 核心特性

### 1. 代码编辑器特性
- 语法高亮 (HTML/CSS/JS)
- 实时预览
- 错误提示
- 代码自动完成
- 多标签页支持

### 2. 运行时特性
- 安全沙盒执行
- 响应式布局
- 动画和交互支持
- 数据持久化
- 错误隔离

### 3. AI集成特性
- 动态工具注册
- 数据驱动接口
- 函数调用映射
- 状态同步
- 结果反馈

## 安全考虑

### 1. 代码执行安全
- iframe沙盒隔离
- CSP(Content Security Policy)限制
- 禁止危险API访问
- XSS防护

### 2. 数据安全
- 输入验证和清理
- 输出编码
- 敏感信息过滤
- 访问权限控制

## 技术选型

### 1. 代码编辑器
- Monaco Editor (VS Code同源) - 推荐专业方案
- 或简单的textarea (参考Starlight Cafe方案，快速实现)

### 2. HTML渲染 (基于参考代码优化)
- iframe沙盒: `sandbox="allow-scripts allow-modals"`
- postMessage双向通信 (Promise-based)
- srcDoc动态内容注入
- CDN资源支持 (Font Awesome等)

### 3. 安全库
- DOMPurify (HTML清理)
- 基础XSS防护 (iframe沙盒已提供基础隔离)

## 数据流设计

```
创作阶段: 
编辑器 → LibraryCard → Database

运行时阶段:
Database → GameEngine → HtmlComponentViewer
                    ↓
AI工具 ← GameToolRegistry ← HtmlComponentRuntime
```

## 接口设计

### 1. HTML组件与宿主应用的通信接口 (基于参考代码优化)
```javascript
// HTML组件内的通信桥接
let callIdCounter = 0;
const pendingCalls = new Map();

function postMessageToHost(action, payload) {
  return new Promise((resolve, reject) => {
    const callId = callIdCounter++;
    pendingCalls.set(callId, { resolve, reject });
    window.parent.postMessage({ action, payload, callId }, '*');
    setTimeout(() => {
      if (pendingCalls.has(callId)) {
        reject(new Error('Request to host timed out.'));
        pendingCalls.delete(callId);
      }
    }, 15000);
  });
}

// 标准游戏API接口
const gameAPI = {
  // AI服务调用 (参考Starlight Cafe)
  ai: {
    generate: (prompt, isJson = false, schema = null) => 
      postMessageToHost('AI_REQUEST', { prompt, isJson, schema })
  },
  
  // 数据持久化 (参考Starlight Cafe)
  storage: {
    save: (key, data) => postMessageToHost('SAVE_DATA', { key, data }),
    load: (key) => postMessageToHost('LOAD_DATA', { key })
  },
  
  // 游戏引擎交互 (新增)
  game: {
    sendData: (data) => postMessageToHost('GAME_DATA', data),
    registerTool: (name, description, parameters, handler) => 
      postMessageToHost('REGISTER_TOOL', { name, description, parameters }),
    updateState: (updates) => postMessageToHost('UPDATE_STATE', updates)
  }
};
```

### 2. 宿主应用消息处理 (GamePage.tsx扩展)
```typescript
// 扩展现有的消息处理系统
const handleHtmlComponentMessage = async (event: MessageEvent, componentId: string) => {
  const { action, payload, callId } = event.data;
  const iframe = componentRef.current;

  switch (action) {
    case 'AI_REQUEST':
      // 转发AI请求到游戏引擎
      const aiResult = await gameEngine.callAI(payload.prompt, payload.isJson, payload.schema);
      iframe?.contentWindow?.postMessage({ 
        action: 'AI_RESPONSE', 
        payload: aiResult, 
        callId 
      }, '*');
      break;
      
    case 'SAVE_DATA':
      // 组件数据持久化
      await saveHtmlComponentData(componentId, payload.key, payload.data);
      iframe?.contentWindow?.postMessage({ action: 'SAVE_SUCCESS', callId }, '*');
      break;
      
    case 'REGISTER_TOOL':
      // 动态注册AI工具
      GameToolRegistry.registerHtmlComponentTool(componentId, payload);
      iframe?.contentWindow?.postMessage({ action: 'TOOL_REGISTERED', callId }, '*');
      break;
  }
};
```

### 3. 工具定义格式
```json
{
  "name": "update_inventory",
  "description": "更新玩家背包物品",
  "parameters": {
    "type": "object",
    "properties": {
      "item": {"type": "string"},
      "quantity": {"type": "number"}
    },
    "required": ["item"]
  },
  "jsFunction": "updateInventory"
}
```

## 关键改进 (基于参考代码分析)

### 1. 通信机制优化
- **Promise-based**: 支持异步调用，避免回调地狱
- **超时机制**: 15秒超时防止请求挂起
- **callId追踪**: 确保请求-响应正确匹配
- **错误处理**: 完整的错误传播和处理机制

### 2. AI集成策略
- **透明代理**: HTML组件内部直接调用AI，宿主负责转发
- **双重调用**: 组件可以直接调用AI（内容生成），也可以注册工具供AI调用
- **状态同步**: AI调用结果自动同步到游戏状态

### 3. 数据持久化
- **组件级存储**: 每个HTML组件都有独立的数据空间
- **自动保存**: 集成到现有的playthrough保存机制
- **状态恢复**: 游戏重启后组件状态完整恢复

### 4. 快速实现路径
- **MVP方案**: 先用textarea实现编辑器，后续可升级到Monaco
- **参考模板**: 基于Starlight Cafe的通信架构快速搭建
- **渐进增强**: 先实现基础功能，再逐步添加高级特性

## 预期成果

1. **故事创作者**能够轻松创建交互式HTML组件
2. **AI系统**能够通过工具与HTML组件交互，也能被组件调用生成内容
3. **玩家**能够享受丰富的交互式游戏体验
4. **系统**具备良好的安全性和扩展性
5. **开发效率**显著提升，面向数据的组件开发模式

## 风险评估

### 高风险
- 代码执行安全漏洞
- AI工具注册冲突
- 性能影响

### 中等风险
- 用户体验复杂度
- 兼容性问题
- 维护成本

### 缓解策略
- 严格的安全测试
- 渐进式开发
- 充分的文档和示例