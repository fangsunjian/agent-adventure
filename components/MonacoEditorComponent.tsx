import { Editor } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import React, { useEffect, useRef, useState } from 'react';
import { MaximizeIcon, MinimizeIcon } from './icons';

interface MonacoEditorComponentProps {
  language: 'html' | 'css' | 'javascript';
  value: string;
  onChange: (value: string) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  theme?: 'light' | 'dark';
  readOnly?: boolean;
  placeholder?: string;
}

const MonacoEditorComponent: React.FC<MonacoEditorComponentProps> = ({
  language,
  value,
  onChange,
  isFullscreen = false,
  onToggleFullscreen,
  theme = 'light',
  readOnly = false,
  placeholder = ''
}) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);

  // 编辑器配置
  const editorOptions: editor.IStandaloneEditorConstructionOptions = {
    theme: theme === 'dark' ? 'vs-dark' : 'vs-light',
    fontSize: 14,
    fontFamily: '"Fira Code", "JetBrains Mono", "Monaco", "Menlo", "Consolas", monospace',
    wordWrap: 'on',
    minimap: {
      enabled: isFullscreen
    },
    automaticLayout: true,
    folding: true,
    lineNumbers: 'on',
    renderWhitespace: 'selection',
    tabSize: 2,
    insertSpaces: true,
    scrollBeyondLastLine: false,
    smoothScrolling: true,
    cursorBlinking: 'smooth',
    multiCursorModifier: 'ctrlCmd',
    formatOnPaste: true,
    formatOnType: true,
    suggestOnTriggerCharacters: true,
    acceptSuggestionOnCommitCharacter: true,
    parameterHints: { enabled: true },
    quickSuggestions: true,
    readOnly,
    selectOnLineNumbers: true,
    mouseWheelZoom: true,
    scrollbar: {
      verticalScrollbarSize: 12,
      horizontalScrollbarSize: 12,
      useShadows: false,
      verticalHasArrows: false,
      horizontalHasArrows: false,
      alwaysConsumeMouseWheel: true
    },
    overviewRulerLanes: 3,
    overviewRulerBorder: false,
    hideCursorInOverviewRuler: false
  };

  // 处理编辑器挂载
  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
    setIsEditorReady(true);

    // 自定义HTML/CSS/JavaScript的语言特性
    setupLanguageFeatures(editor, language);

    // 添加快捷键
    const monacoInstance = (window as any).monaco;
    if (monacoInstance) {
      editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
        // 保存快捷键 - 可以添加保存逻辑
        console.log('Save shortcut pressed');
      });

      editor.addCommand(monacoInstance.KeyCode.F11, () => {
        // F11全屏切换
        if (onToggleFullscreen) {
          onToggleFullscreen();
        }
      });
    }
  };

  // 设置语言特性
  const setupLanguageFeatures = (editor: editor.IStandaloneCodeEditor, lang: string) => {
    const monacoInstance = (window as any).monaco;
    if (!monacoInstance) return;

    // 为HTML组件开发添加自定义补全
    if (lang === 'html') {
      monacoInstance.languages.registerCompletionItemProvider('html', {
        provideCompletionItems: (model: any, position: any) => {
          const suggestions = [
            {
              label: 'gameAPI-ai-generate',
              kind: monacoInstance.languages.CompletionItemKind.Snippet,
              documentation: '调用AI生成内容',
              insertText: 'const response = await window.gameAPI.ai.generate(\'${1:提示词}\');\nconsole.log(\'AI回应:\', response);',
              insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range: {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: position.column,
                endColumn: position.column
              }
            },
            {
              label: 'gameAPI-storage-save',
              kind: monaco.languages.CompletionItemKind.Snippet,
              documentation: '保存数据到游戏存储',
              insertText: 'await window.gameAPI.storage.save(\'${1:key}\', ${2:data});',
              insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range: {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: position.column,
                endColumn: position.column
              }
            },
            {
              label: 'gameAPI-tools-register',
              kind: monaco.languages.CompletionItemKind.Snippet,
              documentation: '注册AI工具',
              insertText: `await window.gameAPI.tools.register({
  name: '\${1:tool_name}',
  description: '\${2:工具描述}',
  parameters: {
    type: 'object',
    properties: {
      \${3:param}: { type: '\${4:string}', description: '\${5:参数描述}' }
    },
    required: ['\${3:param}']
  },
  handler: (params) => {
    \${6:// 处理逻辑}
    return { success: true, result: params.\${3:param} };
  }
});`,
              insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range: {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: position.column,
                endColumn: position.column
              }
            }
          ];
          return { suggestions };
        }
      });
    }

    // 为JavaScript添加gameAPI的类型提示
    if (lang === 'javascript') {
      monacoInstance.languages.typescript.javascriptDefaults.addExtraLib(`
        declare global {
          interface Window {
            gameAPI: {
              ai: {
                generate(prompt: string, isJson?: boolean, schema?: any): Promise<any>;
              };
              storage: {
                save(key: string, data: any): Promise<void>;
                load(key: string): Promise<any>;
              };
              game: {
                sendData(data: any): void;
                updateState(updates: any): void;
                logMessage(message: string, type?: 'info' | 'warning' | 'error'): void;
              };
              tools: {
                register(toolDefinition: any): Promise<any>;
                unregister(toolName: string): Promise<any>;
                list(): Promise<any[]>;
                create: {
                  dataQuery(name: string, description: string, queryFunction: Function): any;
                  stateUpdate(name: string, description: string, updateFunction: Function): any;
                  calculation(name: string, description: string, parameters: any, calcFunction: Function): any;
                };
              };
            };
          }
        }
      `, 'gameapi.d.ts');
    }
  };

  // 处理值变化
  const handleChange = (value: string | undefined) => {
    if (value !== undefined) {
      onChange(value);
    }
  };

  // 添加占位符支持
  useEffect(() => {
    if (isEditorReady && editorRef.current && !value && placeholder) {
      const editor = editorRef.current;
      const model = editor.getModel();
      if (model) {
        model.setValue(placeholder);
        // 设置占位符样式（灰色）
        const monacoInstance = (window as any).monaco;
        if (monacoInstance) {
          editor.deltaDecorations([], [{
            range: new monacoInstance.Range(1, 1, model.getLineCount(), model.getLineMaxColumn(model.getLineCount())),
            options: {
              inlineClassName: 'placeholder-text',
              isWholeLine: false
            }
          }]);
        }
      }
    }
  }, [isEditorReady, value, placeholder]);

  // 响应全屏状态变化
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({
        minimap: { enabled: isFullscreen }
      });
    }
  }, [isFullscreen]);




  return (
    <div className={`relative flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 bg-white dark:bg-zinc-900' : 'h-full'}`}>
      {/* 编辑器工具栏 */}
      <div className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800">
        <div className="flex items-center space-x-2">
          <div className={`px-2 py-1 text-xs font-mono rounded ${
            language === 'html' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
            language === 'css' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
            'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
          }`}>
            {language.toUpperCase()}
          </div>
          {isEditorReady && (
            <div className="text-xs text-gray-500 dark:text-zinc-400">
              Monaco Editor
            </div>
          )}
        </div>
        
        {onToggleFullscreen && (
          <button
            onClick={onToggleFullscreen}
            className="p-1 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded transition-colors"
            title={isFullscreen ? '退出全屏 (F11)' : '全屏编辑 (F11)'}
          >
            {isFullscreen ? 
              <MinimizeIcon className="w-4 h-4" /> : 
              <MaximizeIcon className="w-4 h-4" />
            }
          </button>
        )}
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <Editor
          language={language}
          value={value}
          onChange={handleChange}
          onMount={handleEditorDidMount}
          options={editorOptions}
          height="calc(100% - 0px)"
          loading={
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-indigo-600 rounded-full mx-auto mb-2"></div>
                <div className="text-sm text-gray-600 dark:text-zinc-400">加载编辑器...</div>
              </div>
            </div>
          }
        />
      </div>

      {/* 添加占位符样式和修复样式 */}
      <style>{`
        .placeholder-text {
          color: #9ca3af !important;
          font-style: italic;
        }
        
        /* Monaco Editor基础样式 */
        .monaco-editor {
          height: 100% !important;
          overflow: hidden !important;
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
        }
        
        .monaco-editor .overflow-guard {
          height: 100% !important;
        }
        
        /* 确保滚动条可见 */
        .monaco-editor .decorationsOverviewRuler {
          width: 12px !important;
        }
        
        .monaco-editor .monaco-scrollable-element > .scrollbar > .slider {
          background: rgba(121, 121, 121, 0.4) !important;
        }
        
        .monaco-editor .monaco-scrollable-element > .scrollbar > .slider:hover {
          background: rgba(100, 100, 100, 0.7) !important;
        }
      `}</style>
    </div>
  );
};

export default MonacoEditorComponent;