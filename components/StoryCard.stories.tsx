import type { Meta, StoryObj } from '@storybook/react';
import StoryCard from './StoryCard';

// 简化的Story类型定义
interface StoryData {
  id: string;
  title: string;
  description: string;
  creatorName: string;
  coverImageUrl: string;
  visibility: 'public' | 'private';
  createdAt: string;
  updatedAt: string;
  creatorId: string;
  gameEngine: string;
  tags: string[];
  isPublic: boolean;
}

// 模拟数据
const mockStory: StoryData = {
  id: '1',
  title: '中世纪奇幻世界角色扮演',
  description: '欢迎来到中世纪奇幻世界角色扮演！这是一个你早已身处其中的奇幻世界（即非异世界设定）。你可以扮演平民、冒险者、怪物猎人、巨龙，或是可怜的奴隶。成为备受尊敬的骑士，或是臭名昭著的杀人魔，建立属于你的声誉，谱写专属的奇幻篇章。',
  creatorName: 'fangsunjian2',
  coverImageUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=600&fit=crop&crop=center',
  visibility: 'public',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  creatorId: 'user1',
  gameEngine: 'adventure',
  tags: ['fantasy', 'roleplay', 'medieval'],
  isPublic: true
};

const meta: Meta<typeof StoryCard> = {
  title: 'Components/StoryCard',
  component: StoryCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: '游戏故事卡片组件，用于展示故事的基本信息，包括封面图、标题、描述和作者信息。'
      }
    }
  },
  argTypes: {
    story: {
      description: '故事数据对象',
      control: false
    }
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story_Type = StoryObj<typeof meta>;

// 默认故事
export const Default: Story_Type = {
  args: {
    story: mockStory,
  },
};

// 长标题故事
export const LongTitle: Story_Type = {
  args: {
    story: {
      ...mockStory,
      title: '这是一个非常非常长的故事标题，用来测试标题在不同长度下的显示效果和换行处理',
    },
  },
};

// 短描述故事
export const ShortDescription: Story_Type = {
  args: {
    story: {
      ...mockStory,
      description: '这是一个简短的描述。',
    },
  },
};

// 无图片故事
export const NoImage: Story_Type = {
  args: {
    story: {
      ...mockStory,
      coverImageUrl: '',
    },
  },
};

// 加载状态故事
export const LoadingImage: Story_Type = {
  args: {
    story: {
      ...mockStory,
      coverImageUrl: 'https://httpstat.us/200?sleep=5000', // 模拟慢加载
    },
  },
};

// 错误图片故事
export const BrokenImage: Story_Type = {
  args: {
    story: {
      ...mockStory,
      coverImageUrl: 'https://broken-url-that-will-fail.jpg',
    },
  },
};

// 暗色主题
export const DarkTheme: Story_Type = {
  args: {
    story: mockStory,
  },
  parameters: {
    backgrounds: {
      default: 'dark',
    },
  },
  decorators: [
    (Story) => (
      <div className="dark" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <Story />
      </div>
    ),
  ],
};

// 多卡片网格布局
export const GridLayout: Story_Type = {
  render: () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
      <StoryCard story={mockStory} />
      <StoryCard story={{...mockStory, id: '2', title: '科幻冒险', creatorName: 'user2'}} />
      <StoryCard story={{...mockStory, id: '3', title: '恐怖悬疑', description: '黑暗中的秘密正在等待发现...', creatorName: 'user3'}} />
      <StoryCard story={{...mockStory, id: '4', title: '浪漫爱情', coverImageUrl: '', creatorName: 'user4'}} />
    </div>
  ),
  parameters: {
    layout: 'fullscreen',
  },
};