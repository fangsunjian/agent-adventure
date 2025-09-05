import { supabase } from './supabaseClient';
import type { GameSettings } from '../types';

export interface UserSettings {
  user_id: string;
  settings: GameSettings;
  created_at: string;
  updated_at: string;
}

export class UserSettingsService {
  /**
   * 获取用户设置
   */
  static async getUserSettings(userId: string): Promise<GameSettings | null> {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('settings')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // 没有找到记录，返回null
          return null;
        }
        console.error('Error fetching user settings:', error);
        throw error;
      }

      return data?.settings || null;
    } catch (error) {
      console.error('Error in getUserSettings:', error);
      return null;
    }
  }

  /**
   * 保存用户设置
   */
  static async saveUserSettings(userId: string, settings: GameSettings): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: userId,
          settings: settings,
        }, {
          onConflict: 'user_id',
        });

      if (error) {
        console.error('Error saving user settings:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in saveUserSettings:', error);
      return false;
    }
  }

  /**
   * 更新用户设置的部分字段
   */
  static async updateUserSettings(userId: string, partialSettings: Partial<GameSettings>): Promise<boolean> {
    try {
      // 首先获取现有设置
      const existingSettings = await this.getUserSettings(userId);
      
      if (!existingSettings) {
        // 如果没有现有设置，创建新的设置
        console.warn('No existing settings found for user, creating new settings');
        return false;
      }

      // 合并设置
      const updatedSettings = {
        ...existingSettings,
        ...partialSettings,
      };

      // 保存更新后的设置
      return await this.saveUserSettings(userId, updatedSettings);
    } catch (error) {
      console.error('Error in updateUserSettings:', error);
      return false;
    }
  }

  /**
   * 删除用户设置
   */
  static async deleteUserSettings(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_settings')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('Error deleting user settings:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in deleteUserSettings:', error);
      return false;
    }
  }

  /**
   * 监听用户设置变化（实时订阅）
   */
  static subscribeToUserSettings(
    userId: string, 
    callback: (settings: GameSettings | null) => void
  ): () => void {
    const subscription = supabase
      .channel(`user_settings:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_settings',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new) {
            callback((payload.new as UserSettings).settings);
          } else if (payload.old) {
            callback(null);
          }
        }
      )
      .subscribe();

    // 返回取消订阅函数
    return () => {
      subscription.unsubscribe();
    };
  }
}

export default UserSettingsService;