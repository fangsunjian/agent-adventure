import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameSettings } from '../types';
import { DEFAULT_SETTINGS } from '../constants';
import { UserSettingsService } from '../services/userSettingsService';
import { useAuth } from '../contexts/AuthContext';
import useLocalStorage from './useLocalStorage';

interface UseUserSettingsReturn {
  settings: GameSettings;
  setSettings: (settings: GameSettings | ((prev: GameSettings) => GameSettings)) => void;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  saveToCloud: () => Promise<boolean>;
  loadFromCloud: () => Promise<boolean>;
  resetToDefault: () => void;
}

/**
 * 增强的用户设置管理 Hook
 * 结合了本地存储和云端数据库同步
 */
export function useUserSettings(): UseUserSettingsReturn {
  const { user } = useAuth();
  const [localSettings, setLocalSettings] = useLocalStorage<GameSettings>('gemini-adventure-settings-v2', DEFAULT_SETTINGS);
  const [settings, setSettings] = useState<GameSettings>(localSettings);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const settingsLoadedRef = useRef(false);

  // 同步本地设置到状态
  useEffect(() => {
    setSettings(localSettings);
  }, [localSettings]);

  // 用户登录时从云端加载设置 - 临时禁用云端同步
  // useEffect(() => {
  //   if (user && !settingsLoadedRef.current) {
  //     loadFromCloud();
  //     settingsLoadedRef.current = true;
  //   }
  // }, [user]);

  // 监听云端设置变化 - 临时禁用云端同步
  // useEffect(() => {
  //   if (!user) return;

  //   const unsubscribe = UserSettingsService.subscribeToUserSettings(
  //     user.id,
  //     (cloudSettings) => {
  //       if (cloudSettings) {
  //         // 云端设置有更新，同步到本地
  //         setLocalSettings(cloudSettings);
  //         setSettings(cloudSettings);
  //       }
  //     }
  //   );

  //   return unsubscribe;
  // }, [user, setLocalSettings]);

  // 用户登出时重置
  useEffect(() => {
    if (!user) {
      settingsLoadedRef.current = false;
      setError(null);
    }
  }, [user]);

  /**
   * 保存设置到云端 - 临时禁用
   */
  const saveToCloud = useCallback(async (): Promise<boolean> => {
    // 模拟成功保存
    return true;
  }, [user, settings]);

  /**
   * 从云端加载设置 - 临时禁用
   */
  const loadFromCloud = useCallback(async (): Promise<boolean> => {
    // 模拟成功加载
    return true;
  }, [user, settings, setLocalSettings]);

  /**
   * 设置增强函数 - 仅本地存储（临时禁用云端）
   */
  const enhancedSetSettings = useCallback((newSettings: GameSettings | ((prev: GameSettings) => GameSettings)) => {
    const settingsToApply = newSettings instanceof Function ? newSettings(settings) : newSettings;

    // 只更新本地存储
    setLocalSettings(settingsToApply);
    setSettings(settingsToApply);

    // 云端保存已禁用
  }, [settings, setLocalSettings]);

  /**
   * 重置为默认设置
   */
  const resetToDefault = useCallback(() => {
    enhancedSetSettings(DEFAULT_SETTINGS);
  }, [enhancedSetSettings]);

  return {
    settings,
    setSettings: enhancedSetSettings,
    isLoading,
    isSaving,
    error,
    saveToCloud,
    loadFromCloud,
    resetToDefault,
  };
}

export default useUserSettings;