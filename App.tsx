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
  const { settings, hydrated: settingsHydrated } = useUserSettings()

  // Initialize prompts on app start
  useEffect(() => {
    initializePrompts().catch(error => {
      console.error('Failed to initialize prompts:', error)
    })
  }, [])

  // Apply theme preference including auto (system) mode
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const root = document.documentElement
    const applyTheme = (mode: 'light' | 'dark') => {
      root.classList.toggle('dark', mode === 'dark')
      root.style.colorScheme = mode
      root.dataset.themeApplied = mode
    }

    if (settings.theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const updateFromSystemPreference = (matches: boolean) => {
        applyTheme(matches ? 'dark' : 'light')
      }

      root.dataset.themePreference = 'auto'
      updateFromSystemPreference(mediaQuery.matches)

      const handleChange = (event: MediaQueryListEvent) => {
        updateFromSystemPreference(event.matches)
      }

      if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', handleChange)
        return () => {
          mediaQuery.removeEventListener('change', handleChange)
        }
      }

      mediaQuery.addListener(handleChange)
      return () => {
        mediaQuery.removeListener(handleChange)
      }
    }

    root.dataset.themePreference = settings.theme
    applyTheme(settings.theme)
  }, [settings.theme])

  // Apply UI scale independently so it is always in sync
  useEffect(() => {
    document.documentElement.style.fontSize = `${settings.uiScale}%`
  }, [settings.uiScale])

  // Show loading overlay while settings are loading (but not authentication)
  if (!settingsHydrated) {
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
