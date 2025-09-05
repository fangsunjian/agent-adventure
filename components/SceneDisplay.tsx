import React, { useEffect, useRef } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import type { HistoryItem, Scene } from '../types';
import { ImageLoadingSkeleton, RegenerateIcon } from './icons';

interface SceneDisplayProps {
  history: HistoryItem[];
  onRegenerate: () => void;
  isLoading: boolean;
  regenerateLabel: string;
  userName: string;
  charName: string;
}

const ImageWithLoader: React.FC<{ scene: Scene }> = ({ scene }) => {
  const [isImageLoaded, setIsImageLoaded] = React.useState(false);
  const [currentImageUrl, setCurrentImageUrl] = React.useState<string | null>(null);

  useEffect(() => {
    if (scene.imageUrl && scene.imageUrl !== currentImageUrl) {
      // Only reset if the image URL actually changed
      setCurrentImageUrl(scene.imageUrl);
      setIsImageLoaded(false);
      const img = new Image();
      img.src = scene.imageUrl;
      img.onload = () => setIsImageLoaded(true);
      img.onerror = () => setIsImageLoaded(false);
    } else if (!scene.imageUrl) {
      setIsImageLoaded(true); // No image to load
      setCurrentImageUrl(null);
    } else if (scene.imageUrl === currentImageUrl && !isImageLoaded) {
      // Same URL but not loaded yet, check if it's already cached
      const img = new Image();
      img.src = scene.imageUrl;
      if (img.complete) {
        setIsImageLoaded(true);
      } else {
        img.onload = () => setIsImageLoaded(true);
        img.onerror = () => setIsImageLoaded(false);
      }
    }
  }, [scene.imageUrl, currentImageUrl, isImageLoaded]);

  if (!scene.imageUrl) {
    return null;
  }
  
  return (
    <div className="relative w-full aspect-video bg-gray-200 dark:bg-zinc-900 flex items-center justify-center rounded-t-lg overflow-hidden">
        {!isImageLoaded && <ImageLoadingSkeleton className="w-16 h-16 text-gray-400 dark:text-zinc-600 animate-pulse" />}
        <img
            src={scene.imageUrl}
            alt={scene.imagePrompt}
            className={`object-cover w-full h-full transition-opacity duration-1000 ${isImageLoaded ? 'opacity-100' : 'opacity-0'}`}
        />
    </div>
  );
};


const SceneDisplay: React.FC<SceneDisplayProps> = ({ history, onRegenerate, isLoading, regenerateLabel, userName, charName }) => {
  const endOfHistoryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfHistoryRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  if (history.length === 0) {
      return (
          <div className="flex items-center justify-center h-full bg-white/[var(--game-panel-bg-opacity-light)] dark:bg-zinc-900/[var(--game-panel-bg-opacity-dark)] rounded-lg border border-gray-200 dark:border-zinc-800">
              <p className="text-gray-500 font-serif text-lg">Your story will appear here...</p>
          </div>
      )
  }

  const firstModelItem = history.find(h => h.role === 'model' && !h.isError);

  return (
    <div className="flex flex-col h-full bg-white/[var(--game-panel-bg-opacity-light)] dark:bg-zinc-900/[var(--game-panel-bg-opacity-dark)] rounded-lg overflow-hidden shadow-lg border border-gray-200 dark:border-zinc-800">
      <div className="flex-grow overflow-y-auto p-4 md:p-6 space-y-6">
        {history.map((item, index) => {
          if (item.role === 'user') {
            return (
              <div key={index} className="flex flex-col items-end">
                <p className="text-sm font-semibold text-gray-500 dark:text-zinc-400 mr-3 mb-1">{userName}</p>
                <div className="bg-[rgb(224_231_255/var(--bubble-opacity))] dark:bg-[rgb(49_46_129/var(--bubble-opacity))] rounded-lg px-4 py-2 max-w-xl">
                  <p className="text-indigo-900 dark:text-zinc-200 whitespace-pre-wrap break-words">{item.parts[0].text}</p>
                </div>
              </div>
            );
          }
          if (item.role === 'model') {
            const isLast = index === history.length - 1;
            
            if (item.isError) {
                try {
                    const errorData = JSON.parse(item.parts[0].text);
                    return (
                        <div key={index} className="flex justify-start">
                             <div className="flex flex-col items-start w-full max-w-xl">
                                <p className="text-sm font-semibold text-red-500 dark:text-red-400 ml-3 mb-1">{charName}</p>
                                <div className="group w-full">
                                    <div className="bg-red-50 dark:bg-red-900/40 border-l-4 border-red-500 rounded-r-md p-4">
                                        <p className="font-semibold text-red-600 dark:text-red-400 text-sm mb-1">{errorData.title}</p>
                                        <p className="text-red-800 dark:text-gray-300 font-serif break-words">{errorData.message}</p>
                                    </div>
                                    {isLast && !isLoading && (
                                    <div className="flex justify-end mt-1 pr-1">
                                        <button
                                            onClick={onRegenerate}
                                            className="p-1.5 text-gray-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-500 rounded-full bg-gray-200/50 dark:bg-zinc-800/50 opacity-100 transition-opacity duration-200"
                                            title={regenerateLabel}
                                        >
                                            <RegenerateIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                } catch (e) {
                    console.error("Failed to parse error item:", item.parts[0].text);
                    return (
                        <div key={index} className="flex justify-start">
                            <div className="flex flex-col items-start w-full max-w-xl">
                                <p className="text-sm font-semibold text-red-500 dark:text-red-400 ml-3 mb-1">{charName}</p>
                                <div className="group w-full">
                                    <div className="bg-red-50 dark:bg-red-900/40 border-l-4 border-red-500 rounded-r-md p-4">
                                        <p className="font-semibold text-red-600 dark:text-red-400 text-sm mb-1">解析错误</p>
                                        <p className="text-red-800 dark:text-gray-300 font-serif break-words">无法解析错误消息格式</p>
                                        <details className="mt-2">
                                            <summary className="text-xs text-red-600 dark:text-red-400 cursor-pointer">查看原始数据</summary>
                                            <pre className="text-xs text-red-700 dark:text-red-300 mt-1 whitespace-pre-wrap">{item.parts[0].text}</pre>
                                        </details>
                                    </div>
                                    {isLast && !isLoading && (
                                    <div className="flex justify-end mt-1 pr-1">
                                        <button
                                            onClick={onRegenerate}
                                            className="p-1.5 text-gray-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-500 rounded-full bg-gray-200/50 dark:bg-zinc-800/50 opacity-100 transition-opacity duration-200"
                                            title={regenerateLabel}
                                        >
                                            <RegenerateIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                }
            }

            try {
              const scene: Scene = JSON.parse(item.parts[0].text);
              const modelScene: Scene = { ...scene, imageUrl: item.imageUrl ?? null };
              const isOpeningScene = item === firstModelItem;
              const speakerName = isOpeningScene ? (regenerateLabel.includes("生成") ? "开场白" : "Opening Scene") : charName;

              return (
                <div key={index} className="flex flex-col items-start">
                   <p className="text-sm font-semibold text-gray-500 dark:text-zinc-400 ml-3 mb-1">{speakerName}</p>
                  <div className="group max-w-xl min-w-0">
                    <div className="bg-[rgb(243_244_246/var(--bubble-opacity))] dark:bg-[rgb(39_39_42/var(--bubble-opacity))] rounded-lg flex flex-col shadow-sm">
                      {item.isGeneratingImage ? (
                        <div className="relative w-full aspect-video bg-gray-200 dark:bg-zinc-800 flex flex-col items-center justify-center rounded-t-lg overflow-hidden text-gray-500">
                          <ImageLoadingSkeleton className="w-16 h-16 text-gray-400 dark:text-zinc-600 animate-spin" />
                          <p className="mt-2 font-serif">Generating image...</p>
                        </div>
                      ) : item.imageUrl ? (
                        <ImageWithLoader scene={modelScene} />
                      ) : null}
                      <div 
                        className="markdown-content p-4 text-lg leading-relaxed font-serif text-gray-700 dark:text-zinc-300 break-words"
                        dangerouslySetInnerHTML={{ 
                          __html: DOMPurify.sanitize(
                            marked.parse(scene.description.replace(/\\n\\n/g, '\n\n').replace(/\n{3,}/g, '\n\n')) as string
                          ) 
                        }}
                      />
                    </div>
                    {isLast && !isLoading && !isOpeningScene && (
                       <div className="flex justify-end mt-1 pr-1">
                          <button
                            onClick={onRegenerate}
                            className="p-1.5 text-gray-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-500 rounded-full bg-gray-200/50 dark:bg-zinc-800/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                            title={regenerateLabel}
                          >
                          <RegenerateIcon className="w-5 h-5" />
                          </button>
                       </div>
                     )}
                  </div>
                </div>
              );
            } catch (e) {
              console.error("Failed to parse model response:", item.parts[0].text);
              return (
                <div key={index} className="flex justify-start">
                    <div className="flex flex-col items-start w-full max-w-xl">
                        <p className="text-sm font-semibold text-red-500 dark:text-red-400 ml-3 mb-1">{charName}</p>
                        <div className="group w-full">
                            <div className="bg-red-50 dark:bg-red-900/40 border-l-4 border-red-500 rounded-r-md p-4">
                                <p className="font-semibold text-red-600 dark:text-red-400 text-sm mb-1">场景解析错误</p>
                                <p className="text-red-800 dark:text-gray-300 font-serif break-words">AI返回的数据格式无效，无法渲染场景</p>
                                <details className="mt-2">
                                    <summary className="text-xs text-red-600 dark:text-red-400 cursor-pointer">查看原始数据</summary>
                                    <pre className="text-xs text-red-700 dark:text-red-300 mt-1 whitespace-pre-wrap">{item.parts[0].text}</pre>
                                </details>
                            </div>
                            {isLast && !isLoading && (
                            <div className="flex justify-end mt-1 pr-1">
                                <button
                                    onClick={onRegenerate}
                                    className="p-1.5 text-gray-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-500 rounded-full bg-gray-200/50 dark:bg-zinc-800/50 opacity-100 transition-opacity duration-200"
                                    title={regenerateLabel}
                                >
                                    <RegenerateIcon className="w-5 h-5" />
                                </button>
                            </div>
                            )}
                        </div>
                    </div>
                </div>
              );
            }
          }
          return null;
        })}
        <div ref={endOfHistoryRef} />
      </div>
    </div>
  );
};

export default SceneDisplay;