import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { GameSettings } from '../types';
import { DEFAULT_SETTINGS } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import UserSettingsService from '../services/userSettingsService';

interface UseUserSettingsReturn {
  settings: GameSettings;
  setSettings: (settings: GameSettings | ((prev: GameSettings) => GameSettings)) => void;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  saveToCloud: () => Promise<boolean>;
  loadFromCloud: () => Promise<boolean>;
  resetToDefault: () => void;
  hydrated: boolean;
}

const STORAGE_KEY = 'gemini-adventure-settings-v2';
const hasWindow = typeof window !== 'undefined';

type StoreState = {
  settings: GameSettings;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  hydrated: boolean;
};

type StoreListener = () => void;

const THEME_OPTIONS: ReadonlyArray<GameSettings['theme']> = ['light', 'dark', 'auto'];

type CloudSyncState = {
  subscribers: number;
  currentUserId: string | null;
  initialized: boolean;
  inFlight: boolean;
  unsubscribe: (() => void) | null;
};

const cloudSyncState: CloudSyncState = {
  subscribers: 0,
  currentUserId: null,
  initialized: false,
  inFlight: false,
  unsubscribe: null,
};

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
  hydrated: hasWindow,
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

const cleanupCloudSubscription = () => {
  if (cloudSyncState.unsubscribe) {
    cloudSyncState.unsubscribe();
    cloudSyncState.unsubscribe = null;
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
  updateStoreState({ settings: sanitized, hydrated: true });
  return sanitized;
};

export function useUserSettings(): UseUserSettingsReturn {
  const { user } = useAuth();
  const snapshot = useSyncExternalStore<StoreState>(subscribe, getSnapshot, getSnapshot);

  const persistToCloud = useCallback(async (settingsToPersist: GameSettings) => {
    if (!user?.id) {
      return true;
    }

    updateStoreState({ isSaving: true, error: null });
    try {
      const success = await UserSettingsService.saveUserSettings(user.id, settingsToPersist);
      if (!success) {
        updateStoreState({ error: 'Failed to save settings to cloud' });
      }
      return success;
    } catch (error) {
      console.error('Failed to save settings to cloud:', error);
      updateStoreState({ error: 'Failed to save settings to cloud' });
      return false;
    } finally {
      updateStoreState({ isSaving: false });
    }
  }, [user?.id]);

  const fetchSettingsFromCloud = useCallback(async (): Promise<GameSettings | null> => {
    if (!user?.id) {
      return null;
    }

    try {
      const remoteSettings = await UserSettingsService.getUserSettings(user.id);
      if (remoteSettings) {
        return mergeWithDefaults(remoteSettings);
      }

      const fallback = mergeWithDefaults(storeState.settings);
      const seeded = await UserSettingsService.saveUserSettings(user.id, fallback);
      return seeded ? fallback : null;
    } catch (error) {
      console.error('Failed to load settings from cloud:', error);
      updateStoreState({ error: 'Failed to load settings from cloud' });
      return null;
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      cleanupCloudSubscription();
      cloudSyncState.subscribers = 0;
      cloudSyncState.currentUserId = null;
      cloudSyncState.initialized = false;
      cloudSyncState.inFlight = false;
      updateStoreState({
        settings: loadSettingsFromStorage(),
        error: null,
        isLoading: false,
        isSaving: false,
        hydrated: hasWindow,
      });
      return;
    }

    cloudSyncState.subscribers += 1;

    if (cloudSyncState.currentUserId !== user.id) {
      cleanupCloudSubscription();
      cloudSyncState.currentUserId = user.id;
      cloudSyncState.initialized = false;
      cloudSyncState.inFlight = false;
    }

    let isEffectActive = true;

    const ensureCloudSync = async () => {
      if (cloudSyncState.initialized || cloudSyncState.inFlight) {
        return;
      }

      cloudSyncState.inFlight = true;
      updateStoreState({ isLoading: true, error: null });

      try {
        const remoteSettings = await fetchSettingsFromCloud();
        if (!isEffectActive) {
          return;
        }

        if (remoteSettings) {
          persistSettings(remoteSettings);
          updateStoreState({ settings: remoteSettings, isLoading: false, error: null, hydrated: true });
        } else {
          updateStoreState({ isLoading: false, hydrated: hasWindow });
        }
        cloudSyncState.initialized = true;
      } finally {
        cloudSyncState.inFlight = false;
      }
    };

    void ensureCloudSync();

    if (!cloudSyncState.unsubscribe) {
      cloudSyncState.unsubscribe = UserSettingsService.subscribeToUserSettings(user.id, (incomingSettings) => {
        if (!incomingSettings) {
          return;
        }
        const merged = mergeWithDefaults(incomingSettings);
        persistSettings(merged);
        updateStoreState({ settings: merged, hydrated: true });
      });
    }

    return () => {
      isEffectActive = false;
      cloudSyncState.subscribers = Math.max(0, cloudSyncState.subscribers - 1);

      if (cloudSyncState.subscribers === 0) {
        cleanupCloudSubscription();
        cloudSyncState.currentUserId = null;
        cloudSyncState.initialized = false;
        cloudSyncState.inFlight = false;
      }
    };
  }, [user?.id, fetchSettingsFromCloud]);

  const setSettings = useCallback(
    (value: GameSettings | ((prev: GameSettings) => GameSettings)) => {
      const sanitized = setSettingsInternal(value);
      void persistToCloud(sanitized);
    },
    [persistToCloud]
  );

  const saveToCloud = useCallback(async () => {
    return persistToCloud(snapshot.settings);
  }, [persistToCloud, snapshot.settings]);

  const loadFromCloud = useCallback(async () => {
    updateStoreState({ isLoading: true, error: null });
    const remoteSettings = await fetchSettingsFromCloud();
    updateStoreState({ isLoading: false });
    if (remoteSettings) {
      persistSettings(remoteSettings);
      updateStoreState({ settings: remoteSettings, error: null, hydrated: true });
      return true;
    }
    return false;
  }, [fetchSettingsFromCloud]);

  const resetToDefault = useCallback(() => {
    const sanitized = setSettingsInternal(DEFAULT_SETTINGS);
    void persistToCloud(sanitized);
  }, [persistToCloud]);

  return {
    settings: snapshot.settings,
    setSettings,
    isLoading: snapshot.isLoading,
    isSaving: snapshot.isSaving,
    error: snapshot.error,
    saveToCloud,
    loadFromCloud,
    resetToDefault,
    hydrated: snapshot.hydrated,
  };
}

export default useUserSettings;
