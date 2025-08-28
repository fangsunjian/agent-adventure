import React, { useState, useCallback } from 'react';
import type { GameSettings, CustomModel } from '../types';
import { LANGUAGES } from '../types';
import { UploadIcon, DownloadIcon, RefreshCwIcon } from './icons';
import { getCustomAIModels } from '../services/aiService';

interface SettingsModalProps {
  settings: GameSettings;
  onSave: (newSettings: GameSettings) => void;
  onClose: () => void;
  onExport: () => void;
  onImportClick: () => void;
}

const translations = {
    en: {
        title: "Settings",
        provider: "AI Provider",
        customEndpoint: "Custom Endpoint URL",
        customApiKey: "Custom API Key",
        customModel: "Custom Model",
        fetchModels: "Fetch Models",
        loadingModels: "Loading...",
        noModels: "No models found",
        enableImage: "Enable Image Generation",
        language: "Language",
        save: "Save",
        close: "Close",
        importSettings: "Import",
        exportSettings: "Export",
        useJsonSchema: "Use JSON Schema",
        useJsonSchemaDesc: "Enforce JSON output structure (if supported by model)",
        lmStudioCompat: "LM Studio Compatibility Mode",
        lmStudioCompatDesc: "Use a non-standard JSON schema format for LM Studio.",
        uiScale: "UI Scale",
        dialogueWindowOpacity: "Dialogue Window Opacity",
    },
    zh: {
        title: "设置",
        provider: "AI 提供商",
        customEndpoint: "自定义终端 URL",
        customApiKey: "自定义 API 密钥",
        customModel: "自定义模型",
        fetchModels: "获取模型",
        loadingModels: "加载中...",
        noModels: "未找到模型",
        enableImage: "启用图像生成",
        language: "语言",
        save: "保存",
        close: "关闭",
        importSettings: "导入设置",
        exportSettings: "导出设置",
        useJsonSchema: "使用 JSON Schema",
        useJsonSchemaDesc: "强制执行 JSON 输出结构（如果模型支持）",
        lmStudioCompat: "LM Studio 兼容模式",
        lmStudioCompatDesc: "为 LM Studio 使用非标准的 JSON schema 格式。",
        uiScale: "界面缩放",
        dialogueWindowOpacity: "对话窗口透明度",
    }
}

const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onSave, onClose, onExport, onImportClick }) => {
  const [currentSettings, setCurrentSettings] = useState<GameSettings>(settings);
  const [models, setModels] = useState<CustomModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);

  const t = translations[currentSettings.language];

  const handleFetchModels = useCallback(async () => {
    if (currentSettings.provider !== 'custom' || !currentSettings.customEndpoint) {
        setModelError("Please enter a valid endpoint URL.");
        return;
    };
    setIsLoadingModels(true);
    setModelError(null);
    try {
        const modelObjects = await getCustomAIModels(currentSettings.customEndpoint, currentSettings.customApiKey);
        setModels(modelObjects);
        const modelIds = modelObjects.map(m => m.id);
        if (modelIds.length > 0 && !modelIds.includes(currentSettings.customModelId)) {
            setCurrentSettings(prev => ({...prev, customModelId: modelIds[0]}));
        } else if (modelIds.length === 0) {
            setModelError("No models found at this endpoint.");
        }
    } catch (err) {
        setModelError(err instanceof Error ? err.message : 'Failed to load models.');
        setModels([]);
    } finally {
        setIsLoadingModels(false);
    }
  }, [currentSettings.customEndpoint, currentSettings.customApiKey, currentSettings.customModelId]);

  const handleSave = () => {
    onSave(currentSettings);
    onClose();
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value, type } = e.target;
      if (type === 'checkbox') {
          const { checked } = e.target as HTMLInputElement;
          setCurrentSettings(prev => ({...prev, [name]: checked }));
      } else if (type === 'range' || type === 'number') {
          setCurrentSettings(prev => ({...prev, [name]: parseFloat(value) }));
      }
      else {
          setCurrentSettings(prev => ({...prev, [name]: value}));
      }
  }

  return (
    <div className="absolute inset-0 bg-black/70 flex justify-center z-50 backdrop-blur-md overflow-y-auto p-4 md:py-8">
      <div className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 rounded-lg shadow-xl p-6 w-full max-w-md my-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-zinc-200 font-serif">{t.title}</h2>
            <div className="flex items-center gap-2">
                <button onClick={onImportClick} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-200 text-gray-700 dark:bg-zinc-700 dark:text-zinc-300 font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-zinc-600">
                    <UploadIcon className="w-4 h-4" /> {t.importSettings}
                </button>
                <button onClick={onExport} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-200 text-gray-700 dark:bg-zinc-700 dark:text-zinc-300 font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-zinc-600">
                    <DownloadIcon className="w-4 h-4" /> {t.exportSettings}
                </button>
            </div>
        </div>
        
        <div className="space-y-4">
            <div>
                <label htmlFor="language" className="block text-sm font-medium text-gray-600 dark:text-zinc-400">{t.language}</label>
                <select id="language" name="language" value={currentSettings.language} onChange={handleChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-gray-100 dark:bg-zinc-800 border-gray-300 dark:border-zinc-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                    {LANGUAGES.map(lang => (
                        <option key={lang.code} value={lang.code}>{lang.name}</option>
                    ))}
                </select>
            </div>

            <div className="border-t border-gray-200 dark:border-zinc-700 my-4"></div>

             <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-zinc-400 flex justify-between">
                    <span>{t.uiScale}</span>
                    <span>{Math.round(currentSettings.uiScale)}%</span>
                </label>
                <input
                    name="uiScale"
                    type="range"
                    min="80"
                    max="120"
                    step="5"
                    value={currentSettings.uiScale}
                    onChange={handleChange}
                    className="w-full h-2 bg-gray-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 mt-1"
                />
            </div>
            
            <div className="border-t border-gray-200 dark:border-zinc-700 my-4"></div>
            
            <div>
                <label htmlFor="provider" className="block text-sm font-medium text-gray-600 dark:text-zinc-400">{t.provider}</label>
                <select id="provider" name="provider" value={currentSettings.provider} onChange={handleChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-gray-100 dark:bg-zinc-800 border-gray-300 dark:border-zinc-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                    <option value="gemini">Gemini</option>
                    <option value="custom">Custom (OpenAI compatible)</option>
                </select>
            </div>

            {currentSettings.provider === 'custom' && (
                <>
                     <div>
                        <label htmlFor="customEndpoint" className="block text-sm font-medium text-gray-600 dark:text-zinc-400">{t.customEndpoint}</label>
                        <input type="text" id="customEndpoint" name="customEndpoint" value={currentSettings.customEndpoint} onChange={handleChange} className="mt-1 block w-full bg-gray-100 dark:bg-zinc-800 border-gray-300 dark:border-zinc-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
                    </div>
                     <div>
                        <label htmlFor="customApiKey" className="block text-sm font-medium text-gray-600 dark:text-zinc-400">{t.customApiKey}</label>
                        <input type="password" id="customApiKey" name="customApiKey" value={currentSettings.customApiKey} onChange={handleChange} className="mt-1 block w-full bg-gray-100 dark:bg-zinc-800 border-gray-300 dark:border-zinc-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
                    </div>
                    <div>
                        <label htmlFor="customModelId" className="block text-sm font-medium text-gray-600 dark:text-zinc-400">{t.customModel}</label>
                        <div className="mt-1 flex items-center gap-2">
                            <select
                                id="customModelId"
                                name="customModelId"
                                value={currentSettings.customModelId}
                                onChange={handleChange}
                                disabled={isLoadingModels || models.length === 0 && !modelError}
                                className="block w-full pl-3 pr-10 py-2 text-base bg-gray-100 dark:bg-zinc-800 border-gray-300 dark:border-zinc-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md disabled:opacity-50"
                            >
                                {isLoadingModels ? (
                                    <option>{t.loadingModels}</option>
                                ) : models.length > 0 ? (
                                    models.map(model => <option key={model.id} value={model.id}>{model.id}</option>)
                                ) : (
                                    <option>{t.noModels}</option>
                                )}
                            </select>
                            <button onClick={handleFetchModels} disabled={isLoadingModels} className="p-2 bg-gray-200 dark:bg-zinc-700 rounded-md hover:bg-gray-300 dark:hover:bg-zinc-600 disabled:opacity-50" title={t.fetchModels}>
                                {isLoadingModels ? <div className="w-5 h-5 border-2 border-t-2 border-gray-400 dark:border-zinc-600 border-t-indigo-500 rounded-full animate-spin"></div> : <RefreshCwIcon className="w-5 h-5"/>}
                            </button>
                        </div>
                        {modelError && <p className="text-red-500 text-sm mt-1">{modelError}</p>}
                    </div>
                     <div className="pt-2 space-y-2">
                         <div className="flex items-start">
                            <input 
                              type="checkbox" 
                              id="useJsonSchemaForCustom" 
                              name="useJsonSchemaForCustom" 
                              checked={!!currentSettings.useJsonSchemaForCustom} 
                              onChange={handleChange} 
                              className="h-4 w-4 mt-0.5 shrink-0 text-indigo-600 bg-gray-200 dark:bg-zinc-700 border-gray-300 dark:border-zinc-600 rounded focus:ring-indigo-500"
                            />
                            <label htmlFor="useJsonSchemaForCustom" className="ml-3 block text-sm font-medium text-gray-700 dark:text-zinc-300">
                                {t.useJsonSchema}
                                <span className="text-gray-500 block text-xs font-normal">{t.useJsonSchemaDesc}</span>
                            </label>
                        </div>
                        {currentSettings.useJsonSchemaForCustom && (
                            <div className="flex items-start pl-7">
                                <input 
                                  type="checkbox" 
                                  id="lmStudioCompatibleJson" 
                                  name="lmStudioCompatibleJson" 
                                  checked={!!currentSettings.lmStudioCompatibleJson} 
                                  onChange={handleChange} 
                                  className="h-4 w-4 mt-0.5 shrink-0 text-indigo-600 bg-gray-200 dark:bg-zinc-700 border-gray-300 dark:border-zinc-600 rounded focus:ring-indigo-500"
                                />
                                <label htmlFor="lmStudioCompatibleJson" className="ml-3 block text-sm font-medium text-gray-700 dark:text-zinc-300">
                                    {t.lmStudioCompat}
                                    <span className="text-gray-500 block text-xs font-normal">{t.lmStudioCompatDesc}</span>
                                </label>
                            </div>
                        )}
                    </div>
                </>
            )}

            <div className="flex items-center">
                 <input type="checkbox" id="enableImageGeneration" name="enableImageGeneration" checked={currentSettings.enableImageGeneration} onChange={handleChange} className="h-4 w-4 text-indigo-600 bg-gray-200 dark:bg-zinc-700 border-gray-300 dark:border-zinc-600 rounded focus:ring-indigo-500"/>
                 <label htmlFor="enableImageGeneration" className="ml-3 block text-sm font-medium text-gray-700 dark:text-zinc-300">{t.enableImage}</label>
            </div>
        </div>

        <div className="mt-8 flex justify-end space-x-4">
            <button onClick={onClose} className="px-4 py-2 rounded-md text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700">{t.close}</button>
            <button onClick={handleSave} className="px-4 py-2 rounded-md bg-indigo-600 text-white font-bold hover:bg-indigo-700">{t.save}</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;