import React, { useState, useRef, useEffect } from 'react';
import { CloseIcon } from './icons';

interface ImageCropModalProps {
  isOpen: boolean;
  imageUrl: string;
  onSave: (cropData: { x: number; y: number; scale: number }) => void;
  onClose: () => void;
  initialCrop?: { x: number; y: number; scale: number };
}

const ImageCropModal: React.FC<ImageCropModalProps> = ({
  isOpen,
  imageUrl,
  onSave,
  onClose,
  initialCrop = { x: 0, y: 0, scale: 1 }
}) => {
  const [cropData, setCropData] = useState(initialCrop);
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setCropData(initialCrop);
      setImageLoaded(false);
      setIsDragging(false);
    }
  }, [isOpen, imageUrl, initialCrop]);

  // Handle image load
  const handleImageLoad = () => {
    if (imageRef.current) {
      const { naturalWidth, naturalHeight } = imageRef.current;
      setImageDimensions({ width: naturalWidth, height: naturalHeight });
      setImageLoaded(true);
    }
  };

  // Handle mouse down for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // Left mouse button
      setIsDragging(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    }
  };

  // Handle mouse move for dragging
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

  // Handle mouse up
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Handle zoom controls
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

  // Handle save
  const handleSave = () => {
    onSave(cropData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <header className="p-4 border-b border-gray-200 dark:border-zinc-800 flex justify-between items-center">
          <h2 className="text-xl font-bold font-serif text-gray-800 dark:text-zinc-200">
            裁切角色头像
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700"
            >
              保存
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full"
            >
              <CloseIcon className="w-6 h-6" />
            </button>
          </div>
        </header>

        {/* Controls */}
        <div className="p-4 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-zinc-400">
            拖拽图片调整位置，使用缩放按钮调整大小。圆形区域内的内容将用作头像。
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-2 bg-gray-200 dark:bg-zinc-700 rounded text-gray-700 dark:text-zinc-300 hover:bg-gray-300 dark:hover:bg-zinc-600"
              title="缩小"
            >
              −
            </button>
            <span className="text-sm text-gray-500 dark:text-zinc-400 min-w-[4rem] text-center">
              {Math.round(cropData.scale * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-2 bg-gray-200 dark:bg-zinc-700 rounded text-gray-700 dark:text-zinc-300 hover:bg-gray-300 dark:hover:bg-zinc-600"
              title="放大"
            >
              +
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              className="px-3 py-2 text-sm bg-gray-200 dark:bg-zinc-700 rounded text-gray-700 dark:text-zinc-300 hover:bg-gray-300 dark:hover:bg-zinc-600"
              title="重置"
            >
              重置
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6 overflow-hidden">
          <div className="flex gap-6 h-full">
            {/* Left side - Image preview */}
            <div className="flex-1 flex flex-col">
              <h3 className="text-lg font-semibold mb-4">图片预览</h3>
              <div
                ref={containerRef}
                className="relative bg-gray-100 dark:bg-zinc-800 rounded-lg overflow-hidden flex-1 min-h-[400px]"
                style={{
                  cursor: isDragging ? 'grabbing' : 'grab'
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                {imageUrl && (
                  <div
                    style={{
                      transform: `translate(${cropData.x}px, ${cropData.y}px) scale(${cropData.scale})`,
                      transformOrigin: 'center',
                      transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                    }}
                  >
                    <img
                      ref={imageRef}
                      src={imageUrl}
                      alt="角色图片"
                      className="pointer-events-none max-w-full max-h-full object-contain block mx-auto"
                      onLoad={handleImageLoad}
                      onError={() => setImageLoaded(false)}
                    />
                  </div>
                )}

                {/* 圆形裁切预览区域 - 居中显示 */}
                <div
                  className="absolute border-4 border-white rounded-full shadow-lg pointer-events-none"
                  style={{
                    width: '200px',
                    height: '200px',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)'
                  }}
                />

                {/* 中心点指示器 */}
                <div
                  className="absolute w-2 h-2 bg-white rounded-full pointer-events-none"
                  style={{
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)'
                  }}
                />
              </div>
            </div>

            {/* Right side - Avatar preview */}
            <div className="w-80 flex flex-col">
              <h3 className="text-lg font-semibold mb-4">头像预览</h3>
              <div className="bg-gray-100 dark:bg-zinc-800 rounded-lg p-6 flex flex-col items-center">
                <div className="relative">
                  {imageUrl && imageLoaded && (
                    <AvatarPreview
                      imageUrl={imageUrl}
                      cropData={cropData}
                      diameter={128}
                      alt="头像预览"
                      className="border-4 border-gray-300 dark:border-zinc-600 shadow-inner"
                    />
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-zinc-400 mt-4 text-center">
                  这就是你的角色头像效果
                </p>

                {/* 不同尺寸的头像预览 */}
                <div className="mt-6 space-y-4 w-full">
                  <div className="flex flex-col items-center">
                    <p className="text-xs text-gray-500 dark:text-zinc-500 mb-2">大头像 (64px)</p>
                    {imageUrl && imageLoaded && (
                      <AvatarPreview
                        imageUrl={imageUrl}
                        cropData={cropData}
                        diameter={64}
                        alt="大头像预览"
                        className="border-2 border-gray-300 dark:border-zinc-600"
                      />
                    )}
                  </div>

                  <div className="flex flex-col items-center">
                    <p className="text-xs text-gray-500 dark:text-zinc-500 mb-2">小头像 (32px)</p>
                    {imageUrl && imageLoaded && (
                      <AvatarPreview
                        imageUrl={imageUrl}
                        cropData={cropData}
                        diameter={32}
                        alt="小头像预览"
                        className="border-2 border-gray-300 dark:border-zinc-600"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCropModal;