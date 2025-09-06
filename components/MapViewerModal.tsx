import React, { useCallback, useRef, useState } from 'react';
import type { LibraryCard, MapLocation } from '../types';
import { CloseIcon } from './icons';

interface MapViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  maps: LibraryCard[];
  currentMapIndex: number;
  onMapChange: (index: number) => void;
  playerLocation?: { mapId: string; locationId: string };
  language: 'en' | 'zh';
}

const MapViewerModal: React.FC<MapViewerModalProps> = ({
  isOpen,
  onClose,
  maps,
  currentMapIndex,
  onMapChange,
  playerLocation,
  language
}) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null);

  const t = {
    en: {
      maps: 'Maps',
      close: 'Close',
      zoomIn: 'Zoom In',
      zoomOut: 'Zoom Out',
      resetView: 'Reset View',
      noMaps: 'No maps available',
      playerLocation: 'Player Location'
    },
    zh: {
      maps: '地图',
      close: '关闭',
      zoomIn: '放大',
      zoomOut: '缩小',
      resetView: '重置视图',
      noMaps: '没有可用的地图',
      playerLocation: '玩家位置'
    }
  }[language];

  const currentMap = maps[currentMapIndex];

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    setIsDragging(true);
    setDragStart({
      x: e.clientX - pan.x,
      y: e.clientY - pan.y
    });
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.5, Math.min(3, zoom * delta));
    setZoom(newZoom);
  }, [zoom]);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const zoomIn = useCallback(() => {
    setZoom(prev => Math.min(3, prev * 1.2));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom(prev => Math.max(0.5, prev / 1.2));
  }, []);

  if (!isOpen) return null;

  if (maps.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
        <div className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-700 dark:text-zinc-300">{t.maps}</h2>
            <button
              onClick={onClose}
              className="p-1 text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 rounded-full"
            >
              <CloseIcon className="w-6 h-6" />
            </button>
          </div>
          <p className="text-gray-500 dark:text-zinc-400 text-center">{t.noMaps}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-gray-700 dark:text-zinc-300">{t.maps}</h2>
            {maps.length > 1 && (
              <select
                value={currentMapIndex}
                onChange={(e) => onMapChange(Number(e.target.value))}
                className="px-3 py-1 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 text-sm"
              >
                {maps.map((map, index) => (
                  <option key={map.id} value={index}>
                    {map.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={zoomOut}
              className="p-2 text-gray-600 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 bg-gray-100 dark:bg-zinc-800 rounded-md transition-colors"
              title={t.zoomOut}
            >
              <span className="text-lg font-bold">−</span>
            </button>
            <span className="text-sm text-gray-500 dark:text-zinc-400 min-w-[4rem] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={zoomIn}
              className="p-2 text-gray-600 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 bg-gray-100 dark:bg-zinc-800 rounded-md transition-colors"
              title={t.zoomIn}
            >
              <span className="text-lg font-bold">+</span>
            </button>
            <button
              onClick={resetView}
              className="px-3 py-2 text-gray-600 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 bg-gray-100 dark:bg-zinc-800 rounded-md transition-colors text-sm"
            >
              {t.resetView}
            </button>
            <button
              onClick={onClose}
              className="p-1 text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 rounded-full"
            >
              <CloseIcon className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Map Container */}
        <div className="flex-grow relative overflow-hidden bg-gray-100 dark:bg-zinc-800">
          <div
            ref={mapContainerRef}
            className="w-full h-full relative cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            onClick={() => setSelectedLocation(null)}
          >
            {currentMap?.mapImageUrl && (
              <div className="relative w-full h-full flex items-center justify-center">
                <div
                  className="relative"
                  style={{
                    transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                    transformOrigin: 'center center'
                  }}
                >
                  <img
                    src={currentMap.mapImageUrl}
                    alt={currentMap.name}
                    className="max-w-none h-auto select-none"
                    style={{ 
                      maxHeight: '70vh',
                      width: 'auto'
                    }}
                    draggable={false}
                  />
                  
                  {/* Render locations */}
                  {currentMap.mapLocations?.map((location: MapLocation) => {
                    const isPlayerLocation = playerLocation?.mapId === currentMap.id &&
                                           playerLocation?.locationId === location.id;
                    
                    const handleLocationClick = (e: React.MouseEvent) => {
                      e.stopPropagation();
                      setSelectedLocation(location);
                    };
                    
                    return (
                      <div
                        key={location.id}
                        className="absolute group"
                        style={{
                          left: `${(location.x / 1000) * 100}%`,
                          top: `${(location.y / 1000) * 100}%`,
                          transform: 'translate(-50%, -50%)'
                        }}
                      >
                        {/* Location pin */}
                        <div
                          className={`cursor-pointer relative ${isPlayerLocation ? 'w-6 h-6' : 'w-3 h-3 rounded-full'}`}
                          onClick={handleLocationClick}
                          title={isPlayerLocation ? `${t.playerLocation}: ${location.name}` : location.name}
                        >
                          {!isPlayerLocation ? (
                            <div className="bg-red-500 rounded-full w-full h-full" />
                          ) : (
                            <div className="bg-blue-500 rounded-full w-full h-full flex items-center justify-center text-white text-xs font-bold shadow-lg">
                              🎯
                            </div>
                          )}
                        </div>
                        
                        {/* Location label */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black/80 text-white text-xs rounded whitespace-nowrap pointer-events-none z-20">
                          <div className="font-medium">{location.name}</div>
                          {isPlayerLocation && (
                            <div className="text-blue-300 font-medium mt-1">{t.playerLocation}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Selected location panel */}
        {selectedLocation && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedLocation(null)}
          >
            <div
              className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4 max-h-[70vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-700 dark:text-zinc-300">
                  {selectedLocation.name}
                </h3>
                <button
                  onClick={() => setSelectedLocation(null)}
                  className="p-1 text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 rounded-full"
                >
                  <CloseIcon className="w-6 h-6" />
                </button>
              </div>
              {selectedLocation.description && (
                <p className="text-gray-600 dark:text-zinc-300 whitespace-pre-wrap">
                  {selectedLocation.description}
                </p>
              )}
              {playerLocation?.locationId === selectedLocation.id && (
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-blue-800 dark:text-blue-200 font-medium">
                    {t.playerLocation}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer with map info */}
        {currentMap && (
          <div className="p-4 border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50">
            <h3 className="font-medium text-gray-700 dark:text-zinc-300 mb-1">{currentMap.name}</h3>
            {currentMap.content && (
              <p className="text-sm text-gray-500 dark:text-zinc-400">{currentMap.content}</p>
            )}
            {currentMap.mapLocations && currentMap.mapLocations.length > 0 && (
              <p className="text-xs text-gray-400 dark:text-zinc-500 mt-2">
                {currentMap.mapLocations.length} {language === 'zh' ? '个位置' : 'locations'}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MapViewerModal;