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

  /**
   * 根据故事内容动态注册内容相关工具
   */
  static registerContentBasedTools(activeStory: Story) {
    const toolsRegistered: string[] = [];
    
    // 检测并注册地图相关工具
    const storyMaps = activeStory.library.filter(card => 
      card.type === 'map' && card.mapImageUrl && card.mapLocations && card.mapLocations.length > 0
    );
    
    if (storyMaps.length > 0) {
      console.log(`🗺️ Found ${storyMaps.length} maps in story, registering map tools`);
      this.registerMapTools();
      toolsRegistered.push('map_tools');
    } else {
      console.log('⚪ No maps found in story, skipping map tools registration');
      // 移除已注册的地图工具（如果有的话）
      this.unregisterMapTools();
    }
    
    // 未来可以在这里添加其他内容相关工具的检测
    // if (activeStory.library.some(card => card.type === 'inventory')) {
    //   this.registerInventoryTools();
    //   toolsRegistered.push('inventory_tools');
    // }
    
    return toolsRegistered;
  }

  /**
   * 注册地图相关工具
   */
  private static registerMapTools() {
    // get_available_maps工具
    this.register({
      name: 'get_available_maps',
      description: '获取当前故事中可用的地图列表',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      },
      handler: async (args: {}, context) => {
        try {
          console.log('🗺️ Getting available maps');
          context.logCommunication('tool_get_available_maps', args);
          
          const maps = context.activeStory.library.filter(card => 
            card.type === 'map' && card.mapImageUrl && card.mapLocations
          );
          
          const mapList = maps.map(map => ({
            id: map.id,
            name: map.name,
            description: map.content || '',
            locationCount: map.mapLocations?.length || 0,
            locations: map.mapLocations?.map(loc => ({
              id: loc.id,
              name: loc.name,
              description: loc.description
            })) || []
          }));
          
          return {
            success: true,
            maps: mapList,
            totalMaps: mapList.length
          };
        } catch (error) {
          console.error('❌ Error in get_available_maps tool:', error);
          context.logCommunication('tool_error_get_available_maps', error);
          
          return {
            success: false,
            error: error.message,
            maps: [],
            totalMaps: 0
          };
        }
      },
      requiredFor: ['exploration', 'action'],
      priority: 8
    });

    // get_location_details工具
    this.register({
      name: 'get_location_details',
      description: '获取地图上特定位置的详细信息',
      parameters: {
        type: 'object',
        properties: {
          mapId: {
            type: 'string',
            description: '地图的ID'
          },
          locationId: {
            type: 'string',
            description: '位置的ID'
          }
        },
        required: ['mapId', 'locationId']
      },
      handler: async (args: { mapId: string; locationId: string }, context) => {
        try {
          console.log('🔍 Getting location details:', args);
          context.logCommunication('tool_get_location_details', args);
          
          const map = context.activeStory.library.find(card => 
            card.type === 'map' && card.id === args.mapId
          );
          
          if (!map) {
            throw new Error(`Map with ID ${args.mapId} not found`);
          }
          
          const location = map.mapLocations?.find(loc => loc.id === args.locationId);
          
          if (!location) {
            throw new Error(`Location with ID ${args.locationId} not found in map ${map.name}`);
          }
          
          return {
            success: true,
            location: {
              id: location.id,
              name: location.name,
              description: location.description,
              coordinates: { x: location.x, y: location.y }
            },
            mapName: map.name,
            mapDescription: map.content || ''
          };
        } catch (error) {
          console.error('❌ Error in get_location_details tool:', error);
          context.logCommunication('tool_error_get_location_details', error);
          
          return {
            success: false,
            error: error.message
          };
        }
      },
      requiredFor: ['exploration', 'action'],
      priority: 7
    });

    // set_player_location工具
    this.register({
      name: 'set_player_location',
      description: '设置玩家当前位置。当玩家移动到新地点、传送、或故事明确提到玩家到达某个具体地点时使用。应在描述玩家到达或移动到地图上某个位置时调用，特别是开始游戏时设定初始位置，或玩家执行"前往..."、"到达..."等移动行动时',
      parameters: {
        type: 'object',
        properties: {
          mapId: {
            type: 'string',
            description: '地图的ID'
          },
          locationId: {
            type: 'string',
            description: '位置的ID'
          },
          reason: {
            type: 'string',
            description: '移动到此位置的原因或描述'
          }
        },
        required: ['mapId', 'locationId']
      },
      handler: async (args: { mapId: string; locationId: string; reason?: string }, context) => {
        try {
          console.log('📍 Setting player location:', args);
          context.logCommunication('tool_set_player_location', args);
          
          if (!args.mapId || !args.locationId) {
            throw new Error('Both mapId and locationId are required');
          }
          
          // 验证地图和位置存在
          const map = context.activeStory.library.find(card => 
            card.type === 'map' && card.id === args.mapId
          );
          
          if (!map) {
            throw new Error(`Map with ID ${args.mapId} not found`);
          }
          
          const location = map.mapLocations?.find(loc => loc.id === args.locationId);
          
          if (!location) {
            throw new Error(`Location with ID ${args.locationId} not found in map ${map.name}`);
          }
          
          return {
            success: true,
            playerLocation: {
              mapId: args.mapId,
              locationId: args.locationId,
              mapName: map.name,
              locationName: location.name,
              reason: args.reason || '玩家位置已更新',
              coordinates: { x: location.x, y: location.y }
            }
          };
        } catch (error) {
          console.error('❌ Error in set_player_location tool:', error);
          context.logCommunication('tool_error_set_player_location', error);
          
          return {
            success: false,
            error: error.message
          };
        }
      },
      requiredFor: ['exploration', 'action'],
      priority: 9
    });
  }

  /**
   * 移除地图相关工具
   */
  private static unregisterMapTools() {
    const mapTools = ['get_available_maps', 'get_location_details', 'set_player_location'];
    mapTools.forEach(toolName => {
      if (this.tools.has(toolName)) {
        this.tools.delete(toolName);
        console.log(`🗑️ Unregistered map tool: ${toolName}`);
      }
    });
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
              imagePrompt: '神秘的环境',
              actions: ['继续探索', '环顾四周', '思考下一步'],
              summary: '继续探索未知的环境'
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

    // 地图相关工具现在通过 registerContentBasedTools 方法动态注册
  }

  static register(tool: GameTool) {
    this.tools.set(tool.name, tool);
    console.log(`🔧 Registered tool: ${tool.name}`);
  }

  static getTools(sceneTypes?: SceneType[]): GameTool[] {
    if (!sceneTypes || sceneTypes.length === 0) {
      return Array.from(this.tools.values());
    }
    
    return Array.from(this.tools.values()).filter(tool =>
      tool.requiredFor.some(type => sceneTypes.includes(type))
    );
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

  // 动态工具选择和参数修改系统
  static getToolsForOpenAIWithTurnCount(sceneTypes?: SceneType[], turnCount?: number, settings?: GameSettings): any[] {
    const tools = this.getTools(sceneTypes);
    
    return tools.map(tool => {
      let modifiedTool = { ...tool };
      
      // 动态修改工具参数
      if (turnCount) {
        modifiedTool = this.modifyToolForTurn(modifiedTool, turnCount, settings);
      }
      
      return {
        type: 'function',
        function: {
          name: modifiedTool.name,
          description: modifiedTool.description,
          parameters: modifiedTool.parameters
        }
      };
    });
  }

  private static modifyToolForTurn(tool: GameTool, turnCount: number, settings?: GameSettings): GameTool {
    const modifiedTool = JSON.parse(JSON.stringify(tool)); // Deep clone
    
    // 为核心工具动态添加参数
    if (tool.name === 'advance_scene' || tool.name === 'show_dialogue') {
      // 所有回合都需要 actions 和 summary
      if (!modifiedTool.parameters.properties.actions) {
        modifiedTool.parameters.properties.actions = {
          type: 'array',
          items: { type: 'string' },
          description: '提供3-6个具体的行动选项，让玩家选择下一步行动'
        };
        modifiedTool.parameters.required.push('actions');
      }
      
      if (!modifiedTool.parameters.properties.summary) {
        modifiedTool.parameters.properties.summary = {
          type: 'string',
          description: '本回合的简要总结，用于记录重要信息'
        };
        modifiedTool.parameters.required.push('summary');
      }
      
      // 每5回合添加特殊参数
      if (turnCount % 5 === 0) {
        modifiedTool.parameters.properties.isImportantMemory = {
          type: 'boolean',
          description: '这是否是一个重要的记忆点或里程碑'
        };
        modifiedTool.parameters.properties.achievements = {
          type: 'array',
          items: { type: 'string' },
          description: '玩家在这个阶段取得的成就或进展'
        };
        modifiedTool.parameters.properties.newMemories = {
          type: 'array',
          items: { type: 'string' },
          description: '需要记住的新信息或发现'
        };
      }
      
      // 图像生成参数（如果启用）
      if (settings?.enableImageGeneration && tool.name === 'advance_scene') {
        if (!modifiedTool.parameters.properties.imagePrompt) {
          modifiedTool.parameters.properties.imagePrompt = {
            type: 'string',
            description: '生成场景图像的详细描述（英文）'
          };
          modifiedTool.parameters.required.push('imagePrompt');
        }
      }
    }
    
    return modifiedTool;
  }

  static async executeTool(toolCall: any, context: GameToolContext): Promise<any> {
    const toolName = toolCall.function?.name;
    const tool = this.tools.get(toolName);
    
    if (!tool) {
      throw new Error(`Unknown tool: ${toolName}`);
    }
    
    let args: any = {};
    try {
      args = typeof toolCall.function.arguments === 'string' 
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments || {};
    } catch (error) {
      console.error(`Failed to parse arguments for tool ${toolName}:`, error);
      return { success: false, error: 'Invalid tool arguments' };
    }
    
    return await tool.handler(args, context);
  }
}
