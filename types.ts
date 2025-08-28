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
  language: Language;
  theme: 'light' | 'dark';
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

export type LibraryCardType = 'character' | 'location' | 'item' | 'quest' | 'setting' | 'custom';

export interface LibraryCard {
  id: string;
  type: LibraryCardType;
  name: string;
  content: string;
  keywords: string[];
  customTypeName?: string;
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
}

export interface PlaythroughFromDB {
    id: string;
    user_id: string;
    story_id: string;
    game_state: Omit<Playthrough, 'id' | 'userId' | 'storyId'>;
}