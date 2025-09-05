/**
 * Dynamic prompt loader using fetch API
 * Allows runtime modification of prompts without rebuilding
 */
export class DynamicPromptLoader {
  private static promptCache: Map<string, string> = new Map();
  private static loadingPromises: Map<string, Promise<string>> = new Map();

  /**
   * Load a prompt file content using fetch API
   */
  static async loadPrompt(language: 'en' | 'zh', filename: string): Promise<string> {
    const cacheKey = `${language}-${filename}`;
    
    // Return cached version if available
    if (this.promptCache.has(cacheKey)) {
      return this.promptCache.get(cacheKey)!;
    }

    // Return existing promise if already loading
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey)!;
    }

    // Create new loading promise
    const loadingPromise = this.fetchPrompt(language, filename, cacheKey);
    this.loadingPromises.set(cacheKey, loadingPromise);

    try {
      const content = await loadingPromise;
      this.promptCache.set(cacheKey, content);
      return content;
    } finally {
      this.loadingPromises.delete(cacheKey);
    }
  }

  private static async fetchPrompt(language: 'en' | 'zh', filename: string, cacheKey: string): Promise<string> {
    try {
      const promptPath = `/prompts/${language}/${filename}.txt`;
      const response = await fetch(promptPath);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch prompt: ${response.status} ${response.statusText}`);
      }
      
      const content = await response.text();
      console.log(`✓ Loaded prompt: ${cacheKey}`);
      return content;
    } catch (error) {
      console.error(`Failed to load prompt ${cacheKey}:`, error);
      // Fallback to static prompts from index.ts
      return this.getFallbackPrompt(language, filename);
    }
  }

  /**
   * Fallback to static prompts if fetch fails
   */
  private static getFallbackPrompt(language: 'en' | 'zh', filename: string): string {
    // Import static prompts as fallback
    try {
      const { PROMPTS } = require('../prompts');
      if (filename === 'base-system-instruction') {
        return PROMPTS[language].baseSystemInstruction;
      } else if (filename === 'dialogue-tool-description') {
        return PROMPTS[language].dialogueToolDescription;
      }
    } catch (error) {
      console.error('Fallback prompts also failed:', error);
    }
    return ''; // Ultimate fallback
  }

  /**
   * Get the base system instruction for the specified language
   */
  static async getBaseSystemInstruction(language: 'en' | 'zh'): Promise<string> {
    return this.loadPrompt(language, 'base-system-instruction');
  }

  /**
   * Get the dialogue tool description for the specified language
   */
  static async getDialogueToolDescription(language: 'en' | 'zh'): Promise<string> {
    return this.loadPrompt(language, 'dialogue-tool-description');
  }

  /**
   * Synchronous getter for base system instruction (requires preloading)
   */
  static getBaseSystemInstructionSync(language: 'en' | 'zh'): string {
    const cacheKey = `${language}-base-system-instruction`;
    return this.promptCache.get(cacheKey) || '';
  }

  /**
   * Synchronous getter for dialogue tool description (requires preloading)
   */
  static getDialogueToolDescriptionSync(language: 'en' | 'zh'): string {
    const cacheKey = `${language}-dialogue-tool-description`;
    return this.promptCache.get(cacheKey) || '';
  }

  /**
   * Preload all prompts for both languages
   */
  static async preloadAllPrompts(): Promise<void> {
    const languages: ('en' | 'zh')[] = ['en', 'zh'];
    const filenames = ['base-system-instruction', 'dialogue-tool-description'];
    
    const promises = languages.flatMap(lang => 
      filenames.map(filename => this.loadPrompt(lang, filename))
    );

    try {
      await Promise.all(promises);
      console.log('✓ All prompts preloaded successfully');
    } catch (error) {
      console.error('Some prompts failed to preload:', error);
    }
  }

  /**
   * Clear the prompt cache (useful for development/testing)
   */
  static clearCache(): void {
    this.promptCache.clear();
    console.log('✓ Prompt cache cleared');
  }

  /**
   * Reload a specific prompt (bypasses cache)
   */
  static async reloadPrompt(language: 'en' | 'zh', filename: string): Promise<string> {
    const cacheKey = `${language}-${filename}`;
    this.promptCache.delete(cacheKey);
    return this.loadPrompt(language, filename);
  }

  /**
   * Get cache status for debugging
   */
  static getCacheStatus(): { cached: string[]; loading: string[] } {
    return {
      cached: Array.from(this.promptCache.keys()),
      loading: Array.from(this.loadingPromises.keys())
    };
  }
}