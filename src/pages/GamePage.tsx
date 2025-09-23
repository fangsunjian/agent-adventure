import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStory } from '../hooks/useStories';
import ActionsPanel from '../../components/ActionsPanel';
import ConfirmationDialog from '../../components/ConfirmationDialog';
import DebugPanel from '../../components/DebugPanel';
import DialogueModal from '../../components/DialogueModal';
import LoadingOverlay from '../../components/LoadingOverlay';
import { ArrowLeftIcon, BookIcon, BugIcon, CloseIcon, MapIcon, RegenerateIcon as RestartIcon, SlidersIcon } from '../../components/icons';
import GameSettingsPanel from '../../components/LLMSettingsPanel';
import MapViewerModal from '../../components/MapViewerModal';
import HtmlComponentViewer from '../../components/HtmlComponentViewer';
import PlaceholderInputModal from '../../components/PlaceholderInputModal';
import Resizer from '../../components/Resizer';
import SceneDisplay from '../../components/SceneDisplay';
import SummaryPanel from '../../components/SummaryPanel';
import { simpleUUID, translations } from '../../constants';
import { evaluateAndGenerateMilestone, generateImage, getNextSceneWithGameEngine, getNextSceneWithTools, type ToolHandler } from '../../services/aiService';
import { GameEngine } from '../../services/GameEngine';
import { GameToolRegistry } from '../../services/GameToolRegistry';
import type { DebugLogEntry, DetectedPlaceholder, GameSettings, HistoryItem, Memories, Playthrough, Scene, SceneFragment, Story } from '../../types';
import { GameStatus } from '../../types';

const showDebug = (window as any).DEBUG_MODE === true;

// Simple placeholder replacement, e.g., [[id:Character Name]] -> Character Name
const parseContent = (text: string): string => {
    return text.replace(/\[\[.*?:]/g, '').replace(/\]\]/g, '');
};

export default function GamePage(): React.ReactNode {
  // Router hooks
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();

  // Data hooks
  const { data: activeStory, isLoading: storyLoading, error: storyError } = useStory(storyId || null);

  // Mock settings - TODO: Implement proper settings management
  const [settings, setSettings] = useState<GameSettings>({
    language: 'zh' as const,
    systemInstructions: [],
    enableImageGeneration: false,
    bubbleOpacity: 100,
    dialogueWindowOpacity: 100,
    provider: 'gemini' as const,
    enableDialogueTools: false,
    model: 'gemini-1.5-flash',
    maxTokens: 8192,
    temperature: 0.7,
    topP: 0.95,
    topK: 64,
  });

  // Mock userId for now - should come from auth context
  const userId = 'mock-user-id';

  // Exit handler
  const onExit = useCallback(() => {
    navigate('/');
  }, [navigate]);

  // Save playthrough handler - temporary mock implementation
  const onSavePlaythrough = useCallback((playthrough: Playthrough) => {
    // TODO: Implement actual playthrough saving logic
    console.log('Saving playthrough:', playthrough);
  }, []);

  // Game state initialization - ALL HOOKS MUST BE BEFORE CONDITIONAL RETURNS
  const [gameState, setGameState] = useState<Omit<Playthrough, 'storyId'>>(() => {
    // TODO: Load playthrough from persistent storage if needed
    return {
      userId: userId,
      history: [],
      summaries: [],
      grandSummaries: [],
      milestoneSummaries: [],
      turn: 0,
      userName: 'Player',
      charName: 'Game Master',
      gameStatus: GameStatus.Idle,
      dialogue: null,
      placeholderValues: {},
      hasUnviewedLocationChange: false,
    };
  });
  
  const [communicationsLog, setCommunicationsLog] = useState<DebugLogEntry[]>([]);
  
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isDebugPanelOpen, setIsDebugPanelOpen] = useState(false);
  const [isGameSettingsOpen, setIsGameSettingsOpen] = useState(false);
  const [isNewGameConfirmOpen, setIsNewGameConfirmOpen] = useState(false);
  const [isPlaceholderModalOpen, setIsPlaceholderModalOpen] = useState(false);
  const [isMapViewerOpen, setIsMapViewerOpen] = useState(false);
  const [currentMapIndex, setCurrentMapIndex] = useState(0);
  const [isHtmlComponentViewerOpen, setIsHtmlComponentViewerOpen] = useState(false);
  const [selectedHtmlComponent, setSelectedHtmlComponent] = useState<LibraryCard | null>(null);
  const [detectedPlaceholders, setDetectedPlaceholders] = useState<DetectedPlaceholder[]>([]);
  const [lastPlaceholderValues, setLastPlaceholderValues] = useState<Record<string, string>>(() => {
    // TODO: Initialize with values from stored playthrough if available
    return {};
  });
  const [processedStory, setProcessedStory] = useState<Story | null>(null);
  
  // 跟踪上一次的玩家位置
  const prevPlayerLocationRef = useRef<{ mapId: string; locationId: string } | null>(null);
  // 跟踪组件是否刚刚挂载（用于区分数据库恢复和真实位置变化）
  const isInitialLoadRef = useRef(true);

  const abortControllerRef = useRef<AbortController | null>(null);

  // --- Resizable Panel Logic ---
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [scenePanelSize, setScenePanelSize] = useState(60); // %
  const [isBgLoaded, setIsBgLoaded] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsBgLoaded(false);
    if (!activeStory?.coverImageUrl) return;

    const img = new Image();
    img.src = activeStory.coverImageUrl;
    img.onload = () => setIsBgLoaded(true);
  }, [activeStory?.coverImageUrl]);

  const handleResize = useCallback(() => {
    setIsMobile(window.innerWidth < 1024);
  }, []);

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial check
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const startPos = isMobile ? e.clientY : e.clientX;
    const startSize = scenePanelSize;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      if (!containerRef.current) return;
      const delta = (isMobile ? moveEvent.clientY : moveEvent.clientX) - startPos;
      const containerSize = isMobile ? containerRef.current.offsetHeight : containerRef.current.offsetWidth;
      if (containerSize === 0) return;
      const deltaPercent = (delta / containerSize) * 100;
      const newSize = startSize + deltaPercent;
      setScenePanelSize(Math.max(20, Math.min(newSize, 80)));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
  }, [isMobile, scenePanelSize]);
  // --- End Resizable Panel Logic ---

  const t = translations[settings.language];
  const currentModelResponse = gameState.history.length > 0 && gameState.history[gameState.history.length - 1].role === 'model' && !gameState.history[gameState.history.length-1].isError
    ? JSON.parse(gameState.history[gameState.history.length - 1].parts[0].text) as Scene
    : null;

  // Detect maps in the story
  const storyMaps = processedStory?.library.filter(card => card.type === 'map' && card.mapImageUrl) || [];
  const hasMapButton = storyMaps.length > 0;
  
  // Detect HTML components in the story
  const storyHtmlComponents = processedStory?.library.filter(card => card.type === 'html' && card.htmlData) || [];
  const hasHtmlComponents = storyHtmlComponents.length > 0;

  const logCommunication = useCallback((type: string, data: any) => {
    setCommunicationsLog(prev => [...prev, { type, data, timestamp: new Date().toISOString() }]);
  }, []);

  // 暴露调试和测试用的全局变量
  useEffect(() => {
    (window as any).GameToolRegistry = GameToolRegistry;
    
    // 从gameState构建memories对象
    const memoriesFromState = {
      summaries: gameState.summaries || [],
      grandSummaries: gameState.grandSummaries || [],
      milestoneSummaries: gameState.milestoneSummaries || [],
    };
    
    (window as any).gameData = {
      activeStory: gameState.activeStory,
      settings: settings,
      memories: memoriesFromState,
      gameState: gameState
    };
    
    // 暴露测试工具函数到外部页面
    (window as any).testAIToolCall = async function(toolName: string, args: any = {}) {
      console.log(`🤖 测试AI工具调用: ${toolName}`);
      
      // 创建模拟的工具调用
      const mockToolCall = {
        function: {
          name: toolName,
          arguments: JSON.stringify(args)
        }
      };
      
      // 创建模拟的游戏上下文
      const mockContext = {
        settings: settings,
        history: [],
        memories: memoriesFromState,
        activeStory: gameState.activeStory,
        logCommunication: (type: string, data: any) => console.log(`📋 ${type}:`, data)
      };
      
      try {
        const result = await GameToolRegistry.executeTool(mockToolCall, mockContext);
        console.log(`✅ 工具执行结果:`, result);
        return result;
      } catch (error) {
        console.error(`❌ 工具执行失败:`, error);
        return { success: false, error: error.message };
      }
    };

    // 暴露组件工具查询函数
    (window as any).listComponentTools = function(componentId?: string) {
      console.log('🔍 调试信息:');
      console.log('  - gameState.activeStory:', !!gameState.activeStory);
      console.log('  - library存在:', !!gameState.activeStory?.library);
      console.log('  - library长度:', gameState.activeStory?.library?.length || 0);
      
      const allLibraryCards = gameState.activeStory?.library || [];
      console.log('  - 所有卡片类型:', allLibraryCards.map(card => ({ id: card.id, type: card.type, name: card.name })));
      
      if (!componentId) {
        // 如果没有指定组件ID，查找所有HTML组件
        const htmlComponents = allLibraryCards.filter(card => card.type === 'html');
        console.log('  - HTML组件数量:', htmlComponents.length);
        console.log('  - HTML组件详情:', htmlComponents.map(c => ({ id: c.id, name: c.name, hasHtmlData: !!c.htmlData })));
        
        if (htmlComponents.length === 0) {
          console.log('❌ 未找到HTML组件');
          return [];
        }
        componentId = htmlComponents[0].id; // 使用第一个HTML组件
        console.log(`📋 使用组件ID: ${componentId}`);
      }
      
      const tools = GameToolRegistry.getHtmlComponentTools(componentId);
      console.log(`📋 组件 ${componentId} 的工具列表:`, tools.map(t => ({
        name: t.name,
        description: t.description,
        priority: t.priority
      })));
      return tools;
    };

    // 便捷的工具查看函数
    (window as any).listAllTools = function() {
      const stats = GameToolRegistry.getToolStatistics();
      console.log('📊 所有工具统计:', stats);
      console.log('🛠️ HTML组件工具:', stats.tools.filter(t => t.source === 'html_component'));
      
      // 额外调试信息
      console.log('🔍 工具源分析:', stats.toolsBySource);
      console.log('🔍 所有工具名称:', stats.tools.map(t => t.name));
      
      return stats;
    };

    // 添加调试函数检查工具注册状态
    (window as any).debugToolRegistry = function() {
      console.log('🔍 GameToolRegistry调试:');
      console.log('  - 总工具数:', GameToolRegistry.getToolStatistics().totalTools);
      console.log('  - 工具健康状态:', GameToolRegistry.getToolHealth());
      
      // 尝试查看所有已注册的工具
      const allTools = GameToolRegistry.getTools();
      console.log('  - 所有已注册工具:', allTools.map(t => ({ 
        name: t.name, 
        description: t.description.substring(0, 50) + '...'
      })));
      
      return allTools;
    };

    console.log('🛠️ 外部测试工具已准备好：');
    console.log('  - testAIToolCall(toolName, args) - 测试AI工具调用');
    console.log('  - listComponentTools(componentId?) - 查看已注册的工具');
    console.log('  - listAllTools() - 查看所有工具统计');
    console.log('  - debugToolRegistry() - 调试工具注册状态');
    console.log('  - GameToolRegistry.getToolStatistics() - 查看工具统计');
    console.log('  - GameToolRegistry.getToolHealth() - 查看工具健康状态');
    
    if (showDebug) {
      (window as any).debugGameState = gameState;
      (window as any).debugSettings = settings;
      (window as any).debugMemories = memoriesFromState;
      (window as any).debugLogCommunication = logCommunication;
    }
  }, [gameState, settings, logCommunication]);

  const startNewSession = useCallback((story: Story, userName?: string, charName?: string) => {
    // 重置GameEngine会话状态（包括LLM提供商检测）
    GameEngine.resetSession();
    
    const openingMonologue = parseContent(story.openingMonologue);
    
    const monologueScene: SceneFragment = {
        description: openingMonologue,
        imagePrompt: '',
        actions: [parseContent(story.openingAction)],
        summary: '',
    };
    const monologueHistoryItem: HistoryItem = {
      role: 'model',
      parts: [{ text: JSON.stringify(monologueScene) }],
      imageUrl: null,
      isGeneratingImage: false,
    };

    setGameState(prev => ({
      userId: userId,
      history: [monologueHistoryItem],
      summaries: [],
      grandSummaries: [],
      milestoneSummaries: [],
      turn: 0,
      userName: userName || 'Player',
      charName: charName || 'Game Master',
      gameStatus: GameStatus.Playing,
      dialogue: null,
      placeholderValues: prev.placeholderValues || {},
    }));
    setCommunicationsLog([]);
  }, [userId]);
  
  const scanForPlaceholders = useCallback((story: Story): DetectedPlaceholder[] => {
    const texts = [
        story.backgroundSetting,
        ...story.library.map(c => c.content),
        story.openingMonologue,
        story.openingAction,
    ];

    const combinedText = texts.join(' ');
    const placeholderRegex = /{{\s*(\w+)(?::\s*([^}]+))?\s*}}/g;
    const placeholders = new Map<string, DetectedPlaceholder>();
    let match;
    while ((match = placeholderRegex.exec(combinedText)) !== null) {
        const key = match[1];
        const description = match[2] || key.charAt(0).toUpperCase() + key.slice(1);
        if (!placeholders.has(key)) {
            placeholders.set(key, { key, description });
        }
    }
    return Array.from(placeholders.values());
  }, []);

  const handlePlaceholderSubmit = useCallback((names: Record<string, string>) => {
      // Save the values for next time
      setLastPlaceholderValues(names);
      
      // Update gameState with placeholder values for persistence
      setGameState(prev => ({
        ...prev,
        placeholderValues: names
      }));
      
      const replacedStory = JSON.parse(JSON.stringify(activeStory));
      
      const replace = (text: string) => {
          let newText = text;
          for (const key in names) {
              if (Object.prototype.hasOwnProperty.call(names, key)) {
                  const regex = new RegExp(`{{\\s*${key}(?::[^}}]+)?\\s*}}`, 'g');
                  newText = newText.replace(regex, names[key]);
              }
          }
          return newText;
      };
      
      replacedStory.backgroundSetting = replace(replacedStory.backgroundSetting);
      replacedStory.openingMonologue = replace(replacedStory.openingMonologue);
      replacedStory.openingAction = replace(replacedStory.openingAction);
      replacedStory.library = replacedStory.library.map(card => ({
          ...card,
          content: replace(card.content),
      }));

      setProcessedStory(replacedStory);
      startNewSession(replacedStory, names.user, names.char);
      
      setIsPlaceholderModalOpen(false);
  }, [activeStory, startNewSession]);

  const handlePlaceholderCancel = useCallback(() => {
      setIsPlaceholderModalOpen(false);
      // Don't call onExit, just close the modal and stay in the game
  }, []);

  useEffect(() => {
    if (!activeStory) return;

    const placeholders = scanForPlaceholders(activeStory);
    if (placeholders.length > 0) {
      setDetectedPlaceholders(placeholders);
      setIsPlaceholderModalOpen(true);
    } else {
      setProcessedStory(activeStory);
      startNewSession(activeStory);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStory]);
  
  useEffect(() => {
      if (activeStory && (gameState.gameStatus !== GameStatus.Idle || gameState.history.length > 0)) {
        onSavePlaythrough({ storyId: activeStory.id, ...gameState });
      }
  }, [gameState, activeStory, onSavePlaythrough]);

  // 监测玩家位置变化
  useEffect(() => {
    const currentLocation = gameState.playerLocation;
    const prevLocation = prevPlayerLocationRef.current;
    
    // 如果是初次加载，标记为完成并跳过位置变化检测
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      prevPlayerLocationRef.current = currentLocation || null;
      return;
    }
    
    // 检测位置变化
    if (currentLocation) {
      // 如果有前一个位置且位置发生变化，显示红点
      if (prevLocation && (currentLocation.mapId !== prevLocation.mapId || currentLocation.locationId !== prevLocation.locationId)) {
        setGameState(prev => ({ ...prev, hasUnviewedLocationChange: true }));
      }
      // 如果没有前一个位置但游戏已开始（首次设置位置），显示红点
      else if (!prevLocation && gameState.history.length >= 1) {
        setGameState(prev => ({ ...prev, hasUnviewedLocationChange: true }));
      }
    }
    
    // 更新上一次位置
    prevPlayerLocationRef.current = currentLocation || null;
  }, [gameState.playerLocation, gameState.history.length]);
  

  const processAction = async (action: string, currentState: typeof gameState, customSettings?: GameSettings, silent?: boolean) => {
    if (!processedStory) return;
    
    setGameState(s => ({...s, gameStatus: GameStatus.Loading}));
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    const isFirstAction = !currentState.history.some(h => h.role === 'user');
    let settingsToUse = customSettings || settings;

    if (isFirstAction) {
        const tempInstructions = [...settingsToUse.systemInstructions];
        if (processedStory.backgroundSetting) tempInstructions.unshift({ id: simpleUUID(), title: 'Game Background', role: 'system', text: `Background: ${parseContent(processedStory.backgroundSetting)}`, enabled: true });
        
        processedStory.library.forEach(card => {
            tempInstructions.push({ id: card.id, title: `Library Card: ${card.name}`, role: 'system', text: `[${card.type.toUpperCase()}] ${card.name}: ${card.content}`, enabled: true });
        });
        settingsToUse = { ...settingsToUse, systemInstructions: tempInstructions };
    }
    
    const memories: Memories = {
      summaries: currentState.summaries,
      grandSummaries: currentState.grandSummaries,
      milestoneSummaries: currentState.milestoneSummaries,
    };

    const newTurn = currentState.turn + 1;
    const userAction: HistoryItem = { role: 'user' as const, parts: [{ text: action }] };
    logCommunication('user_action', userAction);
    
    // Only add to visible history if not silent
    const fullHistory = silent ? currentState.history : [...currentState.history, userAction];
    const historyForAPI = [...currentState.history, userAction]; // Always include in API call
    
    if (!silent) {
      setGameState(s => ({...s, history: fullHistory, turn: newTurn}));
    } else {
      setGameState(s => ({...s, gameStatus: GameStatus.Loading}));
    }

    try {
      // Choose between new Game Engine or legacy system
      // For now, use Game Engine if dialog tools are enabled and it's a custom provider
      const useGameEngine = settingsToUse.enableDialogueTools && settingsToUse.provider === 'custom';
      
      let result;
      if (useGameEngine) {
        console.log('🎮 Using new Game Engine...');
        result = await getNextSceneWithGameEngine(historyForAPI, settingsToUse, memories, activeStory, logCommunication, controller.signal, toolHandler);
        
        // Debug player location
        if (result.playerLocationData) {
          console.log('🎯 Updating gameState with playerLocationData:', result.playerLocationData);
        }
        
        // Handle dialogue-only interaction to avoid empty bubble
        if (result.toolCalls?.some(tc => tc.function?.name === 'show_dialogue')) {
          // Set actions for dialogue completion
          if (result.actionData?.actions) {
            dialogueActionsRef.current = result.actionData.actions;
            console.log('🎯 Set dialogueActionsRef from GameEngine for dialogue:', result.actionData.actions);
          }
          
          // Update player location if available, but don't add empty scene to history
          const playerLocationToUpdate = result.playerLocationData ? {
            mapId: result.playerLocationData.mapId,
            locationId: result.playerLocationData.locationId
          } : null;
          
          setGameState(s => ({
            ...s,
            gameStatus: GameStatus.Playing,
            ...(playerLocationToUpdate && {
              playerLocation: playerLocationToUpdate
            })
          }));
          
          console.log('🎭 Dialogue interaction handled without adding empty scene to history');
          return; // Exit early to prevent adding minimal scene
        }
        
        // Fix for dialogue actions not being set when scene exists (minimalScene for dialogue)
        if (result.actionData?.actions && result.toolCalls?.some(tc => tc.function?.name === 'show_dialogue')) {
          dialogueActionsRef.current = result.actionData.actions;
          console.log('🎯 Set dialogueActionsRef from GameEngine actionData:', result.actionData.actions);
        }
      } else {
        console.log('🔄 Using legacy system...');
        result = await getNextSceneWithTools(historyForAPI, settingsToUse, memories, logCommunication, controller.signal, toolHandler);
      }
      
      // Check if we have a scene to display (from either tool calls or regular generation)
      if (!result.scene) {
        // If no scene but tools were called, this might be a dialogue-only interaction
        if (result.toolCalls && result.toolCalls.length > 0) {
          console.log('🎭 Tools executed without scene generation (dialogue-only interaction)');
          
          // Update actions from GameEngine result if available
          let actionsToUpdate = null;
          let playerLocationToUpdate = null;
          
          if (result.actionData?.actions) {
            actionsToUpdate = result.actionData.actions;
            console.log('🎯 actionData from GameEngine:', result.actionData);
            // Store actions for dialogue completion
            dialogueActionsRef.current = actionsToUpdate;
          }

          if (result.playerLocationData) {
            playerLocationToUpdate = {
              mapId: result.playerLocationData.mapId,
              locationId: result.playerLocationData.locationId
            };
            console.log('playerLocationData from GameEngine:', result.playerLocationData);
          }
          
          // Create a temporary scene with the new actions for UI display
          if (actionsToUpdate) {
            const tempScene: SceneFragment = {
              description: '', // Empty since dialogue is showing
              imagePrompt: '',
              actions: actionsToUpdate,
              summary: '对话交互中'
            };
            
            const tempHistoryItem: HistoryItem = {
              role: 'model',
              parts: [{ text: JSON.stringify(tempScene) }],
              imageUrl: null,
              isGeneratingImage: false,
            };
            
            console.log('🎯 Creating temp scene with actions:', actionsToUpdate);
            
            setGameState(s => ({
              ...s,
              gameStatus: GameStatus.Playing,
              // Add the temp history item to show new actions
              history: [...s.history, tempHistoryItem],
              ...(playerLocationToUpdate && {
                playerLocation: playerLocationToUpdate
              })
            }));
          } else {
            setGameState(s => ({
              ...s,
              gameStatus: GameStatus.Playing,
              ...(playerLocationToUpdate && {
                playerLocation: playerLocationToUpdate
              })
            }));
          }
          return;
        }
        throw new Error("No scene or tool calls returned from AI");
      }
      
      const { scene, rawResponse, playerLocationData } = result;

      const historyItemInProgress: HistoryItem = {
        role: 'model' as const, parts: [{ text: JSON.stringify(scene) }], imageUrl: null,
        isGeneratingImage: settingsToUse.enableImageGeneration,
        mapData: result.mapData, // 包含地图数据供AI后续使用
      };
      
      setGameState(s => ({
        ...s,
        history: silent ? [...fullHistory, historyItemInProgress] : [...s.history, historyItemInProgress],
        summaries: [...s.summaries, scene.summary],
        gameStatus: GameStatus.Playing,
        turn: newTurn,
        ...(playerLocationData && {
          playerLocation: {
            mapId: playerLocationData.mapId,
            locationId: playerLocationData.locationId
          }
        }),
        ...(result.mapData && {
          // 存储地图数据到游戏状态，供后续使用
          mapData: result.mapData
        })
      }));

      const updatedHistoryWithModel = [...fullHistory, historyItemInProgress];
      const modelResponseCount = updatedHistoryWithModel.filter(h => h.role === 'model' && !h.isError).length;
      

      // Only use legacy milestone evaluation if NOT using Game Engine
      // The Game Engine handles milestone evaluation through the evaluate_milestone tool
      if (!useGameEngine) {
        const milestoneContext = updatedHistoryWithModel.slice(-4);
        evaluateAndGenerateMilestone(milestoneContext, settingsToUse, logCommunication)
          .then(milestone => {
              if (milestone) {
                  setGameState(s => ({ ...s, milestoneSummaries: [...s.milestoneSummaries, { turn: modelResponseCount, ...milestone }] }));
              }
          }).catch(e => console.error("Failed to evaluate milestone:", e));
      }
      
      if (settingsToUse.enableImageGeneration) {
        generateImage(scene.imagePrompt, settingsToUse, logCommunication).then(imageUrl => {
            setGameState(prev => {
                const newHistory = [...prev.history];
                const lastItemIndex = newHistory.length - 1;
                if (lastItemIndex >= 0 && newHistory[lastItemIndex].role === 'model') {
                    newHistory[lastItemIndex] = { ...newHistory[lastItemIndex], imageUrl: imageUrl, isGeneratingImage: false };
                }
                return { ...prev, history: newHistory };
            });
        }).catch(e => {
            console.error(e);
            setGameState(prev => {
                const newHistory = [...prev.history];
                const lastItemIndex = newHistory.length - 1;
                if (lastItemIndex >= 0 && newHistory[lastItemIndex].role === 'model') {
                    newHistory[lastItemIndex].isGeneratingImage = false;
                }
                return { ...prev, history: newHistory };
            });
        });
      }

    } catch (e: unknown) {
      if ((e as Error).name === 'AbortError') return;

      console.error(e);
      let errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      
      // Check if it's a GameEngine error with specific message
      if (result && (result as any).error) {
        errorMessage = (result as any).errorMessage || 'AI未能正确生成响应，请尝试其他行动。';
      }
      
      logCommunication('gameplay_error', { message: errorMessage, stack: (e as Error)?.stack });
      const errorItem: HistoryItem = {
        role: 'model' as const, parts: [{ text: JSON.stringify({ title: t.errorTitle, message: errorMessage }) }],
        isError: true, imageUrl: null, isGeneratingImage: false,
      };
      setGameState(s => ({
        ...s,
        history: [...s.history, errorItem],
        gameStatus: GameStatus.Playing,
        turn: currentState.turn, // Revert turn count
      }));
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleAction = useCallback(async (action: string) => {
    await processAction(action, gameState);
  }, [gameState, processAction]);
  
  const handleStopGeneration = useCallback(() => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setGameState(s => {
      const historyWithoutUserAction = s.history[s.history.length-1]?.role === 'user' ? s.history.slice(0, -1) : s.history;
      return {
        ...s,
        gameStatus: GameStatus.Playing,
        history: historyWithoutUserAction,
        turn: Math.max(0, s.turn - 1),
      };
    });
  }, []);

  const handleRegenerate = useCallback(async () => {
    const lastUserActionIndex = gameState.history.map(h => h.role).lastIndexOf('user');
    if (lastUserActionIndex === -1) return;

    const lastAction = gameState.history[lastUserActionIndex].parts[0].text;
    const historyForRegen = gameState.history.slice(0, lastUserActionIndex);
    const turnForRegen = historyForRegen.filter(h => h.role === 'user').length;
    
    const modelResponsesBeforeRegen = historyForRegen.filter(h => h.role === 'model' && !h.isError).length;
    const summariesForRegen = gameState.summaries.slice(0, modelResponsesBeforeRegen);
    const grandSummariesForRegen = gameState.grandSummaries.filter(ms => ms.turn <= modelResponsesBeforeRegen);
    const milestoneSummariesForRegen = gameState.milestoneSummaries.filter(ms => ms.turn <= modelResponsesBeforeRegen);

    const stateForRegen = {
      ...gameState,
      history: historyForRegen,
      summaries: summariesForRegen,
      grandSummaries: grandSummariesForRegen,
      milestoneSummaries: milestoneSummariesForRegen,
      turn: turnForRegen,
    };
    
    setGameState(stateForRegen);
    await processAction(lastAction, stateForRegen);

  }, [gameState, processAction]);
  
  const handleConfirmNewGame = () => {
    setIsNewGameConfirmOpen(false);
    const placeholders = scanForPlaceholders(activeStory);
    if (placeholders.length > 0) {
      setDetectedPlaceholders(placeholders);
      setIsPlaceholderModalOpen(true);
    } else {
      setProcessedStory(activeStory);
      startNewSession(activeStory);
    }
  };

  // Dialogue handling functions
  const handleDialogueNext = useCallback(() => {
    if (!gameState.dialogue) return;
    
    const newIndex = gameState.dialogue.currentIndex + 1;
    setGameState(prev => ({
      ...prev,
      dialogue: prev.dialogue ? {
        ...prev.dialogue,
        currentIndex: newIndex
      } : null
    }));
  }, [gameState.dialogue]);

  const handleDialogueSkip = useCallback(() => {
    if (!gameState.dialogue) return;
    
    // Complete the dialogue and add to history
    const dialogueContent = `**${gameState.dialogue.speaker}**: ${gameState.dialogue.messages.join('\n\n')}`;
    const dialogueHistoryItem: HistoryItem = {
      role: 'model',
      parts: [{ text: JSON.stringify({ description: dialogueContent, imagePrompt: '', actions: [], summary: `对话与${gameState.dialogue.speaker}` }) }],
      imageUrl: null,
      isGeneratingImage: false,
    };

    setGameState(prev => ({
      ...prev,
      history: [...prev.history, dialogueHistoryItem],
      dialogue: null,
    }));
  }, [gameState.dialogue]);

  // HTML组件消息处理 - 用于响应iframe中的组件消息  
  const handleHtmlComponentMessage = useCallback(async (action: string, payload: any, callId: string, sourceWindow: Window) => {
    logCommunication('html_component_message', { action, payload, callId });

    // 直接使用消息来源窗口进行响应
    if (!sourceWindow) {
      console.error('HTML组件消息源窗口不可用');
      return;
    }

    try {
      let responsePayload: any;
      let responseAction: string;

      switch (action) {
        case 'AI_REQUEST':
          console.log('🤖 收到AI请求:', payload.prompt, 'callId:', callId);
          // 转发AI请求到游戏引擎 (暂时返回模拟响应)
          responsePayload = `🤖 模拟AI响应: ${payload.prompt}\n\n作为一个友好的AI助手，我很高兴为你提供帮助！你的请求已经被成功处理。这是HTML组件与游戏引擎通信的测试响应。\n\n当前时间: ${new Date().toLocaleString()}`;
          responseAction = 'AI_RESPONSE';
          console.log('🤖 准备发送AI响应, callId:', callId, 'responsePayload:', responsePayload);
          logCommunication('ai_mock_response', { prompt: payload.prompt, response: responsePayload, callId });
          break;
          
        case 'SAVE_DATA':
          // 组件数据持久化
          localStorage.setItem(`html_component_${payload.key}`, JSON.stringify(payload.data));
          responseAction = 'SAVE_SUCCESS';
          responsePayload = { success: true };
          logCommunication('html_component_save', { key: payload.key, data: payload.data });
          break;
          
        case 'LOAD_DATA':
          // 加载组件数据
          const data = localStorage.getItem(`html_component_${payload.key}`);
          const loadedData = data ? JSON.parse(data) : null;
          responseAction = 'LOAD_SUCCESS';
          responsePayload = loadedData;
          logCommunication('html_component_load', { key: payload.key, data: loadedData });
          break;
          
        case 'GAME_DATA':
          // 处理游戏数据
          logCommunication('html_component_game_data', payload);
          // 对于game data，不需要响应
          break;

        case 'REGISTER_TOOL':
          // 处理AI工具注册
          console.log('🛠️ 收到工具注册请求:', payload);
          try {
            const toolName = GameToolRegistry.dynamicRegisterHtmlComponentTool(
              payload.componentId,
              {
                name: payload.name,
                description: payload.description,
                parameters: payload.parameters,
                jsFunction: payload.jsFunction
              }
            );
            
            responseAction = 'REGISTER_SUCCESS';
            responsePayload = { 
              success: true, 
              toolName: toolName,
              message: `工具 '${payload.name}' 已成功注册`
            };
            logCommunication('html_component_tool_registered', { 
              componentId: payload.componentId, 
              toolName: toolName 
            });
            
          } catch (error) {
            responseAction = 'REGISTER_ERROR';
            responsePayload = { 
              success: false, 
              error: error.message 
            };
            logCommunication('html_component_tool_register_error', { 
              componentId: payload.componentId, 
              toolName: payload.name,
              error: error.message 
            });
          }
          break;

        case 'UNREGISTER_TOOL':
          // 处理AI工具取消注册
          console.log('🗑️ 收到工具取消注册请求:', payload);
          try {
            const success = GameToolRegistry.dynamicUnregisterHtmlComponentTool(
              payload.componentId,
              payload.name
            );
            
            responseAction = 'UNREGISTER_SUCCESS';
            responsePayload = { 
              success: success, 
              message: success 
                ? `工具 '${payload.name}' 已成功取消注册`
                : `工具 '${payload.name}' 未找到或取消注册失败`
            };
            logCommunication('html_component_tool_unregistered', { 
              componentId: payload.componentId, 
              toolName: payload.name,
              success 
            });
            
          } catch (error) {
            responseAction = 'UNREGISTER_ERROR';
            responsePayload = { 
              success: false, 
              error: error.message 
            };
            logCommunication('html_component_tool_unregister_error', { 
              componentId: payload.componentId, 
              toolName: payload.name,
              error: error.message 
            });
          }
          break;

        case 'LIST_TOOLS':
          // 处理工具列表查询
          console.log('📋 收到工具列表查询请求:', payload);
          try {
            const componentTools = GameToolRegistry.getHtmlComponentTools(payload.componentId);
            const toolList = componentTools.map(tool => ({
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters
            }));
            
            responseAction = 'LIST_SUCCESS';
            responsePayload = { 
              success: true, 
              tools: toolList,
              count: toolList.length
            };
            logCommunication('html_component_tools_listed', { 
              componentId: payload.componentId, 
              toolCount: toolList.length 
            });
            
          } catch (error) {
            responseAction = 'LIST_ERROR';
            responsePayload = { 
              success: false, 
              error: error.message 
            };
            logCommunication('html_component_tools_list_error', { 
              componentId: payload.componentId, 
              error: error.message 
            });
          }
          return;
          
        case 'LOG_MESSAGE':
          // 记录组件日志
          logCommunication('html_component_log', payload);
          // 日志消息不需要响应
          return;
          
        default:
          console.warn('未知的HTML组件消息类型:', action);
          responseAction = 'ERROR_RESPONSE';
          responsePayload = { error: `未知的消息类型: ${action}` };
      }

      // 发送响应消息
      if (responseAction) {
        console.log('📤 发送响应消息:', { action: responseAction, callId, payloadType: typeof responsePayload });
        sourceWindow.postMessage({ 
          action: responseAction, 
          payload: responsePayload, 
          callId 
        }, '*');
        
        logCommunication('html_component_response_sent', { 
          action: responseAction, 
          callId,
          payloadType: typeof responsePayload 
        });
        console.log('✅ 响应消息已发送');
      }

    } catch (error) {
      console.error('处理HTML组件消息时出错:', error);
      
      // 发送错误响应
      sourceWindow.postMessage({ 
        action: 'ERROR_RESPONSE', 
        payload: { error: error.message }, 
        callId 
      }, '*');
      
      logCommunication('html_component_error', { error: error.message, callId });
    }
  }, [logCommunication]);

  const handleDialogueComplete = useCallback(() => {
    if (!gameState.dialogue) return;
    
    // Use actions from tool results if available, otherwise use default actions
    const actionsToUse = dialogueActionsRef.current || [
      '继续探索',
      '询问更多信息', 
      '告别并离开'
    ];

    // Add dialogue to history and clear dialogue state
    const dialogueContent = `**${gameState.dialogue.speaker}**: ${gameState.dialogue.messages.join('\\n\\n')}`;
    const dialogueHistoryItem: HistoryItem = {
      role: 'model',
      parts: [{ text: JSON.stringify({ 
        description: dialogueContent, 
        imagePrompt: '', 
        actions: actionsToUse, 
        summary: `对话与${gameState.dialogue.speaker}` 
      }) }],
      imageUrl: null,
      isGeneratingImage: false,
    };

    // Update state with dialogue in history  
    setGameState(prev => ({
      ...prev,
      history: [...prev.history, dialogueHistoryItem],
      dialogue: null,
    }));
    
    // Clear the stored actions after use
    dialogueActionsRef.current = null;
    
    // No automatic continuation - let player choose what to do next
  }, [gameState.dialogue]);;

  // Store dialogue actions from tool results
  const dialogueActionsRef = useRef<string[] | null>(null);

  // Tool handler for AI function calls
  const toolHandler: ToolHandler = {
    show_dialogue: async (args: { speaker: string; messages: string[]; avatar?: string }) => {
      return new Promise<void>((resolve) => {
        const callbackId = `dialogue-${Date.now()}`;
        
        setGameState(prev => ({
          ...prev,
          dialogue: {
            isActive: true,
            messages: args.messages,
            currentIndex: 0,
            speaker: args.speaker,
            avatar: args.avatar,
            callbackId
          }
        }));

        // Store the resolve callback for when dialogue completes
        const originalComplete = handleDialogueComplete;
        const wrappedComplete = () => {
          originalComplete();
          resolve();
        };
        
        // We'll resolve immediately for now, but this could be enhanced 
        // to wait for actual dialogue completion
        setTimeout(resolve, 100);
      });
    }
  };

  // Show loading state while story is loading
  if (storyLoading) {
    return <LoadingOverlay messages={["Loading story..."]} />;
  }

  // Show error state if story failed to load
  if (storyError || !activeStory) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-bold text-red-600 mb-2">Story not found</h2>
          <p className="text-gray-600 mb-4">The requested story could not be loaded.</p>
          <button
            onClick={onExit}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const actionsToShow = currentModelResponse?.actions ?? [];

  const windowOpacityFactor = (settings.dialogueWindowOpacity ?? 100) / 100;
  const bubbleOpacityFactor = (settings.bubbleOpacity ?? 100) / 100;
  const gamePanelStyles = {
      '--game-panel-bg-opacity-light': `${0.85 * windowOpacityFactor}`,
      '--game-panel-bg-opacity-dark': `${0.85 * windowOpacityFactor}`,
      '--bubble-opacity': bubbleOpacityFactor,
  } as React.CSSProperties;
  
  const backgroundOverlayOpacity = 0.6 * windowOpacityFactor;
  const backgroundBlur = windowOpacityFactor > 0.05 ? `blur(${windowOpacityFactor * 4}px)` : 'none';

  return (
    <div className="fixed inset-0 flex flex-col bg-cover bg-center bg-zinc-950" style={{ backgroundImage: isBgLoaded && activeStory?.coverImageUrl ? `url(${activeStory.coverImageUrl})` : 'none'}}>
        <div 
          className="absolute inset-0 z-0 transition-all duration-300"
          style={{
              backgroundColor: `rgba(0, 0, 0, ${backgroundOverlayOpacity})`,
              backdropFilter: backgroundBlur
          }}
        />

        <div style={gamePanelStyles} className="relative z-10 w-full h-full flex flex-col">
            <header className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/60 to-transparent flex items-center justify-between gap-2 text-sm" style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top))', paddingLeft: 'calc(1rem + env(safe-area-inset-left))', paddingRight: 'calc(1rem + env(safe-area-inset-right))', paddingBottom: '1rem' }}>
                <div className="flex items-center gap-2">
                    <button onClick={onExit} className="p-2 text-gray-200 hover:text-white bg-black/30 rounded-full transition-colors" aria-label={t.back}>
                        <ArrowLeftIcon className="w-5 h-5"/>
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setIsGameSettingsOpen(true)} className="p-2 text-gray-200 hover:text-white bg-black/30 rounded-full transition-colors" aria-label={t.gameSettings}>
                        <SlidersIcon className="w-5 h-5"/>
                    </button>
                    <button onClick={() => setIsNewGameConfirmOpen(true)} className="p-2 text-gray-200 hover:text-white bg-black/30 rounded-full transition-colors" aria-label={t.startNewGame}>
                        <RestartIcon className="w-5 h-5"/>
                    </button>
                    <button onClick={() => setIsSummaryOpen(true)} disabled={gameState.history.length === 0} className="p-2 text-gray-200 hover:text-white bg-black/30 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed" aria-label={t.storyLog}>
                        <BookIcon className="w-5 h-5"/>
                    </button>
                    {hasMapButton && (
                        <button
                            onClick={() => {
                                if (gameState.playerLocation && storyMaps.length > 0) {
                                    const playerMapIndex = storyMaps.findIndex(map => map.id === gameState.playerLocation!.mapId);
                                    if (playerMapIndex !== -1) {
                                        setCurrentMapIndex(playerMapIndex);
                                    }
                                }
                                setIsMapViewerOpen(true);
                                // 清除红点提示
                                if (gameState.hasUnviewedLocationChange) {
                                    setGameState(prev => ({ ...prev, hasUnviewedLocationChange: false }));
                                }
                            }}
                            className="relative p-2 text-gray-200 hover:text-white bg-black/30 rounded-full transition-colors"
                            aria-label={t.viewMaps}
                        >
                            <MapIcon className="w-5 h-5"/>
                            {gameState.hasUnviewedLocationChange && (
                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                            )}
                        </button>
                    )}
                    {hasHtmlComponents && (
                        <button
                            onClick={() => {
                                if (storyHtmlComponents.length > 0) {
                                    setSelectedHtmlComponent(storyHtmlComponents[0]);
                                    setIsHtmlComponentViewerOpen(true);
                                }
                            }}
                            className="p-2 text-gray-200 hover:text-white bg-black/30 rounded-full transition-colors"
                            aria-label="查看HTML组件"
                            title="查看HTML组件"
                        >
                            <i className="fas fa-code w-5 h-5"></i>
                        </button>
                    )}
                    {showDebug && (
                    <>
                    <button onClick={() => setIsDebugPanelOpen(true)} disabled={gameState.history.length === 0} className="p-2 text-gray-200 hover:text-white bg-black/30 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed" aria-label={t.debugLog}>
                        <BugIcon className="w-5 h-5"/>
                    </button>
                    {/* Debug mode dialogue test button */}
                    <button 
                        onClick={() => setGameState(prev => ({
                            ...prev,
                            dialogue: {
                                isActive: true,
                                messages: ["欢迎来到这个神秘的村庄！", "这里发生了一些奇怪的事情...", "你能帮助我们找到真相吗？"],
                                currentIndex: 0,
                                speaker: "村长",
                                callbackId: "debug-dialogue-test"
                            }
                        }))} 
                        className="p-2 text-gray-200 hover:text-white bg-purple-600/50 rounded-full transition-colors" 
                        aria-label="测试对话"
                    >
                        <span className="text-xs">对话</span>
                    </button>
                    </>
                    )}
                </div>
            </header>
            
            <div
              ref={containerRef}
              className="flex-grow flex flex-col lg:flex-row h-full min-h-0 px-4 md:px-6"
              style={{
                paddingTop: 'calc(4rem + env(safe-area-inset-top))',
                paddingBottom: 'env(safe-area-inset-bottom)',
              }}
            >
                <div style={{ flexBasis: isMobile ? `${scenePanelSize}%` : `${scenePanelSize}%` }} className="flex flex-col min-h-0 min-w-0">
                <SceneDisplay
                    history={gameState.history}
                    onRegenerate={handleRegenerate}
                    isLoading={gameState.gameStatus === GameStatus.Loading}
                    regenerateLabel={t.regenerate}
                    userName={gameState.userName}
                    charName={gameState.charName}
                />
                </div>
                <Resizer onMouseDown={handleMouseDown} isHorizontal={!isMobile} />
                <div style={{ flexBasis: isMobile ? `${100 - scenePanelSize}%` : `${100-scenePanelSize}%` }} className="flex flex-col min-h-0 min-w-0">
                <ActionsPanel
                    actions={actionsToShow}
                    onAction={handleAction}
                    onStop={handleStopGeneration}
                    disabled={gameState.gameStatus === GameStatus.Idle}
                    gameStatus={gameState.gameStatus}
                    userName={gameState.userName}
                    language={settings.language}
                />
                </div>
            </div>

            {isSummaryOpen && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-40 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 rounded-lg shadow-xl w-full max-w-2xl h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-zinc-800 flex-shrink-0">
                            <h2 className="text-xl font-bold text-gray-700 dark:text-zinc-300 font-serif">{t.summariesHeader}</h2>
                            <button onClick={() => setIsSummaryOpen(false)} className="p-1 text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 rounded-full">
                                <CloseIcon className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="flex-grow min-h-0">
                             <SummaryPanel summaries={gameState.summaries} grandSummaries={gameState.grandSummaries} milestoneSummaries={gameState.milestoneSummaries} headerText="" />
                        </div>
                    </div>
                </div>
            )}
            
            {showDebug && <DebugPanel
                isOpen={isDebugPanelOpen}
                onClose={() => setIsDebugPanelOpen(false)}
                log={communicationsLog}
                language={settings.language}
            />}
            
            {isGameSettingsOpen && (
                <div className="absolute inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={() => setIsGameSettingsOpen(false)} />
            )}
            <div className={`absolute top-0 right-0 h-full w-full max-w-sm z-50 transition-transform duration-300 ease-in-out ${isGameSettingsOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <GameSettingsPanel 
                    settings={settings} 
                    onSettingsChange={setSettings} 
                    onClose={() => setIsGameSettingsOpen(false)} 
                />
            </div>

            <ConfirmationDialog
                isOpen={isNewGameConfirmOpen}
                onClose={() => setIsNewGameConfirmOpen(false)}
                onConfirm={handleConfirmNewGame}
                title={t.restartGameTitle}
                message={t.restartGameMessage}
                confirmText={t.restart}
                cancelText={t.cancel}
            />

            {isPlaceholderModalOpen && <PlaceholderInputModal 
                isOpen={isPlaceholderModalOpen}
                onClose={handlePlaceholderCancel}
                onSubmit={handlePlaceholderSubmit}
                placeholders={detectedPlaceholders}
                language={settings.language}
                initialValues={lastPlaceholderValues}
            />}

            {gameState.dialogue && (
                <DialogueModal
                    isOpen={gameState.dialogue.isActive}
                    messages={gameState.dialogue.messages}
                    currentIndex={gameState.dialogue.currentIndex}
                    speaker={gameState.dialogue.speaker}
                    avatar={gameState.dialogue.avatar}
                    onNext={handleDialogueNext}
                    onSkip={handleDialogueSkip}
                    onComplete={handleDialogueComplete}
                />
            )}

            {hasMapButton && (
                <MapViewerModal
                    isOpen={isMapViewerOpen}
                    onClose={() => setIsMapViewerOpen(false)}
                    maps={storyMaps}
                    currentMapIndex={currentMapIndex}
                    onMapChange={setCurrentMapIndex}
                    playerLocation={gameState.playerLocation}
                    language={settings.language}
                />
            )}

            {hasHtmlComponents && (
                <HtmlComponentViewer
                    isOpen={isHtmlComponentViewerOpen}
                    onClose={() => {
                        setIsHtmlComponentViewerOpen(false);
                        setSelectedHtmlComponent(null);
                    }}
                    component={selectedHtmlComponent}
                    onMessage={handleHtmlComponentMessage}
                />
            )}
        </div>
    </div>
  );
}