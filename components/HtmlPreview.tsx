import React, { useRef, useEffect, useState } from 'react';
import type { LibraryCard, Language } from '../types';
import { translations } from '../constants';

interface HtmlPreviewProps {
  card: LibraryCard;
  language: Language;
  onUpdate?: (updatedCard: LibraryCard) => void;
  readonly?: boolean; // 预览模式下是否为只读
  className?: string;
}

const HtmlPreview: React.FC<HtmlPreviewProps> = ({
  card,
  language,
  onUpdate,
  readonly = true,
  className = ''
}) => {
  const t = translations[language];
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [srcDoc, setSrcDoc] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const hasHtmlContent = Boolean(card.htmlData?.html);

  // 生成HTML组件的完整内容
  useEffect(() => {
    if (!hasHtmlContent) {
      setSrcDoc('');
      setIsLoading(false);
      return;
    }

    if (card.htmlData) {
      const { html, css, js } = card.htmlData;

      // 简化版通信桥接代码（仅用于预览，不包含完整的游戏API）
      const previewBridgeScript = `
        // 预览模式的简化API
        window.gameAPI = {
          // 简化的日志输出
          game: {
            logMessage: (message, type = 'info') => {
              console.log(\`[\${type.toUpperCase()}]\`, message);
            }
          },

          // 简化的存储API（仅内存存储）
          storage: {
            _data: {},
            save: function(key, data) {
              this._data[key] = data;
              console.log('💾 预览模式保存数据:', key, data);
              return Promise.resolve();
            },
            load: function(key) {
              const data = this._data[key];
              console.log('📂 预览模式加载数据:', key, data);
              return Promise.resolve(data);
            }
          },

          // 简化的AI接口（预览模式）
          ai: {
            generate: function(prompt, isJson = false) {
              console.log('🤖 预览模式AI调用:', { prompt, isJson });
              return Promise.resolve('这是预览模式的模拟AI响应');
            }
          }
        };

        // 组件加载完成
        window.addEventListener('load', () => {
          console.log('📦 HTML组件预览已加载');
        });

        console.log('🔧 预览模式API已初始化');
      `;

      const previewContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${card.name || 'HTML组件预览'}</title>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
            <style>
              /* 基础样式重置 */
              * {
                box-sizing: border-box;
              }
              body {
                margin: 0;
                padding: 0.5rem;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                font-size: 14px; /* 预览模式下稍小的字体 */
              }

              /* 预览模式特殊样式 */
              .preview-mode {
                transform-origin: top left;
                width: 100%;
                height: 100%;
              }

              /* 用户自定义样式 */
              ${css}
            </style>
          </head>
          <body>
            <div class="preview-mode">
              ${html}
            </div>
            <script type="module">
              ${previewBridgeScript}
            </script>
            <script type="module">
              try {
                ${js}
              } catch (error) {
                console.error('预览模式脚本执行错误:', error);
                document.body.innerHTML += '<div style="position:fixed;top:10px;left:10px;background:red;color:white;padding:5px;border-radius:3px;font-size:12px;">脚本错误: ' + error.message + '</div>';
              }
            </script>
          </body>
        </html>
      `;

      setSrcDoc(previewContent);
      setIsLoading(true);
    }
  }, [hasHtmlContent, card.htmlData, card.name]);

  // 处理iframe加载完成
  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  if (!hasHtmlContent) {
    return (
      <div className={`flex items-center justify-center h-full text-gray-500 dark:text-zinc-400 ${className}`}>
        <div className="text-center">
          <p className="text-sm">HTML组件预览</p>
          <p className="text-xs mt-1">请编写HTML内容</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col ${className}`}>
      {/* 预览标题和状态 */}
      <div className="flex justify-between items-center mb-3">
        <div className="text-xs font-medium text-gray-700 dark:text-zinc-300">
          HTML组件预览
        </div>
        <div className="flex items-center gap-2">
          {isLoading ? (
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-zinc-400">
              <div className="animate-spin w-3 h-3 border border-gray-300 border-t-indigo-600 rounded-full"></div>
              <span>加载中...</span>
            </div>
          ) : (
            <div className="text-xs text-green-600 dark:text-green-400">
              ✓ 预览就绪
            </div>
          )}
        </div>
      </div>

      {/* HTML预览区域 */}
      <div className="flex-1 relative bg-white rounded-lg border border-gray-200 dark:border-zinc-700 overflow-hidden">
        {srcDoc && (
          <iframe
            ref={iframeRef}
            srcDoc={srcDoc}
            title={`${card.name || '未命名'} - 预览`}
            sandbox="allow-scripts allow-modals allow-forms"
            className="w-full h-full border-0"
            loading="lazy"
            onLoad={handleIframeLoad}
          />
        )}

        {/* 加载遮罩 */}
        {isLoading && (
          <div className="absolute inset-0 bg-gray-100 dark:bg-zinc-800 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-indigo-600 rounded-full mx-auto mb-2"></div>
              <p className="text-xs text-gray-600 dark:text-zinc-400">正在加载预览...</p>
            </div>
          </div>
        )}
      </div>

      {/* 组件信息 */}
      {!isLoading && card.content && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-zinc-700">
          <div className="text-xs font-medium text-gray-700 dark:text-zinc-300 mb-1">
            组件说明
          </div>
          <p className="text-xs text-gray-600 dark:text-zinc-400 line-clamp-3">
            {card.content}
          </p>
        </div>
      )}

      {/* 预览模式提示 */}
      <div className="mt-2 px-2 py-1 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded text-xs">
        <span className="text-blue-700 dark:text-blue-300">
          🔍 预览模式：功能可能受限，完整体验请在游戏中测试
        </span>
      </div>
    </div>
  );
};

export default HtmlPreview;
