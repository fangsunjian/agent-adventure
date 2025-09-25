import React, { useState, useEffect, useRef } from 'react';
import type { Story, LibraryCard, LibraryCardType, Language, HtmlComponentData } from '../../types';
import { translations, simpleUUID } from '../../constants';
import { CloseIcon, PlusIcon, UploadIcon, DownloadIcon, SaveIcon, TrashIcon } from '../../components/icons';
import ConfirmationDialog from '../../components/ConfirmationDialog';
import LibraryCardEditorModal from '../../components/LibraryCardEditorModal';
import PreviewPanel from '../../components/PreviewPanel';
import AvatarPreview from '../../components/AvatarPreview';
import HtmlComponentEditor from '../../components/HtmlComponentEditor';
import MapEditor from '../../components/MapEditor';
import { useUserSettings } from '../../hooks/useUserSettings';
import { useAuth } from '../../contexts/AuthContext';
import { useSaveStory, useStory } from '../hooks/useStories';
import { useNavigate, useSearchParams } from 'react-router-dom';

// No props needed - everything handled via hooks

const PREVIEW_PANEL_MIN_WIDTH = 360;
const DETAIL_PANEL_MIN_WIDTH = 360;
const DEFAULT_DETAIL_PANEL_WIDTH = 520;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

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
    const [cardToDelete, setCardToDelete] = useState<string | null>(null);

    // Desktop sidebar states
    const [isDesktop, setIsDesktop] = useState(false);
    const [sidebarSelection, setSidebarSelection] = useState<SidebarSelection>('basic');
    const [showAddCardModal, setShowAddCardModal] = useState(false);

    // Preview panel states
    const [showPreview, setShowPreview] = useState(false);
    const [previewMaximized, setPreviewMaximized] = useState(false);
    const [desktopContentWidth, setDesktopContentWidth] = useState(DEFAULT_DETAIL_PANEL_WIDTH);
    const [isResizingDetailPanel, setIsResizingDetailPanel] = useState(false);


    // Desktop card editing states - replaces UniversalInlineEditor
    const [desktopEditingCard, setDesktopEditingCard] = useState<LibraryCard | null>(null);
    const [desktopCardIsDirty, setDesktopCardIsDirty] = useState(false);

    // Image crop state (inline editing)
    const [cropData, setCropData] = useState({ x: 0, y: 0, scale: 1 });
    const [isDragging, setIsDragging] = useState(false);
    const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
    const [imageLoaded, setImageLoaded] = useState(false);

    // 页面加载时检测设备类型，之后不再动态切换
    useEffect(() => {
        const checkIsDesktop = () => {
            const isDesktopDevice = window.innerWidth >= 1024;
            setIsDesktop(isDesktopDevice);
            console.log('Device type detected:', isDesktopDevice ? 'Desktop' : 'Mobile', 'Width:', window.innerWidth);
        };

        // 临时强制设置为桌面版用于测试坐标修复
        setIsDesktop(true);
        console.log('Force set to Desktop mode for coordinate testing');

        checkIsDesktop();
        // 移除resize监听器，只在页面刷新时检测一次
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
    const desktopMainRef = useRef<HTMLDivElement>(null);
    const getClampedDetailWidth = React.useCallback((candidate: number) => {
        const container = desktopMainRef.current;
        if (!container) {
            return candidate;
        }

        const rect = container.getBoundingClientRect();
        const sanitizedValue = Number.isFinite(candidate) ? candidate : DEFAULT_DETAIL_PANEL_WIDTH;
        const available = Math.max(rect.width - PREVIEW_PANEL_MIN_WIDTH, 0);
        if (available <= 0) {
            return sanitizedValue;
        }

        const minWidth = Math.min(DETAIL_PANEL_MIN_WIDTH, available);
        const maxWidth = Math.max(minWidth, available);
        return clamp(sanitizedValue, minWidth, maxWidth);
    }, []);

    useEffect(() => {
        const originalStory = JSON.stringify(storyToEdit || createNewStory());
        const currentStory = JSON.stringify(story);
        setIsDirty(originalStory !== currentStory);
    }, [story, storyToEdit]);

    useEffect(() => {
        if (!showPreview || previewMaximized) {
            setIsResizingDetailPanel(false);
            return;
        }

        const syncWidth = () => {
            setDesktopContentWidth(prevWidth => {
                const candidate = Number.isFinite(prevWidth) ? prevWidth : DEFAULT_DETAIL_PANEL_WIDTH;
                return getClampedDetailWidth(candidate);
            });
        };

        syncWidth();
        window.addEventListener('resize', syncWidth);

        return () => {
            window.removeEventListener('resize', syncWidth);
        };
    }, [showPreview, previewMaximized, getClampedDetailWidth]);

    useEffect(() => {
        if (!isResizingDetailPanel || !showPreview || previewMaximized) {
            return;
        }

        const handlePointerMove = (event: PointerEvent) => {
            const container = desktopMainRef.current;
            if (!container) {
                return;
            }

            const rect = container.getBoundingClientRect();
            const desiredWidth = rect.right - event.clientX;
            const nextWidth = getClampedDetailWidth(desiredWidth);
            setDesktopContentWidth(nextWidth);
        };

        const stopResizing = () => setIsResizingDetailPanel(false);

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', stopResizing);
        window.addEventListener('pointercancel', stopResizing);
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', stopResizing);
            window.removeEventListener('pointercancel', stopResizing);
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };
    }, [isResizingDetailPanel, showPreview, previewMaximized, getClampedDetailWidth]);

    const shouldShowResizablePreview = showPreview && !previewMaximized;
    const detailPanelWidth = shouldShowResizablePreview ? Math.max(0, Math.round(desktopContentWidth)) : 0;
    const detailPanelStyle = shouldShowResizablePreview
        ? {
            width: `${detailPanelWidth}px`,
            minWidth: `${Math.max(0, Math.min(DETAIL_PANEL_MIN_WIDTH, detailPanelWidth))}px`,
        }
        : undefined;
    const detailPanelClassName = shouldShowResizablePreview
        ? 'h-full flex-shrink-0 overflow-hidden bg-white dark:bg-zinc-900'
        : 'w-full h-full';
    const previewPanelClassName = previewMaximized
        ? 'fixed inset-0 z-50'
        : 'flex-1 min-w-[360px] max-w-[70vw] border-r border-gray-200 dark:border-zinc-800';

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
    
    const handleDetailResizeStart = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (!showPreview || previewMaximized) {
            return;
        }

        event.preventDefault();
        setIsResizingDetailPanel(true);
    }, [showPreview, previewMaximized]);

    const handleSaveCard = React.useCallback(async (cardToSave: LibraryCard) => {
        // Check if user is authenticated
        if (!user) {
            alert('请先登录才能保存更改。Please log in to save changes.');
            return;
        }

        // Update local state
        const updatedStory = { ...story };
        const cardIndex = updatedStory.library.findIndex(c => c.id === cardToSave.id);
        if (cardIndex > -1) {
            updatedStory.library[cardIndex] = cardToSave;
        } else {
            updatedStory.library.push(cardToSave);
        }

        setStory(updatedStory);
        setEditingCard(null);

        // Persist to backend
        try {
            const savedStory = await saveStoryMutation.mutateAsync(updatedStory);
            console.log('Card saved successfully');

            // CRITICAL FIX: Ensure local state stays in sync with saved data
            setStory(savedStory);
        } catch (error) {
            console.error('Failed to save card:', error);
            alert('保存失败，请重试。Failed to save, please try again.');
        }
    }, [user, story, setStory, setEditingCard, saveStoryMutation]);
    
    const handleDeleteCard = React.useCallback((cardId: string) => {
        setCardToDelete(cardId);
    }, [setCardToDelete]);

    const confirmDeleteCard = async () => {
        if (!cardToDelete) return;

        // Check if user is authenticated
        if (!user) {
            console.warn('User not authenticated, cannot delete from backend');
            alert('请先登录才能删除资料卡。Please log in to delete cards.');
            setCardToDelete(null);
            return;
        }

        // Update local state
        const updatedStory = { ...story, library: story.library.filter(c => c.id !== cardToDelete) };
        setStory(updatedStory);
        setEditingCard(null);

        // If we're on desktop and this card was selected, switch to basic info
        if (isDesktop && typeof sidebarSelection === 'object' && sidebarSelection.cardId === cardToDelete) {
            setSidebarSelection('basic');
        }
        setCardToDelete(null);

        // Persist to backend
        try {
            const savedStory = await saveStoryMutation.mutateAsync(updatedStory);
            console.log('Card deleted successfully');

            // CRITICAL FIX: Ensure local state stays in sync with saved data
            setStory(savedStory);
        } catch (error) {
            console.error('Failed to delete card:', error);
            alert('删除失败，请重试。Failed to delete, please try again.');
        }
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
        const card = story.library.find(c => c.id === cardId);
        if (!card) return;

        if (isDesktop) {
            setSidebarSelection({ type: 'card', cardId });
            // 设置桌面版编辑状态
            setDesktopEditingCard(JSON.parse(JSON.stringify(card)));
            setDesktopCardIsDirty(false);
        } else {
            setEditingCard(card);
        }
    };

    // Desktop card editing handlers
    const updateDesktopCard = (updater: (prev: LibraryCard) => LibraryCard) => {
        if (desktopEditingCard) {
            setDesktopEditingCard(prev => {
                const updated = updater(prev!);
                return updated;
            });
            setDesktopCardIsDirty(true);
        }
    };

    const saveDesktopCard = async () => {
        if (desktopEditingCard && desktopCardIsDirty) {
            try {
                await handleSaveCard(desktopEditingCard);
                setDesktopCardIsDirty(false);
            } catch (error) {
                console.error('Failed to save card:', error);
            }
        }
    };

    // Initialize crop data when card changes
    useEffect(() => {
        if (desktopEditingCard?.avatarCrop) {
            setCropData(desktopEditingCard.avatarCrop);
        } else {
            setCropData({ x: 0, y: 0, scale: 1 });
        }
        setImageLoaded(false);
    }, [desktopEditingCard?.id, desktopEditingCard?.imageUrl]);

    // Save crop data when it changes
    useEffect(() => {
        if (desktopEditingCard && imageLoaded &&
            (cropData.x !== 0 || cropData.y !== 0 || cropData.scale !== 1)) {
            updateDesktopCard(prev => ({...prev, avatarCrop: cropData}));
        }
    }, [cropData, imageLoaded]);

    // Image handling functions
    const handleImageLoad = () => {
        setImageLoaded(true);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button === 0) { // Left mouse button
            setIsDragging(true);
            setLastMousePos({ x: e.clientX, y: e.clientY });
            e.preventDefault();
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging && imageLoaded) {
            const deltaX = e.clientX - lastMousePos.x;
            const deltaY = e.clientY - lastMousePos.y;

            setCropData(prev => ({
                ...prev,
                x: prev.x + deltaX,
                y: prev.y + deltaY
            }));

            setLastMousePos({ x: e.clientX, y: e.clientY });
            e.preventDefault();
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleZoomIn = () => {
        setCropData(prev => ({
            ...prev,
            scale: Math.min(prev.scale * 1.2, 5) // Max zoom 5x
        }));
    };

    const handleZoomOut = () => {
        setCropData(prev => ({
            ...prev,
            scale: Math.max(prev.scale / 1.2, 0.1) // Min zoom 0.1x
        }));
    };

    const handleResetZoom = () => {
        setCropData({ x: 0, y: 0, scale: 1 });
    };

    // Get current card for preview
    const getCurrentPreviewCard = (): LibraryCard | null => {
        if (typeof sidebarSelection === 'object') {
            // 优先返回正在编辑的卡片数据
            return desktopEditingCard || story.library.find(c => c.id === sidebarSelection.cardId) || null;
        }
        return null;
    };

    // Check if current card supports preview
    const currentCardSupportsPreview = (): boolean => {
        const card = getCurrentPreviewCard();
        if (!card) return false;
        // Currently supporting map, html, and character types
        return card.type === 'map' || card.type === 'html' || card.type === 'character';
    };

    // Auto-show preview when editing supported card types
    useEffect(() => {
        if (isDesktop && currentCardSupportsPreview() && !showPreview) {
            setShowPreview(true);
        }
    }, [sidebarSelection, isDesktop]);


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

    // Desktop inline card editor - complete implementation with all features
    const renderDesktopCardEditor = (card: LibraryCard) => {
        const t = translations[settings?.language || 'zh'];

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

        const handleKeywordsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const keywords = e.target.value.split(',').map(kw => kw.trim()).filter(Boolean);
            updateDesktopCard(prev => ({...prev, keywords}));
        };

        return (
            <div className="space-y-4">
                {/* Basic card fields */}
                <div>
                    <label htmlFor="desktop-card-name" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">{t.cardName}</label>
                    <input
                        type="text"
                        id="desktop-card-name"
                        value={card.name}
                        onChange={e => updateDesktopCard(prev => ({...prev, name: e.target.value}))}
                        className="w-full p-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                </div>

                <div>
                    <label htmlFor="desktop-card-type" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">{t.cardType}</label>
                    <select
                        id="desktop-card-type"
                        value={card.type}
                        onChange={e => updateDesktopCard(prev => ({...prev, type: e.target.value as LibraryCardType}))}
                        className="w-full p-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                        {cardTypes.map(type => <option key={type} value={type}>{typeTranslations[type]}</option>)}
                    </select>
                </div>

                {/* Custom type name field */}
                {card.type === 'custom' && (
                    <div>
                        <label htmlFor="desktop-card-custom-type-name" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">{t.customTypeName}</label>
                        <input
                            type="text"
                            id="desktop-card-custom-type-name"
                            value={card.customTypeName || ''}
                            onChange={e => updateDesktopCard(prev => ({...prev, customTypeName: e.target.value}))}
                            className="w-full p-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                    </div>
                )}

                {/* Character editing */}
                {card.type === 'character' && (
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="desktop-card-image-url" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">角色图片</label>
                            <input
                                type="text"
                                id="desktop-card-image-url"
                                value={card.imageUrl || ''}
                                onChange={e => updateDesktopCard(prev => ({...prev, imageUrl: e.target.value}))}
                                placeholder="请输入图片地址"
                                className="w-full p-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                        </div>

                        {/* 图片预览和裁切区域 */}
                        {card.imageUrl && (
                            <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-4">
                                <h4 className="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-3">头像预览和裁切</h4>

                                <div className="flex gap-4">
                                    {/* 左侧 - 图片预览区域 */}
                                    <div className="flex-1">
                                        <div
                                            className="relative bg-gray-100 dark:bg-zinc-700 rounded-lg overflow-hidden"
                                            style={{
                                                width: '280px',
                                                height: '200px',
                                                cursor: isDragging ? 'grabbing' : 'grab'
                                            }}
                                            onMouseDown={handleMouseDown}
                                            onMouseMove={handleMouseMove}
                                            onMouseUp={handleMouseUp}
                                            onMouseLeave={handleMouseUp}
                                        >
                                            {/* 图片容器 */}
                                            <div
                                                className="absolute inset-0 flex items-center justify-center"
                                                style={{
                                                    transform: `translate(${cropData.x}px, ${cropData.y}px) scale(${cropData.scale})`,
                                                    transformOrigin: '140px 100px', // 容器中心点 (280px/2, 200px/2)
                                                    transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                                                }}
                                            >
                                                <img
                                                    src={card.imageUrl}
                                                    alt="角色图片"
                                                    className="pointer-events-none max-w-none max-h-none object-contain"
                                                    style={{
                                                        width: 'auto',
                                                        height: '180px', // 稍小于容器高度
                                                    }}
                                                    onLoad={handleImageLoad}
                                                    onError={() => setImageLoaded(false)}
                                                />
                                            </div>

                                            {/* 圆形裁切预览区域 - 固定在容器中心 */}
                                            <div
                                                className="absolute border-4 border-white rounded-full pointer-events-none z-10"
                                                style={{
                                                    width: '80px',
                                                    height: '80px',
                                                    left: '50%',
                                                    top: '50%',
                                                    transform: 'translate(-50%, -50%)',
                                                    boxShadow: 'inset 0 0 0 2px rgba(59, 130, 246, 0.5), 0 0 0 9999px rgba(0, 0, 0, 0.4)'
                                                }}
                                            />

                                            {/* 中心点指示器 */}
                                            <div
                                                className="absolute w-2 h-2 bg-blue-400 rounded-full pointer-events-none z-10"
                                                style={{
                                                    left: '50%',
                                                    top: '50%',
                                                    transform: 'translate(-50%, -50%)'
                                                }}
                                            />
                                        </div>

                                        {/* 控制按钮 */}
                                        <div className="flex items-center justify-between mt-2">
                                            <span className="text-xs text-gray-500 dark:text-zinc-400">拖拽调整位置，圆圈内容将用作头像</span>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={handleZoomOut}
                                                    className="p-1 bg-gray-200 dark:bg-zinc-600 rounded text-gray-700 dark:text-zinc-300 hover:bg-gray-300 dark:hover:bg-zinc-500 text-xs"
                                                >
                                                    −
                                                </button>
                                                <span className="text-xs text-gray-500 dark:text-zinc-400 min-w-[3rem] text-center">
                                                    {Math.round(cropData.scale * 100)}%
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={handleZoomIn}
                                                    className="p-1 bg-gray-200 dark:bg-zinc-600 rounded text-gray-700 dark:text-zinc-300 hover:bg-gray-300 dark:hover:bg-zinc-500 text-xs"
                                                >
                                                    +
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleResetZoom}
                                                    className="px-2 py-1 text-xs bg-gray-200 dark:bg-zinc-600 rounded text-gray-700 dark:text-zinc-300 hover:bg-gray-300 dark:hover:bg-zinc-500"
                                                >
                                                    重置
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 右侧 - 头像预览 */}
                                    <div className="w-32">
                                        <div className="text-center">
                                            <p className="text-xs text-gray-600 dark:text-zinc-400 mb-2">头像效果</p>

                                            {/* 主预览 (64px) */}
                                            {card.imageUrl && imageLoaded && (
                                                <AvatarPreview
                                                    imageUrl={card.imageUrl}
                                                    cropData={cropData}
                                                    diameter={64}
                                                    alt="主头像预览"
                                                    className="border-2 border-gray-300 dark:border-zinc-600 mx-auto mb-3"
                                                />
                                            )}

                                            {/* 小尺寸预览 (32px) */}
                                            {card.imageUrl && imageLoaded && (
                                                <AvatarPreview
                                                    imageUrl={card.imageUrl}
                                                    cropData={cropData}
                                                    diameter={32}
                                                    alt="小头像预览"
                                                    className="border border-gray-300 dark:border-zinc-600 mx-auto"
                                                />
                                            )}
                                            <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1">32px</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Map editing */}
                {card.type === 'map' && (
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="desktop-card-map-image-url" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">{t.mapImageUrl}</label>
                            <input
                                type="text"
                                id="desktop-card-map-image-url"
                                value={card.mapImageUrl || ''}
                                onChange={e => updateDesktopCard(prev => ({...prev, mapImageUrl: e.target.value}))}
                                placeholder={t.mapImageUrlPlaceholder}
                                className="w-full p-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                        </div>
                        <MapEditor
                            card={card}
                            language={settings.language}
                            onUpdate={(updatedCard) => {
                                setDesktopEditingCard(updatedCard);
                                setDesktopCardIsDirty(true);
                            }}
                        />
                    </div>
                )}

                {/* HTML component editing */}
                {card.type === 'html' && (
                    <div className="space-y-4">
                        <HtmlComponentEditor
                            htmlData={card.htmlData || { html: '', css: '', js: '' }}
                            onChange={(htmlData) => {
                                updateDesktopCard(prev => ({ ...prev, htmlData }));
                            }}
                            isFullscreen={false}
                            showPreview={false} // 不显示内置预览，右侧面板显示
                        />
                    </div>
                )}

                {/* Keywords field */}
                <div>
                    <label htmlFor="desktop-card-keywords" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">{t.cardKeywords}</label>
                    <input
                        type="text"
                        id="desktop-card-keywords"
                        value={card.keywords.join(', ')}
                        onChange={handleKeywordsChange}
                        placeholder={t.keywordsPlaceholder}
                        className="w-full p-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                </div>

                {/* Content field - only show for non-HTML and non-map types that use it for complex editing */}
                {card.type !== 'html' && (
                    <div>
                        <label htmlFor="desktop-card-content" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">{t.cardContent}</label>
                        <textarea
                            id="desktop-card-content"
                            value={card.content}
                            onChange={e => {
                                const newContent = e.target.value.slice(0, 1000);
                                updateDesktopCard(prev => ({...prev, content: newContent}));
                            }}
                            rows={8}
                            className="w-full p-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                        <p className="text-right text-xs text-gray-500 dark:text-zinc-400 mt-1">{t.characterCount}: {card.content.length} / 1000</p>
                    </div>
                )}

                {/* Save and delete buttons */}
                <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-zinc-800">
                    <button
                        onClick={() => handleDeleteCard(card.id)}
                        className="flex items-center gap-2 text-sm text-red-600 hover:text-red-800 font-semibold"
                    >
                        <TrashIcon className="w-4 h-4" />
                        {t.deleteCard}
                    </button>

                    <button
                        onClick={saveDesktopCard}
                        disabled={!desktopCardIsDirty}
                        className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {t.save}
                    </button>
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
                    <h2 className="text-lg font-bold font-serif text-gray-800 dark:text-zinc-200">
                        {storyToEdit ? t.editTitle : t.createTitle}
                    </h2>
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
                        <div className="space-y-1 flex-1 overflow-y-auto">
                            {story.library.map(card => {
                                const isSelected = typeof sidebarSelection === 'object' && sidebarSelection.cardId === card.id;

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
                                                    // If this card is being edited in modal, focus on the modal instead
                                                    if (editingCard && editingCard.id === card.id) {
                                                        // Do nothing - user should save in modal
                                                        return;
                                                    }
                                                    // For desktop editing, use the current edited data
                                                    if (isDesktop && typeof sidebarSelection === 'object' && sidebarSelection.cardId === card.id && desktopEditingCard) {
                                                        handleSaveCard(desktopEditingCard);
                                                        setDesktopCardIsDirty(false);
                                                        return;
                                                    }
                                                    handleSaveCard(card);
                                                }}
                                                className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900 rounded text-xs"
                                                title={t.save}
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

                {/* Bottom Action Buttons */}
                <div className="border-t border-gray-200 dark:border-zinc-800 p-4 space-y-3">
                    <input type="file" ref={fileInputRef} onChange={handleFileImport} style={{ display: 'none' }} accept=".json" />
                    <div className="flex gap-2">
                        <button
                            onClick={handleImportClick}
                            title={t.import}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-gray-200 text-gray-700 dark:bg-zinc-700 dark:text-zinc-300 font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-zinc-600"
                        >
                            <UploadIcon className="w-4 h-4" /> {t.import}
                        </button>
                        <button
                            onClick={handleExport}
                            title={t.export}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-gray-200 text-gray-700 dark:bg-zinc-700 dark:text-zinc-300 font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-zinc-600"
                        >
                            <DownloadIcon className="w-4 h-4" /> {t.export}
                        </button>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handlePublish}
                            className="flex-1 px-3 py-2 text-sm bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700"
                        >
                            {t.publish}
                        </button>
                        <button
                            onClick={handleAttemptClose}
                            className="px-4 py-2 text-sm text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md font-semibold"
                        >
                            {t.cancel}
                        </button>
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
            if (!desktopEditingCard) {
                return (
                    <div className="flex items-center justify-center h-full text-gray-500 dark:text-zinc-400">
                        Card not found
                    </div>
                );
            }

            // Render direct card editor for desktop
            return (
                <div className="h-full flex flex-col">
                    {/* Card Editor Header */}
                    <header className="p-4 border-b border-gray-200 dark:border-zinc-800">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold">{t.editCard}: {desktopEditingCard.name || t.unnamedCard}</h3>
                            {desktopCardIsDirty && (
                                <span className="text-sm text-orange-600 dark:text-orange-400">
                                    * 未保存的更改
                                </span>
                            )}
                        </div>
                    </header>

                    {/* Card Editor Content */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {renderDesktopCardEditor(desktopEditingCard)}
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
                // Desktop Layout: Sidebar + Content + Preview (three columns)
                <div className="fixed inset-0 bg-gray-50 dark:bg-zinc-950 flex h-screen">
                    {renderSidebar()}
                    <main
                        ref={desktopMainRef}
                        className={`flex-1 bg-white dark:bg-zinc-900 ${showPreview && !previewMaximized ? 'flex items-stretch' : ''}`}
                    >
                        {showPreview && (
                            <>
                                <PreviewPanel
                                    card={getCurrentPreviewCard()}
                                    language={settings.language}
                                    isVisible={showPreview}
                                    isMaximized={previewMaximized}
                                    onToggleVisible={() => setShowPreview(false)}
                                    onToggleMaximize={() => setPreviewMaximized(!previewMaximized)}
                                    className={previewPanelClassName}
                                />
                                {!previewMaximized && (
                                    <div
                                        role="separator"
                                        aria-orientation="vertical"
                                        onPointerDown={handleDetailResizeStart}
                                        className={`w-1.5 flex-shrink-0 bg-gray-200 dark:bg-zinc-800 cursor-col-resize transition-colors ${isResizingDetailPanel ? 'bg-indigo-400 dark:bg-indigo-500' : 'hover:bg-indigo-300 dark:hover:bg-indigo-600'}`}
                                    />
                                )}
                            </>
                        )}
                        <div
                            className={detailPanelClassName}
                            style={detailPanelStyle}
                        >
                            {renderDesktopContent()}
                        </div>
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
                    isDesktop={false} // 明确标识为移动模式，保留HTML编辑器内置预览
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

            <ConfirmationDialog
                isOpen={cardToDelete !== null}
                onClose={() => setCardToDelete(null)}
                onConfirm={confirmDeleteCard}
                title={t.deleteCardTitle || 'Delete Card'}
                message={t.deleteCardMessage || 'Are you sure you want to delete this card? This action cannot be undone.'}
                confirmText={t.delete || 'Delete'}
                cancelText={t.cancel || 'Cancel'}
            />

        </>
    );
};

export default CreatePage;





