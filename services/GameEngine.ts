import { jsonrepair } from 'jsonrepair';
import type { HistoryItem, GameSettings, Memories, Story, SceneFragment } from '../types';
import { GameToolRegistry, type GameToolContext, type SceneType } from './GameToolRegistry';
import { SceneAnalyzer } from './SceneAnalyzer';
import { PROMPTS } from '../prompts/index';

// 重新导出用于测试
export { GameToolRegistry } from './GameToolRegistry';
export { SceneAnalyzer } from './SceneAnalyzer';

export interface GameEngineResult {
  scene?: SceneFragment;
  rawResponse: string;
  toolCalls?: any[];
  actionData?: any; // 添加actionData字段用于传递行动选项
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
  
  static initialize() {
    if (this.initialized) return;
    
    console.log('🎮 Initializing Game Engine...');
    GameToolRegistry.initialize();
    this.initialized = true;
    console.log('✅ Game Engine initialized');
  }

  /**
   * 核心游戏引擎 - 使用工具化系统生成游戏场景
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
      
      // 调用AI进行游戏推进（传递turnCount）
      const aiResult = await this.callAIWithTools(
        history,
        settings,
        memories,
        toolsToUse,
        gameContext,
        logCommunication,
        abortSignal,
        turnCount
      );
      
      // 处理工具调用结果
      const processedResult = await this.processToolCalls(
        aiResult,
        gameContext,
        toolHandler
      );
      
      const executionTime = Date.now() - startTime;
      
      return {
        ...processedResult,
        engineData: {
          sceneAnalysis,
          toolsUsed: aiResult.toolCalls?.map(tc => tc.function?.name).filter(Boolean) || [],
          executionTime,
          turnCount
        }
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('❌ Game engine error:', error);
      logCommunication('game_engine_error', { error: error.message, executionTime });
      
      // 返回应急场景
      return this.createFallbackScene(error.message, executionTime);
    }
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
      const otherTools = suggestedTools.filter(tool => 
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
    const { openAIMessages } = this.buildPromptParts(history, memories, settings);
    
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
    const requestPayload = {
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
      requestPayload['frequency_penalty'] = Number(settings.llm.frequencyPenalty || 0);
      requestPayload['presence_penalty'] = Number(settings.llm.presencePenalty || 0);
      
      if (settings.llm.reasoningEffort) {
        requestPayload['reasoning_effort'] = settings.llm.reasoningEffort;
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
    
    return {
      toolCalls: choice.message.tool_calls,
      content: choice.message.content,
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
    let isDialogueOnly = false; // 新增：标记是否只是对话
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
        gameContext.logCommunication('tool_execution_failed', {
          tool: toolCall.function?.name,
          error: toolError.message
        });
      }
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
        scene: null, // 表示这是纯对话，不需要场景显示
        rawResponse: aiResult.rawResponse,
        toolCalls: processedToolCalls,
        actionData: actionData // 重要：传递actionData给GamePage
      };
    }
    
    // 构建最终场景 - 确保每次都使用新生成的actions，不会保留旧的
    const finalScene = this.buildFinalScene(sceneData, actionData, summaryData);
    
    return {
      scene: finalScene,
      rawResponse: aiResult.rawResponse,
      toolCalls: processedToolCalls,
      actionData: actionData // 也为常规场景传递actionData
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
  private static buildPromptParts(history: HistoryItem[], memories: Memories, settings: GameSettings) {
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
    return this.buildPromptPartsFromContextual(contextualHistory, settings);
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
  private static buildPromptPartsFromContextual(contextualHistory: any[], settings: GameSettings) {
    // 从prompts系统获取指令
    const language = settings.language === 'zh' ? 'zh' : 'en';
    const baseInstruction = PROMPTS[language].baseSystemInstruction;

    const openAIMessages = [
      { role: 'system', content: baseInstruction }
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