import React, { useState, useEffect } from 'react';
import type { Language, DetectedPlaceholder } from '../types';
import { translations } from '../constants';

const PlaceholderInputModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (names: Record<string, string>) => void;
    placeholders: DetectedPlaceholder[];
    language: Language;
    initialValues?: Record<string, string>;
}> = ({ isOpen, onClose, onSubmit, placeholders, language, initialValues }) => {
    const [values, setValues] = useState<Record<string, string>>({});
    const t = translations[language];

    useEffect(() => {
        if (isOpen) {
            // Initialize state when modal opens
            const newValues: Record<string, string> = {};
            placeholders.forEach(p => {
                // Use initial value if provided, otherwise empty string
                newValues[p.key] = initialValues?.[p.key] || '';
            });
            setValues(newValues);
        }
    }, [isOpen, placeholders, initialValues]);

    if (!isOpen) return null;

    const handleSubmit = () => {
        // Basic validation: ensure no fields are empty
        if (Object.values(values).some(v => v.trim() === '')) {
            // Maybe show an error message, for now just prevent submit
            return;
        }
        onSubmit(values);
    };
    
    const handleInputChange = (key: string, value: string) => {
        setValues(prev => ({ ...prev, [key]: value }));
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            const isLastInput = placeholders[placeholders.length - 1]?.key === e.currentTarget.name;
            if (isLastInput) {
                handleSubmit();
            }
        }
    };

    return (
        <div className="absolute inset-0 bg-black/70 flex justify-center z-[60] backdrop-blur-md overflow-y-auto p-4 md:py-8">
            <div className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 rounded-lg shadow-xl p-6 w-full max-w-md my-auto">
                <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-zinc-200 font-serif">{t.namePlaceholders}</h2>
                <div className="space-y-4">
                    {placeholders.map(({ key, description }) => (
                        <div key={key}>
                            <label htmlFor={`placeholder-${key}`} className="block text-left font-semibold mb-1 text-gray-700 dark:text-zinc-300">{`${description} ({{${key}}})`}</label>
                            <input 
                                id={`placeholder-${key}`} 
                                name={key}
                                value={values[key] || ''} 
                                onChange={e => handleInputChange(key, e.target.value)} 
                                onKeyDown={handleKeyDown}
                                placeholder={t.nameUserPlaceholder}
                                className="w-full p-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                        </div>
                    ))}
                </div>
                <div className="flex justify-end space-x-4 mt-6">
                    <button onClick={onClose} className="px-4 py-2 rounded-md text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700">{t.cancel}</button>
                    <button onClick={handleSubmit} className="px-6 py-2 rounded-md bg-indigo-600 text-white font-bold hover:bg-indigo-700">{t.confirm}</button>
                </div>
            </div>
        </div>
    )
}

export default PlaceholderInputModal;