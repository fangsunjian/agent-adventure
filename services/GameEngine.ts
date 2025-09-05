import { jsonrepair } from 'jsonrepair';
import type { HistoryItem, GameSettings, Memories, Story, SceneFragment } from '../types';
import { GameToolRegistry, type GameToolContext, type SceneType } from './GameToolRegistry';
import { SceneAnalyzer } from './SceneAnalyzer';

// 重新导出用于测试
export { GameToolRegistry } from './GameToolRegistry';
export { SceneAnalyzer } from './SceneAnalyzer';

export interface GameEngineResult {
  scene?: SceneFragment;
  rawResponse: string;
  toolCalls?: any[];
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
      
      // 分析场景上下文
      const sceneAnalysis = SceneAnalyzer.analyze(history, memories, activeStory);
      console.log('📊 Scene analysis:', sceneAnalysis);
      logCommunication('scene_analysis', sceneAnalysis);
      
      // 选择合适的工具集
      const toolsToUse = this.selectTools(sceneAnalysis);
      console.log('🔧 Selected tools:', toolsToUse);
      
      // 构建游戏上下文
      const gameContext: GameToolContext = {
        settings,
        history,
        memories,
        activeStory,
        logCommunication
      };
      
      // 调用AI进行游戏推进
      const aiResult = await this.callAIWithTools(
        history,
        settings,
        memories,
        toolsToUse,
        gameContext,
        logCommunication,
        abortSignal
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
          executionTime
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

  private static selectTools(sceneAnalysis: any): string[] {
    // 简化工具选择 - 现在 advance_scene 和 show_dialogue 自动包含 generate_actions
    let selectedTools = ['advance_scene']; // 基础工具，advance_scene 已包含 generate_actions
    
    if (SceneAnalyzer.shouldUseDynamicTools(sceneAnalysis)) {
      selectedTools = sceneAnalysis.suggestedTools || selectedTools;
      // 移除独立的 generate_actions，因为它现在集成在 advance_scene 中
      selectedTools = selectedTools.filter(tool => tool !== 'generate_actions');
    } else {
      console.log('🎯 Using conservative tool set with integrated generate_actions');
    }
    
    // 确保核心工具可用
    if (!selectedTools.includes('advance_scene')) {
      selectedTools.unshift('advance_scene');
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
    abortSignal: AbortSignal
  ): Promise<{ toolCalls?: any[]; content?: string; rawResponse: string }> {
    
    if (settings.provider !== 'custom' || !settings.customEndpoint) {
      throw new Error('Game Engine currently only supports custom providers');
    }
    
    // 构建提示词和历史
    const { openAIMessages } = this.buildPromptParts(history, memories, settings);
    
    // 获取工具定义 - 只获取选中的工具
    console.log('🔧 Using tools:', toolsToUse);
    const sceneTypes = this.getSceneTypesFromTools(toolsToUse);
    const tools = GameToolRegistry.getToolsForOpenAI(sceneTypes.length > 0 ? sceneTypes : undefined);
    
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
    
    // 构建最终场景 - 确保每次都使用新生成的actions，不会保留旧的
    const finalScene = this.buildFinalScene(sceneData, actionData, summaryData);
    
    return {
      scene: finalScene,
      rawResponse: aiResult.rawResponse,
      toolCalls: processedToolCalls
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
    const baseInstruction = `你是一位专业的游戏大师。你必须使用提供的工具来推进游戏场景。

🔧 工具使用规则（简化版 - 更稳定可靠）：
- 你必须调用工具来回应玩家，不能直接返回文本
- advance_scene工具已自动包含行动选项生成，无需单独调用generate_actions
- show_dialogue工具已自动包含行动选项生成，无需单独调用generate_actions
- 推荐：advance_scene（用于探索场景，自动包含行动选项）
- 推荐：show_dialogue（用于对话场景，自动包含行动选项）
- 现在只需要调用一个工具即可，系统会自动处理行动选项

🎯 工具调用要求：
1. 对于场景描述，只需调用：advance_scene
2. 对于对话描述，只需调用：show_dialogue
3. 系统会自动生成相应的玩家行动选项

🔧 工具说明：
- advance_scene工具：描述新的环境、情况和事件发展（已集成行动选项生成）
- show_dialogue工具：展示NPC的对话内容（已集成行动选项生成）
- 系统会自动根据场景类型生成合适的行动选项

📝 内容要求：
- 工具参数中使用简洁明确的文本
- 避免复杂的嵌套JSON结构
- 保持游戏氛围和连贯性
- 根据玩家行动推进剧情
- 行动选项要具体、有趣且符合场景

⚠️ 重要提醒：
- 只需调用一个工具（advance_scene 或 show_dialogue）
- 系统会自动生成玩家行动选项
- 每次回应都会给玩家提供新的行动选择

当前语言: ${settings.language === 'zh' ? '中文' : 'English'}

系统已自动集成行动选项生成，无需额外调用！`;

    const openAIMessages = [
      { role: 'system', content: baseInstruction }
    ];
    
    // 转换历史记录为 OpenAI 格式
    contextualHistory.forEach(item => {
      if (item.role && item.parts && item.parts[0] && item.parts[0].text.trim()) {
        openAIMessages.push({
          role: item.role === 'model' ? 'assistant' : 'user',
          content: item.parts[0].text.trim()
        });
      }
    });
    
    return { openAIMessages };
  }
}