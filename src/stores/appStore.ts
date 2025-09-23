import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface AppState {
  // Navigation state
  activePage: string
  setActivePage: (page: string) => void

  // Loading states
  isLoading: boolean
  setIsLoading: (loading: boolean) => void

  // User settings
  uiSettings: {
    scale: number
    transparency: number
    theme: 'light' | 'dark' | 'auto'
  }
  updateUiSettings: (settings: Partial<AppState['uiSettings']>) => void

  // Game state
  activeStory: string | null
  setActiveStory: (storyId: string | null) => void

  // Modal states
  modals: {
    newGame: boolean
    settings: boolean
    confirmation: boolean
  }
  setModal: (modal: keyof AppState['modals'], open: boolean) => void
}

export const useAppStore = create<AppState>()(
  devtools(
    (set, get) => ({
      // Navigation
      activePage: 'home',
      setActivePage: (page) => set({ activePage: page }, false, 'setActivePage'),

      // Loading
      isLoading: false,
      setIsLoading: (loading) => set({ isLoading: loading }, false, 'setIsLoading'),

      // Settings
      uiSettings: {
        scale: 100,
        transparency: 90,
        theme: 'auto',
      },
      updateUiSettings: (newSettings) =>
        set(
          (state) => ({
            uiSettings: { ...state.uiSettings, ...newSettings },
          }),
          false,
          'updateUiSettings'
        ),

      // Game
      activeStory: null,
      setActiveStory: (storyId) => set({ activeStory: storyId }, false, 'setActiveStory'),

      // Modals
      modals: {
        newGame: false,
        settings: false,
        confirmation: false,
      },
      setModal: (modal, open) =>
        set(
          (state) => ({
            modals: { ...state.modals, [modal]: open },
          }),
          false,
          `setModal:${modal}`
        ),
    }),
    {
      name: 'app-store',
    }
  )
)