import React, { useState, useEffect } from 'react';
import type { LibraryCard, LibraryCardType, Language } from '../types';
import { translations, simpleUUID } from '../constants';
import ConfirmationDialog from './ConfirmationDialog';
import { CloseIcon, TrashIcon } from './icons';

interface LibraryCardEditorModalProps {
  card: LibraryCard | null;
  onSave: (card: LibraryCard) => void;
  onDelete: (cardId: string) => void;
  onClose: () => void;
  language: Language;
}

const createNewCard = (): LibraryCard => ({
  id: simpleUUID(),
  name: '',
  type: 'character',
  content: '',
  keywords: [],
  customTypeName: '',
});

const LibraryCardEditorModal: React.FC<LibraryCardEditorModalProps> = ({ card, onSave, onDelete, onClose, language }) => {
  const t = translations[language];
  const [currentCard, setCurrentCard] = useState<LibraryCard>(card ? JSON.parse(JSON.stringify(card)) : createNewCard());
  const [isDirty, setIsDirty] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const originalCard = JSON.stringify(card || createNewCard());
    const newCard = JSON.stringify(currentCard);
    setIsDirty(originalCard !== newCard);
  }, [currentCard, card]);

  const handleClose = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  const handleSave = () => {
    if (currentCard.name.trim() && currentCard.content.trim()) {
      onSave(currentCard);
    }
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };
  
  const handleConfirmDelete = () => {
    if (card) {
      onDelete(card.id);
    }
  }

  const handleKeywordsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const keywords = e.target.value.split(',').map(kw => kw.trim()).filter(Boolean);
    setCurrentCard(prev => ({...prev, keywords}));
  };
  
  const cardTypes: LibraryCardType[] = ['character', 'location', 'item', 'quest', 'setting', 'custom'];
  const typeTranslations: Record<LibraryCardType, string> = {
    character: t.cardTypeCharacter,
    location: t.cardTypeLocation,
    item: t.cardTypeItem,
    quest: t.cardTypeQuest,
    setting: t.cardTypeSetting,
    custom: t.cardTypeCustom,
  };

  return (
    <>
      <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-30 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 rounded-lg shadow-xl w-full max-w-xl my-auto flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
          <header className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-zinc-800 flex justify-between items-center">
            <h2 className="text-xl font-bold font-serif text-gray-800 dark:text-zinc-200">{card ? t.editCard : t.addLibraryCard}</h2>
            <div className="flex items-center gap-2">
              <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700">
                {t.save}
              </button>
              <button onClick={handleClose} className="p-2 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full">
                <CloseIcon className="w-6 h-6" />
              </button>
            </div>
          </header>
          <div className="p-6 space-y-4 overflow-y-auto">
            <div>
              <label htmlFor="card-name" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">{t.cardName}</label>
              <input type="text" id="card-name" value={currentCard.name} onChange={e => setCurrentCard(p => ({...p, name: e.target.value}))} className="w-full p-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label htmlFor="card-type" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">{t.cardType}</label>
              <select id="card-type" value={currentCard.type} onChange={e => setCurrentCard(p => ({...p, type: e.target.value as LibraryCardType}))} className="w-full p-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                {cardTypes.map(type => <option key={type} value={type}>{typeTranslations[type]}</option>)}
              </select>
            </div>
            {currentCard.type === 'custom' && (
                <div className="pt-2">
                    <label htmlFor="card-custom-type-name" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">{t.customTypeName}</label>
                    <input type="text" id="card-custom-type-name" value={currentCard.customTypeName || ''} onChange={e => setCurrentCard(p => ({...p, customTypeName: e.target.value}))} className="w-full p-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                </div>
            )}
            <div>
              <label htmlFor="card-keywords" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">{t.cardKeywords}</label>
              <input type="text" id="card-keywords" value={currentCard.keywords.join(', ')} onChange={handleKeywordsChange} placeholder={t.keywordsPlaceholder} className="w-full p-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label htmlFor="card-content" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">{t.cardContent}</label>
              <textarea id="card-content" value={currentCard.content} onChange={e => setCurrentCard(p => ({...p, content: e.target.value.slice(0, 1000)}))} rows={8} className="w-full p-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              <p className="text-right text-xs text-gray-500 dark:text-zinc-400 mt-1">{t.characterCount}: {currentCard.content.length} / 1000</p>
            </div>
          </div>
          {card && (
              <footer className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-zinc-800 mt-auto">
                 <button onClick={handleDelete} className="flex items-center gap-2 text-sm text-red-600 hover:text-red-800 font-semibold">
                    <TrashIcon className="w-4 h-4" />
                    {t.deleteCard}
                 </button>
              </footer>
          )}
        </div>
      </div>
      <ConfirmationDialog
        isOpen={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        onConfirm={onClose}
        title={t.discardChangesTitle}
        message={t.discardChangesMessage}
        confirmText={t.discard}
        cancelText={t.keepEditing}
      />
      <ConfirmationDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title={t.deleteCardTitle}
        message={t.deleteCardMessage}
        confirmText={t.delete}
        cancelText={t.cancel}
      />
    </>
  );
};

export default LibraryCardEditorModal;