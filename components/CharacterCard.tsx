import React from 'react';
import type { LibraryCard } from '../types';
import CircularAvatar from './CircularAvatar';

interface CharacterCardProps {
  card: LibraryCard;
  className?: string;
  showAvatar?: boolean;
  cardSize?: 'small' | 'medium' | 'large';
}

const CharacterCard: React.FC<CharacterCardProps> = ({
  card,
  className = '',
  showAvatar = true,
  cardSize = 'medium'
}) => {
  // 根据卡片尺寸设置样式
  const getCardStyles = () => {
    switch (cardSize) {
      case 'small':
        return {
          width: '200px',
          height: '120px',
          avatarSize: 40,
          nameSize: 'text-sm',
          contentSize: 'text-xs'
        };
      case 'medium':
        return {
          width: '250px',
          height: '150px',
          avatarSize: 50,
          nameSize: 'text-base',
          contentSize: 'text-sm'
        };
      case 'large':
        return {
          width: '300px',
          height: '200px',
          avatarSize: 64,
          nameSize: 'text-lg',
          contentSize: 'text-base'
        };
      default:
        return {
          width: '250px',
          height: '150px',
          avatarSize: 50,
          nameSize: 'text-base',
          contentSize: 'text-sm'
        };
    }
  };

  const styles = getCardStyles();

  return (
    <div className={`relative ${className}`}>
      {/* 角色头像 - 圆形，浮在卡片上方 */}
      {showAvatar && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
          <CircularAvatar
            card={card}
            size={styles.avatarSize}
            showBorder={true}
            className="shadow-lg"
          />
        </div>
      )}

      {/* 角色卡片 */}
      <div
        className="relative rounded-lg overflow-hidden shadow-lg border-2 border-gray-200 dark:border-zinc-700"
        style={{
          width: styles.width,
          height: styles.height,
        }}
      >
        {/* 背景图片 - 使用角色图片作为背景 */}
        {card.imageUrl && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-20 dark:opacity-10"
            style={{
              backgroundImage: `url(${card.imageUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        )}

        {/* 渐变背景遮罩 */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/80 to-white dark:via-zinc-900/80 dark:to-zinc-900" />

        {/* 卡片内容 */}
        <div className="relative h-full flex flex-col justify-end p-4">
          {/* 角色名字 - 悬浮在上方 */}
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
            <h3
              className={`${styles.nameSize} font-bold text-center text-gray-800 dark:text-zinc-200 bg-white/90 dark:bg-zinc-900/90 px-3 py-1 rounded-full shadow-sm border border-gray-200 dark:border-zinc-700`}
            >
              {card.name || '未命名角色'}
            </h3>
          </div>

          {/* 角色描述 */}
          <div className="mt-8">
            <p
              className={`${styles.contentSize} text-gray-700 dark:text-zinc-300 text-center line-clamp-3`}
            >
              {card.content || '暂无描述'}
            </p>

            {/* 关键词标签 */}
            {card.keywords && card.keywords.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1 mt-2">
                {card.keywords.slice(0, 3).map((keyword, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-full"
                  >
                    {keyword}
                  </span>
                ))}
                {card.keywords.length > 3 && (
                  <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 rounded-full">
                    +{card.keywords.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 卡片类型指示器 */}
        <div className="absolute top-2 right-2">
          <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full">
            角色
          </span>
        </div>
      </div>
    </div>
  );
};

export default CharacterCard;