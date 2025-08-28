import React, { useState, useEffect } from 'react';
import type { SystemInstruction, Language, SystemInstructionRole } from '../types';
import { translations } from '../constants';


const SystemInstructionEditorModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (instruction: SystemInstruction) => void;
    instruction: SystemInstruction | null;
    language: Language;
}> = ({ isOpen, onClose, onSave, instruction, language }) => {
    const [currentInstruction, setCurrentInstruction] = useState<SystemInstruction | null>(null);
    const t = translations[language];

    useEffect(() => {
        if (instruction) {
            setCurrentInstruction({...instruction});
        }
    }, [instruction]);

    if (!isOpen || !currentInstruction) return null;

    const handleSave = () => {
        if (currentInstruction.title.trim()) {
            onSave(currentInstruction);
            onClose();
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setCurrentInstruction(prev => {
            if (!prev) return null;
            if (name === 'role') {
                return { ...prev, role: value as SystemInstructionRole };
            }
            return {...prev, [name]: value};
        });
    };

    return (
        <div className="absolute inset-0 bg-black/70 flex justify-center z-[60] backdrop-blur-md overflow-y-auto p-4 md:py-8">
            <div className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 rounded-lg shadow-xl p-6 w-full max-w-xl my-auto">
                <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-zinc-200 font-serif">{t.editInstruction}</h2>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="title" className="block text-left font-semibold mb-1 text-gray-700 dark:text-zinc-300">{t.instructionTitle}</label>
                        <input id="title" name="title" value={currentInstruction.title} onChange={handleChange} placeholder={t.instructionTitlePlaceholder} className="w-full p-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"/>
                    </div>
                    <div>
                        <label htmlFor="role" className="block text-left font-semibold mb-1 text-gray-700 dark:text-zinc-300">{t.instructionRole}</label>
                         <select 
                            id="role"
                            name="role"
                            value={currentInstruction.role}
                            onChange={handleChange}
                            className="w-full p-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        >
                            <option value="system">System</option>
                            <option value="user">User</option>
                            <option value="assistant">Assistant</option>
                        </select>
                    </div>
                     <div>
                        <label htmlFor="text" className="block text-left font-semibold mb-1 text-gray-700 dark:text-zinc-300">{t.instructionPrompt}</label>
                        <textarea id="text" name="text" value={currentInstruction.text} onChange={handleChange} rows={5} className="w-full p-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"/>
                    </div>
                </div>
                <div className="flex justify-end space-x-4 mt-6">
                    <button onClick={onClose} className="px-4 py-2 rounded-md text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700">{t.cancel}</button>
                    <button onClick={handleSave} className="px-6 py-2 rounded-md bg-indigo-600 text-white font-bold hover:bg-indigo-700">{t.save}</button>
                </div>
            </div>
        </div>
    )
}

export default SystemInstructionEditorModal;