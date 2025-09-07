import { GoogleGenAI, Type } from '@google/genai';
import { jsonrepair } from 'jsonrepair';
import { PROMPTS } from '../prompts';
import type { CustomModel, GameSettings, HistoryItem, Memories, MilestoneSummaryItem, SceneFragment, Story } from '../types';
import { DynamicPromptLoader } from '../utils/dynamicPromptLoader';
import { GameEngine } from './GameEngine';

if (!process.env.GEMINI_API_KEY) {
  console.warn("GEMINI_API_KEY environment variable not set for Gemini. This is fine if you are using a custom provider.");
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Base system instructions are now loaded dynamically from files

const RESPONSE_SCHEMA_EN = {
  type: Type.OBJECT,
  properties: {
    description: { type: Type.STRING, description: "A detailed, atmospheric description of the current scene, second person. At least 3 sentences." },
    image_prompt: { type: Type.STRING, description: "A concise, detailed prompt for an AI image generator representing the scene. Thematic to dark fantasy. Example: 'A lone knight stands before a glowing portal in a dark, cavernous throne room, cinematic lighting, dark fantasy art, epic, highly detailed.'" },
    actions: { type: Type.ARRAY, description: "An array of 3-4 distinct actions the player can take. Phrase as commands, e.g., 'Open the ancient chest.'", items: { type: Type.STRING } },
    summary: { type: Type.STRING, description: "A very brief, one-sentence summary of the outcome of the player's last action." },
  },
  required: ["description", "image_prompt", "actions", "summary"]
};

// Chinese system instructions are now loaded dynamically from files

const RESPONSE_SCHEMA_ZH = {
  type: Type.OBJECT,
  properties: {
    description: { type: Type.STRING, description: "当前场景的详细、有气氛的描述，用第二人称书写。至少3句话长。" },
    image_prompt: { type: Type.STRING, description: "为AI图像生成器提供的简洁、详细的提示，准确视觉化场景。与黑暗幻想主题一致。例如：'一个孤独的骑士站在一个黑暗、巨大的宝座房间里的发光传送门前，电影般的灯光，黑暗幻想艺术，史诗感，高细节。'" },
    actions: { type: Type.ARRAY, description: "一个包含3到4个玩家接下来可以采取的独特行动的数组。用命令的形式表达，例如，'打开古老的箱子。'", items: { type: Type.STRING } },
    summary: { type: Type.STRING, description: "对玩家上一个行动结果的非常简短的一句话总结。" },
  },
  required: ["description", "image_prompt", "actions", "summary"]
};

const MILESTONE_SCHEMA_EN = {
  type: Type.OBJECT,
  properties: {
    is_milestone: { type: Type.BOOLEAN, description: "Set to true if a milestone was identified in the provided text." },
    summary: { type: Type.STRING, description: "A concise summary of the milestone event." },
    reason: { type: Type.STRING, description: "A brief explanation of why this is a milestone." },
    tags: { type: Type.ARRAY, description: "1-3 relevant tags (e.g., 'Character Development', 'Plot Twist', 'New Quest').", items: { type: Type.STRING } },
    priority: { type: Type.INTEGER, description: "An integer from 1 to 10 indicating the importance of the milestone." }
  },
  required: ["is_milestone", "summary", "reason", "tags", "priority"]
};

const MILESTONE_SCHEMA_ZH = {
    type: Type.OBJECT,
    properties: {
        is_milestone: { type: Type.BOOLEAN, description: "如果在提供的文本中识别出里程碑，则设置为 true。" },
        summary: { type: Type.STRING, description: "里程碑事件的简明摘要。" },
        reason: { type: Type.STRING, description: "简要解释为什么这是一个里程碑。" },
        tags: { type: Type.ARRAY, description: "1-3个相关标签（例如，'角色发展'，'情节转折'，'新任务'）。", items: { type: Type.STRING } },
        priority: { type: Type.INTEGER, description: "表示里程碑重要性的1到10之间的整数。" }
    },
    required: ["is_milestone", "summary", "reason", "tags", "priority"]
};

// Tool definitions for dialogue system - descriptions loaded dynamically
const createDialogueTools = (language: 'en' | 'zh') => {
    const description = DynamicPromptLoader.getDialogueToolDescriptionSync(language) || 
                       PROMPTS[language].dialogueToolDescription; // Fallback to static
    
    return [
        {
            type: "function",
            function: {
                name: "show_dialogue",
                description: description,
                parameters: {
                    type: "object",
                    properties: {
                        speaker: {
                            type: "string",
                            description: language === 'zh' ? "说话角色的名称" : "Name of the character speaking (e.g., 'Village Elder', '老村长')"
                        },
                        messages: {
                            type: "array",
                            items: { type: "string" },
                            description: language === 'zh' 
                                ? "对话消息数组，每条消息将逐一显示。将长篇对话分割为多个句子/想法以获得更好的节奏感。每个元素应该是一个完整的句子或想法。重要：对引号使用正确的JSON转义\\\"，但保持自然的句子结构。示例：[\"你好，旅行者！\", \"我一直在等待像你这样的人。\", \"村子里有麻烦需要你的帮助。\"]"
                                : "Array of dialogue messages that will be displayed one by one. Split long speeches into multiple sentences/thoughts for better pacing. Each element should be one complete sentence or thought. CRITICAL: Use proper JSON escaping for quotes with \\\" but keep natural sentence structure. Example: [\"Hello traveler!\", \"I've been waiting for someone like you.\", \"There's trouble in the village that needs your help.\"]"
                        },
                        avatar: {
                            type: "string",
                            description: language === 'zh' ? "说话者头像URL（可选）" : "Optional avatar URL for the speaker"
                        }
                    },
                    required: ["speaker", "messages"]
                }
            }
        }
    ];
};

// Tool handler interface
export interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
}

export interface ToolHandler {
  show_dialogue: (args: { speaker: string; messages: string[]; avatar?: string }) => Promise<any>;
}

// Enhanced return type for GameEngine results
export interface GameEngineResult {
  scene?: SceneFragment;
  rawResponse: string;
  toolCalls?: ToolCall[];
  actionData?: {
    actions: string[];
    context?: string;
    timestamp: number;
  };
  playerLocationData?: {
    mapId: string;
    locationId: string;
    mapName: string;
    locationName: string;
    reason: string;
    timestamp: number;
  };
  mapData?: any;
  error?: boolean;
  errorMessage?: string;
}

// Enhanced function that supports tool calls
export async function getNextSceneWithTools(
    history: HistoryItem[],
    settings: GameSettings,
    memories: Memories,
    logCommunication: (type: string, data: any) => void,
    abortSignal: AbortSignal,
    toolHandler?: ToolHandler
): Promise<{ scene?: SceneFragment; rawResponse: string; toolCalls?: ToolCall[] }> {
    
    const contextualHistory = buildContextualHistory(history, memories, settings);
    const { geminiSystemInstruction, openAIMessages } = buildPromptParts(contextualHistory, settings);

    if (settings.provider === 'custom') {
        if (!settings.customEndpoint) throw new Error("Custom endpoint URL is not configured in settings.");
        const url = settings.customEndpoint.replace(/\/+$/, '') + '/chat/completions';

        // Only use tools if enabled in settings
        if (!settings.enableDialogueTools) {
            // Fall back to regular scene generation without tools
            return await getNextScene(history, settings, memories, logCommunication, abortSignal);
        }

        const tools = createDialogueTools(settings.language);
        
        // Build base payload - let AI decide when to use dialogue tools
        const requestPayload: any = {
            model: settings.customModelId || 'gpt-4-turbo',
            messages: openAIMessages,
            tools: tools,
            tool_choice: "auto",
            temperature: Number(settings.llm.temperature || 0.7),
            top_p: Number(settings.llm.topP || 1),
            max_tokens: Number(settings.llm.maxOutputTokens || 1000),
        };
        
        // Add OpenAI-specific parameters only for non-Google APIs
        const isGoogleAPI = settings.customEndpoint?.includes('googleapis.com') || 
                           settings.customEndpoint?.includes('generativelanguage.googleapis.com');
        
        if (!isGoogleAPI) {
            requestPayload.frequency_penalty = Number(settings.llm.frequencyPenalty || 0);
            requestPayload.presence_penalty = Number(settings.llm.presencePenalty || 0);
            
            // Add reasoning effort if set by user
            if (settings.llm.reasoningEffort) {
                requestPayload.reasoning_effort = settings.llm.reasoningEffort;
            }
            
            // Add JSON schema for structured output (when not using tool calls extensively)
            if (settings.useJsonSchemaForCustom) {
                const geminiSchema = settings.language === 'zh' ? RESPONSE_SCHEMA_ZH : RESPONSE_SCHEMA_EN;
                const jsonSchema = convertGeminiSchemaToJSONSchema(geminiSchema);

                if (settings.lmStudioCompatibleJson) {
                    requestPayload.response_format = { type: "json_schema", json_schema: { schema: jsonSchema } };
                } else {
                    requestPayload.response_format = { type: "json_object", schema: jsonSchema };
                }
            }
        }
        
        logCommunication('custom_request_getNextSceneWithTools', requestPayload);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.customApiKey}` },
                body: JSON.stringify(requestPayload),
                signal: abortSignal,
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`Custom provider API error: ${response.status} ${response.statusText} - ${errorBody}`);
            }
            
            const result = await response.json();
            logCommunication('custom_response_getNextSceneWithTools', result);
            
            if (!result.choices || result.choices.length === 0) {
                throw new Error("Custom provider returned an invalid response (empty choices array).");
            }

            const choice = result.choices[0];
            
            // 使用GameEngine的通用工具调用处理（支持xAI格式）
            const { toolCalls, content } = GameEngine.processAIResponseToolCalls(choice, logCommunication);

            console.log('Raw API response choice:', choice);
            console.log('Tool calls detected:', toolCalls);
            console.log('Content:', content);

            // If there are tool calls, handle them
            if (toolCalls && toolCalls.length > 0 && toolHandler) {
                console.log('Processing tool calls:', toolCalls);
                const processedToolCalls: ToolCall[] = [];
                
                for (const toolCall of toolCalls) {
                    console.log('Processing tool call:', toolCall);
                    if (toolCall.function.name === 'show_dialogue') {
                        try {
                            console.log('Raw arguments:', toolCall.function.arguments);
                            
                            // Try to parse and fix malformed JSON arguments
                            let args;
                            try {
                                args = JSON.parse(toolCall.function.arguments);
                                
                                // Fix messages format if it's not an array of strings
                                if (args.messages && Array.isArray(args.messages)) {
                                    args.messages = args.messages.map((msg: any) => {
                                        if (typeof msg === 'string') {
                                            return msg;
                                        } else if (typeof msg === 'object' && msg.content) {
                                            // Extract content from role-based message objects
                                            return msg.content;
                                        } else if (typeof msg === 'object' && msg.text) {
                                            // Extract text field
                                            return msg.text;
                                        } else {
                                            // Convert to string as fallback
                                            return String(msg);
                                        }
                                    });
                                }
                                
                            } catch (parseError) {
                                console.log('Initial JSON parse failed, attempting repair...');
                                
                                // Try to extract valid JSON from malformed string
                                const argsStr = toolCall.function.arguments;
                                
                                // Look for speaker pattern
                                const speakerMatch = argsStr.match(/"speaker"\s*:\s*"([^"]+)"/);
                                const messagesMatch = argsStr.match(/"messages"\s*:\s*\[(.*?)\]/);
                                
                                if (speakerMatch) {
                                    args = {
                                        speaker: speakerMatch[1],
                                        messages: [] as string[]
                                    };
                                    
                                    if (messagesMatch) {
                                        // Try to extract messages
                                        const messagesStr = messagesMatch[1];
                                        const messageMatches = messagesStr.match(/"([^"]+)"/g);
                                        if (messageMatches) {
                                            args.messages = messageMatches.map((m: string) => m.slice(1, -1)); // Remove quotes
                                        }
                                    }
                                    
                                    // Fallback: use a default message if no messages found
                                    if (!args.messages.length) {
                                        // Extract any text content as message
                                        const textMatch = argsStr.match(/[\u4e00-\u9fff\w\s.,!?，。！？]+/);
                                        if (textMatch) {
                                            args.messages = [textMatch[0].trim()];
                                        } else {
                                            args.messages = ["欢迎与我对话！"];
                                        }
                                    }
                                    
                                    console.log('Repaired arguments:', args);
                                } else {
                                    throw parseError; // Re-throw if can't repair
                                }
                            }
                            
                            console.log('Final parsed tool arguments:', args);
                            await toolHandler.show_dialogue(args);
                            processedToolCalls.push(toolCall);
                        } catch (e) {
                            console.error('Failed to execute tool call:', e);
                            console.error('Tool call details:', toolCall);
                        }
                    }
                }

                return {
                    rawResponse: JSON.stringify(result),
                    toolCalls: processedToolCalls
                };
            }

            // No tool calls, try to parse as regular scene
            if (content) {
                console.log('No tool calls, attempting to parse as scene:', content);
                try {
                    // Remove markdown code blocks if present
                    let cleanContent = content;
                    const jsonMatch = content.match(/```json\s*\n([\s\S]*?)\n```/);
                    if (jsonMatch) {
                        cleanContent = jsonMatch[1];
                    }
                    
                    // Try to fix common JSON syntax issues
                    cleanContent = cleanContent
                        .replace(/,\s*}/g, '}') // Remove trailing commas before }
                        .replace(/,\s*]/g, ']') // Remove trailing commas before ]
                        .trim();
                    
                    // Fix misplaced summary in actions array
                    // Pattern: "actions": [..., "summary": "text"}
                    if (cleanContent.includes('"actions":') && cleanContent.includes('"summary":')) {
                        const summaryInArrayPattern = /"actions":\s*\[(.*?),\s*"summary":\s*"([^"]*?)"\s*\}/;
                        const summaryMatch = cleanContent.match(summaryInArrayPattern);
                        
                        if (summaryMatch) {
                            console.log('Detected misplaced summary in actions array, fixing...');
                            try {
                                const actionsStr = summaryMatch[1];
                                const summaryText = summaryMatch[2];
                                
                                // Parse actions properly - they should be JSON array elements
                                let actions = [];
                                if (actionsStr.trim()) {
                                    // Try to parse as JSON array elements
                                    try {
                                        const jsonArrayStr = `[${actionsStr}]`;
                                        actions = JSON.parse(jsonArrayStr);
                                    } catch {
                                        // Fallback: manual parsing
                                        actions = actionsStr.split(',')
                                            .map((action: string) => action.trim().replace(/^"|"$/g, ''))
                                            .filter((action: string) => action.length > 0);
                                    }
                                }
                                
                                // Get everything before "actions" and rebuild
                                const beforeActions = cleanContent.substring(0, cleanContent.indexOf('"actions"'));
                                
                                // Rebuild the entire object
                                const fixedContent = beforeActions + 
                                    `"actions": ${JSON.stringify(actions)}, "summary": "${summaryText}"}`;
                                
                                console.log('Fixed misplaced summary:', fixedContent);
                                
                                // Validate the fixed JSON before using it
                                try {
                                    JSON.parse(fixedContent);
                                    cleanContent = fixedContent;
                                    console.log('JSON validation passed');
                                } catch (validationError) {
                                    console.log('Fixed JSON still invalid, reverting to original:', validationError);
                                    // Don't update cleanContent if validation fails
                                }
                            } catch (fixError) {
                                console.log('Failed to fix misplaced summary:', fixError);
                                console.log('Original content:', cleanContent);
                            }
                        }
                    }
                    
                    // Try to fix malformed actions array format
                    // Pattern: {"actions": ["show_dialogue", "data": {...}]}
                    const malformedActionsPattern = /"actions":\s*\["show_dialogue",\s*"data":\s*(\{.*?\})\]/s;
                    const malformedMatch = cleanContent.match(malformedActionsPattern);
                    
                    if (malformedMatch) {
                        console.log('Detected malformed actions format, attempting to fix...');
                        console.log('Original malformed content:', cleanContent);
                        try {
                            // Extract the data object string and try to parse it
                            let dataObjectStr = malformedMatch[1];
                            
                            // Handle nested quotes by attempting progressive parsing
                            let dataObject;
                            try {
                                dataObject = JSON.parse(dataObjectStr);
                            } catch (parseError) {
                                console.log('Failed to parse data object directly, trying to extract manually...');
                                
                                // Manual extraction for complex nested structure
                                const speakerMatch = dataObjectStr.match(/"speaker":\s*"([^"]+)"/);
                                const messagesMatch = dataObjectStr.match(/"messages":\s*\[(.*?)\]/s);
                                
                                if (speakerMatch) {
                                    dataObject = {
                                        speaker: speakerMatch[1],
                                        messages: []
                                    };
                                    
                                    if (messagesMatch) {
                                        const messagesStr = messagesMatch[1];
                                        // Extract individual messages
                                        const messageMatches = messagesStr.match(/"[^"]*(?:\\.[^"]*)*"/g);
                                        if (messageMatches) {
                                            dataObject.messages = messageMatches.map((m: string) => {
                                                // Remove outer quotes and unescape inner quotes
                                                return m.slice(1, -1).replace(/\\"/g, '"');
                                            });
                                        }
                                    }
                                }
                            }
                            
                            if (dataObject && dataObject.speaker) {
                                // Create properly formatted JSON
                                const fixedJson = {
                                    show_dialogue: {
                                        speaker: dataObject.speaker,
                                        messages: dataObject.messages || []
                                    }
                                };
                                
                                console.log('Fixed JSON:', fixedJson);
                                cleanContent = JSON.stringify(fixedJson);
                            }
                        } catch (fixError) {
                            console.log('Failed to fix malformed actions:', fixError);
                            console.log('Continuing with original content...');
                        }
                    }
                    
                    // Try to fix truncated JSON
                    if (!cleanContent.endsWith('}') && !cleanContent.endsWith(']')) {
                        console.log('JSON appears truncated, attempting basic repair...');
                        
                        // Count open/close brackets to guess how to close
                        const openBraces = (cleanContent.match(/\{/g) || []).length;
                        const closeBraces = (cleanContent.match(/\}/g) || []).length;
                        const openBrackets = (cleanContent.match(/\[/g) || []).length;
                        const closeBrackets = (cleanContent.match(/\]/g) || []).length;
                        
                        // Add missing closing characters
                        for (let i = 0; i < openBrackets - closeBrackets; i++) {
                            cleanContent += ']';
                        }
                        for (let i = 0; i < openBraces - closeBraces; i++) {
                            cleanContent += '}';
                        }
                        
                        console.log('Attempted repair of truncated JSON:', cleanContent);
                    }
                    
                    console.log('Cleaned content for parsing:', cleanContent);
                    
                    // Try jsonrepair first for comprehensive JSON fixing
                    try {
                        console.log('Attempting jsonrepair...');
                        const repairedContent = jsonrepair(cleanContent);
                        console.log('jsonrepair succeeded:', repairedContent);
                        cleanContent = repairedContent;
                    } catch (repairError) {
                        console.log('jsonrepair failed, continuing with manual repairs:', repairError);
                    }
                    
                    // Additional safety check for any remaining malformed actions array
                    if (cleanContent.includes('"actions"') && cleanContent.includes('"show_dialogue"') && cleanContent.includes('"data"')) {
                        console.log('Detected potential actions array issue, attempting comprehensive fix...');
                        
                        // Try to extract and fix any actions array issues
                        try {
                            // More general pattern to catch various malformed actions
                            const generalActionsPattern = /"actions":\s*\[([^\]]*"show_dialogue"[^\]]*)\]/s;
                            const actionsMatch = cleanContent.match(generalActionsPattern);
                            
                            if (actionsMatch) {
                                const actionsContent = actionsMatch[1];
                                console.log('Found problematic actions content:', actionsContent);
                                
                                // Look for speaker and messages in the actions content
                                const speakerMatch = actionsContent.match(/"speaker":\s*"([^"]+)"/);
                                const messagesMatch = actionsContent.match(/"messages":\s*\[(.*?)\]/s);
                                
                                if (speakerMatch) {
                                    let messages = [];
                                    if (messagesMatch) {
                                        const messagesStr = messagesMatch[1];
                                        const messageMatches = messagesStr.match(/"[^"]*(?:\\.[^"]*)*"/g);
                                        if (messageMatches) {
                                            messages = messageMatches.map((m: string) => m.slice(1, -1).replace(/\\"/g, '"'));
                                        }
                                    }
                                    
                                    // Replace the entire content with fixed embedded dialogue format
                                    const fixedJson = {
                                        show_dialogue: {
                                            speaker: speakerMatch[1],
                                            messages: messages
                                        }
                                    };
                                    
                                    cleanContent = JSON.stringify(fixedJson);
                                    console.log('Applied comprehensive fix, new content:', cleanContent);
                                }
                            }
                        } catch (comprehensiveFixError) {
                            console.log('Comprehensive fix failed:', comprehensiveFixError);
                        }
                    }
                    
                    let parsed;
                    try {
                        parsed = JSON.parse(cleanContent);
                    } catch (finalParseError) {
                        console.error('Final JSON parse failed, attempting last resort text extraction...', finalParseError);
                        console.error('Problematic content:', cleanContent);
                        
                        // Last resort: try to extract any readable text content
                        let description = 'An error occurred while processing the response.';
                        
                        // Try to extract any quoted text that might be the main content
                        const textMatch = cleanContent.match(/"([^"]+(?:\\.[^"]*)*)" /);
                        if (textMatch) {
                            description = textMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
                        }
                        
                        // Create a minimal valid scene
                        parsed = {
                            description: description,
                            imagePrompt: '',
                            actions: ['Continue'],
                            summary: 'Error occurred, continuing story...'
                        };
                        
                        console.log('Created fallback scene:', parsed);
                    }
                    
                    // Check if the AI embedded dialogue data in the JSON response
                    if (parsed.show_dialogue && toolHandler) {
                        console.log('Found embedded dialogue in JSON response:', parsed.show_dialogue);
                        
                        // Convert to standard format
                        const dialogueData = {
                            speaker: parsed.show_dialogue.NPC || parsed.show_dialogue.speaker,
                            messages: parsed.show_dialogue.dialogue || parsed.show_dialogue.messages,
                            avatar: parsed.show_dialogue.avatar
                        };
                        
                        console.log('Converted dialogue data:', dialogueData);
                        await toolHandler.show_dialogue(dialogueData);
                        
                        return {
                            rawResponse: content,
                            toolCalls: [{
                                id: `embedded-dialogue-${Date.now()}`,
                                type: 'function' as const,
                                function: {
                                    name: 'show_dialogue',
                                    arguments: JSON.stringify(dialogueData)
                                }
                            }]
                        };
                    }
                    
                    // Check for malformed actions array with embedded dialogue
                    if (parsed.actions && Array.isArray(parsed.actions) && toolHandler) {
                        console.log('Checking actions array for dialogue:', parsed.actions);
                        
                        // Look for show_dialogue in actions array
                        const hasDialogueAction = parsed.actions.includes('show_dialogue');
                        
                        if (hasDialogueAction) {
                            console.log('Found show_dialogue in actions, checking for data...');
                            
                            // Look for dialogue data in various possible locations
                            let dialogueData = null;
                            
                            // Check if there's a data property at the same level
                            if (parsed.data && parsed.data.speaker) {
                                dialogueData = {
                                    speaker: parsed.data.speaker,
                                    messages: parsed.data.messages || []
                                };
                            }
                            // Check if actions array has objects with dialogue data
                            else {
                                for (const action of parsed.actions) {
                                    if (typeof action === 'object' && action.speaker) {
                                        dialogueData = {
                                            speaker: action.speaker,
                                            messages: action.messages || []
                                        };
                                        break;
                                    }
                                }
                            }
                            
                            if (dialogueData && dialogueData.messages.length > 0) {
                                console.log('Extracted dialogue data from malformed actions:', dialogueData);
                                await toolHandler.show_dialogue(dialogueData);
                                
                                return {
                                    rawResponse: content,
                                    toolCalls: [{
                                        id: `malformed-dialogue-${Date.now()}`,
                                        type: 'function' as const,
                                        function: {
                                            name: 'show_dialogue',
                                            arguments: JSON.stringify(dialogueData)
                                        }
                                    }]
                                };
                            }
                        }
                    }
                    
                    // Regular scene parsing
                    const scene: SceneFragment = {
                        description: parsed.description,
                        imagePrompt: parsed.image_prompt || parsed.imagePrompt,
                        actions: parsed.actions,
                        summary: parsed.summary,
                    };
                    return { scene, rawResponse: content };
                } catch (parseError) {
                    console.error("Failed to parse scene response:", content, parseError);
                    console.error("Parse error details:", parseError);
                    
                    // Fallback: Try to extract text content from malformed mixed format
                    try {
                        console.log('Attempting fallback parsing for mixed format...');
                        
                        // Try to extract description from quoted text at the beginning
                        const textMatch = content.match(/^"([^"]*(?:\\.[^"]*)*)"/) || 
                                        content.match(/^([^"]*?)(?:",|$)/);
                        
                        if (textMatch) {
                            let description = textMatch[1];
                            // Unescape quotes and newlines
                            description = description
                                .replace(/\\"/g, '"')
                                .replace(/\\n/g, '\n')
                                .replace(/\\\\/g, '\\');
                            
                            console.log('Extracted description from fallback:', description);
                            
                            // Create a simple scene with just the text content
                            const scene: SceneFragment = {
                                description: description,
                                imagePrompt: '',
                                actions: [], // Empty actions since format was malformed
                                summary: description.slice(0, 100) + '...'
                            };
                            
                            return { scene, rawResponse: content };
                        }
                    } catch (fallbackError) {
                        console.error("Fallback parsing also failed:", fallbackError);
                    }
                    
                    // Final fallback: create a minimal scene to prevent crashes
                    console.log('All parsing failed, creating minimal scene...');
                    const minimalScene: SceneFragment = {
                        description: "你在一个神秘的地方，周围的环境让你感到困惑。你需要决定下一步行动。",
                        imagePrompt: "神秘的环境",
                        actions: ["继续探索", "停下来思考"],
                        summary: "玩家在一个未知的环境中"
                    };
                    
                    return { scene: minimalScene, rawResponse: content };
                }
            } else {
                console.error('No content and no tool calls in response');
                throw new Error("Empty response from API");
            }

        } catch(e) {
            if ((e as Error).name === 'AbortError') console.log('Fetch aborted by user.');
            logCommunication('custom_error_getNextSceneWithTools', e);
            throw e;
        }
    } else {
        // For Gemini, fall back to regular scene generation (tools not supported yet)
        return await getNextScene(history, settings, memories, logCommunication, abortSignal);
    }

    throw new Error("Failed to generate response");
}

/**
 * 新的工具化游戏引擎入口 - 使用完全工具化的系统
 */
export async function getNextSceneWithGameEngine(
    history: HistoryItem[],
    settings: GameSettings,
    memories: Memories,
    activeStory: Story,
    logCommunication: (type: string, data: any) => void,
    abortSignal: AbortSignal,
    toolHandler?: ToolHandler
): Promise<GameEngineResult> {
    
    try {
        console.log('🎮 Using new Game Engine for scene generation...');
        logCommunication('game_engine_start', { historyLength: history.length, settings: settings.provider });
        
        // 使用新的游戏引擎处理
        const result = await GameEngine.processGameTurn(
            history,
            settings,
            memories,
            activeStory,
            logCommunication,
            abortSignal,
            toolHandler as any // Temporary type assertion to resolve interface mismatch
        );
        
        console.log('✅ Game Engine processing completed:', {
            hasScene: !!result.scene,
            toolsUsed: result.engineData?.toolsUsed,
            executionTime: result.engineData?.executionTime
        });
        
        return {
            scene: result.scene,
            rawResponse: result.rawResponse,
            toolCalls: result.toolCalls?.map(tc => ({
                id: tc.id || `tool-${Date.now()}`,
                type: 'function' as const,
                function: tc.function
            })) || [],
            actionData: result.actionData, // 传递actionData给上层
            playerLocationData: result.playerLocationData,
            mapData: result.mapData
        };
        
    } catch (error: any) {
        console.error('❌ Game Engine failed, falling back to legacy system:', error);
        logCommunication('game_engine_fallback', {
            error: error.message,
            fallbackTo: 'getNextSceneWithTools'
        });
        
        // 回退到原有系统
        return await getNextSceneWithTools(
            history,
            settings,
            memories,
            logCommunication,
            abortSignal,
            toolHandler
        );
    }
}

/**
 * Recursively converts a Gemini-style schema object to a standard JSON Schema format.
 */
function convertGeminiSchemaToJSONSchema(geminiSchema: any): any {
    if (!geminiSchema || typeof geminiSchema !== 'object') return geminiSchema;
    const newSchema: { [key: string]: any } = {};
    for (const key in geminiSchema) {
        if (Object.prototype.hasOwnProperty.call(geminiSchema, key)) {
            const value = geminiSchema[key];
            if (key === 'type' && typeof value === 'string') {
                newSchema[key] = value.toLowerCase();
            } else if (key === 'properties' && typeof value === 'object' && value !== null) {
                newSchema[key] = {};
                for (const propKey in value) {
                    if (Object.prototype.hasOwnProperty.call(value, propKey)) {
                        newSchema[key][propKey] = convertGeminiSchemaToJSONSchema(value[propKey]);
                    }
                }
            } else if (key === 'items' && typeof value === 'object' && value !== null) {
                newSchema[key] = convertGeminiSchemaToJSONSchema(value);
            } else {
                newSchema[key] = value;
            }
        }
    }
    return newSchema;
}

function buildPromptParts(history: HistoryItem[], settings: GameSettings): { geminiSystemInstruction: string, openAIMessages: {role: string, content: string}[] } {
    const baseInstruction = DynamicPromptLoader.getBaseSystemInstructionSync(settings.language) || 
                            PROMPTS[settings.language].baseSystemInstruction; // Fallback to static
    const userInstructionsText = settings.systemInstructions
        .filter(instr => instr.enabled)
        .map(instr => instr.text)
        .join('\n');
    const geminiSystemInstruction = `${baseInstruction}\n${userInstructionsText}`;

    const openAIMessages: {role: string, content: string}[] = [];
    const systemRoleInstructions = settings.systemInstructions
        .filter(i => i.enabled && i.role === 'system')
        .map(i => i.text)
        .join('\n');
    openAIMessages.push({ role: 'system', content: `${baseInstruction}\n${systemRoleInstructions}`});

    settings.systemInstructions
        .filter(i => i.enabled && (i.role === 'user' || i.role === 'assistant'))
        .forEach(instr => {
            openAIMessages.push({ role: instr.role, content: instr.text });
        });
    
    history.forEach(h => {
        openAIMessages.push({
            role: h.role === 'model' ? 'assistant' : 'user',
            content: h.parts[0].text
        });
    });

    return { geminiSystemInstruction, openAIMessages };
}

function estimateTokens(text: string): number {
    return Math.ceil(text.length / 3.5);
}

function buildContextualHistory(
    fullHistory: HistoryItem[],
    memories: Memories,
    settings: GameSettings
): HistoryItem[] {
    // 1. Calculate token budget
    const modelResponseHistory = fullHistory.filter(h => h.role === 'model' && !h.isError);
    const last5Responses = modelResponseHistory.slice(-5);
    const responseBuffer = last5Responses.length > 0
        ? Math.max(...last5Responses.map(h => estimateTokens(h.parts[0].text)))
        : 1024;
    const maxTokens = (settings.llm.maxOutputTokens || 8192) - responseBuffer;

    let currentTokens = 0;
    const context: HistoryItem[] = [];

    // 2. Add full recent messages (5-10 items, so ~2-5 turns)
    const RECENT_MESSAGES_COUNT = 8; // 4 turns
    const recentHistory = fullHistory.slice(-RECENT_MESSAGES_COUNT);
    for(const item of recentHistory) {
        currentTokens += estimateTokens(item.parts[0].text);
    }
    context.unshift(...recentHistory);

    if (currentTokens > maxTokens) { // If even recent history is too long, truncate it
        while(currentTokens > maxTokens && context.length > 2) {
            const removedItem = context.shift();
            if (removedItem) currentTokens -= estimateTokens(removedItem.parts[0].text);
        }
        return context;
    }

    // 3. Build memory block
    let memoryBlock = "";
    
    // Milestones are highest priority
    if (memories.milestoneSummaries.length > 0) {
        memoryBlock += "Key Story Milestones (Highest Importance):\n";
        memories.milestoneSummaries.forEach(m => {
            memoryBlock += `- Turn ${m.turn}: ${m.summary} (Reason: ${m.reason}, Priority: ${m.priority})\n`;
        });
        memoryBlock += "\n";
    }

    // Grand Summaries
    if (memories.grandSummaries.length > 0) {
        memoryBlock += "Story Chapter Summaries:\n";
        memories.grandSummaries.forEach(gs => {
            memoryBlock += `- Summary up to Turn ${gs.turn}: ${gs.text}\n`;
        });
        memoryBlock += "\n";
    }

    // Single-turn summaries (up to 20)
    const turnsWithGrandSummary = new Set<number>();
    memories.grandSummaries.forEach(gs => {
        for (let i = 0; i < 5; i++) {
            turnsWithGrandSummary.add(gs.turn - i);
        }
    });

    const relevantSummaries = memories.summaries
        .map((summary, index) => ({ summary, turn: index + 1 }))
        .filter(s => !turnsWithGrandSummary.has(s.turn))
        .slice(-20);

    if (relevantSummaries.length > 0) {
        memoryBlock += "Recent Events (in chronological order):\n";
        relevantSummaries.forEach(s => {
            memoryBlock += `- Turn ${s.turn}: ${s.summary}\n`;
        });
    }

    const memoryTokens = estimateTokens(memoryBlock);
    if (currentTokens + memoryTokens <= maxTokens) {
        const memoryItem: HistoryItem = { role: 'user', parts: [{ text: `[The following is a summary of past events to provide context for the story. Do not mention this summary in your response.]\n\n${memoryBlock}` }]};
        context.unshift(memoryItem);
    }
    
    return context;
}

export async function getNextScene(
  history: HistoryItem[],
  settings: GameSettings,
  memories: Memories,
  logCommunication: (type: string, data: any) => void,
  abortSignal: AbortSignal
): Promise<{ scene: SceneFragment; rawResponse: string }> {
    
    const contextualHistory = buildContextualHistory(history, memories, settings);
    const { geminiSystemInstruction, openAIMessages } = buildPromptParts(contextualHistory, settings);
    
    let text: string;

    if (settings.provider === 'custom') {
        if (!settings.customEndpoint) throw new Error("Custom endpoint URL is not configured in settings.");
        const url = settings.customEndpoint.replace(/\/+$/, '') + '/chat/completions';

        let response_format: any = { type: "json_object" };
        if (settings.useJsonSchemaForCustom) {
            const geminiSchema = settings.language === 'zh' ? RESPONSE_SCHEMA_ZH : RESPONSE_SCHEMA_EN;
            const jsonSchema = convertGeminiSchemaToJSONSchema(geminiSchema);

            if (settings.lmStudioCompatibleJson) {
                response_format = { type: "json_schema", json_schema: { schema: jsonSchema } };
            } else {
                response_format = { type: "json_object", schema: jsonSchema };
            }
        }

        const requestPayload: any = {
            model: settings.customModelId || 'gpt-4-turbo',
            messages: openAIMessages,
            response_format: response_format,
            temperature: Number(settings.llm.temperature),
            top_p: Number(settings.llm.topP),
            max_tokens: Number(settings.llm.maxOutputTokens),
            frequency_penalty: Number(settings.llm.frequencyPenalty),
            presence_penalty: Number(settings.llm.presencePenalty),
        };
        
        // Add reasoning effort if set by user
        if (settings.llm.reasoningEffort) {
            requestPayload.reasoning_effort = settings.llm.reasoningEffort;
        }
        logCommunication('custom_request_getNextScene', requestPayload);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.customApiKey}` },
                body: JSON.stringify(requestPayload),
                signal: abortSignal,
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`Custom provider API error: ${response.status} ${response.statusText} - ${errorBody}`);
            }
            const data = await response.json();
            logCommunication('custom_response_getNextScene', data);
            if (!data.choices || data.choices.length === 0) throw new Error("Custom provider returned an invalid response (empty choices array).");
            text = data.choices[0].message.content;
            if (!text) throw new Error("Custom provider returned an invalid response (empty message content).");
        } catch(e) {
            if ((e as Error).name === 'AbortError') console.log('Fetch aborted by user.');
            logCommunication('custom_error_getNextScene', e);
            throw e;
        }
    } else {
        if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY environment variable not set. Please set it in your environment or use a custom provider in settings.");
        
        const responseSchema = settings.language === 'zh' ? RESPONSE_SCHEMA_ZH : RESPONSE_SCHEMA_EN;
        const requestPayload = {
          model: 'gemini-2.5-flash',
          contents: contextualHistory,
          config: {
            systemInstruction: geminiSystemInstruction,
            responseMimeType: "application/json",
            responseSchema: responseSchema,
            temperature: settings.llm.temperature,
            topP: settings.llm.topP,
            topK: settings.llm.topK,
            maxOutputTokens: settings.llm.maxOutputTokens,
          },
        };
        logCommunication('gemini_request_getNextScene', { ...requestPayload, contents: `[${contextualHistory.length} items]`});
        try {
            const abortPromise = new Promise((_, reject) => {
              abortSignal.addEventListener('abort', () => reject(new DOMException('Aborted by user', 'AbortError')));
            });
            const response = await Promise.race([ ai.models.generateContent(requestPayload), abortPromise ]) as any;
            logCommunication('gemini_response_getNextScene', response);
            text = response.text;
        } catch(e) {
            if ((e as Error).name === 'AbortError') console.log('Gemini request aborted by user.');
            logCommunication('gemini_error_getNextScene', e);
            throw e;
        }
    }
  
  try {
    const parsed = JSON.parse(text);
    const scene: SceneFragment = {
      description: parsed.description,
      imagePrompt: parsed.image_prompt,
      actions: parsed.actions,
      summary: parsed.summary,
    };
    return { scene, rawResponse: text };
  } catch (error) {
    console.error("Failed to parse AI response:", text, error);
    throw new Error("The story took an unexpected turn. The format of the response was invalid.");
  }
}


export async function evaluateAndGenerateMilestone(
    history: HistoryItem[],
    settings: GameSettings,
    logCommunication: (type: string, data: any) => void
): Promise<Omit<MilestoneSummaryItem, 'turn'> | null> {
    const prompt_en = `Analyze the latest turn of this text adventure conversation. Determine if it constitutes a milestone.
A milestone is a key event that should be remembered for the rest of the story. Criteria for a milestone:
- Important personal information or preferences are revealed.
- A significant decision or plan is made.
- A key date, item, or character is introduced or becomes critical.
- There is a moment of strong emotional importance.
If a milestone is found, respond with the JSON object. If not, respond with a JSON object where "is_milestone" is false.`;

    const prompt_zh = `分析这段文字冒险对话的最新回合。判断它是否构成一个里程碑。
里程碑是整个故事后续都应该被记住的关键事件。里程碑的标准：
- 揭示了重要的个人信息或偏好。
- 做出了重大的决定或计划。
- 引入了关键的日期、物品或角色，或者它们变得至关重要。
- 出现了情感上非常重要的时刻。
如果找到里程碑，请使用JSON对象进行响应。如果没有，则返回一个"is_milestone"为 false 的JSON对象。`;

    const prompt = settings.language === 'zh' ? prompt_zh : prompt_en;
    const milestoneHistory = [...history, { role: 'user' as const, parts: [{ text: prompt }] }];
    
    let text: string;

    try {
        if (settings.provider === 'custom') {
            if (!settings.customEndpoint) throw new Error("Custom endpoint URL is not configured in settings.");
            const url = settings.customEndpoint.replace(/\/+$/, '') + '/chat/completions';
            
            let response_format: any = { type: "json_object" };
            if (settings.useJsonSchemaForCustom) {
                 const geminiSchema = settings.language === 'zh' ? MILESTONE_SCHEMA_ZH : MILESTONE_SCHEMA_EN;
                 const jsonSchema = convertGeminiSchemaToJSONSchema(geminiSchema);

                 if (settings.lmStudioCompatibleJson) {
                     response_format = { type: "json_schema", json_schema: { schema: jsonSchema } };
                 } else {
                     response_format = { type: "json_object", schema: jsonSchema };
                 }
            }
            
            const { openAIMessages } = buildPromptParts(milestoneHistory, settings);
            const requestPayload = {
                model: settings.customModelId || 'gpt-4-turbo',
                messages: openAIMessages,
                response_format: response_format,
                temperature: 0.2, // Low temp for analytical task
            };
            logCommunication('custom_request_evaluateMilestone', requestPayload);

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.customApiKey}` },
                body: JSON.stringify(requestPayload),
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`Custom provider API error for milestone: ${response.status} ${response.statusText} - ${errorBody}`);
            }
            const data = await response.json();
            logCommunication('custom_response_evaluateMilestone', data);
            if (!data.choices || data.choices.length === 0) throw new Error("Custom provider returned an invalid milestone response (empty choices array).");
            text = data.choices[0].message.content;

        } else { // Gemini provider
            const responseSchema = settings.language === 'zh' ? MILESTONE_SCHEMA_ZH : MILESTONE_SCHEMA_EN;
            const requestPayload = {
                model: 'gemini-2.5-flash',
                contents: milestoneHistory,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                    temperature: 0.2, // Low temp for analytical task
                }
            };
            logCommunication('gemini_request_evaluateMilestone', { contents: `[${milestoneHistory.length} items]`});

            const response = await ai.models.generateContent(requestPayload);
            logCommunication('gemini_response_evaluateMilestone', response);
            text = response.text || '';
        }

        const parsed = JSON.parse(text);
        if (parsed.is_milestone) {
            return {
                summary: parsed.summary,
                reason: parsed.reason,
                tags: parsed.tags,
                priority: parsed.priority,
            };
        }
        return null;
    } catch(e) {
        logCommunication('api_error_evaluateMilestone', e);
        console.error("Failed to evaluate milestone:", e);
        return null; // Don't block game on failure
    }
}

export async function generateImage(
    prompt: string, 
    settings: GameSettings,
    logCommunication: (type: string, data: any) => void
): Promise<string> {
    if (settings.provider === 'custom' || !settings.enableImageGeneration) return "";
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY environment variable not set for image generation.");

    const requestPayload = {
        model: 'imagen-3.0-generate-002', prompt: prompt,
        config: { numberOfImages: 1, outputMimeType: 'image/jpeg', aspectRatio: '16:9' },
    };
    logCommunication('gemini_request_generateImage', requestPayload);

    try {
        const response = await ai.models.generateImages(requestPayload);
        logCommunication('gemini_response_generateImage', { generatedImagesCount: response.generatedImages?.length ?? 0 });
        if (response.generatedImages && response.generatedImages.length > 0) {
            const base64ImageBytes = response.generatedImages?.[0]?.image?.imageBytes || '';
            return `data:image/jpeg;base64,${base64ImageBytes}`;
        } else {
            throw new Error("No images were generated.");
        }
    } catch(error) {
        logCommunication('gemini_error_generateImage', error);
        console.error("Failed to generate image with prompt:", prompt, error);
        throw new Error("The world's visuals faded to black. Image generation failed.");
    }
}

export async function getCustomAIModels(endpoint: string, apiKey: string): Promise<CustomModel[]> {
    if (!endpoint) return [];
    const url = endpoint.replace(/\/+$/, '') + '/models';
    try {
        const response = await fetch(url, {
            method: 'GET', headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Failed to fetch models: ${response.status} ${response.statusText} - ${errorBody}`);
        }
        const data = await response.json();
        if (data && Array.isArray(data.data)) {
            return data.data.sort((a: any, b: any) => a.id.localeCompare(b.id));
        }
        return [];
    } catch (error) {
        console.error("Error fetching custom AI models:", error);
        throw error;
    }
}