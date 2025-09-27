# Storybook开发工作流指南

**创建时间**: 2025-09-26
**适用项目**: Agent Adventure V2

## 🎯 目标

建立以Storybook为核心的组件驱动开发工作流，提升开发效率、保证UI一致性、增强团队协作。

## 📋 工作流概述

### 开发新组件的标准流程

1. **在Storybook中设计** → 2. **编写Stories** → 3. **实现组件** → 4. **集成到应用** → 5. **维护文档**

### 现有组件改进流程

1. **创建当前状态的Story** → 2. **识别问题和改进点** → 3. **设计新变体** → 4. **重构实现** → 5. **更新文档**

## 🚀 实战案例：CharacterPreview组件优化

### 第一步：创建当前状态的Story

```bash
# 启动Storybook
npm run storybook
```

创建文件：`src/components/CharacterPreview.stories.tsx`

```typescript
import type { Meta, StoryObj } from '@storybook/react'
import { CharacterPreview } from './CharacterPreview'
import type { LibraryCard } from '../types'

const meta: Meta<typeof CharacterPreview> = {
  title: 'Components/Library/CharacterPreview',
  component: CharacterPreview,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: '角色卡预览组件，用于显示角色的基本信息和外观'
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    character: {
      description: '角色数据',
      control: { type: 'object' }
    },
    size: {
      description: '预览尺寸',
      control: { type: 'select' },
      options: ['small', 'medium', 'large']
    },
    showActions: {
      description: '是否显示操作按钮',
      control: { type: 'boolean' }
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

// 基础故事 - 展示正常状态
export const Default: Story = {
  args: {
    character: {
      id: '1',
      name: '艾莉丝',
      type: 'character',
      content: '一位勇敢的女战士，拥有火系魔法能力。她从小在森林中长大，具有敏锐的直觉和强大的战斗技能。',
      keywords: '战士, 火系魔法, 勇敢',
      aiInstructions: '扮演一个勇敢但有时冲动的战士角色',
      imageUrl: 'https://example.com/character-alice.jpg'
    },
    size: 'medium',
    showActions: true
  }
}

// 长文本测试
export const LongDescription: Story = {
  args: {
    character: {
      id: '2',
      name: '萨拉丁·阿布杜拉·本·优素福·伊本·阿尤布',
      type: 'character',
      content: '这是一个非常长的角色描述，用来测试文本溢出和换行的处理。萨拉丁是历史上著名的阿拉伯领袖，他在十字军东征期间统一了埃及和叙利亚，并夺回了耶路撒冷。他以其军事才能、外交技巧和对敌人的宽容而闻名。萨拉丁不仅是一位出色的军事指挥官，还是一位虔诚的穆斯林和公正的统治者。',
      keywords: '历史人物, 领袖, 军事家, 外交家',
      aiInstructions: '扮演一个睿智、宽容但坚定的中世纪阿拉伯领袖',
      imageUrl: 'https://example.com/character-saladin.jpg'
    },
    size: 'medium',
    showActions: true
  }
}

// 无图片状态
export const NoImage: Story = {
  args: {
    character: {
      id: '3',
      name: '神秘法师',
      type: 'character',
      content: '一个身份不明的法师，总是戴着兜帽遮住面孔。',
      keywords: '法师, 神秘',
      aiInstructions: '扮演一个神秘莫测的魔法师',
      imageUrl: undefined
    },
    size: 'medium',
    showActions: true
  }
}

// 不同尺寸变体
export const SmallSize: Story = {
  args: {
    ...Default.args,
    size: 'small'
  }
}

export const LargeSize: Story = {
  args: {
    ...Default.args,
    size: 'large'
  }
}

// 无操作按钮状态
export const NoActions: Story = {
  args: {
    ...Default.args,
    showActions: false
  }
}

// 加载状态
export const Loading: Story = {
  args: {
    character: undefined,
    isLoading: true
  }
}

// 错误状态
export const Error: Story = {
  args: {
    character: undefined,
    error: '加载角色信息失败'
  }
}

// 交互测试 - 所有操作按钮
export const InteractionTest: Story = {
  args: {
    ...Default.args,
    onEdit: () => console.log('编辑角色'),
    onDelete: () => console.log('删除角色'),
    onDuplicate: () => console.log('复制角色'),
    onGenerateImage: () => console.log('生成图片')
  },
  play: async ({ canvasElement }) => {
    // 可以添加自动化交互测试
  }
}
```

### 第二步：分析当前问题和改进机会

在Storybook中运行上述Stories后，您会发现：

**问题识别**:
1. **文本溢出处理不当** - 长角色名和描述的显示问题
2. **图片加载状态缺失** - 没有loading占位符
3. **响应式问题** - 不同尺寸下的布局问题
4. **无障碍问题** - 缺少proper的ARIA标签
5. **交互反馈不足** - 按钮hover和点击状态

### 第三步：设计改进版本

创建新的Story来展示改进方案：

```typescript
// 添加到CharacterPreview.stories.tsx

// 改进版本的设计原型
export const ImprovedDesign: Story = {
  args: {
    character: {
      id: '4',
      name: '艾莉丝',
      type: 'character',
      content: '一位勇敢的女战士，拥有火系魔法能力。',
      keywords: '战士, 火系魔法, 勇敢',
      aiInstructions: '扮演一个勇敢但有时冲动的战士角色',
      imageUrl: 'https://example.com/character-alice.jpg'
    },
    size: 'medium',
    showActions: true,
    // 新增的改进属性
    showKeywords: true,
    truncateDescription: true,
    imageAspectRatio: '1:1',
    animateOnHover: true
  },
  parameters: {
    docs: {
      description: {
        story: '改进版本：添加了关键词显示、文本截断、图片比例控制等功能'
      }
    }
  }
}

// 响应式测试
export const ResponsiveTest: Story = {
  args: Default.args,
  parameters: {
    viewport: {
      viewports: {
        mobile: { name: 'Mobile', styles: { width: '320px', height: '568px' } },
        tablet: { name: 'Tablet', styles: { width: '768px', height: '1024px' } },
        desktop: { name: 'Desktop', styles: { width: '1200px', height: '800px' } }
      }
    }
  }
}
```

### 第四步：实现组件改进

基于Storybook中的设计，实现新的组件：

```typescript
// src/components/CharacterPreview.tsx
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Edit, Trash2, Copy, ImageIcon } from 'lucide-react'
import type { LibraryCard } from '../types'

interface CharacterPreviewProps {
  character?: LibraryCard
  size?: 'small' | 'medium' | 'large'
  showActions?: boolean
  showKeywords?: boolean
  truncateDescription?: boolean
  imageAspectRatio?: '1:1' | '16:9' | '4:3'
  animateOnHover?: boolean
  isLoading?: boolean
  error?: string
  onEdit?: () => void
  onDelete?: () => void
  onDuplicate?: () => void
  onGenerateImage?: () => void
}

export function CharacterPreview({
  character,
  size = 'medium',
  showActions = true,
  showKeywords = false,
  truncateDescription = false,
  imageAspectRatio = '1:1',
  animateOnHover = false,
  isLoading = false,
  error,
  onEdit,
  onDelete,
  onDuplicate,
  onGenerateImage
}: CharacterPreviewProps) {
  const [imageLoading, setImageLoading] = useState(true)
  const [imageError, setImageError] = useState(false)

  // 尺寸配置
  const sizeConfig = {
    small: { cardClass: 'w-48', imageHeight: 'h-24', titleClass: 'text-sm' },
    medium: { cardClass: 'w-72', imageHeight: 'h-40', titleClass: 'text-base' },
    large: { cardClass: 'w-96', imageHeight: 'h-56', titleClass: 'text-lg' }
  }

  const config = sizeConfig[size]

  // 处理加载状态
  if (isLoading) {
    return (
      <Card className={`${config.cardClass} ${animateOnHover ? 'transition-transform hover:scale-105' : ''}`}>
        <CardHeader className="pb-2">
          <Skeleton className={`${config.imageHeight} w-full rounded-md`} />
          <Skeleton className="h-4 w-3/4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-3 w-full mb-2" />
          <Skeleton className="h-3 w-2/3" />
        </CardContent>
      </Card>
    )
  }

  // 处理错误状态
  if (error) {
    return (
      <Card className={`${config.cardClass} border-destructive`}>
        <CardContent className="pt-6 text-center">
          <p className="text-destructive text-sm">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (!character) return null

  // 文本截断处理
  const description = truncateDescription && character.content.length > 100
    ? character.content.substring(0, 100) + '...'
    : character.content

  return (
    <Card
      className={`${config.cardClass} ${animateOnHover ? 'transition-all duration-200 hover:scale-105 hover:shadow-lg' : ''}`}
      role="article"
      aria-label={`角色卡: ${character.name}`}
    >
      <CardHeader className="pb-2">
        {/* 角色图片 */}
        <div className={`${config.imageHeight} w-full relative rounded-md overflow-hidden bg-muted`}>
          {character.imageUrl ? (
            <>
              {imageLoading && (
                <Skeleton className="absolute inset-0" />
              )}
              <img
                src={character.imageUrl}
                alt={character.name}
                className={`w-full h-full object-cover transition-opacity duration-200 ${
                  imageLoading ? 'opacity-0' : 'opacity-100'
                }`}
                onLoad={() => setImageLoading(false)}
                onError={() => {
                  setImageLoading(false)
                  setImageError(true)
                }}
                style={{ aspectRatio: imageAspectRatio }}
              />
              {imageError && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full bg-muted">
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
        </div>

        <CardTitle className={`${config.titleClass} line-clamp-2`}>
          {character.name}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* 角色描述 */}
        <p className="text-sm text-muted-foreground line-clamp-3">
          {description}
        </p>

        {/* 关键词标签 */}
        {showKeywords && character.keywords && (
          <div className="flex flex-wrap gap-1">
            {character.keywords.split(',').map((keyword, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {keyword.trim()}
              </Badge>
            ))}
          </div>
        )}

        {/* 操作按钮 */}
        {showActions && (
          <div className="flex justify-between pt-2">
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={onEdit}
                aria-label={`编辑${character.name}`}
              >
                <Edit className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onDuplicate}
                aria-label={`复制${character.name}`}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={onGenerateImage}
                aria-label={`为${character.name}生成图片`}
              >
                <ImageIcon className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={onDelete}
                aria-label={`删除${character.name}`}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

## 🔄 日常开发工作流

### 开发新组件时

1. **启动Storybook**: `npm run storybook`
2. **创建Story文件**: `ComponentName.stories.tsx`
3. **定义基础Stories**: Default, Loading, Error, 边界情况
4. **在Storybook中调试**: 实时预览所有状态
5. **实现组件**: 基于Story的需求实现
6. **集成到应用**: 确保在真实环境中正常工作

### 重构现有组件时

1. **先写Story**: 记录当前状态
2. **识别问题**: 通过不同Stories发现问题
3. **设计改进**: 创建新的Story展示改进方案
4. **逐步重构**: 保持Stories通过的情况下重构
5. **更新文档**: 保持Story和实现同步

## 📝 Story编写最佳实践

### 必须包含的Stories

1. **Default**: 正常状态
2. **Loading**: 加载状态
3. **Error**: 错误状态
4. **Empty**: 空状态
5. **Edge Cases**: 边界情况（长文本、特殊字符等）

### Story命名规范

- 使用PascalCase：`DefaultState`, `LoadingState`
- 描述性命名：`LongTextOverflow`, `MobileViewport`
- 状态明确：`WithActions`, `WithoutImage`

### 参数配置

```typescript
argTypes: {
  propertyName: {
    description: '属性描述',
    control: { type: 'select' }, // boolean, text, number, select, object
    options: ['option1', 'option2'], // for select
    table: {
      defaultValue: { summary: 'default value' }
    }
  }
}
```

## 🎯 团队协作流程

### 设计审查

1. **创建设计Story**: 展示设计方案
2. **分享Storybook链接**: 让团队成员预览
3. **收集反馈**: 通过Storybook评论功能
4. **迭代设计**: 在Storybook中快速调整

### 代码审查

1. **PR包含Story更新**: 新功能必须有对应的Story
2. **Story覆盖率检查**: 确保主要状态都有覆盖
3. **视觉回归测试**: 使用Chromatic等工具

### 开发协作

1. **组件接口设计**: 通过Story定义组件API
2. **Mock数据标准化**: 在Story中定义标准的测试数据
3. **状态管理**: 通过Story展示组件的所有可能状态

## 🚀 进阶功能

### 自动化测试集成

```bash
# 安装依赖
npm install --save-dev @storybook/test-runner @storybook/addon-interactions

# 运行测试
npm run test-storybook
```

### 视觉回归测试

```bash
# 安装Chromatic
npm install --save-dev chromatic

# 运行视觉测试
npx chromatic --project-token=your-token
```

### 文档自动生成

```typescript
// 添加到组件
/**
 * CharacterPreview组件用于显示角色卡的预览信息
 *
 * @param character - 角色数据
 * @param size - 预览尺寸
 * @param showActions - 是否显示操作按钮
 */
export function CharacterPreview({ ... }) { ... }
```

## 📋 实施计划

### Week 1: 基础设置
- [ ] 为所有shadcn/ui基础组件创建Stories
- [ ] 建立Story编写规范和模板
- [ ] 培训团队成员Storybook使用

### Week 2: 业务组件
- [ ] CharacterPreview, StoryCard等核心组件Stories
- [ ] 游戏界面相关组件Stories
- [ ] 设置CI/CD集成

### Week 3: 高级功能
- [ ] 交互测试集成
- [ ] 视觉回归测试设置
- [ ] 文档自动化完善

### Week 4: 流程优化
- [ ] 团队工作流培训
- [ ] 性能优化
- [ ] 维护文档完善

---

**通过这个工作流，您的CharacterPreview组件将从"AI全权设计"变成"数据驱动、测试充分、文档完善"的专业组件。Storybook将成为您设计、开发、测试、协作的核心工具。**