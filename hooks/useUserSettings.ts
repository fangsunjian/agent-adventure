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

  // 用户登录时从云端加载设置
  useEffect(() => {
    if (user && !settingsLoadedRef.current) {
      loadFromCloud();
      settingsLoadedRef.current = true;
    }
  }, [user]);

  // 监听云端设置变化
  useEffect(() => {
    if (!user) return;

    const unsubscribe = UserSettingsService.subscribeToUserSettings(
      user.id,
      (cloudSettings) => {
        if (cloudSettings) {
          // 云端设置有更新，同步到本地
          setLocalSettings(cloudSettings);
          setSettings(cloudSettings);
        }
      }
    );

    return unsubscribe;
  }, [user, setLocalSettings]);

  // 用户登出时重置
  useEffect(() => {
    if (!user) {
      settingsLoadedRef.current = false;
      setError(null);
    }
  }, [user]);

  /**
   * 保存设置到云端
   */
  const saveToCloud = useCallback(async (): Promise<boolean> => {
    if (!user) {
      setError('用户未登录');
      return false;
    }

    setIsSaving(true);
    setError(null);

    try {
      const success = await UserSettingsService.saveUserSettings(user.id, settings);
      if (!success) {
        setError('保存设置失败');
      }
      return success;
    } catch (error) {
      console.error('Error saving settings to cloud:', error);
      setError('保存设置时出错');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [user, settings]);

  /**
   * 从云端加载设置
   */
  const loadFromCloud = useCallback(async (): Promise<boolean> => {
    if (!user) {
      setError('用户未登录');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const cloudSettings = await UserSettingsService.getUserSettings(user.id);
      
      if (cloudSettings) {
        // 云端有设置，使用云端设置
        setLocalSettings(cloudSettings);
        setSettings(cloudSettings);
        return true;
      } else {
        // 云端没有设置，将本地设置上传到云端
        const success = await UserSettingsService.saveUserSettings(user.id, settings);
        if (!success) {
          setError('初始化云端设置失败');
        }
        return success;
      }
    } catch (error) {
      console.error('Error loading settings from cloud:', error);
      setError('加载设置时出错');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, settings, setLocalSettings]);

  /**
   * 设置增强函数 - 自动保存到云端（如果用户已登录）
   */
  const enhancedSetSettings = useCallback((newSettings: GameSettings | ((prev: GameSettings) => GameSettings)) => {
    const settingsToApply = newSettings instanceof Function ? newSettings(settings) : newSettings;
    
    // 先更新本地存储
    setLocalSettings(settingsToApply);
    setSettings(settingsToApply);

    // 如果用户已登录，异步保存到云端（不阻塞UI）
    if (user) {
      UserSettingsService.saveUserSettings(user.id, settingsToApply).catch(error => {
        console.error('Background save failed:', error);
        // 后台保存失败，不显示错误给用户，保持流畅体验
      });
    }
  }, [user, settings, setLocalSettings]);

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