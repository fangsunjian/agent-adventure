import React from 'react';
import type { Language, LibraryCard } from '../types';
import CharacterCard from './CharacterCard';
import CircularAvatar from './CircularAvatar';

interface CharacterPreviewProps {
  card: LibraryCard;
  language: Language;
  onUpdate?: (updatedCard: LibraryCard) => void;
  className?: string;
}

const CharacterPreview: React.FC<CharacterPreviewProps> = ({
  card,
  language,
  onUpdate,
  className = ''
}) => {
  return (
    <div className={`h-full flex flex-col items-center justify-center p-6 space-y-8 ${className}`}>
      {/* 标题 */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-800 dark:text-zinc-200 mb-2">
          角色预览
        </h2>
        <p className="text-sm text-gray-600 dark:text-zinc-400">
          查看角色卡片的显示效果
        </p>
      </div>

      {/* 角色卡片展示区域 */}
      <div className="flex flex-col items-center justify-center space-y-6 w-full">
        <div className="bg-gray-100 dark:bg-zinc-800 p-1 rounded-lg">
          <CharacterCard
            card={card}
            cardSize="large"
            showAvatar={false}
            className="mx-auto"
          />
        </div>
      </div>

      {/* 带头像的气泡说明 */}
      <div className="relative max-w-md mt-2">
        {/* 头像positioned在气泡左上角 */}
        <div className="absolute -top-0 -left-20 z-10">
          <CircularAvatar
            card={card}
            size={64}
            showBorder={true}
            className="shadow-lg"
          />
        </div>

        {/* 气泡内容 */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 pt-6 pl-6">
          <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">
            使用说明
          </h4>
          <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
            <li>• 圆形头像会在游戏中显示为玩家头像</li>
            <li>• 角色卡片用于展示角色的完整信息</li>
            <li>• 背景图片会自动调整透明度，确保文字清晰可读</li>
            <li>• 可以通过"头像预览和裁切"功能调整头像显示区域</li>
          </ul>
        </div>
      </div>

      {/* 如果没有图片，显示提示 */}
      {!card.imageUrl && (
        <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            💡 添加角色图片后，预览效果会更加完整
          </p>
        </div>
      )}
    </div>
  );
};

export default CharacterPreview;