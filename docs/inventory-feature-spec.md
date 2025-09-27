# 背包功能技术规格文档

## 概述

本文档定义了Agent Adventure项目中背包（物品管理）功能的技术实现规格，包括HTML组件实现、AI工具集成和数据管理方案。

## 功能需求

### 核心功能
1. **物品展示**：显示背包中的所有物品，包括名称、描述和数量
2. **物品管理**：支持添加、删除物品的用户界面操作
3. **AI工具集成**：注册供AI调用的背包管理工具
4. **数据持久化**：使用localStorage保存背包数据

### 用户故事
作为推理游戏玩家，我想要拥有一个背包来存储和管理游戏中获得的物品，以便AI能够通过背包系统推进游戏剧情和解谜过程。

## 技术架构

### 实现方案
- **组件类型**：HTML组件（使用现有HTML组件系统）
- **集成方式**：通过gameAPI工具注册机制
- **数据存储**：localStorage（JSON格式）
- **UI交互**：原生HTML/CSS/JavaScript

### 系统集成点
1. **LibraryCard系统**：创建HTML组件类型的背包卡片
2. **gameAPI.tools.register**：注册AI工具供推理游戏调用
3. **gameAPI.storage**：数据持久化接口
4. **推理游戏系统**：AI通过工具调用管理背包

## 数据结构

### 物品数据模型
```typescript
interface InventoryItem {
  id: string;           // 唯一标识符
  name: string;         // 物品名称
  description: string;  // 物品描述
  quantity: number;     // 物品数量
  timestamp: number;    // 添加时间戳
}

interface Inventory {
  items: InventoryItem[];
  lastModified: number;
}
```

### 存储格式
```json
{
  "items": [
    {
      "id": "key-001",
      "name": "金钥匙",
      "description": "一把闪闪发光的金钥匙，似乎能打开某扇重要的门",
      "quantity": 1,
      "timestamp": 1632847200000
    }
  ],
  "lastModified": 1632847200000
}
```

## AI工具接口

### 1. view_inventory
- **名称**：`view_inventory`
- **描述**：查看背包中的所有物品
- **参数**：无
- **返回值**：物品列表的文本描述

### 2. add_item
- **名称**：`add_item`
- **描述**：向背包添加物品
- **参数**：
  - `name` (string): 物品名称
  - `description` (string): 物品描述
  - `quantity` (number, 默认1): 物品数量
- **返回值**：操作结果消息

### 3. remove_item
- **名称**：`remove_item`
- **描述**：从背包移除物品
- **参数**：
  - `itemName` (string): 要移除的物品名称
  - `quantity` (number, 默认1): 移除数量
- **返回值**：操作结果消息

## HTML组件实现

### 组件结构
```html
<div class="inventory-container">
  <div class="inventory-header">
    <h3>🎒 背包</h3>
    <span class="item-count">物品数量: <span id="item-count">0</span></span>
  </div>

  <div class="inventory-content">
    <div class="item-list" id="item-list">
      <!-- 物品列表动态生成 -->
    </div>

    <div class="add-item-form">
      <h4>添加物品</h4>
      <input type="text" id="item-name" placeholder="物品名称" />
      <textarea id="item-description" placeholder="物品描述"></textarea>
      <input type="number" id="item-quantity" value="1" min="1" />
      <button onclick="addItem()">添加物品</button>
    </div>
  </div>
</div>
```

### 样式设计
```css
.inventory-container {
  max-width: 500px;
  padding: 16px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #f9f9f9;
  font-family: Arial, sans-serif;
}

.inventory-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid #ddd;
}

.item-list {
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: 16px;
}

.item-card {
  background: white;
  padding: 12px;
  margin-bottom: 8px;
  border-radius: 4px;
  border: 1px solid #eee;
}

.add-item-form {
  background: white;
  padding: 12px;
  border-radius: 4px;
  border: 1px solid #eee;
}
```

### JavaScript逻辑
```javascript
// 背包数据管理
let inventory = { items: [], lastModified: Date.now() };

// 初始化背包
function initInventory() {
  loadInventory();
  renderInventory();
  registerAITools();
}

// 加载背包数据
function loadInventory() {
  const saved = gameAPI.storage.load('inventory');
  if (saved) {
    inventory = JSON.parse(saved);
  }
}

// 保存背包数据
function saveInventory() {
  inventory.lastModified = Date.now();
  gameAPI.storage.save('inventory', JSON.stringify(inventory));
}

// 渲染背包界面
function renderInventory() {
  const itemList = document.getElementById('item-list');
  const itemCount = document.getElementById('item-count');

  itemList.innerHTML = '';
  itemCount.textContent = inventory.items.length;

  inventory.items.forEach(item => {
    const itemCard = createItemCard(item);
    itemList.appendChild(itemCard);
  });
}

// AI工具注册
function registerAITools() {
  gameAPI.tools.register({
    name: 'view_inventory',
    description: '查看背包中的所有物品',
    handler: viewInventoryTool
  });

  gameAPI.tools.register({
    name: 'add_item',
    description: '向背包添加物品',
    parameters: {
      name: { type: 'string', description: '物品名称' },
      description: { type: 'string', description: '物品描述' },
      quantity: { type: 'number', description: '物品数量', default: 1 }
    },
    handler: addItemTool
  });

  gameAPI.tools.register({
    name: 'remove_item',
    description: '从背包移除物品',
    parameters: {
      itemName: { type: 'string', description: '要移除的物品名称' },
      quantity: { type: 'number', description: '移除数量', default: 1 }
    },
    handler: removeItemTool
  });
}
```

## 测试计划

### 功能测试
1. **界面测试**：验证背包界面正确显示
2. **数据持久化测试**：验证刷新页面后数据保持
3. **AI工具测试**：验证AI能正确调用背包工具
4. **边界测试**：测试空背包、大量物品等边界情况

### 集成测试
1. **推理游戏集成**：在实际游戏场景中测试背包功能
2. **钥匙通关测试**：验证关键物品管理机制
3. **多工具协作测试**：验证背包工具与其他AI工具的协作

## 部署步骤

1. **创建HTML组件**：在库中创建"背包"HTML组件类型LibraryCard
2. **实现组件代码**：编写HTML、CSS、JavaScript代码
3. **注册AI工具**：集成gameAPI工具注册机制
4. **功能测试**：验证基本功能正常工作
5. **推理游戏测试**：在游戏场景中验证AI调用效果

## 风险评估

### 主要风险
- **AI工具命名冲突**：新工具名称可能与现有工具冲突
- **数据同步问题**：localStorage数据可能与组件状态不同步
- **性能影响**：大量物品时可能影响界面响应性

### 缓解措施
- 使用唯一的工具名称前缀
- 实现数据同步检查机制
- 添加分页或虚拟滚动支持大量物品

## 回滚计划

如果背包功能出现问题：
1. 删除背包LibraryCard
2. 清除localStorage中的背包数据
3. 移除AI工具注册代码
4. 验证现有系统功能正常

---

**文档版本**：v1.0
**创建日期**：2025-09-27
**负责人**：BMad Master