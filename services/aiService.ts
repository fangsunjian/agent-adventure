import { GoogleGenAI, Type } from '@google/genai';
import type { SceneFragment, HistoryItem, GameSettings, SystemInstruction, CustomModel, Memories, MilestoneSummaryItem, GrandSummaryItem } from '../types';

if (!process.env.GEMINI_API_KEY) {
  console.warn("GEMINI_API_KEY environment variable not set for Gemini. This is fine if you are using a custom provider.");
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const BASE_SYSTEM_INSTRUCTION_EN = `You are an expert text adventure game master. You will create a rich, descriptive, and engaging world for the player. You must always respond in the specified JSON format and only that format. Do not include any markdown formatting. The player provides an action, you describe the outcome and new scene. Keep the story moving, introduce challenges and mysteries.`;

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

const BASE_SYSTEM_INSTRUCTION_ZH = `你是一位专家级的文字冒险游戏大师。你将为玩家创造一个丰富、生动、引人入胜的世界。你必须始终以指定的JSON格式并且仅以该格式进行响应。不要包含任何 markdown 格式。玩家提供行动，你描述结果和新场景。保持故事向前发展，引入挑战和谜团。所有内容都必须使用简体中文。`;

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
    const baseInstruction = settings.language === 'zh' ? BASE_SYSTEM_INSTRUCTION_ZH : BASE_SYSTEM_INSTRUCTION_EN;
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

        const requestPayload = {
            model: settings.customModelId || 'gpt-4-turbo',
            messages: openAIMessages,
            response_format: response_format,
            temperature: Number(settings.llm.temperature),
            top_p: Number(settings.llm.topP),
            max_tokens: Number(settings.llm.maxOutputTokens),
            frequency_penalty: Number(settings.llm.frequencyPenalty),
            presence_penalty: Number(settings.llm.presencePenalty),
        };
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

export async function generateGrandSummary(
    history: HistoryItem[],
    settings: GameSettings,
    logCommunication: (type: string, data: any) => void
): Promise<string> {
    const prompt = settings.language === 'zh' 
        ? "根据以上对话历史，生成一个简洁的、概括性的章节摘要，总结到目前为止发生的故事。不要描述场景或提供玩家行动选项。"
        : "Based on the conversation history so far, generate a concise, high-level chapter summary of what has happened. Do not describe a scene or offer player actions.";

    const summaryHistory = [...history, { role: 'user' as const, parts: [{ text: prompt }] }];
    const { geminiSystemInstruction, openAIMessages } = buildPromptParts(summaryHistory, settings);
    
    if (settings.provider === 'custom') {
        if (!settings.customEndpoint) throw new Error("Custom endpoint URL is not configured in settings.");
        const url = settings.customEndpoint.replace(/\/+$/, '') + '/chat/completions';
        const requestPayload = {
            model: settings.customModelId || 'gpt-4-turbo', messages: openAIMessages, 
            temperature: Number(settings.llm.temperature),
            top_p: Number(settings.llm.topP), 
            frequency_penalty: Number(settings.llm.frequencyPenalty), 
            presence_penalty: Number(settings.llm.presencePenalty),
        };
        logCommunication('custom_request_generateGrandSummary', requestPayload);
        try {
            const response = await fetch(url, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.customApiKey}`},
                body: JSON.stringify(requestPayload)
            });
            if (!response.ok) throw new Error('Custom provider API error for summary');
            const data = await response.json();
            logCommunication('custom_response_generateGrandSummary', data);
            if (!data.choices || data.choices.length === 0) throw new Error("Custom provider returned an invalid summary response (empty choices array).");
            return data.choices[0].message.content || "Summary could not be generated.";
        } catch (e) { logCommunication('custom_error_generateGrandSummary', e); throw e; }
    } else {
        const requestPayload = {
            model: 'gemini-2.5-flash', contents: summaryHistory,
            config: { systemInstruction: geminiSystemInstruction, temperature: settings.llm.temperature, topP: settings.llm.topP, topK: settings.llm.topK }
        };
        logCommunication('gemini_request_generateGrandSummary', requestPayload);
        try {
            const response = await ai.models.generateContent(requestPayload);
            logCommunication('gemini_response_generateGrandSummary', response);
            return response.text;
        } catch(e) { logCommunication('gemini_error_generateGrandSummary', e); throw e; }
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
            text = response.text;
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
            const base64ImageBytes = response.generatedImages[0].image.imageBytes;
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