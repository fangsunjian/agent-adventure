import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { GameSettings } from '../types';
import { DEFAULT_SETTINGS } from '../constants';
import { useAuth } from '../contexts/AuthContext';

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

const STORAGE_KEY = 'gemini-adventure-settings-v2';

type StoreState = {
  settings: GameSettings;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
};

type StoreListener = () => void;

const THEME_OPTIONS: ReadonlyArray<GameSettings['theme']> = ['light', 'dark', 'auto'];

const mergeWithDefaults = (settings: Partial<GameSettings> | null | undefined): GameSettings => {
  const merged: GameSettings = {
    ...DEFAULT_SETTINGS,
    ...(settings ?? {}),
  };

  if (!THEME_OPTIONS.includes(merged.theme)) {
    merged.theme = DEFAULT_SETTINGS.theme;
  }

  return merged;
};

const loadSettingsFromStorage = (): GameSettings => {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return DEFAULT_SETTINGS;
    }

    const parsed = JSON.parse(stored) as Partial<GameSettings>;
    return mergeWithDefaults(parsed);
  } catch (error) {
    console.error('Failed to parse user settings from storage:', error);
    return DEFAULT_SETTINGS;
  }
};

let storeState: StoreState = {
  settings: loadSettingsFromStorage(),
  isLoading: false,
  isSaving: false,
  error: null,
};

const listeners = new Set<StoreListener>();

const getSnapshot = (): StoreState => storeState;

const subscribe = (listener: StoreListener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const emit = () => {
  listeners.forEach(listener => listener());
};

const persistSettings = (settings: GameSettings) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to persist user settings:', error);
  }
};

const updateStoreState = (partial: Partial<StoreState>) => {
  storeState = { ...storeState, ...partial };
  emit();
};

const setSettingsInternal = (value: GameSettings | ((prev: GameSettings) => GameSettings)) => {
  const next = typeof value === 'function'
    ? (value as (prev: GameSettings) => GameSettings)(storeState.settings)
    : value;

  const sanitized = mergeWithDefaults(next);
  persistSettings(sanitized);
  updateStoreState({ settings: sanitized });
};

const resetToDefaultInternal = () => {
  setSettingsInternal(DEFAULT_SETTINGS);
};

const saveToCloudInternal = async (): Promise<boolean> => {
  // 云端同步当前禁用，保留接口返回成功
  return true;
};

const loadFromCloudInternal = async (): Promise<boolean> => {
  // 云端同步当前禁用，保留接口返回成功
  return true;
};

export function useUserSettings(): UseUserSettingsReturn {
  const { user } = useAuth();
  const snapshot = useSyncExternalStore<StoreState>(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (!user) {
      updateStoreState({ error: null, isLoading: false, isSaving: false });
    }
  }, [user]);

  const setSettings = useCallback(
    (value: GameSettings | ((prev: GameSettings) => GameSettings)) => {
      setSettingsInternal(value);
    },
    []
  );

  const saveToCloud = useCallback(async () => saveToCloudInternal(), []);
  const loadFromCloud = useCallback(async () => loadFromCloudInternal(), []);
  const resetToDefault = useCallback(() => resetToDefaultInternal(), []);

  return {
    settings: snapshot.settings,
    setSettings,
    isLoading: snapshot.isLoading,
    isSaving: snapshot.isSaving,
    error: snapshot.error,
    saveToCloud,
    loadFromCloud,
    resetToDefault,
  };
}

export default useUserSettings;
