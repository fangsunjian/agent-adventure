import React, { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { QueryProvider } from './src/components/QueryProvider'
import { router } from './src/router'
import { useAuth } from './contexts/AuthContext'
import { useUserSettings } from './hooks/useUserSettings'
import LoadingOverlay from './components/LoadingOverlay'
import AuthPage from './pages/AuthPage'
import { initializePrompts } from './utils/promptInitializer'

export default function App(): React.ReactNode {
  const { session, user, loading } = useAuth()
  const { settings, isLoading: settingsLoading } = useUserSettings()

  // Initialize prompts on app start
  useEffect(() => {
    initializePrompts().catch(error => {
      console.error('Failed to initialize prompts:', error)
    })
  }, [])

  // Apply theme and UI settings
  useEffect(() => {
    const root = document.documentElement
    if (settings.theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }

    root.style.fontSize = `${settings.uiScale}%`
  }, [settings.theme, settings.uiScale])

  // Show loading overlay while settings are loading (but not authentication)
  if (settingsLoading) {
    return (
      <LoadingOverlay
        messages={[
          'Loading Settings...'
        ]}
      />
    )
  }

  // Always render the router - authentication will be handled per-route
  // This allows guest users to browse and play games
  return (
    <QueryProvider>
      <RouterProvider router={router} />
    </QueryProvider>
  )
}