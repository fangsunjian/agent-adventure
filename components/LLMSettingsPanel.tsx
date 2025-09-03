import React, { useState, useRef } from 'react';
import type { GameSettings, LLMSettings, SystemInstruction } from '../types';
import { CloseIcon, GripVerticalIcon, PlusIcon, TrashIcon } from './icons';
import SystemInstructionEditorModal from './SystemInstructionEditorModal';
import { translations, simpleUUID } from '../constants';

type SliderSetting = 'temperature' | 'topP' | 'topK' | 'frequencyPenalty' | 'presencePenalty';
type GenericSliderSetting = 'dialogueWindowOpacity' | 'bubbleOpacity';

const GameSettingsPanel: React.FC<{
    settings: GameSettings;
    onSettingsChange: (newSettings: GameSettings) => void;
    onClose?: () => void;
}> = ({ settings, onSettingsChange, onClose }) => {
    const t = translations[settings.language];
    const dragItem = useRef<number | null>(null);
    const dragOverItem = useRef<number | null>(null);
    const [editingInstruction, setEditingInstruction] = useState<SystemInstruction | null>(null);

    const handleLLMChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        
        let parsedValue: string | number | boolean;
        if (type === 'number' || type === 'range') {
            parsedValue = parseFloat(value);
        } else if (type === 'checkbox') {
            parsedValue = (e.target as HTMLInputElement).checked;
        } else {
            parsedValue = value;
        }
        
        onSettingsChange({
            ...settings,
            llm: { ...settings.llm, [name]: parsedValue }
        });
    };
    
    const handleGenericChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        onSettingsChange({
            ...settings,
            [name]: parseFloat(value)
        });
    };
    
    const handleBooleanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        onSettingsChange({
            ...settings,
            [name]: checked
        });
    };

    const handleSaveInstruction = (instructionToSave: SystemInstruction) => {
        const index = settings.systemInstructions.findIndex(i => i.id === instructionToSave.id);
        const newInstructions = [...settings.systemInstructions];
        if (index > -1) {
            newInstructions[index] = instructionToSave;
        } else {
            newInstructions.push(instructionToSave);
        }
        onSettingsChange({ ...settings, systemInstructions: newInstructions });
    };

    const addInstruction = () => {
        const newInstruction: SystemInstruction = { id: simpleUUID(), title: '', text: '', enabled: true, role: 'system' };
        setEditingInstruction(newInstruction);
    };

    const removeInstruction = (id: string) => {
        const newInstructions = settings.systemInstructions.filter(instr => instr.id !== id);
        onSettingsChange({ ...settings, systemInstructions: newInstructions });
    };

    const toggleInstruction = (id: string) => {
        const newInstructions = settings.systemInstructions.map(instr =>
            instr.id === id ? { ...instr, enabled: !instr.enabled } : instr
        );
        onSettingsChange({ ...settings, systemInstructions: newInstructions });
    };

    const handleDragSort = () => {
        if (dragItem.current === null || dragOverItem.current === null) return;
        const newInstructions = [...settings.systemInstructions];
        const draggedItemContent = newInstructions.splice(dragItem.current, 1)[0];
        newInstructions.splice(dragOverItem.current, 0, draggedItemContent);
        dragItem.current = null;
        dragOverItem.current = null;
        onSettingsChange({ ...settings, systemInstructions: newInstructions });
    };
    
    const renderLLMSlider = (name: SliderSetting, label: string, min: number, max: number, step: number) => (
        <div>
            <label htmlFor={name} className="block text-sm font-medium text-gray-600 dark:text-zinc-400 flex justify-between">
                <span>{label}</span>
                <span>{settings.llm[name]}</span>
            </label>
            <input
                id={name}
                name={name}
                type="range"
                min={min}
                max={max}
                step={step}
                value={settings.llm[name] ?? min}
                onChange={handleLLMChange}
                className="w-full h-2 bg-gray-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
        </div>
    );
    
    const renderGenericSlider = (name: GenericSliderSetting, label: string, min: number, max: number, step: number) => (
        <div>
            <label htmlFor={name} className="block text-sm font-medium text-gray-600 dark:text-zinc-400 flex justify-between">
                <span>{label}</span>
                <span>{Math.round(settings[name] ?? 100)}%</span>
            </label>
            <input
                id={name}
                name={name}
                type="range"
                min={min}
                max={max}
                step={step}
                value={settings[name] ?? 100}
                onChange={handleGenericChange}
                className="w-full h-2 bg-gray-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
        </div>
    );

    return (
        <>
            <div className="h-full bg-white dark:bg-zinc-900 p-4 flex flex-col gap-6 overflow-y-auto">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold font-serif text-gray-700 dark:text-zinc-300">{t.gameSettings}</h2>
                    {onClose && (
                        <button onClick={onClose} className="p-1 text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 rounded-full">
                            <CloseIcon className="w-6 h-6" />
                        </button>
                    )}
                </div>

                <div>
                    <h3 className="text-lg font-semibold font-serif text-gray-600 dark:text-zinc-400 mb-3">UI Settings</h3>
                    <div className="space-y-4">
                        {renderGenericSlider("dialogueWindowOpacity", t.dialogueWindowOpacity, 0, 100, 5)}
                        {renderGenericSlider("bubbleOpacity", t.dialogueBubbleOpacity, 0, 100, 5)}
                        
                        {/* Dialogue Tools Checkbox */}
                        {settings.provider === 'custom' && (
                            <label htmlFor="enableDialogueTools" className="flex items-center gap-2 cursor-pointer">
                                <input
                                    id="enableDialogueTools"
                                    name="enableDialogueTools"
                                    type="checkbox"
                                    checked={!!settings.enableDialogueTools}
                                    onChange={handleBooleanChange}
                                    className="h-4 w-4 text-indigo-600 bg-gray-200 dark:bg-zinc-700 border-gray-300 dark:border-zinc-600 rounded focus:ring-indigo-500"
                                />
                                <span className="text-sm font-medium text-gray-700 dark:text-zinc-300 select-none">
                                    {settings.language === 'zh' ? '启用对话工具调用' : 'Enable Dialogue Tools'}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-zinc-400">
                                    {settings.language === 'zh' ? '(实验性功能)' : '(Experimental)'}
                                </span>
                            </label>
                        )}
                    </div>
                </div>

                <div className="border-t border-gray-200 dark:border-zinc-700"></div>

                <div>
                    <h3 className="text-lg font-semibold font-serif text-gray-600 dark:text-zinc-400 mb-3">{t.llmSettings}</h3>
                    <div className="space-y-4">
                        {renderLLMSlider("temperature", t.temperature, 0, 2, 0.05)}
                        {renderLLMSlider("topP", t.topP, 0, 1, 0.05)}
                        {settings.provider === 'gemini' && renderLLMSlider("topK", t.topK, 1, 100, 1)}
                        {settings.provider === 'custom' && (
                            <>
                                {renderLLMSlider("frequencyPenalty", t.frequencyPenalty, -2, 2, 0.1)}
                                {renderLLMSlider("presencePenalty", t.presencePenalty, -2, 2, 0.1)}
                            </>
                        )}
                        <div>
                            <label htmlFor="maxOutputTokens" className="block text-sm font-medium text-gray-600 dark:text-zinc-400">{t.maxTokens}</label>
                            <label htmlFor="autoMaxTokens" className="flex items-center gap-2 mt-2 cursor-pointer">
                                <input
                                    id="autoMaxTokens"
                                    name="autoMaxTokens"
                                    type="checkbox"
                                    checked={!!settings.llm.autoMaxTokens}
                                    onChange={handleLLMChange}
                                    className="h-4 w-4 text-indigo-600 bg-gray-200 dark:bg-zinc-700 border-gray-300 dark:border-zinc-600 rounded focus:ring-indigo-500"
                                />
                                <span className="text-sm font-medium text-gray-700 dark:text-zinc-300 select-none">{t.autoMaxTokens}</span>
                            </label>
                            <input
                                type="number"
                                id="maxOutputTokens"
                                name="maxOutputTokens"
                                value={settings.llm.maxOutputTokens || 2048}
                                onChange={handleLLMChange}
                                disabled={!!settings.llm.autoMaxTokens}
                                className="mt-1 block w-full bg-gray-100 dark:bg-zinc-800 border-gray-300 dark:border-zinc-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
                            />
                            {settings.llm.autoMaxTokens && settings.llm.fetchedMaxTokens != null && (
                                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                                    {t.fetchedTokens} {settings.llm.fetchedMaxTokens}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex-grow flex flex-col min-h-0">
                    <h2 className="text-xl font-bold font-serif text-gray-700 dark:text-zinc-300 mb-4 flex-shrink-0">{t.systemInstructions}</h2>
                    <div className="space-y-2 overflow-y-auto flex-grow pr-2">
                        {settings.systemInstructions.map((instr, index) => (
                            <div
                                key={instr.id}
                                className="flex items-center gap-2 group p-2 rounded-md bg-gray-100 dark:bg-zinc-800/50"
                                draggable
                                onDragStart={() => dragItem.current = index}
                                onDragEnter={() => dragOverItem.current = index}
                                onDragEnd={handleDragSort}
                                onDragOver={(e) => e.preventDefault()}
                            >
                                <span className="cursor-grab text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300"><GripVerticalIcon className="w-5 h-5"/></span>
                                <label htmlFor={`instr-toggle-${instr.id}`} className="flex items-center gap-2 flex-grow cursor-pointer overflow-hidden">
                                    <input
                                        id={`instr-toggle-${instr.id}`}
                                        type="checkbox"
                                        checked={instr.enabled}
                                        onChange={() => toggleInstruction(instr.id)}
                                        className="h-4 w-4 text-indigo-600 bg-gray-200 dark:bg-zinc-700 border-gray-300 dark:border-zinc-600 rounded focus:ring-indigo-500 shrink-0"
                                    />
                                    <span className="text-sm truncate text-gray-700 dark:text-zinc-300 select-none" title={instr.title}>{instr.title}</span>
                                </label>
                                <button onClick={() => setEditingInstruction(instr)} className="px-3 py-1 text-xs bg-gray-200 text-gray-700 dark:bg-zinc-700 dark:text-zinc-300 font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-zinc-600">Edit</button>
                                <button onClick={() => removeInstruction(instr.id)} className="p-1 text-gray-400 dark:text-zinc-500 hover:text-red-500">
                                    <TrashIcon className="w-4 h-4"/>
                                </button>
                            </div>
                        ))}
                    </div>
                    <button onClick={addInstruction} className="mt-2 flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 dark:bg-zinc-700 dark:text-zinc-300 font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-zinc-600 transition-colors duration-200 text-sm">
                        <PlusIcon className="w-5 h-5" /> {t.addInstruction}
                    </button>
                </div>
            </div>
            <SystemInstructionEditorModal
                isOpen={!!editingInstruction}
                onClose={() => setEditingInstruction(null)}
                onSave={handleSaveInstruction}
                instruction={editingInstruction}
                language={settings.language}
            />
        </>
    );
};

export default GameSettingsPanel;