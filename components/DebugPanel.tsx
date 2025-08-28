import React from 'react';
import type { DebugLogEntry, Language } from '../types';
import { translations } from '../constants';

const DebugPanel: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  log: DebugLogEntry[];
  language: Language;
}> = ({ isOpen, onClose, log, language }) => {
  const t = translations[language];
  if (!isOpen) return null;
  return (
    <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-md">
      <div className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 rounded-lg shadow-xl p-4 w-full max-w-4xl h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold font-serif text-gray-700 dark:text-zinc-300 mb-4 flex-shrink-0">{t.debugLog}</h2>
        <div className="flex-grow overflow-y-auto bg-gray-50 dark:bg-zinc-950 p-4 rounded-md text-sm font-mono border border-gray-200 dark:border-zinc-700">
          {log.map((entry, index) => {
               const isError = entry.type.includes('error');
               const isRequest = entry.type.includes('request');
               const isResponse = entry.type.includes('response');
               const isUser = entry.type.includes('user');
   
               const getTitleColor = () => {
                   if (isError) return 'text-red-500 dark:text-red-400';
                   if (isRequest) return 'text-blue-600 dark:text-blue-400';
                   if (isResponse) return 'text-cyan-600 dark:text-cyan-400';
                   if (isUser) return 'text-lime-600 dark:text-lime-400';
                   return 'text-gray-500 dark:text-zinc-400';
               };

               return (
                <div key={index} className="border-b border-gray-200 dark:border-zinc-700 last:border-b-0 py-3">
                    <div className="flex justify-between items-baseline">
                        <h3 className={`font-bold text-lg mb-1 ${getTitleColor()}`}>{entry.type}</h3>
                        <span className="text-xs text-gray-400 dark:text-zinc-500">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <pre className="whitespace-pre-wrap break-all text-gray-700 dark:text-zinc-300 bg-white dark:bg-zinc-800/50 p-3 rounded-md">
                        <code>
                           {JSON.stringify(entry.data, null, 2)}
                        </code>
                    </pre>
                </div>
               );
          })}
        </div>
        <div className="flex justify-end mt-4 flex-shrink-0">
          <button onClick={onClose} className="px-6 py-2 rounded-md bg-indigo-600 text-white font-bold hover:bg-indigo-700">{t.close}</button>
        </div>
      </div>
    </div>
  );
};

export default DebugPanel;