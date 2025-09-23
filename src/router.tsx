import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { GameLayout } from './layouts/GameLayout'
import { AuthLayout } from './layouts/AuthLayout'

// Pages
import HomePage from './pages/HomePage'
import ExplorePage from './pages/ExplorePage'
import ProfilePage from './pages/ProfilePage'
import CreatePage from './pages/CreatePage'
import GamePage from './pages/GamePage'
import AuthPage from './pages/AuthPage'

export const router = createBrowserRouter([
  {
    path: '/auth',
    element: <AuthLayout />,
    children: [
      {
        index: true,
        element: <AuthPage />,
      },
    ],
  },
  {
    path: '/game',
    element: <GameLayout />,
    children: [
      {
        path: ':storyId?',
        element: <GamePage />,
      },
    ],
  },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'explore',
        element: <ExplorePage />,
      },
      {
        path: 'profile',
        element: <ProfilePage />,
      },
      {
        path: 'create',
        element: <CreatePage />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])