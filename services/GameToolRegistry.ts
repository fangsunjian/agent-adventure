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
  private static toolMetadata: Map<string, {
    registrationTime: number;
    lastUsed: number;
    usageCount: number;
    source: 'core' | 'map' | 'html_component' | 'dynamic';
    componentId?: string;
  }> = new Map();

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
    console.log('🔧 DEBUG: registerContentBasedTools called');
    console.log('🔧 DEBUG: activeStory:', {
      hasStory: !!activeStory,
      storyId: activeStory?.id,
      storyName: activeStory?.name,
      hasLibrary: !!activeStory?.library,
      libraryLength: activeStory?.library?.length || 0
    });

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
    
    // 检测并注册HTML组件工具
    console.log('🔍 DEBUG: Checking for HTML components in story library...');
    console.log('🔍 DEBUG: Story library length:', activeStory.library?.length || 0);

    if (!activeStory.library) {
      console.log('❌ DEBUG: No library found in activeStory during tool registration');
      return toolsRegistered;
    }

    console.log('🔍 DEBUG: Analyzing each card for HTML components:');
    activeStory.library.forEach((card, index) => {
      console.log(`  Registration Card ${index}:`, {
        id: card.id,
        name: card.name,
        type: card.type,
        hasHtmlData: !!card.htmlData,
        hasJs: !!(card.htmlData?.js),
        jsLength: card.htmlData?.js?.length || 0
      });
    });

    const htmlComponents = activeStory.library.filter(card =>
      card.type === 'html' && card.htmlData && card.htmlData.js
    );

    console.log(`🔍 DEBUG: Filtered HTML components count: ${htmlComponents.length}`);

    if (htmlComponents.length > 0) {
      console.log(`📟 Found ${htmlComponents.length} HTML components in story, registering HTML component tools`);
      htmlComponents.forEach((component, index) => {
        console.log(`  HTML Component ${index}:`, {
          id: component.id,
          name: component.name,
          hasToolDefinitions: !!(component.htmlData?.toolDefinitions),
          toolDefinitionsCount: component.htmlData?.toolDefinitions?.length || 0
        });
      });
      this.registerHtmlComponentTools(htmlComponents);
      toolsRegistered.push('html_component_tools');
    } else {
      console.log('⚪ No HTML components found in story, skipping HTML component tools registration');
      // 移除已注册的HTML组件工具（如果有的话）
      this.unregisterHtmlComponentTools();
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
    }, 'map');

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
    }, 'map');

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
    }, 'map');
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

  /**
   * 注册HTML组件相关工具
   */
  private static registerHtmlComponentTools(htmlComponents: any[]) {
    // get_available_html_components工具
    this.register({
      name: 'get_available_html_components',
      description: '获取当前故事中可用的HTML组件列表',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      },
      handler: async (args: {}, context) => {
        try {
          console.log('📟 Getting available HTML components');
          console.log('🔍 DEBUG: activeStory object:', {
            hasActiveStory: !!context.activeStory,
            hasLibrary: !!context.activeStory?.library,
            libraryLength: context.activeStory?.library?.length || 0
          });

          context.logCommunication('tool_get_available_html_components', args);

          if (!context.activeStory) {
            console.log('❌ DEBUG: No activeStory found');
            return {
              success: false,
              error: 'No active story found',
              components: [],
              totalComponents: 0
            };
          }

          if (!context.activeStory.library) {
            console.log('❌ DEBUG: No library found in activeStory');
            return {
              success: false,
              error: 'No library found in active story',
              components: [],
              totalComponents: 0
            };
          }

          console.log('🔍 DEBUG: Library cards details:');
          context.activeStory.library.forEach((card, index) => {
            console.log(`  Card ${index}:`, {
              id: card.id,
              name: card.name,
              type: card.type,
              hasHtmlData: !!card.htmlData,
              htmlDataKeys: card.htmlData ? Object.keys(card.htmlData) : null,
              hasJs: !!(card.htmlData?.js),
              jsLength: card.htmlData?.js?.length || 0
            });
          });

          const allCards = context.activeStory.library;
          console.log('🔍 DEBUG: All cards count:', allCards.length);

          const htmlTypeCards = allCards.filter(card => card.type === 'html');
          console.log('🔍 DEBUG: HTML type cards count:', htmlTypeCards.length);

          const htmlDataCards = htmlTypeCards.filter(card => card.htmlData);
          console.log('🔍 DEBUG: HTML cards with htmlData count:', htmlDataCards.length);

          const htmlComponents = htmlDataCards.filter(card => card.htmlData.js);
          console.log('🔍 DEBUG: HTML cards with JS code count:', htmlComponents.length);

          const componentList = htmlComponents.map(component => ({
            id: component.id,
            name: component.name,
            description: component.content || '',
            hasTools: !!(component.htmlData?.toolDefinitions?.length),
            toolCount: component.htmlData?.toolDefinitions?.length || 0
          }));

          console.log('🔍 DEBUG: Final component list:', componentList);
          console.log('🔍 DEBUG: Component list JSON:', JSON.stringify(componentList, null, 2));

          const result = {
            success: true,
            components: componentList,
            totalComponents: componentList.length
          };

          console.log('🔍 DEBUG: Final result object:', JSON.stringify(result, null, 2));

          return result;
        } catch (error) {
          console.error('❌ Error in get_available_html_components tool:', error);
          context.logCommunication('tool_error_get_available_html_components', error);

          return {
            success: false,
            error: error.message,
            components: [],
            totalComponents: 0
          };
        }
      },
      requiredFor: ['exploration', 'action', 'special_event'],
      priority: 8
    }, 'html_component');

    // interact_with_html_component工具
    this.register({
      name: 'interact_with_html_component',
      description: '与HTML组件进行交互，调用组件内定义的工具函数',
      parameters: {
        type: 'object',
        properties: {
          componentId: {
            type: 'string',
            description: 'HTML组件的ID'
          },
          action: {
            type: 'string',
            description: '要执行的操作或函数名'
          },
          parameters: {
            type: 'object',
            description: '传递给组件函数的参数'
          },
          context: {
            type: 'string',
            description: '交互上下文或目的说明'
          }
        },
        required: ['componentId', 'action']
      },
      handler: async (args: { componentId: string; action: string; parameters?: any; context?: string }, context) => {
        try {
          console.log('🔧 Interacting with HTML component:', args);
          context.logCommunication('tool_interact_with_html_component', args);
          
          const component = context.activeStory.library.find(card => 
            card.type === 'html' && card.id === args.componentId
          );
          
          if (!component || !component.htmlData) {
            throw new Error(`HTML component with ID ${args.componentId} not found`);
          }
          
          // 这里返回一个标准化的响应，实际的组件交互会通过postMessage机制处理
          return {
            success: true,
            componentInteraction: {
              componentId: args.componentId,
              componentName: component.name,
              action: args.action,
              parameters: args.parameters || {},
              context: args.context || '',
              timestamp: Date.now(),
              // 指示游戏引擎需要向HTML组件发送消息
              requiresComponentCall: true
            }
          };
        } catch (error) {
          console.error('❌ Error in interact_with_html_component tool:', error);
          context.logCommunication('tool_error_interact_with_html_component', error);
          
          return {
            success: false,
            error: error.message
          };
        }
      },
      requiredFor: ['exploration', 'action', 'special_event'],
      priority: 9
    }, 'html_component');

    // 解析JavaScript代码中的工具定义
    htmlComponents.forEach(component => {
      if (!component.htmlData?.toolDefinitions && component.htmlData?.js) {
        // 从JavaScript代码中解析工具定义
        component.htmlData.toolDefinitions = this.parseToolDefinitionsFromJS(component.htmlData.js);
        console.log(`🔧 DEBUG: Parsed ${component.htmlData.toolDefinitions?.length || 0} tools from JS for component ${component.name}`);
      }
    });

    // 动态注册每个HTML组件特有的工具
    htmlComponents.forEach(component => {
      if (component.htmlData?.toolDefinitions) {
        component.htmlData.toolDefinitions.forEach((toolDef: any) => {
          this.register({
            name: `${component.id}_${toolDef.name}`,
            description: `${toolDef.description} (来自HTML组件: ${component.name})`,
            parameters: toolDef.parameters || {
              type: 'object',
              properties: {},
              required: []
            },
            handler: async (args: any, context) => {
              try {
                console.log(`🛠️ Executing HTML component tool: ${toolDef.name} for component ${component.id}`);
                context.logCommunication('tool_html_component_dynamic', { 
                  componentId: component.id, 
                  toolName: toolDef.name, 
                  args 
                });
                
                // 返回需要转发给HTML组件的调用信息
                return {
                  success: true,
                  componentToolCall: {
                    componentId: component.id,
                    toolName: toolDef.name,
                    args: args,
                    timestamp: Date.now(),
                    requiresComponentCall: true
                  }
                };
              } catch (error) {
                console.error(`❌ Error in HTML component tool ${toolDef.name}:`, error);
                context.logCommunication('tool_error_html_component_dynamic', error);
                
                return {
                  success: false,
                  error: error.message
                };
              }
            },
            requiredFor: ['exploration', 'action', 'special_event'],
            priority: 10
          }, 'html_component', component.id);
        });
      }
    });
  }

  /**
   * 移除HTML组件相关工具
   */
  private static unregisterHtmlComponentTools() {
    const htmlComponentTools = ['get_available_html_components', 'interact_with_html_component'];
    
    // 移除基础HTML组件工具
    htmlComponentTools.forEach(toolName => {
      if (this.tools.has(toolName)) {
        this.tools.delete(toolName);
        console.log(`🗑️ Unregistered HTML component tool: ${toolName}`);
      }
    });
    
    // 移除动态注册的HTML组件特有工具
    const toolNames = Array.from(this.tools.keys());
    toolNames.forEach(toolName => {
      // 匹配 componentId_toolName 格式的动态工具
      if (toolName.includes('_') && this.tools.has(toolName)) {
        const tool = this.tools.get(toolName);
        if (tool && tool.description.includes('来自HTML组件:')) {
          this.tools.delete(toolName);
          console.log(`🗑️ Unregistered dynamic HTML component tool: ${toolName}`);
        }
      }
    });
  }

  /**
   * 从JavaScript代码中解析工具定义
   */
  private static parseToolDefinitionsFromJS(jsCode: string): any[] {
    const toolDefinitions: any[] = [];

    try {
      // 查找所有工具定义模式：const xxxTool = { name: '...', description: '...', ... };
      const toolPatterns = [
        /const\s+(\w+Tool)\s*=\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g,
        /\{\s*name:\s*['"`]([^'"`]+)['"`][^}]*description:\s*['"`]([^'"`]+)['"`][^}]*\}/g
      ];

      // 尝试第一种模式：完整的工具对象定义
      let match;
      const toolObjectPattern = /const\s+(\w+Tool)\s*=\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;

      while ((match = toolObjectPattern.exec(jsCode)) !== null) {
        const toolVarName = match[1];
        const toolObjectContent = match[2];

        // 解析工具对象内容
        const nameMatch = toolObjectContent.match(/name:\s*['"`]([^'"`]+)['"`]/);
        const descMatch = toolObjectContent.match(/description:\s*['"`]([^'"`]+)['"`]/);

        if (nameMatch && descMatch) {
          const toolName = nameMatch[1];
          const description = descMatch[1];

          // 尝试解析参数定义
          let parameters = {
            type: 'object',
            properties: {},
            required: []
          };

          // 查找参数定义
          const paramsMatch = toolObjectContent.match(/parameters:\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/);
          if (paramsMatch) {
            try {
              // 尝试解析参数对象（简单解析）
              const paramsContent = paramsMatch[1];
              const propertiesMatch = paramsContent.match(/properties:\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/);
              const requiredMatch = paramsContent.match(/required:\s*\[([^\]]*)\]/);

              if (propertiesMatch) {
                // 这里可以进一步解析属性定义，但为了简化暂时使用默认值
                parameters.properties = {};
              }

              if (requiredMatch) {
                const requiredFields = requiredMatch[1]
                  .split(',')
                  .map(field => field.trim().replace(/['"`]/g, ''))
                  .filter(field => field.length > 0);
                parameters.required = requiredFields;
              }
            } catch (e) {
              console.log(`🔧 DEBUG: Could not parse parameters for tool ${toolName}, using defaults`);
            }
          }

          toolDefinitions.push({
            name: toolName,
            description: description,
            parameters: parameters
          });

          console.log(`🔧 DEBUG: Parsed tool from JS: ${toolName} - ${description}`);
        }
      }

      // 如果第一种模式没找到工具，尝试查找已知的工具名称
      if (toolDefinitions.length === 0) {
        const knownTools = [
          {
            pattern: /view_inventory/,
            name: 'view_inventory',
            description: '查看玩家背包中的所有物品',
            parameters: {
              type: 'object',
              properties: {},
              required: []
            }
          },
          {
            pattern: /add_item/,
            name: 'add_item',
            description: '向玩家背包添加物品',
            parameters: {
              type: 'object',
              properties: {
                name: { type: 'string', description: '物品名称' },
                description: { type: 'string', description: '物品描述' },
                quantity: { type: 'number', description: '物品数量', minimum: 1 }
              },
              required: ['name']
            }
          },
          {
            pattern: /remove_item/,
            name: 'remove_item',
            description: '从玩家背包移除物品',
            parameters: {
              type: 'object',
              properties: {
                itemName: { type: 'string', description: '要移除的物品名称' },
                quantity: { type: 'number', description: '要移除的数量', minimum: 1 }
              },
              required: ['itemName']
            }
          }
        ];

        knownTools.forEach(knownTool => {
          if (knownTool.pattern.test(jsCode)) {
            toolDefinitions.push({
              name: knownTool.name,
              description: knownTool.description,
              parameters: knownTool.parameters
            });
            console.log(`🔧 DEBUG: Found known tool in JS: ${knownTool.name}`);
          }
        });
      }

    } catch (error) {
      console.error('🔧 DEBUG: Error parsing tool definitions from JS:', error);
    }

    console.log(`🔧 DEBUG: Total tools parsed from JS: ${toolDefinitions.length}`);
    return toolDefinitions;
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

  static register(tool: GameTool, source: 'core' | 'map' | 'html_component' | 'dynamic' = 'core', componentId?: string) {
    this.tools.set(tool.name, tool);
    
    // 记录工具元数据
    this.toolMetadata.set(tool.name, {
      registrationTime: Date.now(),
      lastUsed: 0,
      usageCount: 0,
      source,
      componentId
    });
    
    console.log(`🔧 Registered tool: ${tool.name} (source: ${source}${componentId ? `, componentId: ${componentId}` : ''})`);
  }

  /**
   * 动态注册HTML组件工具
   * 允许HTML组件在运行时注册新的工具
   */
  static dynamicRegisterHtmlComponentTool(
    componentId: string, 
    toolDefinition: {
      name: string;
      description: string;
      parameters: any;
      jsFunction: string;
    }
  ) {
    const toolName = `${componentId}_${toolDefinition.name}`;
    
    // 检查是否已存在同名工具
    if (this.tools.has(toolName)) {
      console.log(`⚠️ Tool ${toolName} already exists, updating...`);
    }
    
    const dynamicTool: GameTool = {
      name: toolName,
      description: `${toolDefinition.description} (来自HTML组件: ${componentId})`,
      parameters: toolDefinition.parameters || {
        type: 'object',
        properties: {},
        required: []
      },
      handler: async (args: any, context) => {
        try {
          console.log(`🛠️ Executing dynamic HTML component tool: ${toolDefinition.name} for component ${componentId}`);
          context.logCommunication('tool_html_component_dynamic', { 
            componentId, 
            toolName: toolDefinition.name, 
            args 
          });
          
          // 返回需要转发给HTML组件的调用信息
          return {
            success: true,
            componentToolCall: {
              componentId,
              toolName: toolDefinition.name,
              jsFunction: toolDefinition.jsFunction,
              args: args,
              timestamp: Date.now(),
              requiresComponentCall: true
            }
          };
        } catch (error) {
          console.error(`❌ Error in dynamic HTML component tool ${toolDefinition.name}:`, error);
          context.logCommunication('tool_error_html_component_dynamic', error);
          
          return {
            success: false,
            error: error.message
          };
        }
      },
      requiredFor: ['exploration', 'action', 'special_event'],
      priority: 10
    };
    
    this.register(dynamicTool, 'dynamic', componentId);
    console.log(`📟 Dynamic HTML component tool registered: ${toolName}`);
    
    return toolName;
  }

  /**
   * 取消注册HTML组件工具
   */
  static dynamicUnregisterHtmlComponentTool(componentId: string, toolName: string) {
    const fullToolName = `${componentId}_${toolName}`;
    
    if (this.tools.has(fullToolName)) {
      this.tools.delete(fullToolName);
      console.log(`🗑️ Dynamic HTML component tool unregistered: ${fullToolName}`);
      return true;
    }
    
    console.log(`⚠️ Tool ${fullToolName} not found for unregistration`);
    return false;
  }

  /**
   * 获取特定HTML组件的工具列表
   */
  static getHtmlComponentTools(componentId: string): GameTool[] {
    const componentTools: GameTool[] = [];
    
    this.tools.forEach((tool, toolName) => {
      if (toolName.startsWith(`${componentId}_`)) {
        componentTools.push(tool);
      }
    });
    
    return componentTools;
  }

  /**
   * 取消注册特定HTML组件的所有工具
   */
  static unregisterAllHtmlComponentTools(componentId: string) {
    const toolsToRemove: string[] = [];
    
    this.tools.forEach((tool, toolName) => {
      if (toolName.startsWith(`${componentId}_`)) {
        toolsToRemove.push(toolName);
      }
    });
    
    toolsToRemove.forEach(toolName => {
      this.tools.delete(toolName);
      console.log(`🗑️ Removed HTML component tool: ${toolName}`);
    });
    
    console.log(`📟 Removed ${toolsToRemove.length} tools for component ${componentId}`);
    return toolsToRemove.length;
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
    
    // 更新使用统计
    const metadata = this.toolMetadata.get(toolName);
    if (metadata) {
      metadata.lastUsed = Date.now();
      metadata.usageCount++;
      this.toolMetadata.set(toolName, metadata);
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

  /**
   * 获取工具使用统计
   */
  static getToolStatistics(toolName?: string) {
    if (toolName) {
      const tool = this.tools.get(toolName);
      const metadata = this.toolMetadata.get(toolName);
      
      if (!tool || !metadata) {
        return null;
      }
      
      return {
        name: toolName,
        description: tool.description,
        registrationTime: new Date(metadata.registrationTime).toISOString(),
        lastUsed: metadata.lastUsed ? new Date(metadata.lastUsed).toISOString() : 'Never',
        usageCount: metadata.usageCount,
        source: metadata.source,
        componentId: metadata.componentId,
        priority: tool.priority,
        requiredFor: tool.requiredFor
      };
    }
    
    // 返回所有工具的统计
    const statistics = Array.from(this.tools.entries()).map(([name, tool]) => {
      const metadata = this.toolMetadata.get(name) || {
        registrationTime: 0,
        lastUsed: 0,
        usageCount: 0,
        source: 'unknown' as const
      };
      
      return {
        name,
        description: tool.description,
        registrationTime: new Date(metadata.registrationTime).toISOString(),
        lastUsed: metadata.lastUsed ? new Date(metadata.lastUsed).toISOString() : 'Never',
        usageCount: metadata.usageCount,
        source: metadata.source,
        componentId: metadata.componentId,
        priority: tool.priority,
        requiredFor: tool.requiredFor
      };
    });
    
    return {
      totalTools: statistics.length,
      toolsBySource: {
        core: statistics.filter(s => s.source === 'core').length,
        map: statistics.filter(s => s.source === 'map').length,
        html_component: statistics.filter(s => s.source === 'html_component').length,
        dynamic: statistics.filter(s => s.source === 'dynamic').length
      },
      mostUsed: statistics.sort((a, b) => b.usageCount - a.usageCount).slice(0, 5),
      leastUsed: statistics.filter(s => s.usageCount === 0),
      recentlyRegistered: statistics.sort((a, b) => 
        new Date(b.registrationTime).getTime() - new Date(a.registrationTime).getTime()
      ).slice(0, 5),
      tools: statistics
    };
  }

  /**
   * 清理未使用的工具
   */
  static cleanupUnusedTools(maxAge: number = 24 * 60 * 60 * 1000) { // 默认24小时
    const now = Date.now();
    const removedTools: string[] = [];
    
    this.toolMetadata.forEach((metadata, toolName) => {
      // 只清理动态注册的工具且超过maxAge未使用
      if (metadata.source === 'dynamic' && 
          metadata.usageCount === 0 && 
          (now - metadata.registrationTime) > maxAge) {
        
        this.tools.delete(toolName);
        this.toolMetadata.delete(toolName);
        removedTools.push(toolName);
        console.log(`🧹 Cleaned up unused dynamic tool: ${toolName}`);
      }
    });
    
    console.log(`🧹 Cleanup completed: removed ${removedTools.length} unused dynamic tools`);
    return removedTools;
  }

  /**
   * 获取工具健康状态
   */
  static getToolHealth() {
    const totalTools = this.tools.size;
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;
    
    let usedInLastHour = 0;
    let usedInLastDay = 0;
    let neverUsed = 0;
    let totalUsage = 0;
    
    this.toolMetadata.forEach(metadata => {
      totalUsage += metadata.usageCount;
      
      if (metadata.usageCount === 0) {
        neverUsed++;
      } else if ((now - metadata.lastUsed) < oneHour) {
        usedInLastHour++;
      } else if ((now - metadata.lastUsed) < oneDay) {
        usedInLastDay++;
      }
    });
    
    return {
      totalTools,
      totalUsage,
      averageUsagePerTool: totalTools > 0 ? (totalUsage / totalTools).toFixed(2) : '0',
      usedInLastHour,
      usedInLastDay,
      neverUsed,
      healthScore: Math.round(((totalTools - neverUsed) / totalTools) * 100) || 0
    };
  }

  /**
   * 更新工具定义
   */
  static updateTool(toolName: string, updates: Partial<GameTool>) {
    const existingTool = this.tools.get(toolName);
    const metadata = this.toolMetadata.get(toolName);
    
    if (!existingTool || !metadata) {
      console.log(`⚠️ Tool ${toolName} not found for update`);
      return false;
    }
    
    const updatedTool = { ...existingTool, ...updates };
    this.tools.set(toolName, updatedTool);
    
    console.log(`🔄 Updated tool: ${toolName}`);
    return true;
  }

  /**
   * 安全移除工具（包含依赖检查）
   */
  static safeRemoveTool(toolName: string) {
    const tool = this.tools.get(toolName);
    const metadata = this.toolMetadata.get(toolName);
    
    if (!tool || !metadata) {
      console.log(`⚠️ Tool ${toolName} not found for removal`);
      return false;
    }
    
    // 核心工具不允许移除
    if (metadata.source === 'core') {
      console.log(`🚫 Cannot remove core tool: ${toolName}`);
      return false;
    }
    
    this.tools.delete(toolName);
    this.toolMetadata.delete(toolName);
    
    console.log(`🗑️ Safely removed tool: ${toolName}`);
    return true;
  }
}
