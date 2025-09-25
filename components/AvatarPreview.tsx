import React from 'react';
import type { AvatarCropData } from '../types';

const BASE_CANVAS_WIDTH = 280;
const BASE_CANVAS_HEIGHT = 200;
const BASE_MASK_DIAMETER = 80;
const BASE_TRANSFORM_ORIGIN_X = BASE_CANVAS_WIDTH / 2;
const BASE_TRANSFORM_ORIGIN_Y = BASE_CANVAS_HEIGHT / 2;
const BASE_IMAGE_DISPLAY_HEIGHT = 180;

const defaultCrop: AvatarCropData = { x: 0, y: 0, scale: 1 };

interface AvatarPreviewProps {
  imageUrl: string;
  cropData?: AvatarCropData;
  diameter: number;
  alt?: string;
  className?: string;
}

const AvatarPreview: React.FC<AvatarPreviewProps> = ({
  imageUrl,
  cropData,
  diameter,
  alt = 'Avatar preview',
  className = ''
}) => {
  const effectiveCrop = cropData ?? defaultCrop;
  const safeScale = Number.isFinite(effectiveCrop.scale) && effectiveCrop.scale > 0 ? effectiveCrop.scale : 1;
  const safeX = Number.isFinite(effectiveCrop.x) ? effectiveCrop.x : 0;
  const safeY = Number.isFinite(effectiveCrop.y) ? effectiveCrop.y : 0;

  const scaleToMask = diameter / BASE_MASK_DIAMETER;

  return (
    <div
      className={`relative rounded-full overflow-hidden bg-white dark:bg-zinc-900 ${className}`.trim()}
      style={{
        width: `${diameter}px`,
        height: `${diameter}px`,
      }}
    >
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: `${BASE_CANVAS_WIDTH}px`,
          height: `${BASE_CANVAS_HEIGHT}px`,
          transformOrigin: `${BASE_TRANSFORM_ORIGIN_X}px ${BASE_TRANSFORM_ORIGIN_Y}px`,
          transform: `translate(-50%, -50%) scale(${scaleToMask})`,
        }}
      >
        <div
          className="relative w-full h-full"
          style={{
            transformOrigin: `${BASE_TRANSFORM_ORIGIN_X}px ${BASE_TRANSFORM_ORIGIN_Y}px`,
            transform: `translate(${safeX}px, ${safeY}px) scale(${safeScale})`,
          }}
        >
          <img
            src={imageUrl}
            alt={alt}
            draggable={false}
            className="pointer-events-none select-none"
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              height: `${BASE_IMAGE_DISPLAY_HEIGHT}px`,
              width: 'auto',
              maxWidth: 'none',
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default AvatarPreview;
