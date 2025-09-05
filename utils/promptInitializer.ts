import { DynamicPromptLoader } from './dynamicPromptLoader';

/**
 * Initialize the prompt system by preloading all prompts
 */
export async function initializePrompts(): Promise<void> {
  console.log('🔄 Initializing dynamic prompt system...');
  
  try {
    // Preload all prompts
    await DynamicPromptLoader.preloadAllPrompts();
    
    // Verify cache status
    const status = DynamicPromptLoader.getCacheStatus();
    console.log('✅ Dynamic prompts initialized successfully');
    console.log(`📄 Cached prompts: ${status.cached.length}`);
    
    if (status.cached.length === 0) {
      console.warn('⚠️  No prompts were cached. Falling back to static prompts.');
    }
    
  } catch (error) {
    console.error('❌ Failed to initialize dynamic prompts:', error);
    console.log('🔄 Falling back to static prompts from index.ts');
  }
}

/**
 * Reload prompts at runtime (for development)
 */
export async function reloadPrompts(): Promise<void> {
  console.log('🔄 Reloading prompts...');
  
  try {
    DynamicPromptLoader.clearCache();
    await DynamicPromptLoader.preloadAllPrompts();
    console.log('✅ Prompts reloaded successfully');
  } catch (error) {
    console.error('❌ Failed to reload prompts:', error);
  }
}