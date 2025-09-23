import React from 'react'
import { Outlet } from 'react-router-dom'

export function GameLayout() {
  return (
    <div className="w-full h-full bg-white dark:bg-zinc-950 text-gray-800 dark:text-zinc-200">
      <Outlet />
    </div>
  )
}