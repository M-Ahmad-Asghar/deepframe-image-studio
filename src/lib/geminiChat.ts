import { GoogleGenAI } from '@google/genai';
import { ChatMessage } from './chatStorage';

export interface ChatResponse {
  success: boolean;
  text?: string;
  error?: string;
}

const CHAT_MODEL = 'gemini-3-pro-preview';

export async function sendChatMessage(
  apiKey: string,
  systemPrompt: string,
  messages: ChatMessage[],
  userMessage: string
): Promise<ChatResponse> {
  try {
    const ai = new GoogleGenAI({ apiKey });

    // Build contents array - only actual conversation
    const contents: any[] = [];

    // Add conversation history
    for (const msg of messages) {
      contents.push({
        role: msg.role,
        parts: [{ text: msg.text }],
      });
    }

    // Add the new user message
    contents.push({
      role: 'user',
      parts: [{ text: userMessage }],
    });

    // Build enhanced system instruction
    const enhancedSystemPrompt = systemPrompt ? `${systemPrompt}

---
OUTPUT STYLE REQUIREMENTS:
- Provide EXTREMELY DETAILED responses (300-500 words per clip minimum)
- Include ALL technical specifications: HEX colors, percentages, camera distances
- Use proper formatting with headers, code blocks, and structured sections
- For each clip include: ATTACH TO SOFTWARE, GEMINI PROMPT, GROK VIDEO PROMPT, AUDIO NOTES
- Never abbreviate or summarize - be thorough and comprehensive` : '';

    const response = await ai.models.generateContent({
      model: CHAT_MODEL,
      contents,
      config: {
        systemInstruction: enhancedSystemPrompt,
        temperature: 0.85,
        topP: 0.95,
        topK: 64,
        maxOutputTokens: 16384,
      },
    });

    // Extract text from response
    const responseText = (response as any).candidates?.[0]?.content?.parts?.[0]?.text;

    if (responseText) {
      return { success: true, text: responseText };
    }

    return { success: false, error: 'No response generated. Try again.' };
  } catch (error: any) {
    return handleChatError(error);
  }
}

function handleChatError(error: any): ChatResponse {
  const message = error.message || String(error);
  console.error('Gemini Chat error:', message);

  if (
    message.includes('429') ||
    message.includes('quota') ||
    message.includes('rate limit') ||
    message.includes('RESOURCE_EXHAUSTED')
  ) {
    return { success: false, error: 'RATE_LIMITED' };
  }

  if (
    message.includes('400') ||
    message.includes('401') ||
    message.includes('API_KEY_INVALID') ||
    message.includes('API key not valid') ||
    message.includes('UNAUTHENTICATED') ||
    message.includes('INVALID_ARGUMENT')
  ) {
    return { success: false, error: 'Invalid API key. Please check and try again.' };
  }

  if (
    message.includes('SAFETY') ||
    message.includes('blocked') ||
    message.includes('PROHIBITED') ||
    message.includes('harmful')
  ) {
    return { success: false, error: 'Content blocked by safety filters. Try a different message.' };
  }

  if (
    message.includes('404') ||
    message.includes('not found') ||
    message.includes('NOT_FOUND') ||
    message.includes('not supported')
  ) {
    return { success: false, error: 'Model not available. Please try again later.' };
  }

  return { success: false, error: message || 'Chat failed' };
}
