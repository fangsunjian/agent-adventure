import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface GameMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  type?: 'scene' | 'action' | 'system'
}

interface GameState {
  // Current game session
  currentPlaythrough: string | null
  messages: GameMessage[]
  isGenerating: boolean

  // Game settings
  llmSettings: {
    temperature: number
    topP: number
    topK: number
    maxTokens: number
  }

  // Actions
  setCurrentPlaythrough: (id: string | null) => void
  addMessage: (message: Omit<GameMessage, 'id' | 'timestamp'>) => void
  updateMessage: (id: string, updates: Partial<GameMessage>) => void
  clearMessages: () => void
  setIsGenerating: (generating: boolean) => void
  updateLlmSettings: (settings: Partial<GameState['llmSettings']>) => void
}

export const useGameStore = create<GameState>()(
  devtools(
    persist(
      (set, get) => ({
        // State
        currentPlaythrough: null,
        messages: [],
        isGenerating: false,
        llmSettings: {
          temperature: 0.7,
          topP: 0.9,
          topK: 40,
          maxTokens: 1000,
        },

        // Actions
        setCurrentPlaythrough: (id) =>
          set({ currentPlaythrough: id }, false, 'setCurrentPlaythrough'),

        addMessage: (messageData) => {
          const message: GameMessage = {
            ...messageData,
            id: crypto.randomUUID(),
            timestamp: Date.now(),
          }
          set(
            (state) => ({ messages: [...state.messages, message] }),
            false,
            'addMessage'
          )
        },

        updateMessage: (id, updates) =>
          set(
            (state) => ({
              messages: state.messages.map((msg) =>
                msg.id === id ? { ...msg, ...updates } : msg
              ),
            }),
            false,
            'updateMessage'
          ),

        clearMessages: () => set({ messages: [] }, false, 'clearMessages'),

        setIsGenerating: (generating) =>
          set({ isGenerating: generating }, false, 'setIsGenerating'),

        updateLlmSettings: (newSettings) =>
          set(
            (state) => ({
              llmSettings: { ...state.llmSettings, ...newSettings },
            }),
            false,
            'updateLlmSettings'
          ),
      }),
      {
        name: 'game-store',
        partialize: (state) => ({
          llmSettings: state.llmSettings,
          currentPlaythrough: state.currentPlaythrough,
        }),
      }
    ),
    {
      name: 'game-store',
    }
  )
)