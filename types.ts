export interface SceneFragment {
  description: string;
  imagePrompt: string;
  actions: string[];
  summary: string; // This is the single-turn summary
}

export interface Scene extends SceneFragment {
  imageUrl: string | null;
}

export interface GrandSummaryItem {
  turn: number;
  text: string;
}

export interface MilestoneSummaryItem {
  turn: number;
  summary: string;
  reason: string;
  tags: string[];
  priority: number;
}

export interface GameData {
  background: string;
  character: string;
  userName?: string;
  charName?: string;
  grandSummaries: GrandSummaryItem[];
  milestoneSummaries: MilestoneSummaryItem[];
  chatHistory: HistoryItem[];
}

export type HistoryItem = {
  role: 'user' | 'model';
  parts: { text: string }[];
  imageUrl?: string | null;
  isGeneratingImage?: boolean;
  isError?: boolean;
  mapData?: any; // 存储地图数据供AI后续使用
};

export interface DebugLogEntry {
  type: string;
  data: any;
  timestamp: string;
}

export enum GameStatus {
  Idle,
  Playing,
  Loading,
  Error,
}

export type Language = 'en' | 'zh';

export const LANGUAGES: { code: Language; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'zh', name: '中文' },
];

export interface AppSettings {
  provider: 'gemini' | 'custom';
  customEndpoint: string;
  customApiKey: string;
  customModelId: string;
  enableImageGeneration: boolean;
  enableDialogueTools: boolean; // New setting for dialogue tool calls
  language: Language;
  theme: 'light' | 'dark' | 'auto';
  uiScale: number; // in percent, e.g., 100
  dialogueWindowOpacity: number; // in percent, e.g., 100
  bubbleOpacity: number; // in percent, e.g., 100
  useJsonSchemaForCustom?: boolean;
  lmStudioCompatibleJson?: boolean;
}

export interface LLMSettings {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  autoMaxTokens?: boolean;
  fetchedMaxTokens?: number | null;
  reasoningEffort?: 'low' | 'medium' | 'high'; // 推理预算设置
}

export type SystemInstructionRole = 'system' | 'user' | 'assistant';

export interface SystemInstruction {
  id: string;
  title: string;
  role: SystemInstructionRole;
  text: string;
  enabled: boolean;
}

export interface GameSettings extends AppSettings {
  llm: LLMSettings;
  systemInstructions: SystemInstruction[];
}

export interface LastGameConfig {
  background: string;
  character: string;
  openingMonologue: string;
  openingAction: string;
}

export type PendingGameConfig = { background: string; character: string; openingMonologue: string; openingAction: string; };
export type DetectedPlaceholders = ('user' | 'char')[];

export interface DetectedPlaceholder {
  key: string;
  description: string;
}

export interface CustomModel {
  id: string;
  [key: string]: any;
}

export interface Memories {
  summaries: string[];
  grandSummaries: GrandSummaryItem[];
  milestoneSummaries: MilestoneSummaryItem[];
}

// --- New Platform Types ---

export type Page = 'home' | 'explore' | 'profile' | 'game';

export type LibraryCardType = 'character' | 'location' | 'item' | 'quest' | 'setting' | 'custom' | 'map' | 'html';

export interface MapLocation {
  id: string;
  x: number;  // X coordinate on the map (0-1000 scale)
  y: number;  // Y coordinate on the map (0-1000 scale)
  name: string;
  description: string;
}

export interface HtmlToolDefinition {
  name: string;
  description: string;
  parameters: any;
  jsFunction: string; // 对应的JS函数名
}

export interface HtmlComponentData {
  html: string;
  css: string;
  js: string;
  toolDefinitions?: HtmlToolDefinition[]; // AI工具定义
  previewUrl?: string; // 运行时预览URL
}

export interface AvatarCropData {
  x: number;
  y: number;
  scale: number;
}

export interface LibraryCard {
  id: string;
  type: LibraryCardType;
  name: string;
  content: string;
  keywords: string[];
  customTypeName?: string;
  // Map-specific fields
  mapImageUrl?: string;
  mapLocations?: MapLocation[];
  // HTML component-specific fields
  htmlData?: HtmlComponentData;
  // Character-specific fields
  imageUrl?: string;
  avatarCrop?: AvatarCropData;
}

// This type represents the data structure used within the React app (camelCase)
export interface Story {
  id: string;
  creatorId: string;
  creatorName: string;
  title: string;
  description: string;
  coverImageUrl: string;
  visibility: 'public' | 'private';
  category: string;
  library: LibraryCard[];
  backgroundSetting: string;
  openingMonologue: string;
  openingAction: string;
  openingSpeaker: 'narrator' | string; // 'narrator' or a library card ID of a character
}

// This type represents the raw data structure from the Supabase DB (snake_case)
export interface StoryFromDB {
  id: string;
  creator_id: string;
  creator_name: string;
  title: string;
  description: string;
  cover_image_url: string;
  visibility: 'public' | 'private';
  category: string;
  library: LibraryCard[];
  background_setting: string;
  opening_monologue: string;
  opening_action: string;
  opening_speaker: 'narrator' | string;
}


export interface Playthrough {
  id?: string;
  userId: string;
  storyId: string;
  history: HistoryItem[];
  summaries: string[];
  grandSummaries: GrandSummaryItem[];
  milestoneSummaries: MilestoneSummaryItem[];
  turn: number;
  userName: string;
  charName: string;
  gameStatus: GameStatus;
  dialogue?: DialogueState | null;
  placeholderValues?: Record<string, string>;
  playerLocation?: { mapId: string; locationId: string };
  mapData?: any; // 存储地图数据供AI后续使用
  hasUnviewedLocationChange?: boolean; // 跟踪是否有未查看的位置变化
}

export interface PlaythroughFromDB {
    id: string;
    user_id: string;
    story_id: string;
    game_state: Omit<Playthrough, 'id' | 'userId' | 'storyId'>;
}

// --- Dialogue System Types ---

export interface DialogueState {
  isActive: boolean;
  messages: string[];
  currentIndex: number;
  speaker: string;
  avatar?: string;
  callbackId: string;
}

export interface DialogueModalProps {
  isOpen: boolean;
  messages: string[];
  currentIndex: number;
  speaker: string;
  avatar?: string;
  onNext: () => void;
  onSkip: () => void;
  onComplete: () => void;
}




