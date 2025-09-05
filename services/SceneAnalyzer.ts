import type { HistoryItem, Memories, Story } from '../types';
import type { SceneType } from './GameToolRegistry';

export interface SceneAnalysis {
  sceneType: SceneType;
  confidence: number;
  reasoning: string;
  suggestedTools: string[];
  context: {
    lastActions: string[];
    recentSpeakers: string[];
    needsSummary: boolean;
    turnsSinceLastSummary: number;
  };
}

export class SceneAnalyzer {
  /**
   * 分析当前场景上下文，确定场景类型和所需工具
   */
  static analyze(history: HistoryItem[], memories: Memories, story: Story): SceneAnalysis {
    try {
      console.log('🔍 Analyzing scene context...');
      
      // 获取最近的历史记录用于分析
      const recentHistory = history.slice(-5); // 最近5个回合
      const lastItem = history[history.length - 1];
      
      // 初始化分析结果
      let sceneType: SceneType = 'exploration';
      let confidence = 0.5;
      let reasoning = '';
      const suggestedTools: string[] = [];
      
      // 分析上下文信息
      const context = this.analyzeContext(history);
      
      // 场景类型判断逻辑
      const analysis = this.determineSceneType(recentHistory, lastItem, context);
      sceneType = analysis.type;
      confidence = analysis.confidence;
      reasoning = analysis.reasoning;
      
      // 基于场景类型推荐工具
      const toolRecommendations = this.recommendTools(sceneType, context);
      suggestedTools.push(...toolRecommendations);
      
      // 特殊情况处理
      if (context.needsSummary) {
        if (context.turnsSinceLastSummary > 10) {
          suggestedTools.unshift('create_major_summary');
          reasoning += ' 需要创建大总结。';
        } else if (context.turnsSinceLastSummary > 5) {
          suggestedTools.unshift('create_minor_summary');
          reasoning += ' 需要创建小总结。';
        }
      }
      
      const result: SceneAnalysis = {
        sceneType,
        confidence,
        reasoning,
        suggestedTools,
        context
      };
      
      console.log('📊 Scene analysis result:', result);
      return result;
      
    } catch (error) {
      console.error('❌ Error in scene analysis:', error);
      
      // 返回安全的默认分析结果
      return {
        sceneType: 'exploration',
        confidence: 0.3,
        reasoning: '场景分析出现错误，使用默认探索模式',
        suggestedTools: ['advance_scene', 'generate_actions'],
        context: {
          lastActions: [],
          recentSpeakers: [],
          needsSummary: false,
          turnsSinceLastSummary: 0
        }
      };
    }
  }

  private static analyzeContext(history: HistoryItem[]): SceneAnalysis['context'] {
    const lastActions: string[] = [];
    const recentSpeakers: string[] = [];
    let lastSummaryIndex = -1;
    
    // 分析最近的历史记录
    for (let i = Math.max(0, history.length - 10); i < history.length; i++) {
      const item = history[i];
      
      // 收集最近的行动
      if (item.playerInput && lastActions.length < 5) {
        lastActions.push(item.playerInput);
      }
      
      // 收集最近的对话角色
      if (item.response?.dialogues) {
        item.response.dialogues.forEach(dialogue => {
          if (dialogue.speaker && !recentSpeakers.includes(dialogue.speaker) && recentSpeakers.length < 3) {
            recentSpeakers.push(dialogue.speaker);
          }
        });
      }
      
      // 查找最后一次总结
      if (item.response?.summary && item.response.summary.trim().length > 0) {
        lastSummaryIndex = i;
      }
    }
    
    const turnsSinceLastSummary = lastSummaryIndex >= 0 ? history.length - lastSummaryIndex - 1 : history.length;
    const needsSummary = turnsSinceLastSummary > 5;
    
    return {
      lastActions,
      recentSpeakers,
      needsSummary,
      turnsSinceLastSummary
    };
  }

  private static determineSceneType(
    recentHistory: HistoryItem[], 
    lastItem: HistoryItem | undefined,
    context: SceneAnalysis['context']
  ): { type: SceneType; confidence: number; reasoning: string } {
    
    // 如果需要总结，优先总结场景
    if (context.needsSummary && context.turnsSinceLastSummary > 8) {
      return {
        type: 'summary',
        confidence: 0.9,
        reasoning: `已经${context.turnsSinceLastSummary}个回合没有总结，需要进行总结`
      };
    }
    
    // 检查是否是对话场景
    if (context.recentSpeakers.length > 0) {
      const hasRecentDialogue = recentHistory.some(item => 
        item.response?.dialogues && item.response.dialogues.length > 0
      );
      
      if (hasRecentDialogue) {
        // 检查对话是否还在继续
        const lastPlayerAction = context.lastActions[0];
        const isDialogueAction = lastPlayerAction && (
          lastPlayerAction.includes('说') ||
          lastPlayerAction.includes('回答') ||
          lastPlayerAction.includes('询问') ||
          lastPlayerAction.includes('对话') ||
          lastPlayerAction.includes('交谈')
        );
        
        if (isDialogueAction) {
          return {
            type: 'dialogue',
            confidence: 0.8,
            reasoning: '玩家正在进行对话交互'
          };
        }
      }
    }
    
    // 检查是否是行动场景
    if (lastItem?.playerInput) {
      const actionKeywords = ['攻击', '战斗', '使用', '拿起', '打开', '关闭', '推', '拉', '破坏', '修复'];
      const isActionScene = actionKeywords.some(keyword => 
        lastItem.playerInput.includes(keyword)
      );
      
      if (isActionScene) {
        return {
          type: 'action',
          confidence: 0.7,
          reasoning: '玩家执行了具体的行动操作'
        };
      }
    }
    
    // 检查特殊事件
    const hasSpecialEvent = recentHistory.some(item => {
      const description = item.response?.description || '';
      return description.includes('突然') || 
             description.includes('意外') || 
             description.includes('神秘') ||
             description.includes('警告') ||
             description.includes('发现了');
    });
    
    if (hasSpecialEvent) {
      return {
        type: 'special_event',
        confidence: 0.6,
        reasoning: '场景中出现了特殊事件或发现'
      };
    }
    
    // 默认为探索场景
    return {
      type: 'exploration',
      confidence: 0.5,
      reasoning: '常规的探索或环境描述场景'
    };
  }

  private static recommendTools(sceneType: SceneType, context: SceneAnalysis['context']): string[] {
    const baseTools = ['advance_scene']; // 场景推进是基础工具
    
    switch (sceneType) {
      case 'exploration':
        return [...baseTools, 'generate_actions'];
        
      case 'dialogue':
        return [...baseTools, 'show_dialogue', 'generate_actions'];
        
      case 'action':
        return [...baseTools, 'generate_actions'];
        
      case 'summary':
        if (context.turnsSinceLastSummary > 10) {
          return ['create_major_summary', 'update_memory'];
        } else {
          return ['create_minor_summary'];
        }
        
      case 'special_event':
        return [...baseTools, 'show_system_message', 'generate_actions', 'update_memory'];
        
      default:
        return [...baseTools, 'generate_actions'];
    }
  }

  /**
   * 检查是否需要特定工具
   */
  static needsTool(toolName: string, analysis: SceneAnalysis): boolean {
    return analysis.suggestedTools.includes(toolName);
  }

  /**
   * 获取场景类型的置信度阈值建议
   */
  static shouldUseDynamicTools(analysis: SceneAnalysis): boolean {
    // 只有在足够确信场景类型时才使用动态工具加载
    return analysis.confidence > 0.6;
  }

  /**
   * 获取工具优先级排序
   */
  static prioritizeTools(tools: string[], analysis: SceneAnalysis): string[] {
    const priority = {
      // 高优先级 - 场景核心功能
      'advance_scene': 1,
      'show_dialogue': 1,
      
      // 中优先级 - 交互功能  
      'generate_actions': 2,
      'show_system_message': 2,
      
      // 低优先级 - 辅助功能
      'create_minor_summary': 3,
      'create_major_summary': 3,
      'update_memory': 4
    };
    
    return tools.sort((a, b) => {
      const priorityA = priority[a] || 5;
      const priorityB = priority[b] || 5;
      return priorityA - priorityB;
    });
  }
}