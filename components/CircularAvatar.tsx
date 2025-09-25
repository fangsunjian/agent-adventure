import React from 'react';
import type { LibraryCard } from '../types';
import AvatarPreview from './AvatarPreview';

interface CircularAvatarProps {
  card: LibraryCard;
  size?: 'small' | 'medium' | 'large' | number;
  className?: string;
  showBorder?: boolean;
}

const resolveDiameter = (size: CircularAvatarProps['size']) => {
  if (typeof size === 'number' && !Number.isNaN(size) && size > 0) {
    return size;
  }

  switch (size) {
    case 'small':
      return 32;
    case 'large':
      return 128;
    case 'medium':
    default:
      return 64;
  }
};

const CircularAvatar: React.FC<CircularAvatarProps> = ({
  card,
  size = 'medium',
  className = '',
  showBorder = true
}) => {
  const diameter = resolveDiameter(size);

  if (!card.imageUrl) {
    return (
      <div
        className={`rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center text-gray-500 dark:text-zinc-400 ${
          showBorder ? 'border-2 border-gray-300 dark:border-zinc-600' : ''
        } ${className}`.trim()}
        style={{
          width: `${diameter}px`,
          height: `${diameter}px`,
        }}
      >
        <span className="text-sm font-bold">
          {card.name ? card.name.charAt(0).toUpperCase() : '?'}
        </span>
      </div>
    );
  }

  const cropData = card.avatarCrop ?? { x: 0, y: 0, scale: 1 };
  const borderClass = showBorder ? 'border-2 border-gray-300 dark:border-zinc-600' : '';

  return (
    <AvatarPreview
      imageUrl={card.imageUrl}
      cropData={cropData}
      diameter={diameter}
      alt={card.name || '角色头像'}
      className={`${borderClass} ${className}`.trim()}
    />
  );
};

export default CircularAvatar;
