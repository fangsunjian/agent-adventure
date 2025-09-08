import React, { useRef, useEffect, useState } from 'react';
import type { LibraryCard } from '../types';
import { CloseIcon } from './icons';

interface HtmlComponentViewerProps {
  isOpen: boolean;
  onClose: () => void;
  component: LibraryCard | null;
  onMessage?: (action: string, payload: any, callId: string, sourceWindow: Window) => void;
}

const HtmlComponentViewer: React.FC<HtmlComponentViewerProps> = ({ 
  isOpen, 
  onClose, 
  component, 
  onMessage
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [srcDoc, setSrcDoc] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // 生成HTML组件的完整内容
  useEffect(() => {
    if (isOpen && component && component.htmlData) {
      const { html, css, js } = component.htmlData;
      
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
              key: '${component.id}_' + key, 
              data 
            }),
            load: (key) => postMessageToHost('LOAD_DATA', { 
              key: '${component.id}_' + key 
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
                componentId: '${component.id}',
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
              // 清理全局处理函数
              delete window['tool_' + toolName];
              
              return postMessageToHost('UNREGISTER_TOOL', {
                componentId: '${component.id}',
                name: toolName
              });
            },

            // 获取已注册的工具列表
            list: () => {
              return postMessageToHost('LIST_TOOLS', {
                componentId: '${component.id}'
              });
            },

            // 工具定义助手 - 创建标准化的工具定义
            createDefinition: (name, description, parameters, handler) => {
              return {
                name,
                description,
                parameters: parameters || {
                  type: 'object',
                  properties: {},
                  required: []
                },
                handler
              };
            },

            // 参数验证助手
            validateParameters: (parameters, requiredSchema) => {
              if (!requiredSchema || !requiredSchema.properties) {
                return { valid: true };
              }

              const errors = [];
              const required = requiredSchema.required || [];

              for (const field of required) {
                if (!(field in parameters)) {
                  errors.push(\`Missing required parameter: \${field}\`);
                }
              }

              for (const [field, value] of Object.entries(parameters)) {
                const schema = requiredSchema.properties[field];
                if (schema && schema.type) {
                  const actualType = Array.isArray(value) ? 'array' : typeof value;
                  if (actualType !== schema.type) {
                    errors.push(\`Parameter '\${field}' should be \${schema.type}, got \${actualType}\`);
                  }
                }
              }

              return {
                valid: errors.length === 0,
                errors
              };
            },

            // 便捷的工具创建方法
            create: {
              // 创建数据查询工具
              dataQuery: (name, description, queryFunction) => {
                return window.gameAPI.tools.createDefinition(
                  name,
                  description,
                  {
                    type: 'object',
                    properties: {
                      query: { type: 'string', description: '查询参数' }
                    }
                  },
                  queryFunction
                );
              },

              // 创建状态更新工具
              stateUpdate: (name, description, updateFunction) => {
                return window.gameAPI.tools.createDefinition(
                  name,
                  description,
                  {
                    type: 'object',
                    properties: {
                      updates: { type: 'object', description: '要更新的状态' }
                    },
                    required: ['updates']
                  },
                  updateFunction
                );
              },

              // 创建计算工具
              calculation: (name, description, parameters, calcFunction) => {
                return window.gameAPI.tools.createDefinition(
                  name,
                  description,
                  parameters,
                  calcFunction
                );
              }
            }
          }
        };

        // 组件加载完成通知（不需要等待响应）
        window.addEventListener('load', () => {
          window.parent.postMessage({
            action: 'COMPONENT_LOADED',
            payload: { componentId: '${component.id}' }
          }, '*');
        });

        console.log('HTML组件通信桥接已初始化');

        // 暴露测试工具到全局作用域（用于控制台测试）
        window.testAIToolCall = async function(toolName, args = {}) {
          console.log(\`🤖 测试AI工具调用: \${toolName}\`);
          
          if (!window.GameToolRegistry) {
            console.error('❌ GameToolRegistry未找到，请确保在游戏页面中测试');
            return;
          }
          
          // 创建模拟的工具调用
          const mockToolCall = {
            function: {
              name: toolName,
              arguments: JSON.stringify(args)
            }
          };
          
          // 创建模拟的游戏上下文
          const mockContext = {
            settings: window.gameData?.settings || {},
            history: [],
            memories: window.gameData?.memories || {},
            activeStory: window.gameData?.activeStory || {},
            logCommunication: (type, data) => console.log(\`📋 \${type}:\`, data)
          };
          
          try {
            const result = await window.GameToolRegistry.executeTool(mockToolCall, mockContext);
            console.log(\`✅ 工具执行结果:\`, result);
            return result;
          } catch (error) {
            console.error(\`❌ 工具执行失败:\`, error);
            return { success: false, error: error.message };
          }
        };

        // 暴露组件工具查询函数
        window.listComponentTools = function(componentId = '${component.id}') {
          if (!window.GameToolRegistry) {
            console.error('❌ GameToolRegistry未找到');
            return;
          }
          
          const tools = window.GameToolRegistry.getHtmlComponentTools(componentId);
          console.log(\`📋 组件 \${componentId} 的工具列表:\`, tools.map(t => ({
            name: t.name,
            description: t.description,
            priority: t.priority
          })));
          return tools;
        };

        console.log('🛠️ 测试工具已准备好：');
        console.log('  - testAIToolCall(toolName, args) - 测试AI工具调用');
        console.log('  - listComponentTools() - 查看已注册的工具');
        console.log('  - GameToolRegistry.getToolStatistics() - 查看工具统计');
        console.log('  - GameToolRegistry.getToolHealth() - 查看工具健康状态');
      `;

      const fullContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${component.name || 'HTML组件'}</title>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
            <style>
              /* 基础样式重置 */
              * {
                box-sizing: border-box;
              }
              body {
                margin: 0;
                padding: 1rem;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              }
              /* 用户自定义样式 */
              ${css}
            </style>
          </head>
          <body>
            ${html}
            <script type="module">
              ${bridgeScript}
            </script>
            <script type="module">
              ${js}
            </script>
          </body>
        </html>
      `;

      setSrcDoc(fullContent);
      setIsLoading(true);
    }
  }, [isOpen, component]);

  // 处理iframe消息和引用传递  
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const iframe = iframeRef.current;
      
      // 只处理来自iframe内部的消息（请求消息）
      if (!iframe || event.source !== iframe.contentWindow) {
        return;
      }

      const { action, payload, callId } = event.data;
      console.log('🔄 HtmlComponentViewer收到来自iframe的消息:', { action, callId });
      
      // 处理组件加载完成
      if (action === 'COMPONENT_LOADED') {
        setIsLoading(false);
        return;
      }

      // 转发所有其他请求消息给父组件处理
      if (onMessage && event.source) {
        console.log('🔄 转发消息给GamePage处理');
        onMessage(action, payload, callId, event.source as Window);
      }
    };

    if (isOpen) {
      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }
  }, [isOpen, onMessage]);

  if (!isOpen || !component) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 rounded-lg shadow-xl w-full max-w-4xl h-full max-h-[90vh] flex flex-col">
        {/* 头部 */}
        <header className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-zinc-800 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <i className="fas fa-code text-indigo-600"></i>
            <div>
              <h2 className="text-xl font-bold font-serif text-gray-800 dark:text-zinc-200">
                {component.name}
              </h2>
              <p className="text-sm text-gray-600 dark:text-zinc-400">HTML组件</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isLoading && (
              <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-zinc-400">
                <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-indigo-600 rounded-full"></div>
                <span>加载中...</span>
              </div>
            )}
            <button 
              onClick={onClose} 
              className="p-2 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
              title="关闭组件"
            >
              <CloseIcon className="w-6 h-6" />
            </button>
          </div>
        </header>

        {/* 组件内容区 */}
        <div className="flex-grow relative bg-white overflow-hidden">
          {srcDoc && (
            <iframe
              ref={iframeRef}
              srcDoc={srcDoc}
              title={component.name || 'HTML组件'}
              sandbox="allow-scripts allow-modals allow-forms"
              className="w-full h-full border-0"
              loading="lazy"
            />
          )}
          
          {/* 加载遮罩 */}
          {isLoading && (
            <div className="absolute inset-0 bg-gray-100 dark:bg-zinc-800 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-4 border-gray-300 border-t-indigo-600 rounded-full mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-zinc-400">正在加载HTML组件...</p>
              </div>
            </div>
          )}
        </div>

        {/* 底部信息 */}
        {!isLoading && component.content && (
          <footer className="flex-shrink-0 p-3 border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800">
            <p className="text-sm text-gray-600 dark:text-zinc-400 line-clamp-2">
              {component.content}
            </p>
          </footer>
        )}
      </div>
    </div>
  );
};

export default HtmlComponentViewer;