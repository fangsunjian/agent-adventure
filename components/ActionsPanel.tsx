import React, { useState } from 'react';
import { GameStatus, Language } from '../types';
import { translations } from '../constants';

type ActionMode = 'say' | 'do' | 'happened';

interface ActionsPanelProps {
  actions: string[];
  onAction: (action: string) => void;
  onStop: () => void;
  disabled: boolean;
  gameStatus: GameStatus;
  userName: string;
  language: Language;
}

const ActionsPanel: React.FC<ActionsPanelProps> = ({ actions, onAction, onStop, disabled, gameStatus, userName, language }) => {
  const [customAction, setCustomAction] = useState('');
  const [mode, setMode] = useState<ActionMode>('do');
  const isLoading = gameStatus === GameStatus.Loading;
  const t = translations[language];

  const handleCustomActionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customAction.trim() && !isLoading && !disabled) {
      let formattedAction = customAction.trim();
      const user = userName || (language === 'zh' ? '我' : 'I');
      
      if (mode === 'say') {
          formattedAction = t.sayActionFormat.replace('{user}', user).replace('{action}', formattedAction);
      } else if (mode === 'do') {
          formattedAction = `${user} ${formattedAction}`;
      }
      // 'happened' mode sends the text as is

      onAction(formattedAction);
      setCustomAction('');
    }
  };

  const placeholders: Record<Language, Record<ActionMode, string>> = {
    en: {
      say: t.placeholderSay,
      do: t.placeholderDo,
      happened: t.placeholderHappened,
    },
    zh: {
      say: t.placeholderSay,
      do: t.placeholderDo,
      happened: t.placeholderHappened,
    },
  };

  const ModeButton: React.FC<{ label: string, targetMode: ActionMode }> = ({ label, targetMode }) => (
    <button
      type="button"
      onClick={() => setMode(targetMode)}
      disabled={isLoading}
      className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors duration-200 disabled:opacity-50
        ${mode === targetMode
          ? 'bg-indigo-600 text-white'
          : 'bg-gray-200 text-gray-700 dark:bg-zinc-700 dark:text-zinc-300 hover:bg-gray-300 dark:hover:bg-zinc-600'
        }`}
    >
      {label}
    </button>
  );

  return (
    <div 
      className="h-full flex flex-col p-4 space-y-3 bg-white/[var(--game-panel-bg-opacity-light)] dark:bg-zinc-900/[var(--game-panel-bg-opacity-dark)] rounded-lg border border-gray-200 dark:border-zinc-800"
    >
      <div className="flex-grow space-y-2 overflow-y-auto pr-2">
        {actions.map((action, index) => (
          <button
            key={index}
            onClick={() => onAction(action)}
            disabled={isLoading || disabled}
            className="w-full text-left px-4 py-2.5 bg-white text-gray-800 font-semibold rounded-md border border-gray-300 hover:bg-indigo-500 hover:border-indigo-600 hover:text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:border-gray-300 disabled:text-gray-500 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700 dark:hover:bg-indigo-600 dark:hover:border-indigo-500 dark:hover:text-white dark:disabled:bg-zinc-800 dark:disabled:border-zinc-700 dark:disabled:text-zinc-500"
          >
            {action}
          </button>
        ))}
      </div>
      
      {isLoading && actions.length === 0 && (
        <div className="flex-grow flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-gray-500">
                <div className="w-8 h-8 border-2 border-t-2 border-gray-400 dark:border-zinc-600 border-t-indigo-500 rounded-full animate-spin"></div>
                <p>{t.awaitingNextChapter}</p>
            </div>
        </div>
      )}

      {disabled && (
         <div className="flex-grow flex items-center justify-center text-center text-gray-500 font-serif">
            <div>
              <p className="text-lg">Your adventure awaits.</p>
              <p>Start a new game to begin.</p>
            </div>
        </div>
      )}

      <form onSubmit={handleCustomActionSubmit} className="mt-auto flex-shrink-0 flex flex-col">
        <div className="flex items-center gap-4 mb-2">
            <span className="text-sm font-semibold text-gray-600 dark:text-zinc-400">{t.actionsHeaderNext}</span>
            <div className="flex items-center gap-2">
                <ModeButton label={t.actionSay} targetMode="say" />
                <ModeButton label={t.actionDo} targetMode="do" />
                <ModeButton label={t.actionHappened} targetMode="happened" />
            </div>
        </div>

        <div className="flex gap-2">
            <textarea
                id="custom-action-input"
                value={customAction}
                onChange={(e) => setCustomAction(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleCustomActionSubmit(e);
                    }
                }}
                disabled={isLoading || disabled}
                placeholder={placeholders[language][mode]}
                rows={2}
                className="flex-grow p-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-50"
            />
            {isLoading ? (
              <button type="button" onClick={onStop} className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg shadow-md hover:bg-red-700 transition-colors duration-300">
                {t.stop}
              </button>
            ) : (
              <button type="submit" disabled={disabled} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg shadow-md hover:bg-indigo-700 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed">
                {t.send}
              </button>
            )}
        </div>
      </form>
    </div>
  );
};

export default ActionsPanel;