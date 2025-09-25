import React from 'react';
import type { LibraryCard, Language } from '../types';
import { translations } from '../constants';
import { CloseIcon, MaximizeIcon, MinimizeIcon } from './icons';
import MapPreview from './MapPreview';
import HtmlPreview from './HtmlPreview';
import CharacterPreview from './CharacterPreview';

// 预览组件的通用接口
interface PreviewComponentProps {
  card: LibraryCard;
  language: Language;
  onUpdate?: (updatedCard: LibraryCard) => void; // 用于预览组件反向更新数据
  className?: string;
}

// 预览面板属性
interface PreviewPanelProps {
  card: LibraryCard | null;
  language: Language;
  isVisible: boolean;
  isMaximized?: boolean;
  onToggleVisible: () => void;
  onToggleMaximize?: () => void;
  onCardUpdate?: (updatedCard: LibraryCard) => void;
  className?: string;
}

// 地图预览组件包装器
const MapPreviewWrapper: React.FC<PreviewComponentProps> = ({ card, language, onUpdate, className }) => {
  return (
    <MapPreview
      card={card}
      language={language}
      onUpdate={onUpdate}
      readonly={true}
      className={className}
    />
  );
};

// HTML组件预览包装器 - 在预览面板中只显示预览效果
const HtmlComponentPreview: React.FC<PreviewComponentProps> = ({ card, language, onUpdate, className }) => {
  return (
    <HtmlPreview
      card={card}
      language={language}
      onUpdate={onUpdate}
      readonly={true}
      className={className}
    />
  );
};

// 通用预览组件（未来扩展用）
const GenericPreview: React.FC<PreviewComponentProps> = ({ card, language, className }) => {
  return (
    <div className={`flex items-center justify-center h-full text-gray-500 dark:text-zinc-400 ${className || ''}`}>
      <div className="text-center">
        <p className="text-sm">预览功能</p>
        <p className="text-xs mt-1">此类型暂无预览支持</p>
        <p className="text-xs text-gray-400 mt-2">{card.type}</p>
      </div>
    </div>
  );
};

// 角色预览组件包装器
const CharacterPreviewWrapper: React.FC<PreviewComponentProps> = ({ card, language, onUpdate, className }) => {
  return (
    <CharacterPreview
      card={card}
      language={language}
      onUpdate={onUpdate}
      className={className}
    />
  );
};

// 预览渲染器 - 根据卡片类型选择对应的预览组件
const PreviewRenderer: React.FC<PreviewComponentProps> = ({ card, language, onUpdate, className }) => {
  switch (card.type) {
    case 'map':
      return <MapPreviewWrapper card={card} language={language} onUpdate={onUpdate} className={className} />;
    case 'html':
      return <HtmlComponentPreview card={card} language={language} onUpdate={onUpdate} className={className} />;
    case 'character':
      return <CharacterPreviewWrapper card={card} language={language} onUpdate={onUpdate} className={className} />;
    // 未来扩展其他类型
    // case 'location':
    //   return <LocationPreview card={card} language={language} onUpdate={onUpdate} className={className} />;
    default:
      return <GenericPreview card={card} language={language} onUpdate={onUpdate} className={className} />;
  }
};

// 主预览面板组件
const PreviewPanel: React.FC<PreviewPanelProps> = ({
  card,
  language,
  isVisible,
  isMaximized = false,
  onToggleVisible,
  onToggleMaximize,
  onCardUpdate,
  className = ''
}) => {
  const t = translations[language];

  if (!isVisible) {
    return null;
  }

  return (
    <div className={`bg-white dark:bg-zinc-900 border-l border-gray-200 dark:border-zinc-800 flex flex-col ${className}`}>
      {/* 预览面板标题栏 */}
      <header className="p-4 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-zinc-200">
          预览
        </h3>

        <div className="flex items-center gap-1">
          {onToggleMaximize && (
            <button
              onClick={onToggleMaximize}
              className="p-1 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded"
              title={isMaximized ? "最小化" : "最大化"}
            >
              {isMaximized ? <MinimizeIcon className="w-4 h-4" /> : <MaximizeIcon className="w-4 h-4" />}
            </button>
          )}
          <button
            onClick={onToggleVisible}
            className="p-1 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded"
            title="关闭预览"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 预览内容区域 */}
      <div className="flex-1 p-4 overflow-hidden">
        {card ? (
          <PreviewRenderer
            card={card}
            language={language}
            onUpdate={onCardUpdate}
            className="h-full"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-zinc-400">
            <div className="text-center">
              <p className="text-sm">选择资料卡查看预览</p>
              <p className="text-xs mt-1 text-gray-400">支持角色、地图、HTML组件等类型</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PreviewPanel;
export type { PreviewComponentProps };