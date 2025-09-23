import React, { useState, useEffect, useRef } from 'react';
import type { Story, LibraryCard, LibraryCardType, Language } from '../../types';
import { translations, simpleUUID } from '../../constants';
import { CloseIcon, PlusIcon, UploadIcon, DownloadIcon, SaveIcon, TrashIcon } from '../../components/icons';
import ConfirmationDialog from '../../components/ConfirmationDialog';
import LibraryCardEditorModal from '../../components/LibraryCardEditorModal';
import { useUserSettings } from '../../hooks/useUserSettings';
import { useAuth } from '../../contexts/AuthContext';
import { useSaveStory, useStory } from '../hooks/useStories';
import { useNavigate, useSearchParams } from 'react-router-dom';

// No props needed - everything handled via hooks

type CreateTab = 'basic' | 'library' | 'plot';
type SidebarSelection = 'basic' | 'library' | { type: 'card', cardId: string };

const createNewStory = (): Story => ({
    id: simpleUUID(),
    creatorId: '',
    creatorName: 'You', // This would come from user auth in a real app
    title: '',
    description: '',
    coverImageUrl: `https://placehold.co/400x400/1e293b/ffffff/png?text=New%0AStory`,
    visibility: 'private',
    category: '',
    library: [],
    backgroundSetting: '',
    openingMonologue: '',
    openingAction: '',
    openingSpeaker: 'narrator',
});

const createNewCard = (): LibraryCard => ({
  id: simpleUUID(),
  name: '',
  type: 'character',
  content: '',
  keywords: [],
  customTypeName: '',
});

const TabButton: React.FC<{label: string, isActive: boolean, onClick: () => void}> = ({ label, isActive, onClick }) => {
    return (
        <button onClick={onClick} className={`py-3 font-semibold border-b-2 transition-colors ${isActive ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-200'}`}>
            {label}
        </button>
    )
}

const CreatePage: React.FC = () => {
    const { settings } = useUserSettings();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const saveStoryMutation = useSaveStory();

    const editId = searchParams.get('edit');
    const { data: storyToEdit, isLoading: storyLoading } = useStory(editId);

    const t = translations[settings?.language || 'zh'];
    const [activeTab, setActiveTab] = useState<CreateTab>('basic');
    const [story, setStory] = useState<Story>(createNewStory);
    const [isDirty, setIsDirty] = useState(false);
    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
    const [showPublishError, setShowPublishError] = useState(false);
    const [editingCard, setEditingCard] = useState<LibraryCard | null>(null);

    // Desktop sidebar states
    const [isDesktop, setIsDesktop] = useState(false);
    const [sidebarSelection, setSidebarSelection] = useState<SidebarSelection>('basic');
    const [showAddCardModal, setShowAddCardModal] = useState(false);
    const [cardDirtyStates, setCardDirtyStates] = useState<Record<string, boolean>>({});

    // CHECK: 1024px 作为桌面版断点是否合适
    useEffect(() => {
        const checkIsDesktop = () => {
            setIsDesktop(window.innerWidth >= 1024);
        };

        checkIsDesktop();
        window.addEventListener('resize', checkIsDesktop);
        return () => window.removeEventListener('resize', checkIsDesktop);
    }, []);

    // Load story data when editing
    useEffect(() => {
        if (storyToEdit && editId) {
            console.log('📝 Loading story for editing:', storyToEdit.title);
            setStory(JSON.parse(JSON.stringify(storyToEdit)));
        }
    }, [storyToEdit, editId]);

    // Initialize story with user info
    useEffect(() => {
        if (user && story.creatorId === '') {
            setStory(prev => ({
                ...prev,
                creatorId: user.id,
                creatorName: user.email || 'Unknown User'
            }));
        }
    }, [user, story.creatorId]);
    
    const formRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const originalStory = JSON.stringify(storyToEdit || createNewStory());
        const currentStory = JSON.stringify(story);
        setIsDirty(originalStory !== currentStory);
    }, [story, storyToEdit]);
    
    const handleAttemptClose = () => {
        if (isDirty) {
            setShowDiscardConfirm(true);
        } else {
            navigate('/profile');
        }
    };

    const handlePublish = async () => {
        if (!story.title || !story.description || !story.openingMonologue) {
            setShowPublishError(true);
            return;
        }

        try {
            await saveStoryMutation.mutateAsync(story);
            navigate('/profile');
        } catch (error) {
            console.error('Failed to save story:', error);
            setShowPublishError(true);
        }
    };

    const handleExport = () => {
        const dataStr = JSON.stringify(story, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.download = `${story.title.replace(/ /g, '_') || 'untitled-story'}.json`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const result = event.target?.result;
                if (typeof result === 'string') {
                    const importedStory = JSON.parse(result) as Story;
                    // Basic validation
                    if (importedStory.id && importedStory.title !== undefined && Array.isArray(importedStory.library)) {
                        setStory(importedStory);
                    } else {
                        alert('Invalid story file format.');
                    }
                }
            } catch (error) {
                console.error('Error importing story:', error);
                alert('Failed to import story file.');
            }
        };
        reader.readAsText(file);
        if (e.target) e.target.value = ''; 
    };
    
    const handleSaveCard = (cardToSave: LibraryCard) => {
        setStory(prev => {
            const cardIndex = prev.library.findIndex(c => c.id === cardToSave.id);
            const newLibrary = [...prev.library];
            if (cardIndex > -1) {
                newLibrary[cardIndex] = cardToSave;
            } else {
                newLibrary.push(cardToSave);
            }
            return { ...prev, library: newLibrary };
        });
        setEditingCard(null);
    };
    
    const handleDeleteCard = (cardId: string) => {
        setStory(prev => ({ ...prev, library: prev.library.filter(c => c.id !== cardId) }));
        setEditingCard(null);
        // If we're on desktop and this card was selected, switch to basic info
        if (isDesktop && typeof sidebarSelection === 'object' && sidebarSelection.cardId === cardId) {
            setSidebarSelection('basic');
        }
        // Remove dirty state for deleted card
        setCardDirtyStates(prev => {
            const newStates = { ...prev };
            delete newStates[cardId];
            return newStates;
        });
    };

    // Desktop-specific handlers
    const handleAddCard = (name: string, type: LibraryCardType) => {
        const newCard = {
            ...createNewCard(),
            name,
            type
        };
        setStory(prev => ({
            ...prev,
            library: [...prev.library, newCard]
        }));
        setShowAddCardModal(false);

        // Switch to edit the new card on desktop
        if (isDesktop) {
            setSidebarSelection({ type: 'card', cardId: newCard.id });
        } else {
            setEditingCard(newCard);
        }
    };

    const handleCardSelect = (cardId: string) => {
        if (isDesktop) {
            setSidebarSelection({ type: 'card', cardId });
        } else {
            const card = story.library.find(c => c.id === cardId);
            if (card) {
                setEditingCard(card);
            }
        }
    };

    const markCardDirty = (cardId: string, isDirty: boolean) => {
        setCardDirtyStates(prev => {
            if (prev[cardId] === isDirty) return prev;
            return {
                ...prev,
                [cardId]: isDirty
            };
        });
    };

    // Add Card Modal Component
    const AddCardModal: React.FC<{
        isOpen: boolean;
        onSave: (name: string, type: LibraryCardType) => void;
        onClose: () => void;
    }> = ({ isOpen, onSave, onClose }) => {
        const [cardName, setCardName] = useState('');
        const [cardType, setCardType] = useState<LibraryCardType>('character');

        useEffect(() => {
            if (isOpen) {
                setCardName('');
                setCardType('character');
            }
        }, [isOpen]);

        const handleSave = () => {
            if (cardName.trim()) {
                onSave(cardName.trim(), cardType);
            }
        };

        const handleKeyDown = (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSave();
            } else if (e.key === 'Escape') {
                onClose();
            }
        };

        if (!isOpen) return null;

        const cardTypes: LibraryCardType[] = ['character', 'location', 'item', 'quest', 'setting', 'custom', 'map', 'html'];
        const typeTranslations: Record<LibraryCardType, string> = {
            character: t.cardTypeCharacter,
            location: t.cardTypeLocation,
            item: t.cardTypeItem,
            quest: t.cardTypeQuest,
            setting: t.cardTypeSetting,
            custom: t.cardTypeCustom,
            map: t.cardTypeMap,
            html: t.cardTypeHtml,
        };

        return (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-40 backdrop-blur-sm p-4">
                <div className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                    <header className="p-4 border-b border-gray-200 dark:border-zinc-800 flex justify-between items-center">
                        <h3 className="text-lg font-bold font-serif text-gray-800 dark:text-zinc-200">
                            {t.addLibraryCard}
                        </h3>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full"
                        >
                            <CloseIcon className="w-5 h-5" />
                        </button>
                    </header>
                    <div className="p-4 space-y-4">
                        <div>
                            <label htmlFor="add-card-name" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                                {t.cardName}
                            </label>
                            <input
                                type="text"
                                id="add-card-name"
                                value={cardName}
                                onChange={(e) => setCardName(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={t.cardName}
                                className="w-full p-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                autoFocus
                            />
                        </div>
                        <div>
                            <label htmlFor="add-card-type" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                                {t.cardType}
                            </label>
                            <select
                                id="add-card-type"
                                value={cardType}
                                onChange={(e) => setCardType(e.target.value as LibraryCardType)}
                                onKeyDown={handleKeyDown}
                                className="w-full p-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            >
                                {cardTypes.map(type => (
                                    <option key={type} value={type}>
                                        {typeTranslations[type]}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <footer className="p-4 border-t border-gray-200 dark:border-zinc-800 flex justify-end gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md"
                        >
                            {t.cancel}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!cardName.trim()}
                            className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {t.save}
                        </button>
                    </footer>
                </div>
            </div>
        );
    };

    // Universal Inline Editor - wraps existing LibraryCardEditorModal
    const UniversalInlineEditor: React.FC<{
        card: LibraryCard;
        onSave: (card: LibraryCard) => void;
        onDelete: (cardId: string) => void;
        language: Language;
    }> = ({ card, onSave, onDelete, language }) => {
        return (
            <div className="relative bg-transparent">
                {/* Hide the modal overlay and use inline styling */}
                <style>{`
                    /* Ultra-precise targeting: Only affect the main modal overlay */
                    .inline-editor-wrapper > div[class~="absolute"][class~="inset-0"][class~="bg-black/70"][class~="z-30"] {
                        position: relative !important;
                        background: transparent !important;
                        backdrop-filter: none !important;
                        padding: 0 !important;
                        display: block !important;
                        z-index: auto !important;
                    }

                    /* Target the main modal content container */
                    .inline-editor-wrapper > div[class~="absolute"][class~="inset-0"][class~="bg-black/70"][class~="z-30"] > div[class~="bg-white"] {
                        box-shadow: none !important;
                        border: none !important;
                        border-radius: 0 !important;
                        max-width: none !important;
                        width: 100% !important;
                        height: auto !important;
                        max-height: none !important;
                        margin: 0 !important;
                    }

                    /* Hide the main modal header */
                    .inline-editor-wrapper > div[class~="absolute"][class~="inset-0"][class~="bg-black/70"][class~="z-30"] > div[class~="bg-white"] > header:first-child {
                        display: none !important;
                    }

                    /* CRITICAL: Ensure nested modals (z-40) are completely unaffected and display properly */
                    .inline-editor-wrapper div[class~="absolute"][class~="inset-0"][class~="bg-black/70"][class~="z-40"] {
                        position: absolute !important;
                        background: rgba(0, 0, 0, 0.7) !important;
                        backdrop-filter: blur(4px) !important;
                        z-index: 40 !important;
                        display: flex !important;
                        align-items: center !important;
                        justify-content: center !important;
                        inset: 0 !important;
                    }
                `}</style>

                <div className="inline-editor-wrapper">
                    <LibraryCardEditorModal
                        card={card}
                        onSave={(updatedCard) => {
                            onSave(updatedCard);
                            markCardDirty(card.id, false);
                        }}
                        onDelete={() => onDelete(card.id)}
                        onClose={() => {}} // No close needed for inline editor
                        language={language}
                        onChange={(updatedCard) => {
                            markCardDirty(card.id, true);
                        }}
                    />
                </div>
            </div>
        );
    };

    // Desktop Sidebar Component
    const renderSidebar = () => {
        const typeTranslations: Record<string, string> = {
            character: t.cardTypeCharacter,
            location: t.cardTypeLocation,
            item: t.cardTypeItem,
            quest: t.cardTypeQuest,
            setting: t.cardTypeSetting,
            custom: t.cardTypeCustom,
            map: t.cardTypeMap,
            html: t.cardTypeHtml,
        };

        return (
            <div className="w-80 bg-white dark:bg-zinc-900 border-r border-gray-300 dark:border-zinc-700 flex flex-col h-full">
                {/* Header */}
                <header className="p-4 border-b border-gray-200 dark:border-zinc-800">
                    <h2 className="text-lg font-bold font-serif text-gray-800 dark:text-zinc-200 mb-3">
                        {storyToEdit ? t.editTitle : t.createTitle}
                    </h2>
                    <div className="flex items-center gap-2 flex-wrap">
                        <input type="file" ref={fileInputRef} onChange={handleFileImport} style={{ display: 'none' }} accept=".json" />
                        <button
                            onClick={handleImportClick}
                            title={t.import}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-200 text-gray-700 dark:bg-zinc-700 dark:text-zinc-300 font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-zinc-600"
                        >
                            <UploadIcon className="w-3 h-3" /> {t.import}
                        </button>
                        <button
                            onClick={handleExport}
                            title={t.export}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-200 text-gray-700 dark:bg-zinc-700 dark:text-zinc-300 font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-zinc-600"
                        >
                            <DownloadIcon className="w-3 h-3" /> {t.export}
                        </button>
                        <button
                            onClick={handlePublish}
                            className="px-2 py-1 text-xs bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700"
                        >
                            {t.publish}
                        </button>
                        <button
                            onClick={handleAttemptClose}
                            className="p-1 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full"
                        >
                            <CloseIcon className="w-4 h-4" />
                        </button>
                    </div>
                </header>

                {/* Navigation Groups */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Basic Info Group */}
                    <div>
                        <button
                            onClick={() => setSidebarSelection('basic')}
                            className={`w-full text-left p-3 rounded-lg font-medium transition-colors ${
                                sidebarSelection === 'basic'
                                    ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300'
                                    : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
                            }`}
                        >
                            {t.tabBasicInfo}
                        </button>
                    </div>

                    {/* Library Group */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-600 dark:text-zinc-400">
                                {t.tabLibrary}
                            </span>
                            <button
                                onClick={() => setShowAddCardModal(true)}
                                className="p-1 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900 rounded"
                                title={t.addLibraryCard}
                            >
                                <PlusIcon className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="space-y-1 max-h-64 overflow-y-auto">
                            {story.library.map(card => {
                                const isSelected = typeof sidebarSelection === 'object' && sidebarSelection.cardId === card.id;
                                const isDirty = cardDirtyStates[card.id];

                                return (
                                    <div
                                        key={card.id}
                                        className={`group flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                                            isSelected
                                                ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300'
                                                : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
                                        }`}
                                        onClick={() => handleCardSelect(card.id)}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1">
                                                <span className="text-sm font-medium truncate">
                                                    {card.name || t.unnamedCard}
                                                </span>
                                                {isDirty && (
                                                    <span className="text-orange-500 text-xs">*</span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">
                                                {card.type === 'custom' ? card.customTypeName : (typeTranslations[card.type] || card.type)}
                                            </p>
                                        </div>

                                        {/* Action buttons - show on hover or when selected */}
                                        <div className={`flex gap-1 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSaveCard(card);
                                                }}
                                                className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900 rounded text-xs"
                                                title={t.save}
                                                disabled={!isDirty}
                                            >
                                                <SaveIcon className="w-3 h-3" />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteCard(card.id);
                                                }}
                                                className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded text-xs"
                                                title={t.delete}
                                            >
                                                <TrashIcon className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                            {story.library.length === 0 && (
                                <p className="text-sm text-gray-500 dark:text-zinc-400 italic p-2">
                                    {t.noCardsYet || 'No cards added yet'}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Desktop Content Area Component
    const renderDesktopContent = () => {
        if (sidebarSelection === 'basic') {
            // Show combined basic info + plot settings
            return (
                <div className="p-6 space-y-6 overflow-y-auto">
                    <section>
                        <h3 className="text-lg font-semibold mb-4">{t.tabBasicInfo}</h3>
                        {renderBasicInfoTab()}
                    </section>
                    <section>
                        <h3 className="text-lg font-semibold mb-4">{t.tabPlotSettings}</h3>
                        {renderPlotSettingsTab()}
                    </section>
                </div>
            );
        } else if (typeof sidebarSelection === 'object') {
            // Show card editor
            const card = story.library.find(c => c.id === sidebarSelection.cardId);
            if (!card) {
                return (
                    <div className="flex items-center justify-center h-full text-gray-500 dark:text-zinc-400">
                        Card not found
                    </div>
                );
            }

            // Render inline card editor for desktop
            return (
                <div className="h-full flex flex-col">
                    {/* Card Editor Header */}
                    <header className="p-6 border-b border-gray-200 dark:border-zinc-800">
                        <h3 className="text-lg font-semibold">{t.editCard}: {card.name || t.unnamedCard}</h3>
                    </header>

                    {/* Card Editor Content */}
                    <div className="flex-1 overflow-y-auto p-6">
                        <UniversalInlineEditor
                            card={card}
                            onSave={(updatedCard) => {
                                handleSaveCard(updatedCard);
                                markCardDirty(card.id, false);
                            }}
                            onDelete={handleDeleteCard}
                            language={settings.language}
                        />
                    </div>
                </div>
            );
        }

        return (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-zinc-400">
                Select an item from the sidebar to edit
            </div>
        );
    };

    const renderBasicInfoTab = () => (
        <div className="space-y-4">
            <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">{t.storyTitle}</label>
                <input type="text" id="title" value={story.title} onChange={e => setStory(s => ({...s, title: e.target.value}))} placeholder={t.storyTitlePlaceholder} className="w-full p-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
            </div>
            <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">{t.storyDescription}</label>
                <textarea id="description" value={story.description} onChange={e => setStory(s => ({...s, description: e.target.value}))} rows={3} placeholder={t.storyDescriptionPlaceholder} className="w-full p-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"/>
            </div>
             <div>
                <label htmlFor="coverImageUrl" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">{t.coverImageURL}</label>
                <input type="text" id="coverImageUrl" value={story.coverImageUrl} onChange={e => setStory(s => ({...s, coverImageUrl: e.target.value}))} placeholder={t.coverImageURLPlaceholder} className="w-full p-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">{t.visibility}</label>
                <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="visibility" value="public" checked={story.visibility === 'public'} onChange={() => setStory(s => ({...s, visibility: 'public'}))} className="text-indigo-600 focus:ring-indigo-500"/>{t.visibilityPublic}</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="visibility" value="private" checked={story.visibility === 'private'} onChange={() => setStory(s => ({...s, visibility: 'private'}))} className="text-indigo-600 focus:ring-indigo-500"/>{t.visibilityPrivate}</label>
                </div>
            </div>
             <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">{t.category}</label>
                <input type="text" id="category" value={story.category} onChange={e => setStory(s => ({...s, category: e.target.value}))} placeholder={t.categoryPlaceholder} className="w-full p-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
            </div>
        </div>
    );
    
    const renderLibraryTab = () => {
        const typeTranslations: Record<string, string> = {
            character: t.cardTypeCharacter,
            location: t.cardTypeLocation,
            item: t.cardTypeItem,
            quest: t.cardTypeQuest,
            setting: t.cardTypeSetting,
            custom: t.cardTypeCustom,
            map: t.cardTypeMap,
        };
        return (
             <div className="space-y-4">
                <h3 className="text-lg font-semibold">{t.libraryHeader}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {story.library.map(card => (
                        <button key={card.id} onClick={() => setEditingCard(card)} className="p-4 bg-gray-100 dark:bg-zinc-800 rounded-lg text-left hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors">
                           <p className="font-bold">{card.name}</p>
                           <p className="text-sm text-gray-500 dark:text-zinc-400 capitalize">{card.type === 'custom' ? card.customTypeName : (typeTranslations[card.type] || card.type)}</p>
                           <p className="text-xs text-gray-600 dark:text-zinc-300 line-clamp-2 mt-2">{card.content}</p>
                        </button>
                    ))}
                    <button onClick={() => setEditingCard(createNewCard())} className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-lg hover:border-indigo-500 hover:text-indigo-500 text-gray-500 dark:text-zinc-400 dark:hover:text-indigo-400 transition-colors min-h-[120px]">
                        <PlusIcon className="w-8 h-8 mb-2" />
                        <span className="font-semibold">{t.addLibraryCard}</span>
                    </button>
                </div>
             </div>
        )
    };
    
    const renderPlotSettingsTab = () => (
        <div className="space-y-4">
            <div>
                <label htmlFor="backgroundSetting" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">{t.backgroundSetting}</label>
                <textarea id="backgroundSetting" value={story.backgroundSetting} onChange={e => setStory(s => ({...s, backgroundSetting: e.target.value}))} rows={4} placeholder={t.backgroundPlaceholder} className="w-full p-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"/>
            </div>
            <div>
                <label htmlFor="openingMonologue" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">{t.openingMonologueLabel}</label>
                <textarea id="openingMonologue" value={story.openingMonologue} onChange={e => setStory(s => ({...s, openingMonologue: e.target.value}))} rows={6} placeholder={t.openingMonologuePlaceholder} className="w-full p-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"/>
            </div>
            <div>
                <label htmlFor="openingAction" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">{t.openingActionLabel}</label>
                <textarea id="openingAction" value={story.openingAction} onChange={e => setStory(s => ({...s, openingAction: e.target.value}))} rows={2} placeholder={t.openingActionPlaceholder} className="w-full p-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"/>
            </div>
        </div>
    );

    // Show loading state while fetching story data
    if (editId && storyLoading) {
        return (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-20 backdrop-blur-sm">
                <div className="bg-white dark:bg-zinc-900 p-8 rounded-lg">
                    <p className="text-lg">正在加载故事数据...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            {isDesktop ? (
                // Desktop Layout: Sidebar + Content
                <div className="fixed inset-0 bg-gray-50 dark:bg-zinc-950 flex h-screen">
                    {renderSidebar()}
                    <main className="flex-1 bg-white dark:bg-zinc-900">
                        {renderDesktopContent()}
                    </main>
                </div>
            ) : (
                // Mobile Layout: Modal Dialog (original)
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-20 backdrop-blur-sm overflow-y-auto px-4 pt-[calc(1rem+env(safe-area-inset-top))]">
                    <div ref={formRef} className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 rounded-lg shadow-xl w-full max-w-4xl my-auto flex flex-col max-h-full">
                        <header className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-zinc-800 flex justify-between items-center">
                            <h2 className="text-xl font-bold font-serif text-gray-800 dark:text-zinc-200">{storyToEdit ? t.editTitle : t.createTitle}</h2>
                            <div className="flex items-center gap-2">
                                <input type="file" ref={fileInputRef} onChange={handleFileImport} style={{ display: 'none' }} accept=".json" />
                                <button onClick={handleImportClick} title={t.import} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-200 text-gray-700 dark:bg-zinc-700 dark:text-zinc-300 font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-zinc-600">
                                    <UploadIcon className="w-4 h-4" /> {t.import}
                                </button>
                                <button onClick={handleExport} title={t.export} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-200 text-gray-700 dark:bg-zinc-700 dark:text-zinc-300 font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-zinc-600">
                                    <DownloadIcon className="w-4 h-4" /> {t.export}
                                </button>
                                <button onClick={handlePublish} className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700">
                                    {t.publish}
                                </button>
                                <button onClick={handleAttemptClose} className="p-2 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full">
                                    <CloseIcon className="w-6 h-6" />
                                </button>
                            </div>
                        </header>

                        <nav className="flex-shrink-0 border-b border-gray-200 dark:border-zinc-800">
                            <div className="flex gap-4 px-6">
                                <TabButton label={t.tabBasicInfo} isActive={activeTab === 'basic'} onClick={() => setActiveTab('basic')} />
                                <TabButton label={t.tabLibrary} isActive={activeTab === 'library'} onClick={() => setActiveTab('library')} />
                                <TabButton label={t.tabPlotSettings} isActive={activeTab === 'plot'} onClick={() => setActiveTab('plot')} />
                            </div>
                        </nav>

                        <main className="p-6 flex-grow overflow-y-auto">
                            {activeTab === 'basic' && renderBasicInfoTab()}
                            {activeTab === 'library' && renderLibraryTab()}
                            {activeTab === 'plot' && renderPlotSettingsTab()}
                        </main>
                    </div>
                </div>
            )}

            {/* Add Card Modal - only for desktop */}
            {isDesktop && (
                <AddCardModal
                    isOpen={showAddCardModal}
                    onSave={handleAddCard}
                    onClose={() => setShowAddCardModal(false)}
                />
            )}

            {/* Library Card Editor Modal - only for mobile */}
            {!isDesktop && editingCard && (
                <LibraryCardEditorModal
                    card={editingCard}
                    onSave={handleSaveCard}
                    onDelete={handleDeleteCard}
                    onClose={() => setEditingCard(null)}
                    language={settings.language}
                />
            )}

            <ConfirmationDialog
                isOpen={showDiscardConfirm}
                onClose={() => setShowDiscardConfirm(false)}
                onConfirm={() => navigate('/profile')}
                title={t.discardChangesTitle}
                message={t.discardChangesMessage}
                confirmText={t.discard}
                cancelText={t.keepEditing}
            />

            <ConfirmationDialog
                isOpen={showPublishError}
                onClose={() => setShowPublishError(false)}
                onConfirm={() => setShowPublishError(false)}
                title={t.publishErrorTitle}
                message={t.publishErrorMessage}
                confirmText="OK"
                cancelText=""
            />
        </>
    );
};

export default CreatePage;