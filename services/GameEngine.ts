import { PROMPTS } from '../prompts/index';
import type { GameSettings, HistoryItem, Memories, SceneFragment, Story } from '../types';
import { GameToolRegistry, type GameToolContext, type SceneType } from './GameToolRegistry';
import { SceneAnalyzer } from './SceneAnalyzer';

// 重新导出用于测试
export { GameToolRegistry } from './GameToolRegistry';
export { SceneAnalyzer } from './SceneAnalyzer';

export interface GameEngineResult {
  scene?: SceneFragment;
  rawResponse: string;
  toolCalls?: any[];
  actionData?: any; // 添加actionData字段用于传递行动选项
  playerLocationData?: { mapId: string; locationId: string; mapName: string; locationName: string; reason: string };
  mapData?: any; // 新增：存储地图数据
  error?: boolean;
  errorMessage?: string;
  engineData?: {
    sceneAnalysis: any;
    toolsUsed: string[];
    executionTime: number;
  };
}

export interface ToolHandler {
  show_dialogue: (data: { speaker: string; messages: string[]; avatar?: string }) => Promise<void>;
  [key: string]: (data: any) => Promise<void>;
}

export class GameEngine {
  private static initialized = false;
  private static detectedLLMProvider: string | null = null; // 会话级别的LLM提供商检测
  
  static initialize() {
    if (this.initialized) return;
    
    console.log('🎮 Initializing Game Engine...');
    GameToolRegistry.initialize();
    this.initialized = true;
    console.log('✅ Game Engine initialized');
  }

  /**
   * 重置会话状态（用于新游戏开始时）
   */
  static resetSession() {
    console.log('🔄 Resetting GameEngine session state');
    this.detectedLLMProvider = null;
  }

  /**
   * 核心游戏引擎 - 使用工具化系统生成游戏场景（支持多轮工具调用）
   */
  static async processGameTurn(
    history: HistoryItem[],
    settings: GameSettings,
    memories: Memories,
    activeStory: Story,
    logCommunication: (type: string, data: any) => void,
    abortSignal: AbortSignal,
    toolHandler?: ToolHandler
  ): Promise<GameEngineResult> {
    const startTime = Date.now();
    
    try {
      console.log('🎮 Starting game turn processing...');
      
      // 确保初始化
      this.initialize();
      
      // 计算当前轮次（基于历史记录长度）
      const turnCount = Math.floor(history.length / 2) + 1; // 每轮包括用户输入和AI响应
      console.log(`🔄 Processing turn ${turnCount}`);
      
      // 分析场景上下文
      const sceneAnalysis = SceneAnalyzer.analyze(history, memories, activeStory);
      console.log('📊 Scene analysis:', sceneAnalysis);
      logCommunication('scene_analysis', sceneAnalysis);
      
      // 根据故事内容动态注册工具
      GameToolRegistry.registerContentBasedTools(activeStory);
      
      // 选择合适的工具集（传递轮次信息）
      const toolsToUse = this.selectTools(sceneAnalysis, turnCount);
      console.log('🔧 Selected tools:', toolsToUse);
      
      // 构建游戏上下文
      const gameContext: GameToolContext = {
        settings,
        history,
        memories,
        activeStory,
        logCommunication
      };
      
      // 启动多轮工具调用循环
      const processedResult = await this.processMultiTurnToolCalls(
        history,
        settings,
        memories,
        toolsToUse,
        gameContext,
        logCommunication,
        abortSignal,
        turnCount,
        toolHandler
      );
      
      const executionTime = Date.now() - startTime;
      
      return {
        ...processedResult,
        engineData: {
          sceneAnalysis,
          toolsUsed: processedResult.allToolsUsed || [],
          executionTime
        }
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('❌ Game engine error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      logCommunication('game_engine_error', { error: errorMessage, executionTime });
      
      // 返回应急场景
      return this.createFallbackScene(errorMessage, executionTime);
    }
  }

  /**
   * 多轮工具调用处理 - 实现标准OpenAI工具调用链
   */
  private static async processMultiTurnToolCalls(
    history: HistoryItem[],
    settings: GameSettings,
    memories: Memories,
    toolsToUse: string[],
    gameContext: GameToolContext,
    logCommunication: (type: string, data: any) => void,
    abortSignal: AbortSignal,
    turnCount: number,
    toolHandler?: ToolHandler
  ): Promise<Omit<GameEngineResult, 'engineData'> & { allToolsUsed: string[] }> {
    
    interface ToolResult {
      toolName: string;
      success: boolean;
      data?: any;
      error?: string;
    }
    
    console.log('🔄 Starting multi-turn tool call processing...');
    
    let currentMessages = this.buildPromptParts(history, memories, settings, gameContext.activeStory).openAIMessages;
    let allToolsUsed: string[] = [];
    let allToolResults: ToolResult[] = [];
    let maxIterations = 5; // 防止无限循环
    let iteration = 0;
    let retryCount = 0;
    const maxRetries = 1;
    
    while (iteration < maxIterations) {
      iteration++;
      console.log(`🔄 Tool call iteration ${iteration}/${maxIterations}`);
      
      // 调用AI获取工具决策
      const aiResult = await this.callAIWithMessages(
        currentMessages,
        toolsToUse,
        settings,
        logCommunication,
        abortSignal,
        turnCount
      );
      
      if (!aiResult.toolCalls || aiResult.toolCalls.length === 0) {
        console.log('⚠️ No tool calls in iteration, ending loop');
        break;
      }
      
      // 执行工具调用
      const toolResults = await this.executeToolCalls(aiResult.toolCalls, gameContext);
      allToolsUsed.push(...toolResults.map((tr: ToolResult) => tr.toolName));
      allToolResults.push(...toolResults);
      
      // 检查是否有终结性工具
      const terminalResult = toolResults.find((result: ToolResult) =>
        ['advance_scene', 'show_dialogue'].includes(result.toolName) && result.success
      );
      
      if (terminalResult) {
        console.log(`✅ Found terminal tool: ${terminalResult.toolName}, ending loop`);
        return await this.buildFinalResult(allToolResults, aiResult.rawResponse, toolHandler, allToolsUsed);
      }
      
      // 检查核心工具是否失败或参数缺失，需要重试
      const coreToolsFailed = toolResults.some(result =>
        ['advance_scene', 'show_dialogue'].includes(result.toolName) &&
        (!result.success || this.isMissingKeyFields(result.data, result.toolName))
      );
      
      if (coreToolsFailed && retryCount < maxRetries) {
        console.log(`⚠️ Core tool failed or missing fields, retrying AI request (attempt ${retryCount + 1}/${maxRetries})`);
        retryCount++;
        // 不添加工具结果到历史，继续下一次iteration重试AI
        continue;
      }
      
      // 将工具结果添加到消息历史中
      currentMessages = this.addToolResultsToMessages(currentMessages, aiResult.toolCalls, toolResults);
      
      console.log(`🔄 Continuing to iteration ${iteration + 1}, tools used so far:`, allToolsUsed);
    }
    
    // 如果超过最大迭代次数或重试失败，创建error结果
    if (iteration >= maxIterations || retryCount >= maxRetries) {
      console.log('❌ Max iterations or retries reached, returning error result');
      const playerLocationData = allToolResults.find(tr => tr.toolName === 'set_player_location' && tr.success && tr.data?.playerLocation)?.data?.playerLocation || null;
      return {
        scene: this.createErrorScene('AI未能正确生成响应，请尝试其他行动。'),
        rawResponse: 'Max iterations or retries reached',
        toolCalls: [],
        actionData: { actions: ['继续探索'], context: '选择下一步行动' },
        playerLocationData,
        allToolsUsed,
        error: true
      };
    }
    
    // 如果超过最大迭代次数，创建fallback结果
    console.log('⚠️ Reached maximum iterations, creating fallback result');
    const playerLocationData = allToolResults.find(tr => tr.toolName === 'set_player_location' && tr.success && tr.data?.playerLocation)?.data?.playerLocation || null;
    return {
      scene: this.createMinimalScene('游戏继续进行中...'),
      rawResponse: 'Max iterations reached',
      toolCalls: [],
      actionData: { actions: ['继续'], context: '继续游戏' },
      playerLocationData,
      allToolsUsed
    };
  }

  // 检查工具数据是否缺失关键字段
  private static isMissingKeyFields(data: any, toolName: string): boolean {
    if (!data) return true;
    
    switch (toolName) {
      case 'advance_scene':
        return !data.description || !data.actions || data.actions.length === 0;
      case 'show_dialogue':
        return !data.speaker || !data.messages || data.messages.length === 0 || !data.actions || data.actions.length === 0;
      default:
        return false;
    }
  }

  // 创建错误场景
  private static createErrorScene(message: string): SceneFragment {
    return {
      description: message,
      imagePrompt: '',
      actions: ['继续探索', '查看周围'],
      summary: 'AI响应错误'
    };
  }

  /**
   * 调用AI处理消息
   */
  private static async callAIWithMessages(
    messages: any[],
    toolsToUse: string[],
    settings: GameSettings,
    logCommunication: (type: string, data: any) => void,
    abortSignal: AbortSignal,
    turnCount: number
  ): Promise<{ toolCalls?: any[]; content?: string; rawResponse: string }> {
    
    if (settings.provider !== 'custom' || !settings.customEndpoint) {
      throw new Error('Game Engine currently only supports custom providers');
    }
    
    // 获取工具定义
    const sceneTypes = this.getSceneTypesFromTools(toolsToUse);
    const tools = GameToolRegistry.getToolsForOpenAIWithTurnCount(
      sceneTypes.length > 0 ? sceneTypes : undefined,
      turnCount,
      settings
    );
    
    const requestPayload: any = {
      model: settings.customModelId || 'gpt-4-turbo',
      messages: messages,
      tools: tools,
      tool_choice: "required",
      temperature: Number(settings.llm.temperature || 0.7),
      top_p: Number(settings.llm.topP || 1),
      max_tokens: Number(settings.llm.maxOutputTokens || 1000),
    };
    
    const isGoogleAPI = settings.customEndpoint?.includes('googleapis.com');
    if (!isGoogleAPI) {
      requestPayload.frequency_penalty = Number(settings.llm.frequencyPenalty || 0);
      requestPayload.presence_penalty = Number(settings.llm.presencePenalty || 0);
      
      if (settings.llm.reasoningEffort) {
        requestPayload.reasoning_effort = settings.llm.reasoningEffort;
      }
    }
    
    logCommunication('📤 multi_turn_ai_request', requestPayload);
    
    const url = settings.customEndpoint.replace(/\/+$/, '') + '/chat/completions';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.customApiKey}`
      },
      body: JSON.stringify(requestPayload),
      signal: abortSignal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`AI API error: ${response.status} ${response.statusText} - ${errorBody}`);
    }
    
    const result = await response.json();
    logCommunication('📥 multi_turn_ai_response', result);
    
    if (!result.choices || result.choices.length === 0) {
      throw new Error('AI returned empty response');
    }

    const choice = result.choices[0];
    
    // 使用通用的AI响应工具调用处理
    const { toolCalls, content } = this.processAIResponseToolCalls(choice, logCommunication);
    
    return {
      toolCalls: toolCalls,
      content: content,
      rawResponse: JSON.stringify(result)
    };
  }

  /**
   * 通用的AI响应工具调用处理（包含xAI格式检测）
   */
  static processAIResponseToolCalls(choice: any, logCommunication: (type: string, data: any) => void): { toolCalls: any[]; content: string } {
    let toolCalls = choice.message.tool_calls;
    let content = choice.message.content;
    
    // 如果没有标准tool_calls但有content，检查是否是xAI格式
    if (!toolCalls && content && content.includes('<xai:function_call')) {
      console.log('🔍 Detected xAI non-standard tool call format');
      
      // 记录LLM提供商（仅首次检测时）
      if (!this.detectedLLMProvider) {
        this.detectedLLMProvider = 'xai';
        console.log('📝 Detected LLM provider: xAI');
        logCommunication('llm_provider_detected', { provider: 'xai', format: 'non-standard-function-calls' });
      }
      
      toolCalls = this.parseXAIToolCalls(content);
      console.log('🔄 Converted xAI format to standard tool calls:', toolCalls);
    }
    
    // 如果已经检测到是xAI，但这次没有明显的xAI标记，仍然尝试解析
    else if (this.detectedLLMProvider === 'xai' && !toolCalls && content) {
      const potentialToolCalls = this.parseXAIToolCalls(content);
      if (potentialToolCalls && potentialToolCalls.length > 0) {
        toolCalls = potentialToolCalls;
        console.log('🔄 Applied xAI parsing to current response:', toolCalls);
      }
    }
    
    return { toolCalls: toolCalls || [], content: content || '' };
  }

  /**
   * 解析xAI非标准工具调用格式
   */
  private static parseXAIToolCalls(content: string): any[] {
    const toolCalls: any[] = [];
    
    try {
      // 匹配 <xai:function_call>...</xai:function_call> 格式
      const functionCallRegex = /<xai:function_call[^>]*>\s*({.*?})\s*<\/xai:function_call>/gs;
      let match;
      let callIndex = 0;
      
      while ((match = functionCallRegex.exec(content)) !== null) {
        try {
          const jsonContent = match[1];
          const parsedCall = JSON.parse(jsonContent);
          
          // 转换为标准OpenAI tool call格式
          const standardToolCall = {
            id: `xai_call_${Date.now()}_${callIndex}`,
            type: 'function',
            function: {
              name: parsedCall.name,
              arguments: typeof parsedCall.arguments === 'string' 
                ? parsedCall.arguments 
                : JSON.stringify(parsedCall.arguments)
            }
          };
          
          toolCalls.push(standardToolCall);
          callIndex++;
          
          console.log('✅ Parsed xAI tool call:', standardToolCall);
          
        } catch (parseError) {
          console.warn('⚠️ Failed to parse xAI function call JSON:', match[1], parseError);
        }
      }
      
      // 如果没有找到标准格式，尝试其他可能的xAI格式
      if (toolCalls.length === 0 && content.includes('function_call')) {
        console.log('🔍 Attempting alternative xAI parsing patterns...');
        
        // 尝试解析其他可能的格式，如简单的函数调用
        const simpleFunctionRegex = /function_call\s*[:=]\s*({[^}]*name[^}]*})/g;
        let simpleMatch;
        
        while ((simpleMatch = simpleFunctionRegex.exec(content)) !== null) {
          try {
            const jsonContent = simpleMatch[1];
            const parsedCall = JSON.parse(jsonContent);
            
            if (parsedCall.name) {
              const standardToolCall = {
                id: `xai_simple_${Date.now()}_${callIndex}`,
                type: 'function',
                function: {
                  name: parsedCall.name,
                  arguments: JSON.stringify(parsedCall.arguments || {})
                }
              };
              
              toolCalls.push(standardToolCall);
              callIndex++;
              console.log('✅ Parsed simple xAI function call:', standardToolCall);
            }
            
          } catch (parseError) {
            console.warn('⚠️ Failed to parse simple xAI function call:', simpleMatch[1], parseError);
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Error parsing xAI tool calls:', error);
    }
    
    return toolCalls;
  }

  /**
   * 执行工具调用
   */
  private static async executeToolCalls(
    toolCalls: any[],
    gameContext: GameToolContext
  ): Promise<Array<{ toolName: string; success: boolean; data?: any; error?: string }>> {
    
    const results = [];
    
    for (const toolCall of toolCalls) {
      try {
        console.log(`🔧 Executing tool: ${toolCall.function?.name}`);
        
        const result = await GameToolRegistry.executeTool(toolCall, gameContext);
        
        // 检查是否是需要转发给HTML组件的工具调用
        if (result.componentToolCall && result.componentToolCall.requiresComponentCall) {
          console.log(`🔄 Tool requires HTML component execution: ${toolCall.function?.name}`);
          
          // 尝试执行HTML组件工具调用
          const componentResult = await this.executeHtmlComponentTool(
            result.componentToolCall,
            gameContext
          );
          
          results.push({
            toolName: toolCall.function?.name,
            success: componentResult.success,
            data: componentResult,
            error: componentResult.error
          });
        } else {
          results.push({
            toolName: toolCall.function?.name,
            success: result.success,
            data: result,
            error: result.error
          });
        }
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ Tool execution failed for ${toolCall.function?.name}:`, error);
        
        results.push({
          toolName: toolCall.function?.name,
          success: false,
          error: errorMessage
        });
      }
    }
    
    return results;
  }

  /**
   * 执行HTML组件工具调用
   */
  private static async executeHtmlComponentTool(
    componentToolCall: {
      componentId: string;
      toolName: string;
      jsFunction?: string;
      args: any;
      timestamp: number;
    },
    gameContext: GameToolContext
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    
    try {
      console.log(`📟 Executing HTML component tool: ${componentToolCall.toolName} for component ${componentToolCall.componentId}`);
      
      // 查找对应的HTML组件
      const htmlComponent = gameContext.activeStory.library.find(card => 
        card.type === 'html' && card.id === componentToolCall.componentId
      );
      
      if (!htmlComponent) {
        throw new Error(`HTML component with ID ${componentToolCall.componentId} not found`);
      }
      
      // 记录工具调用日志
      gameContext.logCommunication('html_component_tool_call', {
        componentId: componentToolCall.componentId,
        componentName: htmlComponent.name,
        toolName: componentToolCall.toolName,
        args: componentToolCall.args,
        timestamp: componentToolCall.timestamp
      });
      
      // 模拟HTML组件工具执行（在实际实现中，这会通过postMessage发送到HTML组件）
      // 这里返回一个标准化的响应，表示工具调用已经发起
      const toolResponse = {
        success: true,
        componentToolExecution: {
          componentId: componentToolCall.componentId,
          componentName: htmlComponent.name,
          toolName: componentToolCall.toolName,
          executionStatus: 'initiated',
          message: `HTML组件工具 '${componentToolCall.toolName}' 已发起执行`,
          args: componentToolCall.args,
          timestamp: componentToolCall.timestamp,
          // 在实际实现中，这里会包含来自HTML组件的真实响应
          simulatedResponse: this.simulateHtmlComponentResponse(componentToolCall)
        }
      };
      
      console.log(`✅ HTML component tool executed successfully: ${componentToolCall.toolName}`);
      return toolResponse;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ HTML component tool execution failed:`, error);
      
      gameContext.logCommunication('html_component_tool_error', {
        componentId: componentToolCall.componentId,
        toolName: componentToolCall.toolName,
        error: errorMessage,
        timestamp: Date.now()
      });
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * 模拟HTML组件响应（用于开发测试）
   */
  private static simulateHtmlComponentResponse(componentToolCall: any) {
    const { toolName, args } = componentToolCall;
    
    // 根据工具名称模拟不同的响应
    switch (toolName) {
      case 'get_click_count':
        return {
          clickCount: Math.floor(Math.random() * 20),
          message: `按钮已被点击 ${Math.floor(Math.random() * 20)} 次`
        };
      
      case 'query_component_status':
        if (args.query === 'full') {
          return {
            state: {
              clickCount: Math.floor(Math.random() * 20),
              lastInput: '测试输入',
              selectedOption: '选项1'
            },
            timestamp: new Date().toISOString()
          };
        } else if (args.query === 'summary') {
          return {
            summary: `点击数: ${Math.floor(Math.random() * 20)}, 最后输入: 测试输入`
          };
        }
        break;
      
      case 'calculate_metrics':
        const metricType = args.metricType;
        if (metricType === 'usage') {
          return {
            metrics: {
              totalClicks: Math.floor(Math.random() * 50),
              inputCount: Math.floor(Math.random() * 10),
              testResults: Math.floor(Math.random() * 15)
            }
          };
        } else if (metricType === 'engagement') {
          return {
            metrics: {
              interactionScore: Math.floor(Math.random() * 100),
              engagementLevel: ['低', '中', '高'][Math.floor(Math.random() * 3)]
            }
          };
        }
        break;
      
      default:
        return {
          message: `HTML组件工具 '${toolName}' 执行完成`,
          args: args,
          timestamp: new Date().toISOString()
        };
    }
    
    return {
      message: `工具 '${toolName}' 执行完成`,
      result: 'success'
    };
  }

  /**
   * 将工具结果添加到消息历史
   */
  private static addToolResultsToMessages(
    currentMessages: any[],
    toolCalls: any[],
    toolResults: Array<{ toolName: string; success: boolean; data?: any; error?: string }>
  ): any[] {
    
    const newMessages = [...currentMessages];
    
    // 添加AI的工具调用消息
    newMessages.push({
      role: 'assistant',
      content: null,
      tool_calls: toolCalls
    });
    
    // 添加每个工具的结果消息
    toolCalls.forEach((toolCall, index) => {
      const toolResult = toolResults[index];
      const resultContent = toolResult?.success
        ? JSON.stringify(toolResult.data)
        : `Error: ${toolResult?.error || 'Unknown error'}`;
      
      newMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: resultContent
      });
    });
    
    return newMessages;
  }

  /**
   * 构建最终结果
   */
  private static async buildFinalResult(
    toolResults: Array<{ toolName: string; success: boolean; data?: any; error?: string }>,
    rawResponse: string,
    toolHandler?: ToolHandler,
    allToolsUsed?: string[]
  ): Promise<Omit<GameEngineResult, 'engineData'> & { allToolsUsed: string[] }> {
    
    let sceneData: any = null;
    let actionData: any = null;
    let summaryData: any = null;
    let playerLocationData: any = null;
    let mapData: any = null;
    let isDialogueOnly = false;
    const processedToolCalls: any[] = [];
    let error: boolean = false;
    let errorMessage: string = '';
    
    // 处理工具结果
    for (const toolResult of toolResults) {
      console.log('Processing tool result:', {
        toolName: toolResult.toolName,
        success: toolResult.success,
        hasData: !!toolResult.data,
        dataKeys: toolResult.data ? Object.keys(toolResult.data) : []
      });
      
      if (!toolResult.success || !toolResult.data) {
        // 如果核心工具失败，标记错误
        if (['advance_scene', 'show_dialogue'].includes(toolResult.toolName)) {
          error = true;
          errorMessage = toolResult.error || `Tool ${toolResult.toolName} failed`;
        }
        continue;
      }
      
      const data = toolResult.data;
      
      if (data.sceneData) sceneData = data.sceneData;
      if (data.actionData) actionData = data.actionData;
      if (data.summaryData) summaryData = data.summaryData;
      
      // Handle player location from set_player_location tool
      if (toolResult.toolName === 'set_player_location' && data.playerLocation) {
        playerLocationData = data.playerLocation;
        console.log('🎯 Set playerLocationData from set_player_location tool:', playerLocationData);
      }
      
      if (data.maps) mapData = data;
      
      // 构建toolCall格式供上层使用
      processedToolCalls.push({
        id: `tool-${Date.now()}-${toolResult.toolName}`,
        type: 'function',
        function: {
          name: toolResult.toolName,
          arguments: JSON.stringify({})
        }
      });
      
      // 处理对话
      if (toolResult.toolName === 'show_dialogue' && data.dialogueData && toolHandler?.show_dialogue) {
        isDialogueOnly = true;
        await toolHandler.show_dialogue(data.dialogueData);
      }
    }
    
    // 如果有错误，创建错误场景
    if (error) {
      return {
        scene: this.createErrorScene(errorMessage),
        rawResponse,
        toolCalls: processedToolCalls,
        actionData: actionData || { actions: ['继续探索'], context: '选择下一步行动' },
        playerLocationData,
        mapData,
        allToolsUsed: allToolsUsed || [],
        error: true,
        errorMessage
      };
    }
    
    // 确保有行动数据
    if (!actionData) {
      actionData = {
        actions: ['继续探索', '仔细观察', '寻找线索'],
        context: '选择下一步行动'
      };
    }
    
    // 对于纯对话场景，也需要返回有效的场景数据
    if (isDialogueOnly && !sceneData) {
      console.log('🎭 Pure dialogue scene, creating minimal scene with updated actions');
      console.log('🎯 ActionData received:', actionData);
      
      const minimalScene = {
        description: '', // 空描述，因为对话已经显示
        imagePrompt: '',
        actions: actionData?.actions || ['继续'],
        summary: summaryData?.summary || '进行了对话交流'
      };
      
      console.log('🎯 Final scene actions:', minimalScene.actions);
      
      return {
        scene: minimalScene,
        rawResponse,
        toolCalls: processedToolCalls,
        actionData: actionData, // 确保actionData被传递
        playerLocationData,
        mapData,
        allToolsUsed: allToolsUsed || []
      };
    }
    
    // 构建场景 - 确保使用最新的actionData
    const finalScene = this.buildFinalScene(sceneData, actionData, summaryData);
    console.log('🎯 Final scene built with actions:', finalScene.actions);
    
    return {
      scene: finalScene,
      rawResponse,
      toolCalls: processedToolCalls,
      actionData: actionData, // 确保actionData被传递
      playerLocationData,
      mapData,
      allToolsUsed: allToolsUsed || []
    };
  }

  private static selectTools(sceneAnalysis: any, turnCount?: number): string[] {
    // 简化工具选择 - 只使用两个核心工具，参数会动态修改
    let selectedTools = ['advance_scene']; // 基础工具
    
    console.log(`🔄 Turn ${turnCount || 'unknown'}: Using dynamic parameter tools`);
    
    if (SceneAnalyzer.shouldUseDynamicTools(sceneAnalysis)) {
      const suggestedTools = sceneAnalysis.suggestedTools || [];
      
      // 使用建议的工具，但只保留核心工具
      selectedTools = [];
      if (suggestedTools.includes('show_dialogue')) {
        selectedTools.push('show_dialogue');
      }
      if (suggestedTools.includes('advance_scene')) {
        selectedTools.push('advance_scene');
      }
      
      // 添加其他建议的工具（排除已处理的和不再需要的）
      const otherTools = suggestedTools.filter((tool: string) =>
        !['show_dialogue', 'advance_scene', 'generate_actions', 'create_minor_summary', 'create_major_summary'].includes(tool)
      );
      selectedTools.push(...otherTools);
    } else {
      console.log('🎯 Using conservative tool set');
    }
    
    // 确保至少有一个核心工具
    if (selectedTools.length === 0) {
      selectedTools = ['advance_scene'];
    }
    
    // 确保包含两个核心工具
    if (!selectedTools.includes('advance_scene')) {
      selectedTools.push('advance_scene');
    }
    if (!selectedTools.includes('show_dialogue')) {
      selectedTools.push('show_dialogue');
    }
    
    console.log('🔧 Final selected tools:', selectedTools);
    return selectedTools;
  }

  private static getSceneTypesFromTools(toolNames: string[]): SceneType[] {
    // 根据工具名称推断场景类型
    const sceneTypes: SceneType[] = [];
    
    if (toolNames.includes('advance_scene') || toolNames.includes('generate_actions')) {
      sceneTypes.push('exploration');
    }
    
    if (toolNames.includes('show_dialogue')) {
      sceneTypes.push('dialogue');
    }
    
    if (toolNames.includes('create_minor_summary') || toolNames.includes('create_major_summary')) {
      sceneTypes.push('summary');
    }
    
    if (toolNames.includes('show_system_message') || toolNames.includes('evaluate_milestone')) {
      sceneTypes.push('special_event');
    }
    
    // 默认至少包含探索类型
    if (sceneTypes.length === 0) {
      sceneTypes.push('exploration');
    }
    
    return sceneTypes;
  }

  private static async callAIWithTools(
    history: HistoryItem[],
    settings: GameSettings,
    memories: Memories,
    toolsToUse: string[],
    gameContext: GameToolContext,
    logCommunication: (type: string, data: any) => void,
    abortSignal: AbortSignal,
    turnCount?: number
  ): Promise<{ toolCalls?: any[]; content?: string; rawResponse: string }> {
    
    if (settings.provider !== 'custom' || !settings.customEndpoint) {
      throw new Error('Game Engine currently only supports custom providers');
    }
    
    // 构建提示词和历史
    const { openAIMessages } = this.buildPromptParts(history, memories, settings, gameContext.activeStory);
    
    // 获取动态修改后的工具定义（传递settings参数）
    console.log('🔧 Using tools:', toolsToUse);
    console.log(`🔄 Turn count: ${turnCount}, Major summary turn: ${turnCount && turnCount % 5 === 0}`);
    console.log(`🖼️ Image generation enabled: ${settings.enableImageGeneration}`);
    const sceneTypes = this.getSceneTypesFromTools(toolsToUse);
    const tools = GameToolRegistry.getToolsForOpenAIWithTurnCount(
      sceneTypes.length > 0 ? sceneTypes : undefined, 
      turnCount, 
      settings
    );
    
    // 构建请求
    const requestPayload: any = {
      model: settings.customModelId || 'gpt-4-turbo',
      messages: openAIMessages,
      tools: tools,
      tool_choice: "required", // 强制使用工具
      temperature: Number(settings.llm.temperature || 0.7),
      top_p: Number(settings.llm.topP || 1),
      max_tokens: Number(settings.llm.maxOutputTokens || 1000),
    };
    
    // 添加非Google API的参数
    const isGoogleAPI = settings.customEndpoint?.includes('googleapis.com');
    if (!isGoogleAPI) {
      requestPayload.frequency_penalty = Number(settings.llm.frequencyPenalty || 0);
      requestPayload.presence_penalty = Number(settings.llm.presencePenalty || 0);
      
      if (settings.llm.reasoningEffort) {
        requestPayload.reasoning_effort = settings.llm.reasoningEffort;
      }
    }
    
    logCommunication('📤 game_engine_request', requestPayload);
    
    const url = settings.customEndpoint.replace(/\/+$/, '') + '/chat/completions';
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${settings.customApiKey}` 
      },
      body: JSON.stringify(requestPayload),
      signal: abortSignal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`AI API error: ${response.status} ${response.statusText} - ${errorBody}`);
    }
    
    const result = await response.json();
    logCommunication('📥 game_engine_response', result);
    
    if (!result.choices || result.choices.length === 0) {
      throw new Error('AI returned empty response');
    }

    const choice = result.choices[0];
    
    // 使用通用的AI响应工具调用处理
    const { toolCalls, content } = this.processAIResponseToolCalls(choice, logCommunication);
    
    return {
      toolCalls: toolCalls,
      content: content,
      rawResponse: JSON.stringify(result)
    };
  }

  private static async processToolCalls(
    aiResult: { toolCalls?: any[]; content?: string; rawResponse: string },
    gameContext: GameToolContext,
    toolHandler?: ToolHandler
  ): Promise<Omit<GameEngineResult, 'engineData'>> {
    
    if (!aiResult.toolCalls || aiResult.toolCalls.length === 0) {
      console.log('⚠️ No tool calls received from AI');
      return {
        scene: this.createMinimalScene('AI没有使用工具，继续游戏...'),
        rawResponse: aiResult.rawResponse
      };
    }
    
    console.log('🔧 Processing tool calls:', aiResult.toolCalls);
    
    let sceneData: any = null;
    let actionData: any = null;
    let summaryData: any = null;
    let systemMessage: any = null;
    let playerLocationData: any = null;
    let mapData: any = null; // 新增：存储地图数据
    let isDialogueOnly = false; // 新增：标记是否只是对话
    let hasMapToolsOnly = false; // 新增：标记是否只有地图工具
    const processedToolCalls: any[] = [];
    
    // 按顺序执行工具调用
    for (const toolCall of aiResult.toolCalls) {
      try {
        console.log(`🔧 Executing tool: ${toolCall.function?.name}`);
        
        const result = await GameToolRegistry.executeTool(toolCall, gameContext);
        processedToolCalls.push(toolCall);
        
        if (result.success) {
          // 收集不同类型的结果
          if (result.sceneData) sceneData = result.sceneData;
          if (result.actionData) {
            actionData = result.actionData;
          }
          if (result.summaryData) summaryData = result.summaryData;
          if (result.systemMessage) systemMessage = result.systemMessage;
          if (result.playerLocation) playerLocationData = result.playerLocation;
          if (result.maps) mapData = result; // 收集地图数据（get_available_maps返回的是result.maps）
          
          // 处理对话工具的特殊情况
          if (toolCall.function?.name === 'show_dialogue' && result.dialogueData && toolHandler?.show_dialogue) {
            isDialogueOnly = true; // 标记为对话模式
            await toolHandler.show_dialogue(result.dialogueData);
          }
        } else {
          console.warn(`⚠️ Tool ${toolCall.function?.name} failed:`, result.error);
          // 使用fallback数据
          if (result.fallback) {
            if (toolCall.function?.name === 'advance_scene') {
              sceneData = result.fallback;
            }
          }
        }
        
      } catch (toolError) {
        console.error(`❌ Tool execution failed for ${toolCall.function?.name}:`, toolError);
        const errorMessage = toolError instanceof Error ? toolError.message : String(toolError);
        gameContext.logCommunication('tool_execution_failed', {
          tool: toolCall.function?.name,
          error: errorMessage
        });
      }
    }
    
    // 检查是否只有地图工具（没有scene生成工具）
    const mapToolNames = ['get_available_maps', 'get_location_details', 'set_player_location'];
    const hasOnlyMapTools = processedToolCalls.length > 0 && 
      processedToolCalls.every(tc => mapToolNames.includes(tc.function?.name));
    
    // 如果只有地图工具且没有场景数据，创建一个临时的信息场景
    if (hasOnlyMapTools && !sceneData) {
      console.log('🗺️ Map tools only, creating informational scene');
      gameContext.logCommunication('map_tools_only', {
        tools: processedToolCalls.map(tc => tc.function?.name),
        hasMapData: !!mapData,
        hasPlayerLocation: !!playerLocationData
      });
      
      // 创建一个包含真实地图数据的场景，让AI知道可用的地图信息
      let mapInfoText = '';
      if (mapData && mapData.maps && mapData.maps.length > 0) {
        mapInfoText = `你发现了${mapData.totalMaps}张重要地图：`;
        mapData.maps.forEach((map: any, index: number) => {
          mapInfoText += `\n${index + 1}. ${map.name}`;
          if (map.locations && map.locations.length > 0) {
            mapInfoText += `（包含${map.locations.length}个地点）`;
          }
        });
        mapInfoText += '\n\n这些地图可能对你的冒险有帮助。';
      } else {
        mapInfoText = '你尝试查看地图信息，但没有发现任何可用的地图。';
      }
      
      const infoScene = {
        description: mapInfoText,
        imagePrompt: '古老的地图和导航工具',
        actions: ['研究地图详情', '继续探索', '寻找其他线索'],
        summary: '获取了地图信息'
      };
      
      return {
        scene: infoScene,
        rawResponse: aiResult.rawResponse,
        toolCalls: processedToolCalls,
        actionData: { actions: infoScene.actions, context: '基于地图信息选择行动' },
        playerLocationData: playerLocationData,
        mapData: mapData
      };
    }
    
    // 简化检查：现在 advance_scene 和 show_dialogue 自动包含行动选项
    // 只有在完全没有行动数据的情况下才强制执行
    if (!actionData) {
      console.log('🚨 No action data available, enforcing basic action generation');
      gameContext.logCommunication('actions_enforced', {
        reason: 'No action data from integrated tools',
        hadSceneData: !!sceneData
      });
      
      // 提供基本的行动选项作为后备
      actionData = {
        actions: ['继续探索', '仔细观察', '寻找线索', '回顾情况'],
        context: '选择你的下一步行动'
      };
    }
    
    // 对于纯对话场景，不需要生成场景描述，但要传递actionData
    if (isDialogueOnly && !sceneData) {
      // 对话场景不需要额外的场景描述，返回空场景但包含actionData
      return {
        scene: undefined, // 表示这是纯对话，不需要场景显示
        rawResponse: aiResult.rawResponse,
        toolCalls: processedToolCalls,
        actionData: actionData, // 重要：传递actionData给GamePage
        playerLocationData: playerLocationData
      };
    }
    
    // 构建最终场景 - 确保每次都使用新生成的actions，不会保留旧的
    const finalScene = this.buildFinalScene(sceneData, actionData, summaryData);
    
    return {
      scene: finalScene,
      rawResponse: aiResult.rawResponse,
      toolCalls: processedToolCalls,
      actionData: actionData, // 也为常规场景传递actionData
      playerLocationData: playerLocationData
    };
  }

  private static buildFinalScene(sceneData: any, actionData: any, summaryData: any): SceneFragment {
    return {
      description: sceneData?.description || '游戏继续进行中...',
      imagePrompt: sceneData?.imagePrompt || '',
      actions: actionData?.actions || ['继续'],
      summary: summaryData?.summary || (sceneData?.description?.slice(0, 50) + '...' || '')
    };
  }

  private static createMinimalScene(description: string): SceneFragment {
    return {
      description,
      imagePrompt: '',
      actions: ['继续'],
      summary: description.slice(0, 50) + '...'
    };
  }

  private static createFallbackScene(errorMessage: string, executionTime: number): GameEngineResult {
    console.log(`⚠️ Creating fallback scene due to error: ${errorMessage}`);
    
    return {
      scene: {
        description: '游戏遇到了一些技术问题，但冒险仍在继续。你发现自己在一个安静的地方，可以重新开始探索。',
        imagePrompt: '平静的环境',
        actions: ['重新开始探索', '查看周围', '休息片刻'],
        summary: '技术问题已解决，游戏继续'
      },
      rawResponse: JSON.stringify({ error: errorMessage, fallback: true }),
      engineData: {
        sceneAnalysis: { error: 'Failed to analyze' },
        toolsUsed: [],
        executionTime
      }
    };
  }

  // 从原有aiService复制的辅助方法
  // 从原有aiService复制的辅助方法
  private static buildPromptParts(history: HistoryItem[], memories: Memories, settings: GameSettings, activeStory?: Story) {
    // 将标准 HistoryItem 格式转换为内部格式
    const convertedHistory = [];
    
    for (const item of history) {
      if (item.role === 'user' && item.parts?.[0]?.text) {
        // 用户消息 - 直接使用 parts 中的文本
        convertedHistory.push({
          role: 'user',
          parts: [{ text: item.parts[0].text }]
        });
      } else if (item.role === 'model' && item.parts?.[0]?.text) {
        // AI 回复 - 直接使用 parts 中的文本
        convertedHistory.push({
          role: 'model',
          parts: [{ text: item.parts[0].text }]
        });
      }
    }
    
    // 使用现有的 buildContextualHistory 和 buildPromptParts 逻辑
    const contextualHistory = this.buildContextualHistory(convertedHistory, memories, settings);
    
    // 检查是否有地图数据需要包含在提示词中
    const lastModelResponse = history.filter(item => item.role === 'model').pop();
    if (lastModelResponse?.mapData) {
      // 如果最后一条AI响应包含地图数据，添加到上下文
      contextualHistory.push({
        role: 'user',
        parts: [{ text: `[地图数据: ${JSON.stringify(lastModelResponse.mapData)}]` }]
      });
    }
    
    return this.buildPromptPartsFromContextual(contextualHistory, settings, activeStory);
  }
  
  // 复制 buildContextualHistory 的核心逻辑
  private static buildContextualHistory(fullHistory: any[], memories: Memories, settings: GameSettings) {
    // 简化版本，取最近的几个交互
    const recentHistory = fullHistory.slice(-6); // 最近3个完整交互
    
    // 构建记忆块（简化版）
    const memoryItems = [];
    
    if (memories.milestoneSummaries && memories.milestoneSummaries.length > 0) {
      let memoryBlock = "Key Story Milestones:\n";
      memories.milestoneSummaries.slice(-3).forEach(m => {
        memoryBlock += `- Turn ${m.turn}: ${m.summary}\n`;
      });
      
      memoryItems.push({
        role: 'user',
        parts: [{ text: `[Context: ${memoryBlock}]` }]
      });
    }
    
    return [...memoryItems, ...recentHistory];
  }
  
  // 构建最终的提示词格式
  // 构建最终的提示词格式
  private static buildPromptPartsFromContextual(contextualHistory: any[], settings: GameSettings, activeStory?: Story) {
    // 从prompts系统获取指令
    const language = settings.language === 'zh' ? 'zh' : 'en';
    let systemContent = PROMPTS[language].baseSystemInstruction;
    
    // 在不告知玩家的情况下添加故事背景给AI
    if (activeStory?.backgroundSetting) {
      systemContent += `\n\n[STORY BACKGROUND - DO NOT REVEAL TO PLAYER]: ${activeStory.backgroundSetting}`;
    }

    const openAIMessages = [
      { role: 'system', content: systemContent }
    ];
    
    // 转换历史记录为 OpenAI 格式，并清理AI响应内容
    contextualHistory.forEach((item, index) => {
      if (item.role && item.parts && item.parts[0] && item.parts[0].text.trim()) {
        const isRecentMessage = index >= contextualHistory.length - 5; // 最近5条消息
        
        if (item.role === 'model') {
          // 处理AI回复消息，需要清理内容
          let cleanedContent = this.cleanAIResponseContent(item.parts[0].text, isRecentMessage);
          
          openAIMessages.push({
            role: 'assistant',
            content: cleanedContent
          });
        } else {
          // 用户消息直接使用
          openAIMessages.push({
            role: 'user',
            content: item.parts[0].text.trim()
          });
        }
      }
    });
    
    return { openAIMessages };
  }

  // 清理AI响应内容的辅助方法
  private static cleanAIResponseContent(rawContent: string, isRecentMessage: boolean): string {
    try {
      // 尝试解析JSON内容
      const parsed = JSON.parse(rawContent);
      
      if (isRecentMessage) {
        // 最近5条消息：使用description内容
        if (parsed.description) {
          return parsed.description;
        }
      } else {
        // 较老的消息：使用summary内容，并标注为summary
        if (parsed.summary) {
          return `[Summary] ${parsed.summary}`;
        } else if (parsed.description) {
          // 如果没有summary，从description生成简短摘要
          const shortSummary = parsed.description.length > 100 
            ? parsed.description.substring(0, 100) + '...'
            : parsed.description;
          return `[Summary] ${shortSummary}`;
        }
      }
      
      // 如果解析失败，返回原始内容的简化版本
      return rawContent.length > 200 ? rawContent.substring(0, 200) + '...' : rawContent;
      
    } catch (error) {
      // JSON解析失败，直接处理原始文本
      console.log('Failed to parse AI response as JSON, using raw content:', error);
      
      if (isRecentMessage) {
        // 最近消息：返回原内容（可能是纯文本回复）
        return rawContent;
      } else {
        // 较老消息：截断并标注为summary
        const shortContent = rawContent.length > 100 
          ? rawContent.substring(0, 100) + '...'
          : rawContent;
        return `[Summary] ${shortContent}`;
      }
    }
  }
}