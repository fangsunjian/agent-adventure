import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { HtmlComponentData } from '../types';

interface HtmlComponentEditorProps {
  htmlData: HtmlComponentData;
  onChange: (htmlData: HtmlComponentData) => void;
}

type EditorTab = 'html' | 'css' | 'js';

const HtmlComponentEditor: React.FC<HtmlComponentEditorProps> = ({ htmlData, onChange }) => {
  const [activeTab, setActiveTab] = useState<EditorTab>('html');
  const [srcDoc, setSrcDoc] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

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
  max-width: 800px;
  margin: auto;
  background-color: var(--card-bg);
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 8px 25px rgba(0,0,0,0.3);
}

.component-header {
  text-align: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid var(--border-color);
}

.component-header h2 {
  margin: 0;
  color: var(--primary-color);
  font-size: 1.8rem;
}

.component-header p {
  margin: 0.5rem 0 0 0;
  color: #a0aec0;
}

.test-section {
  margin: 2rem 0;
  padding: 1.5rem;
  background-color: rgba(255,255,255,0.05);
  border-radius: 8px;
  border-left: 4px solid var(--primary-color);
}

.test-section h3 {
  margin: 0 0 1rem 0;
  color: var(--text-color);
  font-size: 1.2rem;
}

.button-group {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin: 1rem 0;
}

.btn {
  padding: 0.75rem 1.25rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
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
  padding: 0.5rem 1rem;
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
  background-color: #1a1a1a;
  border: 2px solid var(--border-color);
  border-radius: 6px;
  padding: 1rem;
  height: 150px;
  overflow-y: auto;
  font-family: 'Courier New', monospace;
  font-size: 0.8rem;
  white-space: pre-wrap;
  margin: 1rem 0;
}

.log-entry {
  margin: 0.25rem 0;
  padding: 0.25rem;
  border-left: 3px solid transparent;
}

.log-entry.info {
  color: #63b3ed;
  border-left-color: #63b3ed;
}

.log-entry.success {
  color: #68d391;
  border-left-color: #68d391;
}

.log-entry.warning {
  color: #fbd38d;
  border-left-color: #fbd38d;
}

.log-entry.error {
  color: #fc8181;
  border-left-color: #fc8181;
}

.log-timestamp {
  opacity: 0.7;
  font-size: 0.7rem;
}`,

    js: htmlData.js || `// HTML组件功能测试代码
console.log('🎮 HTML组件测试模块已加载');

// 状态管理
let componentState = {
  clickCount: 0,
  lastInput: '',
  selectedOption: '',
  testResults: []
};

// DOM元素
const elements = {
  basicBtn: document.getElementById('basic-btn'),
  aiTestBtn: document.getElementById('ai-test-btn'),
  saveTestBtn: document.getElementById('save-test-btn'),
  loadTestBtn: document.getElementById('load-test-btn'),
  processInputBtn: document.getElementById('process-input-btn'),
  clearLogBtn: document.getElementById('clear-log-btn'),
  
  testInput: document.getElementById('test-input'),
  testSelect: document.getElementById('test-select'),
  
  clickCount: document.getElementById('click-count'),
  lastInput: document.getElementById('last-input'),
  selectedOption: document.getElementById('selected-option'),
  logOutput: document.getElementById('log-output')
};

// 日志系统
function addLog(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = document.createElement('div');
  logEntry.className = \`log-entry \${type}\`;
  logEntry.innerHTML = \`<span class="log-timestamp">[\${timestamp}]</span> \${message}\`;
  
  elements.logOutput.appendChild(logEntry);
  elements.logOutput.scrollTop = elements.logOutput.scrollHeight;
  
  // 同时发送到游戏引擎日志（不等待响应）
  if (window.gameAPI) {
    window.gameAPI.game.logMessage(message, type);
  }
}

// 更新状态显示
function updateStatusDisplay() {
  elements.clickCount.textContent = componentState.clickCount;
  elements.lastInput.textContent = componentState.lastInput || '无';
  elements.selectedOption.textContent = componentState.selectedOption || '无';
}

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
  
  // 清空输入框
  elements.testInput.value = '';
  
  // 发送到游戏引擎
  if (window.gameAPI) {
    window.gameAPI.game.sendData({
      type: 'user_input',
      value: inputValue,
      timestamp: new Date().toISOString()
    });
  }
});

// 选择框变化监听
elements.testSelect?.addEventListener('change', (e) => {
  const selectedValue = e.target.value;
  componentState.selectedOption = selectedValue;
  updateStatusDisplay();
  
  if (selectedValue) {
    addLog(\`选择了选项: \${selectedValue}\`, 'info');
    
    // 发送选择到游戏引擎
    if (window.gameAPI) {
      window.gameAPI.game.sendData({
        type: 'option_selected',
        value: selectedValue,
        timestamp: new Date().toISOString()
      });
    }
  }
});

// 清除日志
elements.clearLogBtn?.addEventListener('click', () => {
  elements.logOutput.innerHTML = '';
  addLog('日志已清除', 'info');
});

// 输入框回车支持
elements.testInput?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    elements.processInputBtn?.click();
  }
});

// AI工具定义示例
function registerAITools() {
  if (!window.gameAPI || !window.gameAPI.tools) {
    addLog('⚠ AI工具接口不可用', 'warning');
    return;
  }
  
  try {
    // 示例1: 注册计数器工具
    const counterTool = window.gameAPI.tools.createDefinition(
      'get_click_count',
      '获取组件按钮的当前点击次数',
      {
        type: 'object',
        properties: {},
        required: []
      },
      () => {
        return {
          success: true,
          clickCount: componentState.clickCount,
          message: \`按钮已被点击 \${componentState.clickCount} 次\`
        };
      }
    );
    
    window.gameAPI.tools.register(counterTool);
    addLog('✅ 注册AI工具: get_click_count', 'success');
    
    // 示例2: 注册状态查询工具
    const statusTool = window.gameAPI.tools.create.dataQuery(
      'query_component_status',
      '查询HTML组件的当前状态',
      (params) => {
        const { query } = params;
        
        if (query === 'full') {
          return {
            success: true,
            state: componentState,
            timestamp: new Date().toISOString()
          };
        } else if (query === 'summary') {
          return {
            success: true,
            summary: \`点击数: \${componentState.clickCount}, 最后输入: \${componentState.lastInput || '无'}\`
          };
        } else {
          return {
            success: false,
            error: '不支持的查询类型，请使用 "full" 或 "summary"'
          };
        }
      }
    );
    
    window.gameAPI.tools.register(statusTool);
    addLog('✅ 注册AI工具: query_component_status', 'success');
    
    // 示例3: 注册状态更新工具
    const updateTool = window.gameAPI.tools.create.stateUpdate(
      'update_component_state',
      '更新HTML组件的状态',
      (params) => {
        const { updates } = params;
        
        if (updates.clickCount !== undefined) {
          componentState.clickCount = updates.clickCount;
        }
        if (updates.lastInput !== undefined) {
          componentState.lastInput = updates.lastInput;
        }
        if (updates.selectedOption !== undefined) {
          componentState.selectedOption = updates.selectedOption;
        }
        
        updateStatusDisplay();
        
        return {
          success: true,
          message: '状态已更新',
          newState: componentState
        };
      }
    );
    
    window.gameAPI.tools.register(updateTool);
    addLog('✅ 注册AI工具: update_component_state', 'success');
    
    // 示例4: 注册计算工具
    const calcTool = window.gameAPI.tools.create.calculation(
      'calculate_metrics',
      '计算组件使用指标',
      {
        type: 'object',
        properties: {
          metricType: {
            type: 'string',
            description: '指标类型：usage, performance, engagement'
          }
        },
        required: ['metricType']
      },
      (params) => {
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
    );
    
    window.gameAPI.tools.register(calcTool);
    addLog('✅ 注册AI工具: calculate_metrics', 'success');
    
    addLog('🛠️ 所有AI工具注册完成！AI现在可以调用这些工具。', 'success');
    
  } catch (error) {
    addLog(\`❌ 注册AI工具时出错: \${error.message}\`, 'error');
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  addLog('🎮 HTML组件测试界面已初始化', 'success');
  addLog('所有功能按钮已准备就绪', 'info');
  
  // 检查gameAPI可用性
  if (window.gameAPI) {
    addLog('✓ gameAPI已连接', 'success');
    
    // 注册AI工具
    setTimeout(() => {
      registerAITools();
    }, 500); // 延迟注册确保API完全就绪
    
  } else {
    addLog('⚠ gameAPI不可用，某些功能可能无法工作', 'warning');
  }
  
  updateStatusDisplay();
});

addLog('📋 组件代码加载完成，等待DOM初始化...', 'info');`
  };

  const [code, setCode] = useState({
    html: defaultCode.html,
    css: defaultCode.css,
    js: defaultCode.js
  });

  const updatePreview = useCallback(() => {
    setSrcDoc(`
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
        </head>
        <body>${code.html}</body>
        <style>${code.css}</style>
        <script type="module">${code.js}</script>
      </html>
    `);
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
    setCode(prev => ({
      ...prev,
      [tab]: value
    }));
  };

  const tabConfig = {
    html: { name: 'HTML', icon: 'fas fa-code' },
    css: { name: 'CSS', icon: 'fab fa-css3-alt' },
    js: { name: 'JavaScript', icon: 'fab fa-js-square' }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-96">
        {/* 代码编辑器 */}
        <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg flex flex-col overflow-hidden">
          {/* 标签页 */}
          <div className="flex bg-gray-200 dark:bg-zinc-900">
            {(['html', 'css', 'js'] as EditorTab[]).map(tab => (
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
          </div>

          {/* 代码编辑区 */}
          <div className="flex-grow relative">
            <textarea
              value={code[activeTab]}
              onChange={e => handleCodeChange(activeTab, e.target.value)}
              className="absolute inset-0 w-full h-full p-4 bg-gray-900 text-gray-200 font-mono text-sm resize-none border-0 focus:outline-none"
              spellCheck="false"
              placeholder={`输入${tabConfig[activeTab].name}代码...`}
            />
          </div>
        </div>

        {/* 预览区 */}
        <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg flex flex-col overflow-hidden">
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
      </div>

      {/* 工具提示 */}
      <div className="text-sm text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
        <div className="flex items-start space-x-2">
          <i className="fas fa-info-circle mt-0.5"></i>
          <div>
            <p><strong>提示：</strong></p>
            <ul className="list-disc list-inside space-y-1 mt-1">
              <li>代码会实时预览，编辑后稍等片刻即可看到效果</li>
              <li>支持Font Awesome图标库，可直接使用图标样式</li>
              <li>JavaScript代码运行在沙盒环境中，确保安全</li>
              <li>后续版本将支持AI工具定义，实现与游戏引擎的交互</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HtmlComponentEditor;