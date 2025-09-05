/**
 * 游戏引擎测试脚本
 * 用于验证新的工具化系统是否正常工作
 */

import { GameToolRegistry, GameEngine } from '../services/GameEngine';
import { SceneAnalyzer } from '../services/SceneAnalyzer';
import type { HistoryItem, GameSettings, Memories, Story } from '../types';

// 模拟数据
const mockSettings: GameSettings = {
  provider: 'custom',
  customEndpoint: 'https://api.openai.com/v1',
  customApiKey: 'test-key',
  customModelId: 'gpt-4',
  language: 'zh',
  enableDialogueTools: true,
  llm: {
    temperature: 0.7,
    topP: 1,
    maxOutputTokens: 1000,
    frequencyPenalty: 0,
    presencePenalty: 0
  }
};

const mockHistory: HistoryItem[] = [
  {
    playerInput: '我想探索这个神秘的森林',
    response: {
      description: '你走进了一片古老的森林，阳光透过茂密的树叶洒下斑驳的光影。',
      imagePrompt: '古老森林',
      actions: ['继续前进', '仔细观察周围', '寻找路径'],
      summary: '玩家进入了神秘森林'
    },
    turn: 1
  }
];

const mockMemories: Memories = {
  characters: new Map([
    ['森林精灵', '友好的森林守护者，知道很多秘密']
  ]),
  locations: new Map([
    ['神秘森林', '充满魔法的古老森林']
  ]),
  items: new Map(),
  knowledge: new Map([
    ['森林传说', '据说森林深处有古老的宝藏']
  ])
};

const mockStory: Story = {
  id: 'test-story',
  creatorId: 'test-user',
  creatorName: 'Test User',
  title: '森林冒险',
  description: '在神秘森林中的冒险故事',
  coverImageUrl: '',
  visibility: 'private',
  category: '冒险',
  library: '测试',
  backgroundSetting: '一个充满魔法的幻想世界',
  openingMonologue: '欢迎来到神秘的森林...',
  openingAction: '你站在森林的入口',
  openingSpeaker: '叙述者'
};

// 测试函数
export function testGameToolRegistry() {
  console.log('🧪 Testing Game Tool Registry...');
  
  try {
    GameToolRegistry.initialize();
    
    // 测试工具获取
    const allTools = GameToolRegistry.getTools();
    console.log(`✅ Loaded ${allTools.length} tools:`, allTools.map(t => t.name));
    
    // 测试场景工具获取
    const explorationTools = GameToolRegistry.getTools(['exploration']);
    console.log(`✅ Exploration tools:`, explorationTools.map(t => t.name));
    
    // 测试OpenAI格式
    const openAITools = GameToolRegistry.getToolsForOpenAI(['exploration']);
    console.log(`✅ OpenAI format tools:`, openAITools.length);
    
    console.log('✅ Game Tool Registry test passed!');
    return true;
  } catch (error) {
    console.error('❌ Game Tool Registry test failed:', error);
    return false;
  }
}

export function testSceneAnalyzer() {
  console.log('🧪 Testing Scene Analyzer...');
  
  try {
    const analysis = SceneAnalyzer.analyze(mockHistory, mockMemories, mockStory);
    console.log('✅ Scene analysis result:', analysis);
    
    // 验证分析结果
    if (!analysis.sceneType || !analysis.suggestedTools || analysis.suggestedTools.length === 0) {
      throw new Error('Invalid scene analysis result');
    }
    
    console.log('✅ Scene Analyzer test passed!');
    return true;
  } catch (error) {
    console.error('❌ Scene Analyzer test failed:', error);
    return false;
  }
}

export function testToolExecution() {
  console.log('🧪 Testing Tool Execution...');
  
  try {
    GameToolRegistry.initialize();
    
    const mockContext = {
      settings: mockSettings,
      history: mockHistory,
      memories: mockMemories,
      activeStory: mockStory,
      logCommunication: (type: string, data: any) => console.log(`Log: ${type}`, data)
    };
    
    // 测试advance_scene工具
    const mockToolCall = {
      function: {
        name: 'advance_scene',
        arguments: JSON.stringify({
          description: '你在森林中发现了一个神秘的石碑',
          imagePrompt: '古老的石碑'
        })
      }
    };
    
    GameToolRegistry.executeTool(mockToolCall, mockContext).then(result => {
      console.log('✅ Tool execution result:', result);
      if (result.success && result.sceneData) {
        console.log('✅ Tool Execution test passed!');
      } else {
        console.error('❌ Tool execution returned invalid result');
      }
    }).catch(error => {
      console.error('❌ Tool Execution test failed:', error);
    });
    
    return true;
  } catch (error) {
    console.error('❌ Tool Execution test failed:', error);
    return false;
  }
}

// 运行所有测试
export function runAllTests() {
  console.log('🚀 Starting Game Engine Tests...');
  console.log('='.repeat(50));
  
  const results = [
    testGameToolRegistry(),
    testSceneAnalyzer(),
    testToolExecution()
  ];
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log('='.repeat(50));
  console.log(`📊 Test Results: ${passed}/${total} passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Game Engine is ready!');
  } else {
    console.log('⚠️ Some tests failed. Please check the errors above.');
  }
  
  return passed === total;
}

// 在浏览器控制台中可用
if (typeof window !== 'undefined') {
  (window as any).gameEngineTests = {
    testGameToolRegistry,
    testSceneAnalyzer, 
    testToolExecution,
    runAllTests
  };
  console.log('🧪 Game Engine tests available in console: window.gameEngineTests');
}