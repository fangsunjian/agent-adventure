import React from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import TopHeader from '../../components/TopHeader'
import BottomNavBar from '../../components/BottomNavBar'
import NewGameModal from '../../components/NewGameModal'
import { useAppStore } from '../stores/appStore'
import { DEFAULT_PROMPTS } from '../../constants'
import type { PendingGameConfig, DetectedPlaceholders } from '../../types'

export function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { modals, setModal } = useAppStore()

  // Map pathname to page for TopHeader
  const getActivePageFromPath = (pathname: string): string => {
    if (pathname === '/') return 'home'
    if (pathname.startsWith('/explore')) return 'explore'
    if (pathname.startsWith('/profile')) return 'profile'
    return 'home'
  }

  const activePage = getActivePageFromPath(location.pathname)

  const handleNewGameStart = (config: PendingGameConfig, placeholders: DetectedPlaceholders) => {
    // For now, just close the modal and navigate to create page
    // TODO: Implement proper game creation logic
    setModal('newGame', false)
    navigate('/create')
  }

  const handleNewGameClose = () => {
    setModal('newGame', false)
  }

  return (
    <>
      <div className="w-full flex-container-full-height bg-white dark:bg-zinc-950 text-gray-800 dark:text-zinc-200">
        <TopHeader activePage={activePage} language="zh" />
        <main className="flex-1 overflow-y-auto main-content-area">
          <Outlet />
        </main>
      </div>
      {/* Hide bottom nav on desktop, show on mobile */}
      <div className="block lg:hidden">
        <BottomNavBar language="zh" />
      </div>
      <NewGameModal
        isOpen={modals.newGame}
        onClose={handleNewGameClose}
        onStart={handleNewGameStart}
        language="zh"
        initialBackground={DEFAULT_PROMPTS.zh.background}
        initialCharacter={DEFAULT_PROMPTS.zh.character}
        initialOpeningMonologue={DEFAULT_PROMPTS.zh.openingMonologue}
        initialOpeningAction={DEFAULT_PROMPTS.zh.openingAction}
      />
    </>
  )
}