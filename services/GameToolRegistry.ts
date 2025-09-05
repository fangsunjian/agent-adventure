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
          autoGenerateActions: {
            type: 'boolean',
            description: '是否自动生成行动选项（默认：true）'
          }
        },
        required: ['speaker', 'messages']
      },
      handler: async (args: { speaker: string; messages: string[]; avatar?: string; autoGenerateActions?: boolean }, context) => {
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
          
          // 清理和验证消息
          const cleanMessages = args.messages
            .filter(msg => typeof msg === 'string' && msg.trim().length > 0)
            .map(msg => msg.trim())
            .slice(0, 10); // 限制最多10条消息
          
          if (cleanMessages.length === 0) {
            throw new Error('No valid messages found after filtering');
          }
          
          // 自动生成行动选项（默认启用）
          let actionData = null;
          if (args.autoGenerateActions !== false) {
            actionData = await this.generateContextualActions(context, 'dialogue');
          }
          
          return {
            success: true,
            dialogueData: {
              speaker: args.speaker.trim(),
              messages: cleanMessages,
              avatar: args.avatar?.trim() || '',
              timestamp: Date.now()
            },
            actionData: actionData
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

    // 场景推进工具
    this.register({
      name: 'advance_scene',
      description: '推进游戏场景，描述新的环境、情况和发生的事件，自动包含行动选项生成和智能总结',
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
          autoGenerateActions: {
            type: 'boolean',
            description: '是否自动生成行动选项（默认：true）'
          },
          autoCreateSummary: {
            type: 'boolean',
            description: '是否自动创建总结（默认：true）'
          },
          summaryType: {
            type: 'string',
            enum: ['minor', 'major', 'none'],
            description: '总结类型：小总结、大总结、或不创建总结'
          }
        },
        required: ['description']
      },
      handler: async (args: { 
        description: string; 
        imagePrompt?: string; 
        autoGenerateActions?: boolean;
        autoCreateSummary?: boolean;
        summaryType?: 'minor' | 'major' | 'none';
      }, context) => {
        try {
          console.log('🎬 Advancing scene:', args);
          context.logCommunication('tool_advance_scene', args);
          
          // 验证参数
          if (!args.description || typeof args.description !== 'string') {
            throw new Error('Scene description is required and must be a string');
          }
          
          // 基础场景数据
          const sceneData = {
            description: args.description.trim(),
            imagePrompt: args.imagePrompt?.trim() || '',
            timestamp: Date.now()
          };
          
          // 自动生成行动选项（默认启用）
          let actionData = null;
          if (args.autoGenerateActions !== false) {
            actionData = await this.generateContextualActions(context, 'exploration');
          }
          
          // 自动创建总结（默认启用）
          let summaryData = null;
          if (args.autoCreateSummary !== false && args.summaryType !== 'none') {
            const summaryType = args.summaryType || this.determineSummaryType(context);
            summaryData = await this.generateContextualSummary(context, summaryType);
          }
          
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

    // 行动选项生成工具
    this.register({
      name: 'generate_actions',
      description: '为玩家生成可选择的行动选项',
      parameters: {
        type: 'object',
        properties: {
          actions: {
            type: 'array',
            items: { type: 'string' },
            description: '玩家可以选择的行动选项数组'
          },
          context: {
            type: 'string',
            description: '行动选项的上下文说明'
          }
        },
        required: ['actions']
      },
      handler: async (args: { actions: string[]; context?: string }, context) => {
        try {
          console.log('⚡ Generating actions:', args);
          context.logCommunication('tool_generate_actions', args);
          
          // 验证和清理行动选项
          if (!Array.isArray(args.actions) || args.actions.length === 0) {
            throw new Error('Actions array is required and must not be empty');
          }
          
          const cleanActions = args.actions
            .filter(action => typeof action === 'string' && action.trim().length > 0)
            .map(action => action.trim())
            .slice(0, 6); // 限制最多6个选项
          
          if (cleanActions.length === 0) {
            throw new Error('No valid actions found after filtering');
          }
          
          return {
            success: true,
            actionData: {
              actions: cleanActions,
              context: args.context?.trim() || '',
              timestamp: Date.now()
            }
          };
        } catch (error) {
          console.error('❌ Error in generate_actions tool:', error);
          context.logCommunication('tool_error_generate_actions', error);
          
          return {
            success: false,
            error: error.message,
            fallback: {
              actions: ['继续探索', '停下来思考', '查看周围'],
              context: '选择你的下一步行动'
            }
          };
        }
      },
      requiredFor: ['exploration', 'action'],
      priority: 2
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
    // 小总结工具
    this.register({
      name: 'create_minor_summary',
      description: '创建当前场景或几个回合的简短总结',
      parameters: {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            description: '简短的总结文本'
          },
          keyEvents: {
            type: 'array',
            items: { type: 'string' },
            description: '关键事件列表'
          }
        },
        required: ['summary']
      },
      handler: async (args: { summary: string; keyEvents?: string[] }, context) => {
        try {
          console.log('📝 Creating minor summary:', args);
          context.logCommunication('tool_create_minor_summary', args);
          
          if (!args.summary || typeof args.summary !== 'string') {
            throw new Error('Summary is required and must be a string');
          }
          
          const cleanKeyEvents = Array.isArray(args.keyEvents) 
            ? args.keyEvents.filter(event => typeof event === 'string' && event.trim().length > 0)
            : [];
          
          return {
            success: true,
            summaryData: {
              summary: args.summary.trim(),
              keyEvents: cleanKeyEvents,
              type: 'minor',
              timestamp: Date.now()
            }
          };
        } catch (error) {
          console.error('❌ Error in create_minor_summary tool:', error);
          context.logCommunication('tool_error_create_minor_summary', error);
          
          return {
            success: false,
            error: error.message,
            fallback: {
              summary: '最近发生了一些有趣的事情',
              keyEvents: [],
              type: 'minor'
            }
          };
        }
      },
      requiredFor: ['summary'],
      priority: 4
    });

    // 大总结工具
    this.register({
      name: 'create_major_summary',
      description: '创建章节或重要段落的详细总结',
      parameters: {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            description: '详细的总结文本'
          },
          achievements: {
            type: 'array',
            items: { type: 'string' },
            description: '玩家取得的成就或进展'
          },
          newMemories: {
            type: 'array',
            items: { type: 'string' },
            description: '需要记住的新信息'
          }
        },
        required: ['summary']
      },
      handler: async (args: { summary: string; achievements?: string[]; newMemories?: string[] }, context) => {
        try {
          console.log('📚 Creating major summary:', args);
          context.logCommunication('tool_create_major_summary', args);
          
          if (!args.summary || typeof args.summary !== 'string') {
            throw new Error('Summary is required and must be a string');
          }
          
          const cleanAchievements = Array.isArray(args.achievements)
            ? args.achievements.filter(item => typeof item === 'string' && item.trim().length > 0)
            : [];
          
          const cleanMemories = Array.isArray(args.newMemories)
            ? args.newMemories.filter(item => typeof item === 'string' && item.trim().length > 0)
            : [];
          
          return {
            success: true,
            summaryData: {
              summary: args.summary.trim(),
              achievements: cleanAchievements,
              newMemories: cleanMemories,
              type: 'major',
              timestamp: Date.now()
            }
          };
        } catch (error) {
          console.error('❌ Error in create_major_summary tool:', error);
          context.logCommunication('tool_error_create_major_summary', error);
          
          return {
            success: false,
            error: error.message,
            fallback: {
              summary: '这是一个重要的章节',
              achievements: [],
              newMemories: [],
              type: 'major'
            }
          };
        }
      },
      requiredFor: ['summary'],
      priority: 5
    });
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

  // 辅助方法：生成上下文相关的行动选项
  private static async generateContextualActions(context: GameToolContext, sceneType: string): Promise<any> {
    try {
      console.log(`⚡ Generating contextual actions for ${sceneType} scene...`);
      
      // 基于场景类型和上下文生成行动选项
      let actions: string[] = [];
      let actionContext = '';
      
      switch (sceneType) {
        case 'dialogue':
          actions = [
            '继续对话',
            '询问更多信息',
            '改变话题',
            '结束对话'
          ];
          actionContext = '选择你在对话中的回应';
          break;
          
        case 'exploration':
        default:
          actions = [
            '继续探索当前区域',
            '仔细观察周围环境',
            '寻找其他路径',
            '检查物品和装备'
          ];
          actionContext = '选择你在当前区域的行动';
          break;
          
        case 'action':
          actions = [
            '执行当前行动',
            '重新评估情况',
            '寻找其他解决方案',
            '暂停并思考'
          ];
          actionContext = '选择你的行动方式';
          break;
          
        case 'special_event':
          actions = [
            '调查这个事件',
            '保持警惕',
            '寻找更多信息',
            '准备应对'
          ];
          actionContext = '选择你如何应对这个特殊情况';
          break;
      }
      
      // 根据历史记录调整行动选项
      const recentHistory = context.history.slice(-3);
      const lastPlayerInput = recentHistory.find(h => h.role === 'user')?.parts?.[0]?.text || '';
      
      // 如果玩家提到了特定关键词，调整行动选项
      const keywords = {
        '战斗': ['准备战斗', '寻找武器', '制定战术', '撤退'],
        '魔法': ['施展魔法', '研究法术', '寻找魔法物品', '冥想恢复'],
        '宝藏': ['寻找宝藏', '检查宝物', '保护财富', '继续寻宝'],
        '门': ['打开门', '检查门锁', '寻找钥匙', '另寻他路'],
        'NPC': ['与NPC交谈', '询问信息', '建立关系', '观察行为']
      };
      
      for (const [keyword, customActions] of Object.entries(keywords)) {
        if (lastPlayerInput.includes(keyword)) {
          actions = [...customActions.slice(0, 2), ...actions.slice(0, 2)];
          break;
        }
      }
      
      return {
        actions: actions.slice(0, 4), // 限制为4个选项
        context: actionContext
      };
      
    } catch (error) {
      console.error('❌ Error generating contextual actions:', error);
      return {
        actions: ['继续探索', '仔细观察', '寻找线索', '回顾情况'],
        context: '选择你的下一步行动'
      };
    }
  }

  // 辅助方法：确定总结类型
  private static determineSummaryType(context: GameToolContext): 'minor' | 'major' {
    const historyLength = context.history.length;
    
    // 每10个回合创建大总结，每5个回合创建小总结
    if (historyLength % 10 === 0) {
      return 'major';
    } else if (historyLength % 5 === 0) {
      return 'minor';
    }
    
    return 'minor'; // 默认创建小总结
  }

  // 辅助方法：生成上下文相关的总结
  private static async generateContextualSummary(context: GameToolContext, summaryType: 'minor' | 'major'): Promise<any> {
    try {
      console.log(`📝 Generating ${summaryType} contextual summary...`);
      
      const recentHistory = context.history.slice(-5); // 最近5个回合
      const keyEvents: string[] = [];
      const achievements: string[] = [];
      const newMemories: string[] = [];
      
      // 提取关键事件
      recentHistory.forEach((item, index) => {
        const description = item.parts?.[0]?.text || '';
        if (description) {
          // 寻找关键词来识别重要事件
          if (description.includes('发现') || description.includes('找到') || description.includes('获得')) {
            keyEvents.push(`回合${context.history.length - recentHistory.length + index + 1}: ${description.slice(0, 50)}...`);
          }
          
          // 识别成就
          if (description.includes('成功') || description.includes('完成') || description.includes('解决')) {
            achievements.push(`成功: ${description.slice(0, 50)}...`);
          }
          
          // 识别新的记忆点
          if (description.includes('记住') || description.includes('重要') || description.includes('关键')) {
            newMemories.push(`重要信息: ${description.slice(0, 50)}...`);
          }
        }
      });
      
      // 生成总结文本
      let summary = '';
      if (summaryType === 'major') {
        summary = `这是第${context.history.length}个回合的重要总结。`;
        if (keyEvents.length > 0) {
          summary += `关键事件包括：${keyEvents.join('；')}。`;
        }
        if (achievements.length > 0) {
          summary += `主要成就：${achievements.join('；')}。`;
        }
        if (newMemories.length > 0) {
          summary += `需要记住的信息：${newMemories.join('；')}。`;
        }
        
        return {
          summary: summary,
          achievements: achievements,
          newMemories: newMemories,
          type: 'major'
        };
      } else {
        // 小总结
        summary = `最近探索进展：`;
        if (keyEvents.length > 0) {
          summary += `发现了${keyEvents.length}个重要事件。`;
        }
        if (achievements.length > 0) {
          summary += `达成了${achievements.length}个目标。`;
        }
        
        return {
          summary: summary || '继续探索中...',
          keyEvents: keyEvents,
          type: 'minor'
        };
      }
      
    } catch (error) {
      console.error('❌ Error generating contextual summary:', error);
      return {
        summary: summaryType === 'major' ? '重要进展总结' : '近期探索总结',
        type: summaryType
      };
    }
  }
}