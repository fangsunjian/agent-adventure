import React, { useState, useRef } from 'react';
import type { LibraryCard, MapLocation, Language } from '../types';
import { translations, simpleUUID } from '../constants';

interface MapPreviewProps {
  card: LibraryCard;
  language: Language;
  onUpdate?: (updatedCard: LibraryCard) => void;
  readonly?: boolean; // 预览模式下是否为只读
  className?: string;
}

const MapPreview: React.FC<MapPreviewProps> = ({
  card,
  language,
  onUpdate,
  readonly = true, // 默认为只读预览模式
  className = ''
}) => {
  const t = translations[language];

  // Map display states
  const [mapScale, setMapScale] = useState(1);
  const [mapTranslateX, setMapTranslateX] = useState(0);
  const [mapTranslateY, setMapTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

  // Location display options
  const [showLocationLabels, setShowLocationLabels] = useState(true); // 预览模式默认显示标签

  if (!card.mapImageUrl) {
    return (
      <div className={`flex items-center justify-center h-full text-gray-500 dark:text-zinc-400 ${className}`}>
        <div className="text-center">
          <p className="text-sm">{t.mapPreview}</p>
          <p className="text-xs mt-1">请设置地图图片URL</p>
        </div>
      </div>
    );
  }

  // Zoom handlers
  const handleZoomIn = () => {
    setMapScale(prev => Math.min(prev * 1.2, 5));
  };

  const handleZoomOut = () => {
    setMapScale(prev => Math.max(prev / 1.2, 0.1));
  };

  const handleResetView = () => {
    setMapScale(1);
    setMapTranslateX(0);
    setMapTranslateY(0);
  };

  // Mouse event handlers for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (readonly) {
      setIsDragging(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && readonly) {
      const deltaX = e.clientX - lastMousePos.x;
      const deltaY = e.clientY - lastMousePos.y;

      setMapTranslateX(prev => prev + deltaX);
      setMapTranslateY(prev => prev + deltaY);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  // Location click handler (for navigation/info display in preview mode)
  const handleLocationClick = (location: MapLocation) => {
    if (readonly) {
      // 在预览模式下，可以显示位置信息或导航到该位置
      console.log(`Location clicked: ${location.name}`, location);
    }
  };

  return (
    <div className={`h-full flex flex-col ${className}`}>
      {/* 预览标题和控制栏 */}
      <div className="flex justify-between items-center mb-3">
        <div className="text-xs font-medium text-gray-700 dark:text-zinc-300">
          {t.mapPreview}
        </div>
        <div className="flex items-center gap-2">
          {/* 缩放控制 */}
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-1 bg-gray-200 dark:bg-zinc-700 rounded text-gray-700 dark:text-zinc-300 hover:bg-gray-300 dark:hover:bg-zinc-600"
            title="缩小"
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
            title="放大"
          >
            +
          </button>
          <button
            type="button"
            onClick={handleResetView}
            className="px-2 py-1 text-xs bg-gray-200 dark:bg-zinc-700 rounded text-gray-700 dark:text-zinc-300 hover:bg-gray-300 dark:hover:bg-zinc-600"
            title={t.mapReset || '重置'}
          >
            重置
          </button>
        </div>
      </div>

      {/* 显示标签选项 */}
      <div className="flex items-center gap-2 mb-3">
        <input
          type="checkbox"
          id="preview-show-labels"
          checked={showLocationLabels}
          onChange={(e) => setShowLocationLabels(e.target.checked)}
          className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500 focus:ring-2"
        />
        <label htmlFor="preview-show-labels" className="text-xs text-gray-700 dark:text-zinc-300">
          {t.mapShowLabels || '显示名称'}
        </label>
      </div>

      {/* 地图预览区域 */}
      <div
        className="relative bg-gray-100 dark:bg-zinc-800 rounded-lg overflow-hidden flex-1 select-none border"
        style={{
          cursor: isDragging ? 'grabbing' : 'grab',
          minHeight: '200px'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <div
          style={{
            transform: `scale(${mapScale}) translate(${mapTranslateX}px, ${mapTranslateY}px)`,
            transformOrigin: 'top left',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out'
          }}
          className="w-full h-full flex items-center justify-center"
        >
          <img
            src={card.mapImageUrl}
            alt="Map preview"
            className="pointer-events-none max-w-full max-h-full object-contain"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
            draggable={false}
          />

          {/* 渲染位置标记 */}
          {(card.mapLocations || []).map((location) => {
            // 位置计算逻辑（简化版，适用于预览）
            const x = (location.x / 1000) * 100; // 转换为百分比
            const y = (location.y / 1000) * 100;

            return (
              <div
                key={location.id}
                className="absolute w-3 h-3 border-2 border-white rounded-full transform -translate-x-1/2 -translate-y-1/2 shadow-lg z-10 bg-red-500 cursor-pointer hover:scale-110 transition-transform"
                style={{
                  left: `${x}%`,
                  top: `${y}%`
                }}
                title={`${location.name}: ${location.description}`}
                onClick={() => handleLocationClick(location)}
              >
                {/* 位置标签 */}
                {showLocationLabels && (
                  <div
                    className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 px-2 py-1 bg-black/80 text-white text-xs rounded whitespace-nowrap pointer-events-none z-20"
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

      {/* 位置列表（预览模式下的简化版本） */}
      {(card.mapLocations || []).length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-zinc-700">
          <div className="text-xs font-medium text-gray-700 dark:text-zinc-300 mb-2">
            地图位置 ({card.mapLocations?.length || 0})
          </div>
          <div className="space-y-1 max-h-24 overflow-y-auto text-xs">
            {(card.mapLocations || []).map((location) => (
              <div
                key={location.id}
                className="flex items-center gap-2 p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer"
                onClick={() => handleLocationClick(location)}
                title={location.description}
              >
                <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0"></div>
                <span className="truncate text-gray-700 dark:text-zinc-300">
                  {location.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MapPreview;