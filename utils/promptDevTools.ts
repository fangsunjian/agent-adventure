import { DynamicPromptLoader } from './dynamicPromptLoader';
import { reloadPrompts } from './promptInitializer';

/**
 * Development tools for prompt management
 * Add these to window for browser console access
 */
declare global {
  interface Window {
    promptDevTools: {
      reload: () => Promise<void>;
      status: () => void;
      clear: () => void;
      getPrompt: (language: 'en' | 'zh', filename: string) => Promise<string>;
    };
  }
}

export const promptDevTools = {
  /**
   * Reload all prompts from server
   */
  reload: async (): Promise<void> => {
    console.log('🔄 Manually reloading prompts...');
    await reloadPrompts();
  },

  /**
   * Show cache status
   */
  status: (): void => {
    const status = DynamicPromptLoader.getCacheStatus();
    console.log('📊 Prompt Cache Status:');
    console.log('  Cached:', status.cached);
    console.log('  Loading:', status.loading);
  },

  /**
   * Clear prompt cache
   */
  clear: (): void => {
    DynamicPromptLoader.clearCache();
    console.log('🗑️ Prompt cache cleared');
  },

  /**
   * Get a specific prompt
   */
  getPrompt: async (language: 'en' | 'zh', filename: string): Promise<string> => {
    try {
      const content = await DynamicPromptLoader.loadPrompt(language, filename);
      console.log(`📄 Prompt ${language}/${filename}:`);
      console.log(content);
      return content;
    } catch (error) {
      console.error(`❌ Failed to load prompt ${language}/${filename}:`, error);
      return '';
    }
  }
};

// Make available in browser console for development
if (typeof window !== 'undefined') {
  window.promptDevTools = promptDevTools;
}