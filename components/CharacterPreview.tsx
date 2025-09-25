import React from 'react';
import type { LibraryCard, Language } from '../types';
import CircularAvatar from './CircularAvatar';
import CharacterCard from './CharacterCard';

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
          查看角色卡片和头像的显示效果
        </p>
      </div>

      {/* 两个展示区域 */}
      <div className="flex flex-col lg:flex-row items-center justify-center gap-8 w-full">
        {/* 左侧 - 圆形头像展示 */}
        <div className="flex flex-col items-center space-y-4">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-zinc-300">
            圆形头像
          </h3>
          <div className="bg-gray-100 dark:bg-zinc-800 p-6 rounded-lg">
            <CircularAvatar
              card={card}
              size={128}
              showBorder={true}
              className="shadow-lg"
            />
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-zinc-400">
              {card.name || '未命名角色'}
            </p>
            {card.avatarCrop && (
              <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1">
                已设置裁切: 缩放 {Math.round(card.avatarCrop.scale * 100)}%
              </p>
            )}
          </div>
        </div>

        {/* 右侧 - 角色卡片展示 */}
        <div className="flex flex-col items-center space-y-4">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-zinc-300">
            角色卡片
          </h3>
          <div className="bg-gray-100 dark:bg-zinc-800 p-6 rounded-lg">
            <CharacterCard
              card={card}
              cardSize="medium"
              showAvatar={true}
              className="mx-auto"
            />
          </div>
          <div className="text-center max-w-xs">
            <p className="text-sm text-gray-600 dark:text-zinc-400">
              包含圆形头像、背景图片、名字和描述
            </p>
            {card.keywords && card.keywords.length > 0 && (
              <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1">
                关键词: {card.keywords.slice(0, 2).join(', ')}
                {card.keywords.length > 2 && ` +${card.keywords.length - 2}个`}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 底部说明 */}
      <div className="max-w-2xl text-center">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">
            使用说明
          </h4>
          <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
            <li>• 圆形头像会在游戏中显示为玩家头像</li>
            <li>• 角色卡片用于展示角色的完整信息</li>
            <li>• 背景图片会自动调整透明度，确保文字清晰可读</li>
            <li>• 可以通过"预览和裁切头像"按钮调整头像显示区域</li>
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