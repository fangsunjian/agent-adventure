import React, { useState, useRef } from 'react';
import type { LibraryCard, MapLocation, Language } from '../types';
import { translations, simpleUUID } from '../constants';
import ConfirmationDialog from './ConfirmationDialog';

interface MapEditorProps {
  card: LibraryCard;
  language: Language;
  onUpdate: (updatedCard: LibraryCard) => void;
  className?: string;
}

// Location Edit Modal Component (复制自 LibraryCardEditorModal)
interface LocationEditModalProps {
  isOpen: boolean;
  location: MapLocation | null; // null for adding new location
  onSave: (name: string, description: string) => void;
  onClose: () => void;
  language: Language;
}

const LocationEditModal: React.FC<LocationEditModalProps> = ({ isOpen, location, onSave, onClose, language }) => {
  const t = translations[language];
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      if (location) {
        // Editing existing location
        setName(location.name || '');
        setDescription(location.description || '');
      } else {
        // Adding new location - provide default name
        const locationCount = (document.querySelectorAll('[data-location-item]') || []).length;
        setName(`${language === 'zh' ? '位置' : 'Location'} ${locationCount + 1}`);
        setDescription('');
      }
    }
  }, [isOpen, location, language]);

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim(), description.trim());
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

  return (
    <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <header className="p-4 border-b border-gray-200 dark:border-zinc-800 flex justify-between items-center">
          <h3 className="text-lg font-bold font-serif text-gray-800 dark:text-zinc-200">
            {location ? t.editLocationTitle : t.addLocationTitle}
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full"
          >
            ×
          </button>
        </header>
        <div className="p-4 space-y-4">
          <div>
            <label htmlFor="location-name" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
              {t.locationNameLabel}
            </label>
            <input
              type="text"
              id="location-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t.locationNamePlaceholder}
              className="w-full p-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="location-description" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
              {t.locationDescriptionLabel}
            </label>
            <textarea
              id="location-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t.locationDescriptionPlaceholder}
              rows={3}
              className="w-full p-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
            />
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
            disabled={!name.trim()}
            className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {location ? t.saveChanges : t.addLocation}
          </button>
        </footer>
      </div>
    </div>
  );
};

const MapEditor: React.FC<MapEditorProps> = ({ card, language, onUpdate, className = '' }) => {
  const t = translations[language];

  // Map view state (复制自 LibraryCardEditorModal)
  const [mapScale, setMapScale] = useState(1);
  const [mapTranslateX, setMapTranslateX] = useState(0);
  const [mapTranslateY, setMapTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [mapMode, setMapMode] = useState<'pan' | 'add' | 'edit'>('pan');

  // Location editing states (复制自 LibraryCardEditorModal)
  const [editingLocation, setEditingLocation] = useState<MapLocation | null>(null);
  const [deletingLocationId, setDeletingLocationId] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [showLocationEditModal, setShowLocationEditModal] = useState(false);
  const [showAddLocationModal, setShowAddLocationModal] = useState(false);
  const [pendingLocationCoords, setPendingLocationCoords] = useState<{x: number, y: number} | null>(null);

  // Location dragging state (复制自 LibraryCardEditorModal)
  const [isDraggingLocation, setIsDraggingLocation] = useState(false);
  const [draggingLocationId, setDraggingLocationId] = useState<string | null>(null);

  // Location display options
  const [showLocationLabels, setShowLocationLabels] = useState(false);

  if (!card.mapImageUrl) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="text-sm text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
          <p><strong>地图编辑提示：</strong></p>
          <p>请先设置地图图片URL，然后就可以添加和编辑位置点了。</p>
        </div>
      </div>
    );
  }

  // Map interaction handlers (复制并简化自 LibraryCardEditorModal)
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
    } else if (isDraggingLocation && mapMode === 'edit') {
      handleLocationMouseMove(e);
      e.preventDefault();
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    handleLocationMouseUp();
  };

  // Location handlers (复制自 LibraryCardEditorModal)
  const handleLocationItemClick = (location: MapLocation) => {
    setMapMode('edit');
    setSelectedLocationId(location.id);

    // Center the map on this location (简化版本)
    const container = document.querySelector('[data-map-container]') as HTMLElement;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;

    const imgElement = document.querySelector(`img[src="${card.mapImageUrl}"]`) as HTMLImageElement;
    if (!imgElement || !imgElement.naturalWidth || !imgElement.naturalHeight) {
      return;
    }

    const naturalWidth = imgElement.naturalWidth;
    const naturalHeight = imgElement.naturalHeight;
    const maxDimension = Math.max(naturalWidth, naturalHeight);

    const imageX = (location.x / 1000) * maxDimension;
    const imageY = (location.y / 1000) * maxDimension;

    const scaleRatio = containerWidth / naturalWidth;
    const scaledImageX = imageX * scaleRatio;
    const scaledImageY = imageY * scaleRatio;

    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;

    const newTranslateX = centerX - (scaledImageX * mapScale);
    const newTranslateY = centerY - (scaledImageY * mapScale);

    setMapTranslateX(newTranslateX);
    setMapTranslateY(newTranslateY);
  };

  const handleEditLocation = (location: MapLocation) => {
    setEditingLocation(location);
    setShowLocationEditModal(true);
  };

  const handleDeleteLocation = (locationId: string) => {
    setDeletingLocationId(locationId);
  };

  const handleConfirmDeleteLocation = () => {
    if (deletingLocationId) {
      const newLocations = card.mapLocations?.filter(loc => loc.id !== deletingLocationId) || [];
      onUpdate({...card, mapLocations: newLocations});
      setDeletingLocationId(null);
    }
  };

  const handleSaveLocationEdit = (name: string, description: string) => {
    if (editingLocation) {
      const updatedLocations = card.mapLocations?.map(loc =>
        loc.id === editingLocation.id
          ? { ...loc, name, description }
          : loc
      ) || [];
      onUpdate({ ...card, mapLocations: updatedLocations });
      setEditingLocation(null);
      setShowLocationEditModal(false);
    }
  };

  const handleSaveNewLocation = (name: string, description: string) => {
    if (pendingLocationCoords) {
      const newLocation: MapLocation = {
        id: simpleUUID(),
        x: pendingLocationCoords.x,
        y: pendingLocationCoords.y,
        name: name || `${language === 'zh' ? '位置' : 'Location'} ${(card.mapLocations || []).length + 1}`,
        description
      };

      onUpdate({
        ...card,
        mapLocations: [...(card.mapLocations || []), newLocation]
      });

      setPendingLocationCoords(null);
      setShowAddLocationModal(false);
    }
  };

  // Location dragging handlers (复制自 LibraryCardEditorModal，简化版本)
  const handleLocationMouseDown = (e: React.MouseEvent, locationId: string) => {
    if (mapMode === 'edit') {
      e.stopPropagation();
      setIsDraggingLocation(true);
      setDraggingLocationId(locationId);
      setSelectedLocationId(locationId);
    }
  };

  const handleLocationMouseMove = (e: React.MouseEvent) => {
    if (isDraggingLocation && draggingLocationId && mapMode === 'edit') {
      const imgElement = e.currentTarget.querySelector('img') as HTMLImageElement;
      if (!imgElement || !imgElement.naturalWidth || !imgElement.naturalHeight) return;

      const container = e.currentTarget as HTMLElement;
      const containerRect = container.getBoundingClientRect();
      const containerWidth = containerRect.width;

      const clickX = e.clientX - containerRect.left;
      const clickY = e.clientY - containerRect.top;

      const originalX = (clickX - mapTranslateX) / mapScale;
      const originalY = (clickY - mapTranslateY) / mapScale;

      const naturalWidth = imgElement.naturalWidth;
      const naturalHeight = imgElement.naturalHeight;
      const scaleRatio = containerWidth / naturalWidth;

      const imageX = originalX / scaleRatio;
      const imageY = originalY / scaleRatio;

      if (imageX < 0 || imageX > naturalWidth || imageY < 0 || imageY > naturalHeight) {
        return;
      }

      const maxDimension = Math.max(naturalWidth, naturalHeight);
      const coord1000X = Math.round((imageX / maxDimension) * 1000);
      const coord1000Y = Math.round((imageY / maxDimension) * 1000);

      if (coord1000X >= 0 && coord1000X <= 1000 && coord1000Y >= 0 && coord1000Y <= 1000) {
        const updatedLocations = card.mapLocations?.map(loc =>
          loc.id === draggingLocationId
            ? { ...loc, x: coord1000X, y: coord1000Y }
            : loc
        ) || [];
        onUpdate({ ...card, mapLocations: updatedLocations });
      }
    }
  };

  const handleLocationMouseUp = () => {
    setIsDraggingLocation(false);
    setDraggingLocationId(null);
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    if (mapMode === 'add' && !isDragging) {
      const imgElement = e.currentTarget.querySelector('img') as HTMLImageElement;
      if (!imgElement || !imgElement.naturalWidth || !imgElement.naturalHeight) return;

      const container = e.currentTarget as HTMLElement;
      const containerRect = container.getBoundingClientRect();
      const containerWidth = containerRect.width;

      const clickX = e.clientX - containerRect.left;
      const clickY = e.clientY - containerRect.top;

      const originalX = (clickX - mapTranslateX) / mapScale;
      const originalY = (clickY - mapTranslateY) / mapScale;

      const naturalWidth = imgElement.naturalWidth;
      const naturalHeight = imgElement.naturalHeight;

      const scaleRatio = containerWidth / naturalWidth;

      const imageX = originalX / scaleRatio;
      const imageY = originalY / scaleRatio;

      if (imageX < 0 || imageX > naturalWidth || imageY < 0 || imageY > naturalHeight) {
        return;
      }

      const maxDimension = Math.max(naturalWidth, naturalHeight);
      const coord1000X = Math.round((imageX / maxDimension) * 1000);
      const coord1000Y = Math.round((imageY / maxDimension) * 1000);

      if (coord1000X >= 0 && coord1000X <= 1000 && coord1000Y >= 0 && coord1000Y <= 1000) {
        setPendingLocationCoords({ x: coord1000X, y: coord1000Y });
        setShowAddLocationModal(true);
      }
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 地图预览和控制 */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">{t.mapPreview}</label>
          <div className="flex items-center gap-2">
            {/* Mode toggle buttons */}
            <div className="flex border border-gray-300 dark:border-zinc-600 rounded overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  setMapMode('pan');
                  setSelectedLocationId(null);
                }}
                className={`px-2 py-1 text-xs font-medium transition-colors ${
                  mapMode === 'pan'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-600'
                }`}
                title={`${t.mapModePan} Mode (Drag to move)`}
              >
                🤚 {t.mapModePan}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMapMode('add');
                  setSelectedLocationId(null);
                }}
                className={`px-2 py-1 text-xs font-medium transition-colors ${
                  mapMode === 'add'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-600'
                }`}
                title={`${t.mapModeAdd} Mode (Click to add locations)`}
              >
                📍 {t.mapModeAdd}
              </button>
              <button
                type="button"
                onClick={() => setMapMode('edit')}
                className={`px-2 py-1 text-xs font-medium transition-colors ${
                  mapMode === 'edit'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-600'
                }`}
                title={`${t.mapModeEdit} Mode (Drag to move locations)`}
              >
                ✏️ {t.mapModeEdit}
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
              title={t.mapReset}
            >
              {t.mapReset}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <input
            type="checkbox"
            id="show-location-labels"
            checked={showLocationLabels}
            onChange={(e) => setShowLocationLabels(e.target.checked)}
            className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500 focus:ring-2"
          />
          <label htmlFor="show-location-labels" className="text-sm text-gray-700 dark:text-zinc-300">
            {t.mapShowLabels}
          </label>
        </div>
        <div
          data-map-container
          className="relative bg-gray-100 dark:bg-zinc-800 rounded-lg overflow-hidden max-h-64 select-none"
          style={{
            cursor: mapMode === 'pan'
              ? (isDragging ? 'grabbing' : 'grab')
              : mapMode === 'add'
              ? 'crosshair'
              : 'default' // edit mode
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
              src={card.mapImageUrl}
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
            {(card.mapLocations || []).length > 0 && (card.mapLocations || []).map((location) => {
              const container = document.querySelector('[data-map-container]') as HTMLElement;
              if (!container) {
                return null;
              }

              const containerRect = container.getBoundingClientRect();
              const containerWidth = containerRect.width || 516;
              const containerHeight = containerRect.height || 256;

              const imgElement = container.querySelector('img') as HTMLImageElement;
              if (!imgElement || !imgElement.naturalWidth || !imgElement.naturalHeight) {
                return null;
              }

              const naturalWidth = imgElement.naturalWidth;
              const naturalHeight = imgElement.naturalHeight;
              const maxDimension = Math.max(naturalWidth, naturalHeight);

              const imageX = (location.x / 1000) * maxDimension;
              const imageY = (location.y / 1000) * maxDimension;

              const scaleRatio = containerWidth / naturalWidth;
              const scaledImageX = imageX * scaleRatio;
              const scaledImageY = imageY * scaleRatio;

              const containerX = scaledImageX;
              const containerY = scaledImageY;

              return (
                <div
                  key={location.id}
                  className={`absolute w-3 h-3 border-2 border-white rounded-full transform -translate-x-1/2 -translate-y-1/2 shadow-lg z-10 transition-all ${
                    mapMode === 'edit' && selectedLocationId === location.id
                      ? 'bg-blue-500 w-4 h-4 border-blue-300'
                      : 'bg-red-500'
                  } ${
                    mapMode === 'edit'
                      ? 'cursor-move hover:scale-110'
                      : 'cursor-pointer'
                  }`}
                  style={{
                    left: `${containerX}px`,
                    top: `${containerY}px`
                  }}
                  title={`${location.name}: ${location.description}`}
                  onMouseDown={(e) => handleLocationMouseDown(e, location.id)}
                >
                  {/* Location label */}
                  {showLocationLabels && (
                    <div
                      className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 px-2 py-1 bg-black/70 text-white text-xs rounded whitespace-nowrap pointer-events-none z-20"
                      style={{
                        fontSize: '10px',
                        maxWidth: '120px',
                        wordBreak: 'break-all'
                      }}
                    >
                      {location.name}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">{t.clickToAddLocation}</p>
      </div>

      {/* 位置列表 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">{t.mapLocations}</label>
        <div className="space-y-2 max-h-32 overflow-y-auto overflow-x-hidden w-0 min-w-full">
          {(card.mapLocations || []).map((location) => (
            <div
              key={location.id}
              data-location-item
              className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors max-w-full ${
                mapMode === 'edit' && selectedLocationId === location.id
                  ? 'bg-indigo-100 dark:bg-indigo-900 border-2 border-indigo-500'
                  : 'bg-gray-50 dark:bg-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-600'
              }`}
              onClick={() => handleLocationItemClick(location)}
            >
              <div className="flex-grow min-w-0 overflow-hidden">
                <span className="text-sm font-medium block truncate">{location.name}</span>
                {location.description && (
                  <span className="text-xs text-gray-500 dark:text-zinc-400 block truncate">{location.description}</span>
                )}
              </div>
              <span className="text-xs text-gray-500 dark:text-zinc-400 px-2 flex-shrink-0">({location.x}, {location.y})</span>
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditLocation(location);
                  }}
                  className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900 rounded text-xs"
                  title="Edit location"
                >
                  ✏️
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteLocation(location.id);
                  }}
                  className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900 rounded text-xs"
                  title="Delete location"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
          {(!card.mapLocations || card.mapLocations.length === 0) && (
            <p className="text-sm text-gray-500 dark:text-zinc-400 italic">No locations added yet</p>
          )}
        </div>
      </div>

      {/* Location Edit Modal */}
      {showLocationEditModal && editingLocation && (
        <LocationEditModal
          isOpen={showLocationEditModal}
          location={editingLocation}
          onSave={handleSaveLocationEdit}
          onClose={() => {
            setShowLocationEditModal(false);
            setEditingLocation(null);
          }}
          language={language}
        />
      )}

      {/* Add Location Modal */}
      {showAddLocationModal && pendingLocationCoords && (
        <LocationEditModal
          isOpen={showAddLocationModal}
          location={null}
          onSave={handleSaveNewLocation}
          onClose={() => {
            setShowAddLocationModal(false);
            setPendingLocationCoords(null);
          }}
          language={language}
        />
      )}

      {/* Delete Location Confirmation */}
      <ConfirmationDialog
        isOpen={deletingLocationId !== null}
        onClose={() => setDeletingLocationId(null)}
        onConfirm={handleConfirmDeleteLocation}
        title={t.deleteLocationTitle}
        message={t.deleteLocationMessage}
        confirmText={t.delete}
        cancelText={t.cancel}
      />
    </div>
  );
};

export default MapEditor;