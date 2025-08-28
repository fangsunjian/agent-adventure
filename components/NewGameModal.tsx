import React, { useState, useEffect } from 'react';
import type { Language, PendingGameConfig, DetectedPlaceholders } from '../types';
import { translations, DEFAULT_PROMPTS } from '../constants';


const NewGameModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onStart: (config: PendingGameConfig, placeholders: DetectedPlaceholders) => void;
  language: Language;
  initialBackground: string;
  initialCharacter: string;
  initialOpeningMonologue: string;
  initialOpeningAction: string;
}> = ({ isOpen, onClose, onStart, language, initialBackground, initialCharacter, initialOpeningMonologue, initialOpeningAction }) => {
  const [background, setBackground] = useState(initialBackground);
  const [character, setCharacter] = useState(initialCharacter);
  const [openingMonologue, setOpeningMonologue] = useState(initialOpeningMonologue);
  const [openingAction, setOpeningAction] = useState(initialOpeningAction);
  const t = translations[language];

  useEffect(() => {
    if (isOpen) {
      setBackground(initialBackground);
      setCharacter(initialCharacter);
      setOpeningMonologue(initialOpeningMonologue);
      setOpeningAction(initialOpeningAction);
    }
  }, [isOpen, initialBackground, initialCharacter, initialOpeningMonologue, initialOpeningAction]);

  if (!isOpen) return null;

  const handleStart = () => {
    const combinedText = `${background} ${character} ${openingMonologue} ${openingAction}`;
    const placeholders: DetectedPlaceholders = [];
    if (combinedText.includes('{{user}}')) placeholders.push('user');
    if (combinedText.includes('{{char}}')) placeholders.push('char');
    onStart({ background, character, openingMonologue, openingAction }, placeholders);
  };

  const handleReset = () => {
    setBackground(DEFAULT_PROMPTS[language].background);
    setCharacter(DEFAULT_PROMPTS[language].character);
    setOpeningMonologue(DEFAULT_PROMPTS[language].openingMonologue);
    setOpeningAction(DEFAULT_PROMPTS[language].openingAction);
  };

  return (
    <div className="absolute inset-0 bg-black/70 flex justify-center z-50 backdrop-blur-md overflow-y-auto p-4 md:py-8">
      <div className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 rounded-lg shadow-xl p-6 w-full max-w-2xl my-auto">
        <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-zinc-200 font-serif">{t.startNewGame}</h2>
        <div className="space-y-4">
            <div>
                <label htmlFor="background" className="block text-left font-semibold mb-1 text-gray-700 dark:text-zinc-300">{t.backgroundLabel}</label>
                <textarea id="background" value={background} onChange={e => setBackground(e.target.value)} rows={3} placeholder={t.backgroundPlaceholder} className="w-full p-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"/>
            </div>
            <div>
                <label htmlFor="character" className="block text-left font-semibold mb-1 text-gray-700 dark:text-zinc-300">{t.characterLabel}</label>
                <textarea id="character" value={character} onChange={e => setCharacter(e.target.value)} rows={3} placeholder={t.characterPlaceholder} className="w-full p-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"/>
            </div>
            <div>
                <label htmlFor="openingMonologue" className="block text-left font-semibold mb-1 text-gray-700 dark:text-zinc-300">{t.openingMonologueLabel}</label>
                <textarea id="openingMonologue" value={openingMonologue} onChange={e => setOpeningMonologue(e.target.value)} rows={3} placeholder={t.openingMonologuePlaceholder} className="w-full p-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"/>
            </div>
            <div>
                <label htmlFor="openingAction" className="block text-left font-semibold mb-1 text-gray-700 dark:text-zinc-300">{t.openingActionLabel}</label>
                <textarea id="openingAction" value={openingAction} onChange={e => setOpeningAction(e.target.value)} rows={2} placeholder={t.openingActionPlaceholder} className="w-full p-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"/>
            </div>
        </div>
        <div className="flex justify-between items-center mt-6">
            <button onClick={handleReset} className="px-4 py-2 rounded-md text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors">{t.resetToDefaults}</button>
            <div className="flex justify-end space-x-4">
                <button onClick={onClose} className="px-4 py-2 rounded-md text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700">{t.close}</button>
                <button onClick={handleStart} className="px-6 py-2 rounded-md bg-indigo-600 text-white font-bold hover:bg-indigo-700">{t.startAdventure}</button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default NewGameModal;