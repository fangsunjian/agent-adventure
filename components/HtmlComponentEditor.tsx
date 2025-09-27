import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { HtmlComponentData } from '../types';
import MonacoEditorComponent from './MonacoEditorComponent';

interface HtmlComponentEditorProps {
  htmlData: HtmlComponentData;
  onChange: (htmlData: HtmlComponentData) => void;
  isFullscreen?: boolean;
  showPreview?: boolean; // 控制是否显示内置预览窗口
}

type EditorTab = 'html' | 'css' | 'js' | 'guide';

const HtmlComponentEditor: React.FC<HtmlComponentEditorProps> = ({ htmlData, onChange, isFullscreen = false, showPreview = true }) => {
  const [activeTab, setActiveTab] = useState<EditorTab>('html');
  const [srcDoc, setSrcDoc] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const componentGuideSections = [
    {
      title: '静态工具描述 (无需等待 iframe 加载)',
      tips: [
        '在 JavaScript 中声明工具对象，例如 `const viewInventoryTool = { name: "view_inventory", description: "查看背包" }`，并包含 `parameters` 字段。',
        'GameToolRegistry 会在故事加载时解析这些对象，将工具注册给 AI，即使组件尚未打开也能被调用。',
        '工具真正的执行逻辑仍需在组件运行时通过 `window.tool_<name>` 函数提供，请在 JS 中确保暴露对应处理逻辑。'
      ]
    },
    {
      title: '初始化本地存储数据',
      tips: [
        '使用 `window.gameAPI.component.registerInitializer({...})` 可在故事初始化时写入 localStorage（如背包初始物品）。',
        '或在 JS 顶部添加注释：`// @component-initializer={"type":"storage_seed",...}`，引擎会自动解析并应用。',
        '`mode: "ifEmpty"` 表示仅在存储为空时覆盖，`storageKey` 控制命名空间（默认 `inventory`）。'
      ]
    },
    {
      title: '回退机制说明',
      tips: [
        '当 iframe 未打开时，HTML 工具调用会使用存储数据进行回退，这保证了 AI 工具在纯对话流程中仍然可用。',
        '请确保关键数据在初始化或工具执行后同步到 localStorage，避免回退时信息缺失。'
      ]
    },
    {
      title: '常用片段示例',
      tips: [
        '`const addItemTool = { name: "add_item", description: "添加物品", parameters: {...} };`',
        '`// @component-initializer={"type":"storage_seed","storageKey":"inventory","mode":"ifEmpty","data":{...}}`',
        '`await window.gameAPI.component.registerInitializer(() => ({ type: "storage_seed", storageKey: "inventory", data: {...} }));`'
      ]
    }
  ];

  // 默认代码模板
  const defaultCode = {
    html: htmlData.html || `<div id="game-component">
  <header class="component-header">
    <h2><i class="fas fa-gamepad"></i> 游戏组件测试</h2>
    <p>测试HTML组件的各项功能</p>
  </header>

  <div class="test-section">
    <h3><i class="fas fa-mouse-pointer"></i> 交互测试</h3>
    <div class="button-group">
      <button id="basic-btn" class="btn primary">基础按钮</button>
      <button id="ai-test-btn" class="btn secondary">AI测试</button>
      <button id="save-test-btn" class="btn success">保存测试</button>
      <button id="load-test-btn" class="btn warning">加载测试</button>
    </div>
  </div>

  <div class="test-section">
    <h3><i class="fas fa-edit"></i> 输入测试</h3>
    <div class="input-group">
      <input type="text" id="test-input" placeholder="输入一些文字..." class="input-field">
      <button id="process-input-btn" class="btn primary">处理输入</button>
    </div>
    <div class="input-group">
      <label for="test-select">选择测试:</label>
      <select id="test-select" class="select-field">
        <option value="">请选择...</option>
        <option value="option1">选项1</option>
        <option value="option2">选项2</option>
        <option value="option3">选项3</option>
      </select>
    </div>
  </div>

  <div class="test-section">
    <h3><i class="fas fa-chart-bar"></i> 状态显示</h3>
    <div id="status-display" class="status-panel">
      <div class="status-item">
        <span class="label">点击次数:</span>
        <span id="click-count" class="value">0</span>
      </div>
      <div class="status-item">
        <span class="label">最后输入:</span>
        <span id="last-input" class="value">无</span>
      </div>
      <div class="status-item">
        <span class="label">选中选项:</span>
        <span id="selected-option" class="value">无</span>
      </div>
    </div>
  </div>

  <div class="test-section">
    <h3><i class="fas fa-terminal"></i> 日志输出</h3>
    <div id="log-output" class="log-panel"></div>
    <button id="clear-log-btn" class="btn danger small">清除日志</button>
  </div>
</div>`,

    css: htmlData.css || `:root {
  --primary-color: #4299e1;
  --secondary-color: #6b46c1;
  --success-color: #10b981;
  --warning-color: #f59e0b;
  --danger-color: #ef4444;
  --bg-color: #1a202c;
  --card-bg: #2d3748;
  --text-color: #e2e8f0;
  --border-color: #4a5568;
  --input-bg: #374151;
}

* {
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background-color: var(--bg-color);
  color: var(--text-color);
  margin: 0;
  padding: 1rem;
  line-height: 1.6;
}

#game-component {
  max-width: 1000px;
  margin: 0 auto;
  padding: 1.5rem;
  background-color: var(--card-bg);
  border-radius: 10px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.component-header {
  text-align: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid var(--border-color);
}

.component-header h2 {
  color: var(--primary-color);
  margin: 0 0 0.5rem 0;
  font-size: 1.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.component-header p {
  margin: 0;
  color: #a0aec0;
  font-size: 1rem;
}

.test-section {
  margin: 1.5rem 0;
  padding: 1.5rem;
  background-color: var(--input-bg);
  border-radius: 8px;
  border-left: 4px solid var(--primary-color);
}

.test-section h3 {
  color: var(--text-color);
  margin: 0 0 1rem 0;
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.button-group {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 0.75rem;
  margin: 1rem 0;
}

.btn {
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.btn:active {
  transform: translateY(0);
}

.btn.primary {
  background-color: var(--primary-color);
  color: white;
}

.btn.secondary {
  background-color: var(--secondary-color);
  color: white;
}

.btn.success {
  background-color: var(--success-color);
  color: white;
}

.btn.warning {
  background-color: var(--warning-color);
  color: white;
}

.btn.danger {
  background-color: var(--danger-color);
  color: white;
}

.btn.small {
  padding: 0.5rem 0.75rem;
  font-size: 0.8rem;
}

.input-group {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  margin: 1rem 0;
  flex-wrap: wrap;
}

.input-field, .select-field {
  padding: 0.75rem;
  border: 2px solid var(--border-color);
  border-radius: 6px;
  background-color: var(--input-bg);
  color: var(--text-color);
  font-size: 0.9rem;
  min-width: 200px;
}

.input-field:focus, .select-field:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.2);
}

.status-panel {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin: 1rem 0;
}

.status-item {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem;
  background-color: var(--input-bg);
  border-radius: 6px;
  border-left: 3px solid var(--primary-color);
}

.status-item .label {
  font-weight: 600;
  color: #a0aec0;
}

.status-item .value {
  font-weight: 700;
  color: var(--text-color);
}

.log-panel {
  background-color: #000;
  color: #0f0;
  font-family: 'Courier New', monospace;
  padding: 1rem;
  border-radius: 6px;
  min-height: 200px;
  max-height: 300px;
  overflow-y: auto;
  font-size: 0.85rem;
  border: 1px solid #333;
}

.log-entry {
  margin: 0.25rem 0;
  padding: 0.25rem 0;
  border-bottom: 1px solid #222;
}

.log-entry.info { color: #0ff; }
.log-entry.success { color: #0f0; }
.log-entry.warning { color: #ff0; }
.log-entry.error { color: #f00; }

@media (max-width: 768px) {
  .button-group {
    grid-template-columns: 1fr;
  }

  .input-group {
    flex-direction: column;
    align-items: stretch;
  }

  .input-field, .select-field {
    min-width: unset;
  }

  .status-panel {
    grid-template-columns: 1fr;
  }
}`,

    js: htmlData.js || `// 组件状态管理
const componentState = {
  clickCount: 0,
  lastInput: '',
  selectedOption: '',
  testResults: []
};

// DOM元素引用
const elements = {
  basicBtn: document.getElementById('basic-btn'),
  aiTestBtn: document.getElementById('ai-test-btn'),
  saveTestBtn: document.getElementById('save-test-btn'),
  loadTestBtn: document.getElementById('load-test-btn'),
  processInputBtn: document.getElementById('process-input-btn'),
  testInput: document.getElementById('test-input'),
  testSelect: document.getElementById('test-select'),
  clickCount: document.getElementById('click-count'),
  lastInput: document.getElementById('last-input'),
  selectedOption: document.getElementById('selected-option'),
  logOutput: document.getElementById('log-output'),
  clearLogBtn: document.getElementById('clear-log-btn')
};

// 日志功能
function addLog(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = document.createElement('div');
  logEntry.className = \`log-entry \${type}\`;
  logEntry.innerHTML = \`[\${timestamp}] \${message}\`;

  elements.logOutput.appendChild(logEntry);
  elements.logOutput.scrollTop = elements.logOutput.scrollHeight;

  // 限制日志条数
  const entries = elements.logOutput.children;
  if (entries.length > 100) {
    elements.logOutput.removeChild(entries[0]);
  }
}

// 状态显示更新
function updateStatusDisplay() {
  if (elements.clickCount) elements.clickCount.textContent = componentState.clickCount;
  if (elements.lastInput) elements.lastInput.textContent = componentState.lastInput || '无';
  if (elements.selectedOption) elements.selectedOption.textContent = componentState.selectedOption || '无';
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  addLog('组件初始化完成', 'success');
  updateStatusDisplay();
});

// 基础按钮测试
elements.basicBtn?.addEventListener('click', () => {
  componentState.clickCount++;
  updateStatusDisplay();
  addLog(\`按钮被点击！总点击次数: \${componentState.clickCount}\`, 'info');
});

// AI功能测试
elements.aiTestBtn?.addEventListener('click', async () => {
  addLog('开始测试AI功能...', 'info');

  if (!window.gameAPI) {
    addLog('错误: gameAPI不可用', 'error');
    return;
  }

  try {
    const prompt = '请生成一句鼓励玩家的话';
    addLog(\`发送AI请求: \${prompt}\`, 'info');

    const response = await window.gameAPI.ai.generate(prompt);
    addLog(\`AI响应: \${response}\`, 'success');

    componentState.testResults.push({
      type: 'ai_test',
      timestamp: new Date().toISOString(),
      result: 'success',
      data: response
    });

  } catch (error) {
    addLog(\`AI测试失败: \${error.message}\`, 'error');

    componentState.testResults.push({
      type: 'ai_test',
      timestamp: new Date().toISOString(),
      result: 'error',
      error: error.message
    });
  }
});

// 保存功能测试
elements.saveTestBtn?.addEventListener('click', async () => {
  addLog('开始测试保存功能...', 'info');

  if (!window.gameAPI) {
    addLog('错误: gameAPI不可用', 'error');
    return;
  }

  try {
    const testData = {
      ...componentState,
      timestamp: new Date().toISOString(),
      message: '这是测试保存的数据'
    };

    await window.gameAPI.storage.save('test_data', testData);
    addLog('数据保存成功！', 'success');
    addLog(\`保存的数据: \${JSON.stringify(testData, null, 2)}\`, 'info');

  } catch (error) {
    addLog(\`保存失败: \${error.message}\`, 'error');
  }
});

// 加载功能测试
elements.loadTestBtn?.addEventListener('click', async () => {
  addLog('开始测试加载功能...', 'info');

  if (!window.gameAPI) {
    addLog('错误: gameAPI不可用', 'error');
    return;
  }

  try {
    const loadedData = await window.gameAPI.storage.load('test_data');

    if (loadedData) {
      addLog('数据加载成功！', 'success');
      addLog(\`加载的数据: \${JSON.stringify(loadedData, null, 2)}\`, 'info');

      // 可选：恢复部分状态
      if (loadedData.clickCount) {
        componentState.clickCount = loadedData.clickCount;
        updateStatusDisplay();
        addLog('状态已恢复到保存时的状态', 'info');
      }
    } else {
      addLog('没有找到保存的数据', 'warning');
    }

  } catch (error) {
    addLog(\`加载失败: \${error.message}\`, 'error');
  }
});

// 输入处理测试
elements.processInputBtn?.addEventListener('click', () => {
  const inputValue = elements.testInput?.value.trim();

  if (!inputValue) {
    addLog('请先输入一些文字', 'warning');
    return;
  }

  componentState.lastInput = inputValue;
  updateStatusDisplay();
  addLog(\`处理输入: "\${inputValue}"\`, 'info');

  componentState.testResults.push({
    type: 'input_processed',
    timestamp: new Date().toISOString(),
    result: 'success',
    data: inputValue
  });

  // 清空输入框
  if (elements.testInput) elements.testInput.value = '';
});

// 选择框变化处理
elements.testSelect?.addEventListener('change', (e) => {
  const selectedValue = e.target.value;
  componentState.selectedOption = selectedValue;
  updateStatusDisplay();

  if (selectedValue) {
    addLog(\`选择了选项: "\${selectedValue}"\`, 'info');
  } else {
    addLog('取消了选择', 'info');
  }
});

// 清除日志
elements.clearLogBtn?.addEventListener('click', () => {
  if (elements.logOutput) {
    elements.logOutput.innerHTML = '';
    addLog('日志已清除', 'info');
  }
});

// 注册AI工具示例
if (window.gameAPI && window.gameAPI.tools) {
  const calcTool = {
    name: 'calculate_metrics',
    description: '计算组件使用指标',
    parameters: {
      type: 'object',
      properties: {
        metricType: {
          type: 'string',
          description: '指标类型：usage, performance, engagement'
        }
      },
      required: ['metricType']
    },
    handler: (params) => {
      const { metricType } = params;

      switch (metricType) {
        case 'usage':
          return {
            success: true,
            metrics: {
              totalClicks: componentState.clickCount,
              inputCount: componentState.testResults.filter(r => r.type === 'input_processed').length,
              testResults: componentState.testResults.length
            }
          };
        case 'performance':
          const successfulTests = componentState.testResults.filter(r => r.result === 'success').length;
          const totalTests = componentState.testResults.length;
          return {
            success: true,
            metrics: {
              successRate: totalTests > 0 ? (successfulTests / totalTests * 100).toFixed(1) + '%' : '0%',
              totalTests,
              successfulTests
            }
          };
        case 'engagement':
          return {
            success: true,
            metrics: {
              interactionScore: Math.min(componentState.clickCount * 10 + componentState.testResults.length * 5, 100),
              engagementLevel: componentState.clickCount > 10 ? '高' : componentState.clickCount > 5 ? '中' : '低'
            }
          };
        default:
          return {
            success: false,
            error: '不支持的指标类型'
          };
      }
    }
  };

  window.gameAPI.tools.register(calcTool);
  addLog('✅ 注册AI工具: calculate_metrics', 'success');
}`
  };

  const [code, setCode] = useState(defaultCode);

  // 生成HTML组件的完整内容
  const updatePreview = useCallback(() => {
    const { html, css, js } = code;

    // 注入通信桥接代码
    const bridgeScript = `
      // HTML组件与宿主应用的通信桥接
      let callIdCounter = 0;
      const pendingCalls = new Map();

      function postMessageToHost(action, payload) {
        return new Promise((resolve, reject) => {
          const callId = 'call_' + callIdCounter++;
          console.log('📤 iframe发送请求:', { action, callId, payload });
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

      window.addEventListener('message', (event) => {
        const { action, payload, callId } = event.data;
        console.log('📨 iframe收到响应消息:', { action, callId, hasPayload: !!payload });

        if (pendingCalls.has(callId)) {
          console.log('✅ 找到对应的pending call, callId:', callId);
          const { resolve, reject } = pendingCalls.get(callId);
          if (payload && payload.error) {
            console.log('❌ 响应包含错误:', payload.error);
            reject(new Error(payload.error));
          } else {
            console.log('✅ 成功解析响应, payload:', payload);
            resolve(payload);
          }
          pendingCalls.delete(callId);
        } else {
          console.log('⚠️ 未找到对应的pending call, callId:', callId, 'pending calls:', Array.from(pendingCalls.keys()));
        }

        // 处理特殊的log消息，这些消息不期待响应
        if (callId && typeof callId === 'string' && callId.startsWith('log_')) {
          // log消息不需要处理响应，直接忽略
          return;
        }
      });

      // 标准游戏API接口
      window.gameAPI = {
        // AI服务调用
        ai: {
          generate: (prompt, isJson = false, schema = null) =>
            postMessageToHost('AI_REQUEST', { prompt, isJson, schema })
        },

        // 数据持久化
        storage: {
          save: (key, data) => postMessageToHost('SAVE_DATA', {
            key: 'component_' + key,
            data
          }),
          load: (key) => postMessageToHost('LOAD_DATA', {
            key: 'component_' + key
          })
        },

        // 游戏引擎交互
        game: {
          sendData: (data) => postMessageToHost('GAME_DATA', data),
          updateState: (updates) => postMessageToHost('UPDATE_STATE', updates),
          logMessage: (message, type = 'info') => {
            // 日志消息不需要等待响应，直接发送
            window.parent.postMessage({
              action: 'LOG_MESSAGE',
              payload: { message, type }
            }, '*');
          }
        },

        // AI工具定义和管理接口
        tools: {
          // 注册单个工具给AI系统
          register: (toolDefinition) => {
            if (!toolDefinition.name || !toolDefinition.description) {
              throw new Error('Tool must have name and description');
            }

            if (!toolDefinition.handler || typeof toolDefinition.handler !== 'function') {
              throw new Error('Tool must have a handler function');
            }

            // 存储处理函数到全局作用域
            window['tool_' + toolDefinition.name] = toolDefinition.handler;

            return postMessageToHost('REGISTER_TOOL', {
              componentId: 'component',
              name: toolDefinition.name,
              description: toolDefinition.description,
              parameters: toolDefinition.parameters || {
                type: 'object',
                properties: {},
                required: []
              },
              jsFunction: 'tool_' + toolDefinition.name
            });
          },

          // 批量注册多个工具
          registerBatch: (toolDefinitions) => {
            const results = [];
            for (const toolDef of toolDefinitions) {
              try {
                results.push(window.gameAPI.tools.register(toolDef));
              } catch (error) {
                console.error('Failed to register tool:', toolDef.name, error);
                results.push(Promise.reject(error));
              }
            }
            return Promise.all(results);
          },

          // 取消注册工具
          unregister: (toolName) => {
            // 删除全局函数
            if (window['tool_' + toolName]) {
              delete window['tool_' + toolName];
            }

            return postMessageToHost('UNREGISTER_TOOL', {
              componentId: 'component',
              name: toolName
            });
          }
        }
      };
    `;

    const fullHTML = `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>HTML组件</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
        <style>${css}</style>
      </head>
      <body>
        ${html}
        <script>
          ${bridgeScript}

          // 用户自定义JavaScript代码
          ${js}
        </script>
      </body>
      </html>
    `;

    setSrcDoc(fullHTML);
  }, [code.html, code.css, code.js]);

  // 实时预览更新
  useEffect(() => {
    const timeout = setTimeout(() => {
      updatePreview();
    }, 300);
    return () => clearTimeout(timeout);
  }, [updatePreview]);

  // 通知父组件数据变化
  useEffect(() => {
    onChange({
      html: code.html,
      css: code.css,
      js: code.js,
      toolDefinitions: htmlData.toolDefinitions
    });
  }, [code.html, code.css, code.js, htmlData.toolDefinitions]);

  const handleCodeChange = (tab: EditorTab, value: string) => {
    if (tab === 'guide') {
      return;
    }
    setCode(prev => ({
      ...prev,
      [tab]: value
    }));
  };

  // 加载测试代码的函数
  const loadTestCode = async (testType: 'default' | 'inventory') => {
    try {
      const filePrefix = testType === 'default' ? 'default-test' : 'inventory-test';

      // 并行加载三个文件
      const [htmlResponse, cssResponse, jsResponse] = await Promise.all([
        fetch(`/test-templates/${filePrefix}.html`),
        fetch(`/test-templates/${filePrefix}.css`),
        fetch(`/test-templates/${filePrefix}.js`)
      ]);

      if (!htmlResponse.ok || !cssResponse.ok || !jsResponse.ok) {
        throw new Error('无法加载测试文件');
      }

      const [html, css, js] = await Promise.all([
        htmlResponse.text(),
        cssResponse.text(),
        jsResponse.text()
      ]);

      setCode({ html, css, js });
      console.log('已加载' + (testType === 'default' ? '默认' : '背包') + '测试代码');

    } catch (error) {
      console.error('加载测试代码失败:', error);
      alert('加载测试代码失败，请检查文件是否存在');
    }
  };

  const editableTabs: EditorTab[] = ['html', 'css', 'js'];
  const tabOrder: EditorTab[] = [...editableTabs, 'guide'];

  const tabConfig: Record<EditorTab, { name: string; icon: string }> = {
    html: { name: 'HTML', icon: 'fas fa-code' },
    css: { name: 'CSS', icon: 'fab fa-css3-alt' },
    js: { name: 'JavaScript', icon: 'fab fa-js-square' },
    guide: { name: '使用指南', icon: 'fas fa-book-open' }
  };

  return (
    <div className={isFullscreen ? 'h-full flex flex-col' : 'space-y-4'}>
      <div className={`${isFullscreen && showPreview ? 'grid grid-cols-1 xl:grid-cols-2 gap-4 flex-grow min-h-0' : 'flex flex-col gap-4'}`}>
        {/* Monaco 代码编辑器 */}
        <div className={`bg-gray-50 dark:bg-zinc-800 rounded-lg flex flex-col overflow-hidden ${isFullscreen ? '' : 'h-[48rem]'} ${!showPreview && isFullscreen ? 'col-span-full' : ''}`}>
          {/* 标签页和测试按钮 */}
          <div className="flex bg-gray-200 dark:bg-zinc-900">
            {tabOrder.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors duration-200 flex items-center space-x-2 ${
                  activeTab === tab
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-zinc-800'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700'
                }`}
              >
                <i className={tabConfig[tab].icon}></i>
                <span>{tabConfig[tab].name}</span>
              </button>
            ))}

            {/* 测试按钮区域 */}
            <div className="ml-auto flex items-center space-x-2 px-4">
              <button
                onClick={() => loadTestCode('default')}
                className="px-3 py-1 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors duration-200 flex items-center space-x-1"
                title="加载默认测试代码"
              >
                <i className="fas fa-vial"></i>
                <span>默认测试</span>
              </button>
              <button
                onClick={() => loadTestCode('inventory')}
                className="px-3 py-1 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors duration-200 flex items-center space-x-1"
                title="加载背包功能测试代码"
              >
                <i className="fas fa-backpack"></i>
                <span>背包测试</span>
              </button>
            </div>
          </div>

          {/* Monaco编辑区 */}
          <div className="flex-grow">
            {activeTab === 'guide' ? (
              <div className="h-full overflow-y-auto bg-zinc-900/50 text-sm text-gray-200 p-6 space-y-6">
                {componentGuideSections.map(section => (
                  <section key={section.title} className="space-y-3">
                    <h3 className="text-base font-semibold flex items-center gap-2 text-indigo-300">
                      <i className="fas fa-lightbulb"></i>
                      {section.title}
                    </h3>
                    <ul className="list-disc list-inside space-y-2 text-gray-300/90">
                      {section.tips.map(item => (
                        <li key={item} className="leading-6">
                          <span dangerouslySetInnerHTML={{ __html: item.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 bg-zinc-800/80 rounded text-indigo-200">$1</code>') }} />
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            ) : (
              (() => {
                const safeTab = (activeTab === 'js' ? 'javascript' : activeTab) as 'html' | 'css' | 'javascript';
                const currentValue = code[activeTab as 'html' | 'css' | 'js'];
                return (
                  <MonacoEditorComponent
                    language={safeTab}
                    value={currentValue}
                    onChange={(value) => handleCodeChange(activeTab, value)}
                    isFullscreen={false}
                    theme="dark"
                    placeholder={'输入' + tabConfig[activeTab].name + '代码...'}
                  />
                );
              })()
            )}
          </div>
        </div>

        {/* 预览区 - 只在showPreview为true时显示 */}
        {showPreview && (
          <div className={`bg-gray-50 dark:bg-zinc-800 rounded-lg flex flex-col overflow-hidden ${isFullscreen ? '' : 'h-[48rem]'}`}>
            <div className="bg-gray-200 dark:bg-zinc-900 p-2 flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center space-x-2">
                <i className="fas fa-eye"></i>
                <span>实时预览</span>
              </h3>
            </div>

            <div className="flex-grow bg-white">
              <iframe
                ref={iframeRef}
                srcDoc={srcDoc}
                title="HTML组件预览"
                sandbox="allow-scripts allow-modals"
                className="w-full h-full border-0"
                loading="lazy"
              />
            </div>
          </div>
        )}
      </div>

      {/* 工具提示 */}
      {!isFullscreen && (
        <div className="text-sm text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
          <div className="flex items-start space-x-2">
            <i className="fas fa-info-circle mt-0.5"></i>
            <div>
              <p><strong>专业编辑器特性：</strong></p>
              <ul className="list-disc list-inside space-y-1 mt-1">
                <li>Monaco Editor专业代码编辑体验，支持语法高亮和智能补全</li>
                <li>支持F11全屏编辑模式，提供更大编辑空间</li>
                <li>gameAPI自动补全，快速编写游戏交互代码</li>
                <li>支持AI工具注册，与游戏引擎深度集成</li>
                <li>Font Awesome图标库已预载，可直接使用</li>
                <li>点击测试按钮可快速加载预设的测试代码模板</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HtmlComponentEditor;
