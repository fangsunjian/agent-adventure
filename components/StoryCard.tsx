import React, { useState, useEffect } from 'react';
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
    <div className="flex bg-white dark:bg-zinc-900 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-zinc-800 hover:shadow-lg hover:border-indigo-500/50 dark:hover:border-indigo-500/50 transition-all duration-300">
      <GracefulImage
        src={story.coverImageUrl}
        alt={`Cover for ${story.title}`}
        className="w-24 h-32 md:w-32 md:h-40 object-cover flex-shrink-0"
      />
      <div className="p-4 flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-bold font-serif text-gray-800 dark:text-zinc-200">{story.title}</h3>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mb-2">by {story.creatorName}</p>
          <p className="text-sm text-gray-600 dark:text-zinc-300 line-clamp-2">{story.description}</p>
        </div>
      </div>
    </div>
  );
};

export default StoryCard;