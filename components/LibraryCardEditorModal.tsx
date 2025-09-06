import React, { useState, useEffect } from 'react';
import type { LibraryCard, LibraryCardType, Language, MapLocation } from '../types';
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
  mapImageUrl: '',
  mapLocations: [],
});

const LibraryCardEditorModal: React.FC<LibraryCardEditorModalProps> = ({ card, onSave, onDelete, onClose, language }) => {
  const t = translations[language];
  const [currentCard, setCurrentCard] = useState<LibraryCard>(card ? JSON.parse(JSON.stringify(card)) : createNewCard());
  const [isDirty, setIsDirty] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Map view state
  const [mapScale, setMapScale] = useState(1);
  const [mapTranslateX, setMapTranslateX] = useState(0);
  const [mapTranslateY, setMapTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [mapMode, setMapMode] = useState<'pan' | 'add'>('pan'); // 'pan' for dragging, 'add' for adding locations

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


  // Map interaction handlers
  const handleZoomIn = () => {
    setMapScale(prev => Math.min(prev * 1.2, 5)); // Max zoom 5x
  };

  const handleZoomOut = () => {
    setMapScale(prev => Math.max(prev / 1.2, 0.1)); // Min zoom 0.1x
  };

  const handleResetView = () => {
    setMapScale(1);
    setMapTranslateX(0);
    setMapTranslateY(0);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && mapMode === 'pan') { // Left mouse button and pan mode
      setIsDragging(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && mapMode === 'pan') {
      const deltaX = e.clientX - lastMousePos.x;
      const deltaY = e.clientY - lastMousePos.y;
      
      setMapTranslateX(prev => prev + deltaX);
      setMapTranslateY(prev => prev + deltaY);
      setLastMousePos({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    if (mapMode === 'add' && !isDragging) {
      // Find the image element to get coordinates relative to it
      const imgElement = e.currentTarget.querySelector('img') as HTMLImageElement;
      if (!imgElement || !imgElement.naturalWidth || !imgElement.naturalHeight) return;
      
      // Get the container dimensions (fixed size)
      const container = e.currentTarget as HTMLElement;
      const containerRect = container.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const containerHeight = containerRect.height;
      
      // Get click position relative to container
      const clickX = e.clientX - containerRect.left;
      const clickY = e.clientY - containerRect.top;
      
      // Reverse the zoom and pan transformations to get original container coordinates
      // With transform-origin: 'top left', the formula is: originalPoint = (clickPoint - translate) / scale
      const originalX = (clickX - mapTranslateX) / mapScale;
      const originalY = (clickY - mapTranslateY) / mapScale;
      
      // Image processing: Original image → scaled to container width → cropped to container height
      const naturalWidth = imgElement.naturalWidth;
      const naturalHeight = imgElement.naturalHeight;
      
      // Don't check container bounds for originalX/originalY because after dragging,
      // valid image coordinates can exceed container boundaries
      // We'll check image bounds later instead
      
      // Since we already applied inverse transform to get originalX/originalY,
      // these coordinates are already in the "untransformed" coordinate space
      // We just need to map them to the original image coordinates
      
      // Calculate scale ratio: how much the original image is scaled to fit container width
      const scaleRatio = containerWidth / naturalWidth;
      
      // Map container coordinates directly to original image coordinates
      const imageX = originalX / scaleRatio;
      const imageY = originalY / scaleRatio;
      
      // Check if the calculated image coordinates are within the original image bounds
      if (imageX < 0 || imageX > naturalWidth || imageY < 0 || imageY > naturalHeight) {
        return; // Click was outside the original image bounds
      }
      
      // Convert to 1000x1000 coordinate system
      const maxDimension = Math.max(naturalWidth, naturalHeight); // 1024
      const coord1000X = Math.round((imageX / maxDimension) * 1000);
      const coord1000Y = Math.round((imageY / maxDimension) * 1000);
      
      // Ensure coordinates are within bounds
      if (coord1000X >= 0 && coord1000X <= 1000 && coord1000Y >= 0 && coord1000Y <= 1000) {
        // Create a new location
        const newLocationName = prompt('Enter location name:') || `Location ${(currentCard.mapLocations || []).length + 1}`;
        const newLocationDescription = prompt('Enter location description:') || '';
        
        if (newLocationName) {
          const newLocation: MapLocation = {
            id: simpleUUID(),
            x: coord1000X,
            y: coord1000Y,
            name: newLocationName,
            description: newLocationDescription
          };
          
          setCurrentCard(prev => ({
            ...prev,
            mapLocations: [...(prev.mapLocations || []), newLocation]
          }));
        }
      }
    }
  };
  
  const cardTypes: LibraryCardType[] = ['character', 'location', 'item', 'quest', 'setting', 'custom', 'map'];
  const typeTranslations: Record<LibraryCardType, string> = {
    character: t.cardTypeCharacter,
    location: t.cardTypeLocation,
    item: t.cardTypeItem,
    quest: t.cardTypeQuest,
    setting: t.cardTypeSetting,
    custom: t.cardTypeCustom,
    map: t.cardTypeMap,
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
            {currentCard.type === 'map' && (
                <div className="pt-2 space-y-4">
                    <div>
                        <label htmlFor="card-map-image-url" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">{t.mapImageUrl}</label>
                        <input type="text" id="card-map-image-url" value={currentCard.mapImageUrl || ''} onChange={e => setCurrentCard(p => ({...p, mapImageUrl: e.target.value}))} placeholder={t.mapImageUrlPlaceholder} className="w-full p-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                    </div>
                    {currentCard.mapImageUrl && (
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">{t.mapPreview}</label>
                                <div className="flex items-center gap-2">
                                    {/* Mode toggle buttons */}
                                    <div className="flex border border-gray-300 dark:border-zinc-600 rounded overflow-hidden">
                                        <button
                                            type="button"
                                            onClick={() => setMapMode('pan')}
                                            className={`px-2 py-1 text-xs font-medium transition-colors ${
                                                mapMode === 'pan' 
                                                    ? 'bg-indigo-600 text-white' 
                                                    : 'bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-600'
                                            }`}
                                            title="Pan Mode (Drag to move)"
                                        >
                                            🤚 Pan
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setMapMode('add')}
                                            className={`px-2 py-1 text-xs font-medium transition-colors ${
                                                mapMode === 'add' 
                                                    ? 'bg-indigo-600 text-white' 
                                                    : 'bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-600'
                                            }`}
                                            title="Add Mode (Click to add locations)"
                                        >
                                            📍 Add
                                        </button>
                                    </div>
                                    <div className="w-px h-4 bg-gray-300 dark:bg-zinc-600"></div>
                                    <button
                                        type="button"
                                        onClick={handleZoomOut}
                                        className="p-1 bg-gray-200 dark:bg-zinc-700 rounded text-gray-700 dark:text-zinc-300 hover:bg-gray-300 dark:hover:bg-zinc-600"
                                        title="Zoom Out"
                                    >
                                        −
                                    </button>
                                    <span className="text-xs text-gray-500 dark:text-zinc-400 min-w-[3rem] text-center">
                                        {Math.round(mapScale * 100)}%
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleZoomIn}
                                        className="p-1 bg-gray-200 dark:bg-zinc-700 rounded text-gray-700 dark:text-zinc-300 hover:bg-gray-300 dark:hover:bg-zinc-600"
                                        title="Zoom In"
                                    >
                                        +
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleResetView}
                                        className="px-2 py-1 text-xs bg-gray-200 dark:bg-zinc-700 rounded text-gray-700 dark:text-zinc-300 hover:bg-gray-300 dark:hover:bg-zinc-600"
                                        title="Reset View"
                                    >
                                        Reset
                                    </button>
                                </div>
                            </div>
                            <div 
                                data-map-container
                                className="relative bg-gray-100 dark:bg-zinc-800 rounded-lg overflow-hidden max-h-64 select-none"
                                style={{ 
                                    cursor: mapMode === 'pan' 
                                        ? (isDragging ? 'grabbing' : 'grab')
                                        : 'crosshair'
                                }}
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onMouseUp={handleMouseUp}
                                onMouseLeave={handleMouseUp}
                                onClick={handleContainerClick}
                            >
                                <div
                                    style={{
                                        transform: `translate(${mapTranslateX}px, ${mapTranslateY}px) scale(${mapScale})`,
                                        transformOrigin: 'top left',
                                        transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                                    }}
                                >
                                    <img
                                        src={currentCard.mapImageUrl}
                                        alt="Map preview"
                                        className="pointer-events-none"
                                        style={{ 
                                            maxWidth: '100%',
                                            maxHeight: '100%',
                                            width: 'auto',
                                            height: 'auto',
                                            objectFit: 'contain',
                                            display: 'block',
                                            margin: '0 auto'
                                        }}
                                        onError={e => {
                                            const target = e.target as HTMLImageElement;
                                            target.style.display = 'none';
                                        }}
                                    />
                                {/* Render location markers */}
                                {(currentCard.mapLocations || []).map((location) => {
                                    // Get container dimensions dynamically
                                    const container = document.querySelector('[data-map-container]') as HTMLElement;
                                    if (!container) return null;
                                    
                                    const containerRect = container.getBoundingClientRect();
                                    const containerWidth = containerRect.width;
                                    const containerHeight = containerRect.height;
                                    
                                    // Get image natural dimensions
                                    const imgElement = document.querySelector(`img[src="${currentCard.mapImageUrl}"]`) as HTMLImageElement;
                                    if (!imgElement || !imgElement.naturalWidth || !imgElement.naturalHeight) {
                                        return null;
                                    }
                                    
                                    const naturalWidth = imgElement.naturalWidth;
                                    const naturalHeight = imgElement.naturalHeight;
                                    const maxDimension = Math.max(naturalWidth, naturalHeight);
                                    
                                    // Reverse the coordinate transformation
                                    // 1000x1000 → Original image → Scaled image → Container
                                    
                                    // 1000x1000 → Original image coordinates
                                    const imageX = (location.x / 1000) * maxDimension;
                                    const imageY = (location.y / 1000) * maxDimension;
                                    
                                    // Original image → Scaled image coordinates  
                                    const scaleRatio = containerWidth / naturalWidth;
                                    const scaledImageX = imageX * scaleRatio;
                                    const scaledImageY = imageY * scaleRatio;
                                    
                                    // Always show markers and let CSS clipping handle visibility
                                    // The transform on the parent will position them correctly
                                    
                                    // Scaled image → Container coordinates (these will be in the transformed coordinate space)
                                    const containerX = scaledImageX;
                                    const containerY = scaledImageY;
                                    
                                    return (
                                        <div
                                            key={location.id}
                                            className="absolute w-3 h-3 bg-red-500 border-2 border-white rounded-full transform -translate-x-1/2 -translate-y-1/2 shadow-lg z-10"
                                            style={{
                                                left: `${containerX}px`,
                                                top: `${containerY}px`
                                            }}
                                            title={`${location.name}: ${location.description}`}
                                        />
                                    );
                                })}
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">{t.clickToAddLocation}</p>
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">{t.mapLocations}</label>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                            {(currentCard.mapLocations || []).map((location) => (
                                <div key={location.id} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-zinc-700 rounded">
                                    <span className="text-sm font-medium flex-grow">{location.name}</span>
                                    <span className="text-xs text-gray-500 dark:text-zinc-400">({location.x}, {location.y})</span>
                                    <button
                                        onClick={() => {
                                            const newLocations = currentCard.mapLocations?.filter(loc => loc.id !== location.id) || [];
                                            setCurrentCard(p => ({...p, mapLocations: newLocations}));
                                        }}
                                        className="text-red-500 hover:text-red-700 text-sm"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                            {(!currentCard.mapLocations || currentCard.mapLocations.length === 0) && (
                                <p className="text-sm text-gray-500 dark:text-zinc-400 italic">No locations added yet</p>
                            )}
                        </div>
                    </div>
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