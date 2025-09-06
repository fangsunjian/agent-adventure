import { jsonrepair } from 'jsonrepair';
import type { GameSettings, HistoryItem, Memories, Story } from '../types';

export type SceneType = 'exploration' | 'dialogue' | 'action' | 'summary' | 'special_event';

export interface GameTool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
  handler: (args: any, context: GameToolContext) => Promise<any>;
  requiredFor: SceneType[];
  priority: number;
}

export interface GameToolContext {
  settings: GameSettings;
  history: HistoryItem[];
  memories: Memories;
  activeStory: Story;
  logCommunication: (type: string, data: any) => void;
}

export class GameToolRegistry {
  private static tools: Map<string, GameTool> = new Map();
  private static initialized = false;

  static initialize() {
    if (this.initialized) return;
    
    console.log('🔧 Initializing Game Tool Registry...');
    
    // 注册核心工具
    this.registerCoreTools();
    // 注册总结系统工具
    this.registerSummaryTools();
    // 注册特殊工具
    this.registerSpecialTools();
    
    this.initialized = true;
    console.log(`✅ Game Tool Registry initialized with ${this.tools.size} tools`);
  }

  private static registerCoreTools() {
    // 对话工具（从现有系统迁移并优化）
    this.register({
      name: 'show_dialogue',
      description: '显示NPC对话内容',
      parameters: {
        type: 'object',
        properties: {
          speaker: {
            type: 'string',
            description: '说话角色的名称'
          },
          messages: {
            type: 'array',
            items: { type: 'string' },
            description: '对话消息数组，每条消息将逐一显示。将长篇对话分割为多个句子以获得更好的节奏感'
          },
          avatar: {
            type: 'string',
            description: '说话者头像URL（可选）'
          },
          // 必填的行动选项生成参数
          actions: {
            type: 'array',
            items: { type: 'string' },
            description: '玩家可以选择的行动选项数组'
          },
          actionContext: {
            type: 'string',
            description: '行动选项的上下文说明'
          },
          // 必填的小总结参数
          summary: {
            type: 'string',
            description: '对当前对话的简要总结'
          },
          isImportantMemory: {
            type: 'boolean',
            description: '是否为重要记忆（可选，默认false）'
          }
        },
        required: ['speaker', 'messages', 'actions', 'summary']
      },
      handler: async (args: { 
        speaker: string; 
        messages: string[]; 
        avatar?: string;
        actions: string[];
        actionContext?: string;
        summary: string;
        isImportantMemory?: boolean;
      }, context) => {
        try {
          console.log('💬 Showing dialogue:', args);
          context.logCommunication('tool_show_dialogue', args);
          
          // 验证参数
          if (!args.speaker || typeof args.speaker !== 'string') {
            throw new Error('Speaker is required and must be a string');
          }
          
          if (!Array.isArray(args.messages) || args.messages.length === 0) {
            throw new Error('Messages array is required and must not be empty');
          }

          if (!Array.isArray(args.actions) || args.actions.length === 0) {
            throw new Error('Actions array is required and must not be empty');
          }

          if (!args.summary || typeof args.summary !== 'string') {
            throw new Error('Summary is required and must be a string');
          }
          
          // 清理和验证消息
          const cleanMessages = args.messages
            .filter(msg => typeof msg === 'string' && msg.trim().length > 0)
            .map(msg => msg.trim())
            .slice(0, 10); // 限制最多10条消息
          
          if (cleanMessages.length === 0) {
            throw new Error('No valid messages found after filtering');
          }

          // 清理和验证行动选项
          const cleanActions = args.actions
            .filter(action => typeof action === 'string' && action.trim().length > 0)
            .map(action => action.trim())
            .slice(0, 6); // 限制最多6个选项

          if (cleanActions.length === 0) {
            throw new Error('No valid actions found after filtering');
          }
          
          return {
            success: true,
            dialogueData: {
              speaker: args.speaker.trim(),
              messages: cleanMessages,
              avatar: args.avatar?.trim() || '',
              timestamp: Date.now()
            },
            actionData: {
              actions: cleanActions,
              context: args.actionContext?.trim() || '',
              timestamp: Date.now()
            },
            summaryData: {
              summary: args.summary.trim(),
              type: 'minor',
              isImportantMemory: args.isImportantMemory || false,
              timestamp: Date.now()
            }
          };
        } catch (error) {
          console.error('❌ Error in show_dialogue tool:', error);
          context.logCommunication('tool_error_show_dialogue', error);
          
          return {
            success: false,
            error: error.message,
            fallback: {
              speaker: '神秘声音',
              messages: ['...'],
              avatar: ''
            }
          };
        }
      },
      requiredFor: ['dialogue'],
      priority: 1
    });

    // 场景推进工具 - 完全重构，集成所有必需功能
    this.register({
      name: 'advance_scene',
      description: '推进游戏场景，描述新的环境、情况和发生的事件。必须生成行动选项和小总结。',
      parameters: {
        type: 'object',
        properties: {
          description: {
            type: 'string',
            description: '场景描述文本，详细描述环境、情况和事件'
          },
          imagePrompt: {
            type: 'string',
            description: '可选的场景图像描述，用于生成配图'
          },
          // 必填的行动选项生成参数
          actions: {
            type: 'array',
            items: { type: 'string' },
            description: '玩家可以选择的行动选项数组'
          },
          actionContext: {
            type: 'string',
            description: '行动选项的上下文说明'
          },
          // 必填的小总结参数
          summary: {
            type: 'string',
            description: '对当前场景的简要总结'
          },
          isImportantMemory: {
            type: 'boolean',
            description: '是否为重要记忆（可选，默认false）'
          }
        },
        required: ['description', 'actions', 'summary']
      },
      handler: async (args: { 
        description: string; 
        imagePrompt?: string; 
        actions: string[];
        actionContext?: string;
        summary: string;
        isImportantMemory?: boolean;
      }, context) => {
        try {
          console.log('🎬 Advancing scene:', args);
          context.logCommunication('tool_advance_scene', args);
          
          // 验证参数
          if (!args.description || typeof args.description !== 'string') {
            throw new Error('Scene description is required and must be a string');
          }

          if (!Array.isArray(args.actions) || args.actions.length === 0) {
            throw new Error('Actions array is required and must not be empty');
          }

          if (!args.summary || typeof args.summary !== 'string') {
            throw new Error('Summary is required and must be a string');
          }
          
          // 清理和验证行动选项
          const cleanActions = args.actions
            .filter(action => typeof action === 'string' && action.trim().length > 0)
            .map(action => action.trim())
            .slice(0, 6); // 限制最多6个选项

          if (cleanActions.length === 0) {
            throw new Error('No valid actions found after filtering');
          }
          
          // 基础场景数据
          const sceneData = {
            description: args.description.trim(),
            imagePrompt: args.imagePrompt?.trim() || '',
            timestamp: Date.now()
          };
          
          // 行动数据
          const actionData = {
            actions: cleanActions,
            context: args.actionContext?.trim() || '',
            timestamp: Date.now()
          };
          
          // 小总结数据
          const summaryData = {
            summary: args.summary.trim(),
            type: 'minor',
            isImportantMemory: args.isImportantMemory || false,
            timestamp: Date.now()
          };
          
          return {
            success: true,
            sceneData: sceneData,
            actionData: actionData,
            summaryData: summaryData
          };
        } catch (error) {
          console.error('❌ Error in advance_scene tool:', error);
          context.logCommunication('tool_error_advance_scene', error);
          
          return {
            success: false,
            error: error.message,
            fallback: {
              description: '你继续在这个神秘的地方探索着...',
              imagePrompt: '神秘的环境'
            }
          };
        }
      },
      requiredFor: ['exploration', 'action', 'special_event'],
      priority: 1
    });

    // 系统消息工具
    this.register({
      name: 'show_system_message',
      description: '显示系统提示消息给玩家',
      parameters: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: '要显示的系统消息文本'
          },
          messageType: {
            type: 'string',
            enum: ['info', 'warning', 'success', 'error'],
            description: '消息类型，影响显示样式'
          }
        },
        required: ['message']
      },
      handler: async (args: { message: string; messageType?: string }, context) => {
        try {
          console.log('📢 System message:', args);
          context.logCommunication('tool_show_system_message', args);
          
          if (!args.message || typeof args.message !== 'string') {
            throw new Error('Message is required and must be a string');
          }
          
          return {
            success: true,
            systemMessage: {
              message: args.message.trim(),
              type: args.messageType || 'info',
              timestamp: Date.now()
            }
          };
        } catch (error) {
          console.error('❌ Error in show_system_message tool:', error);
          context.logCommunication('tool_error_show_system_message', error);
          
          return {
            success: false,
            error: error.message,
            fallback: {
              message: '系统消息处理出现问题',
              type: 'error'
            }
          };
        }
      },
      requiredFor: ['special_event'],
      priority: 3
    });
  }

  private static registerSummaryTools() {
    // 这个方法现在为空，因为总结功能已集成到核心工具中
    // 动态参数修改将在 GameEngine 中处理
  }

  private static registerSpecialTools() {
    // Milestone评估工具
    this.register({
      name: 'evaluate_milestone',
      description: '评估当前回合是否包含里程碑事件',
      parameters: {
        type: 'object',
        properties: {
          is_milestone: {
            type: 'boolean',
            description: '是否为里程碑事件'
          },
          summary: {
            type: 'string',
            description: '里程碑的简要描述'
          },
          reason: {
            type: 'string', 
            description: '为什么这是一个里程碑'
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: '相关标签'
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            description: '优先级级别'
          }
        },
        required: ['is_milestone']
      },
      handler: async (args: { is_milestone: boolean; summary?: string; reason?: string; tags?: string[]; priority?: string }, context) => {
        try {
          console.log('📍 Evaluating milestone:', args);
          context.logCommunication('tool_evaluate_milestone', args);
          
          if (typeof args.is_milestone !== 'boolean') {
            throw new Error('is_milestone must be a boolean');
          }
          
          if (args.is_milestone) {
            // 验证里程碑必需字段
            if (!args.summary || !args.reason) {
              throw new Error('Milestone requires summary and reason');
            }
            
            return {
              success: true,
              milestoneData: {
                is_milestone: true,
                summary: args.summary.trim(),
                reason: args.reason.trim(),
                tags: Array.isArray(args.tags) ? args.tags.filter(t => typeof t === 'string') : [],
                priority: args.priority || 'medium',
                timestamp: Date.now()
              }
            };
          } else {
            return {
              success: true,
              milestoneData: {
                is_milestone: false,
                timestamp: Date.now()
              }
            };
          }
        } catch (error) {
          console.error('❌ Error in evaluate_milestone tool:', error);
          context.logCommunication('tool_error_evaluate_milestone', error);
          
          return {
            success: false,
            error: error.message,
            fallback: {
              is_milestone: false,
              reason: 'Error occurred during evaluation'
            }
          };
        }
      },
      requiredFor: ['summary'],
      priority: 7
    });

    // 记忆更新工具
    this.register({
      name: 'update_memory',
      description: '更新游戏世界的重要信息到记忆系统',
      parameters: {
        type: 'object',
        properties: {
          key: {
            type: 'string',
            description: '记忆的关键字或标识符'
          },
          value: {
            type: 'string', 
            description: '要存储的信息内容'
          },
          type: {
            type: 'string',
            enum: ['character', 'location', 'item', 'event', 'knowledge'],
            description: '记忆的类型分类'
          }
        },
        required: ['key', 'value']
      },
      handler: async (args: { key: string; value: string; type?: string }, context) => {
        try {
          console.log('🧠 Updating memory:', args);
          context.logCommunication('tool_update_memory', args);
          
          if (!args.key || !args.value || typeof args.key !== 'string' || typeof args.value !== 'string') {
            throw new Error('Key and value are required and must be strings');
          }
          
          return {
            success: true,
            memoryUpdate: {
              key: args.key.trim(),
              value: args.value.trim(),
              type: args.type || 'knowledge',
              timestamp: Date.now()
            }
          };
        } catch (error) {
          console.error('❌ Error in update_memory tool:', error);
          context.logCommunication('tool_error_update_memory', error);
          
          return {
            success: false,
            error: error.message,
            fallback: null
          };
        }
      },
      requiredFor: ['summary', 'special_event'],
      priority: 6
    });
  }

  static register(tool: GameTool) {
    this.tools.set(tool.name, tool);
    console.log(`🔧 Registered tool: ${tool.name}`);
  }

  static getTools(sceneTypes?: SceneType[]): GameTool[] {
    if (!sceneTypes || sceneTypes.length === 0) {
      return Array.from(this.tools.values()).sort((a, b) => a.priority - b.priority);
    }
    
    return Array.from(this.tools.values())
      .filter(tool => sceneTypes.some(type => tool.requiredFor.includes(type)))
      .sort((a, b) => a.priority - b.priority);
  }

  static getTool(name: string): GameTool | undefined {
    return this.tools.get(name);
  }

  static getToolsForOpenAI(sceneTypes?: SceneType[]): any[] {
    const tools = this.getTools(sceneTypes);
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }));
  }

  // 动态修改工具参数的方法
  static getToolsForOpenAIWithTurnCount(sceneTypes?: SceneType[], turnCount?: number, settings?: any): any[] {
    const tools = this.getTools(sceneTypes);
    const isMajorSummaryTurn = turnCount && turnCount % 5 === 0;
    
    return tools.map(tool => {
      let modifiedTool = {
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: { 
            ...tool.parameters,
            required: [...(tool.parameters.required || [])] // 复制required数组
          }
        }
      };

      // 动态修改 advance_scene 和 show_dialogue 的参数结构
      if (tool.name === 'advance_scene') {
        // 根据设置决定是否包含 imagePrompt 参数
        if (!settings?.enableImageGeneration) {
          delete modifiedTool.function.parameters.properties.imagePrompt;
          // 更新 required 数组
          modifiedTool.function.parameters.required = modifiedTool.function.parameters.required.filter(
            (param: string) => param !== 'imagePrompt'
          );
        }
        
        if (isMajorSummaryTurn) {
          // 第5轮：添加大总结参数到properties
          modifiedTool.function.description = '推进游戏场景并创建大总结，描述新的环境、情况和发生的事件。必须生成行动选项和大总结。';
          modifiedTool.function.parameters.properties.achievements = {
            type: 'array',
            items: { type: 'string' },
            description: '玩家取得的成就或进展'
          };
          modifiedTool.function.parameters.properties.newMemories = {
            type: 'array',
            items: { type: 'string' },
            description: '需要记住的新信息'
          };
          
          // 添加大总结参数到required数组
          modifiedTool.function.parameters.required.push('achievements', 'newMemories');
          
          // 修改summary描述
          if (modifiedTool.function.parameters.properties.summary) {
            modifiedTool.function.parameters.properties.summary.description = '对最近5轮对话的详细总结';
          }
        } else {
          // 普通轮次：保持小总结参数
          modifiedTool.function.description = '推进游戏场景，描述新的环境、情况和发生的事件。必须生成行动选项和小总结。';
        }
      }

      if (tool.name === 'show_dialogue') {
        if (isMajorSummaryTurn) {
          // 第5轮：添加大总结参数到properties
          modifiedTool.function.description = '显示NPC对话内容并创建大总结。必须生成行动选项和大总结。';
          modifiedTool.function.parameters.properties.achievements = {
            type: 'array',
            items: { type: 'string' },
            description: '玩家取得的成就或进展'
          };
          modifiedTool.function.parameters.properties.newMemories = {
            type: 'array',
            items: { type: 'string' },
            description: '需要记住的新信息'
          };
          
          // 添加大总结参数到required数组
          modifiedTool.function.parameters.required.push('achievements', 'newMemories');
          
          // 修改summary描述
          if (modifiedTool.function.parameters.properties.summary) {
            modifiedTool.function.parameters.properties.summary.description = '对最近5轮对话的详细总结';
          }
        } else {
          // 普通轮次：保持小总结参数
          modifiedTool.function.description = '显示NPC对话内容。必须生成行动选项和小总结。';
        }
      }

      return modifiedTool;
    });
  }

  static async executeTool(toolCall: any, context: GameToolContext): Promise<any> {
    try {
      const toolName = toolCall.function?.name;
      if (!toolName) {
        throw new Error('Tool call missing function name');
      }

      const tool = this.getTool(toolName);
      if (!tool) {
        throw new Error(`Unknown tool: ${toolName}`);
      }

      console.log(`🔧 Executing tool: ${toolName}`);
      context.logCommunication('🔧 tool_execution_start', { tool: toolName, args: toolCall.function.arguments });

      // 解析参数，使用jsonrepair处理可能的格式问题
      let args;
      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch (parseError) {
        console.log(`⚠️ JSON parse failed for ${toolName}, attempting repair...`);
        try {
          const repairedArgs = jsonrepair(toolCall.function.arguments);
          args = JSON.parse(repairedArgs);
          console.log(`✅ Successfully repaired JSON for ${toolName}`);
        } catch (repairError) {
          console.error(`❌ JSON repair failed for ${toolName}:`, repairError);
          throw new Error(`Invalid JSON arguments for tool ${toolName}: ${parseError.message}`);
        }
      }

      // 执行工具
      const result = await tool.handler(args, context);
      
      console.log(`✅ Tool ${toolName} executed successfully`);
      context.logCommunication('✅ tool_execution_success', { tool: toolName, result });
      
      return result;
    } catch (error) {
      console.error('❌ Tool execution error:', error);
      context.logCommunication('❌ tool_execution_error', { 
        tool: toolCall.function?.name, 
        error: error.message,
        stack: error.stack 
      });
      
      throw error;
    }
  }
}