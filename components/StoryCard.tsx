import React, { useEffect, useState } from 'react';
import type { Story } from '../types';
import { ImageLoadingSkeleton } from './icons';

// Helper component for graceful image loading
const GracefulImage: React.FC<{ src: string; alt: string; className: string }> = ({ src, alt, className }) => {
  const [imageState, setImageState] = useState<'loading' | 'loaded' | 'error'>('loading');

  useEffect(() => {
    setImageState('loading');
    if (!src) {
      setImageState('error');
      return;
    }
    const img = new Image();
    img.src = src;
    img.onload = () => setImageState('loaded');
    img.onerror = () => setImageState('error');
  }, [src]);

  if (imageState === 'loading') {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-200 dark:bg-zinc-800`}>
        <ImageLoadingSkeleton className="w-1/2 h-1/2 text-gray-400 animate-pulse" />
      </div>
    );
  }

  if (imageState === 'error') {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-100 dark:bg-zinc-900 text-gray-400 dark:text-zinc-600`}>
        <ImageLoadingSkeleton className="w-1/2 h-1/2" />
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} />;
};


const StoryCard: React.FC<{ story: Story }> = ({ story }) => {
  return (
    <div className="relative flex flex-col bg-white dark:bg-zinc-900 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-all duration-300 h-60 sm:h-64 md:h-72">
      {/* Image Container */}
      <div className="relative w-full h-36 sm:h-40 md:h-48 flex-shrink-0">
        <GracefulImage
          src={story.coverImageUrl}
          alt={`Cover for ${story.title}`}
          className="w-full h-full object-cover"
        />
        {/* User info floating on image */}
        <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded text-xs text-white">
          by {story.creatorName}
        </div>
      </div>

      {/* Content Container */}
      <div className="px-3 pt-3 pb-6 flex flex-col flex-1 min-w-0">
        <h3 className="text-sm md:text-base font-bold font-serif text-gray-800 dark:text-zinc-200 line-clamp-2 leading-tight mb-2">{story.title}</h3>

        {/* Description wrapper - exactly 3 lines with ellipsis */}
        <div className="overflow-hidden mb-2" style={{ height: '3.75rem', lineHeight: '1.25rem' }}>
          <p className="text-xs text-gray-600 dark:text-zinc-300" style={{ margin: 0, padding: 0, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', wordBreak: 'break-word' }}>{story.description}</p>
        </div>

        {/* Spacing to push content away from bottom edge */}
        <div className="flex-1 min-h-8"></div>
      </div>
    </div>
  );
};

export default StoryCard;
