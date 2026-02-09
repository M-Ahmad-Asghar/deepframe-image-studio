// Chat storage utilities for DEEPFRAME Chat

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export interface Chat {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const STORAGE_KEY = 'deepframe-chats';
const ACTIVE_CHAT_KEY = 'deepframe-active-chat';

// Generate unique ID
export const generateId = () => Math.random().toString(36).substring(2, 11);

// Get initial AI welcome message
export const getInitialAIMessage = (): ChatMessage => ({
  id: generateId(),
  role: 'model',
  text: `✅ All prompt parts combined successfully!

I have received and understood the complete AI Story-to-Video Production System prompt.

Ready to begin! Let's create your cinematic video.

Welcome to the AI Story-to-Video Production System! 🎬

I'll help you create a Hollywood-style cinematic video from scratch - from story idea to complete video prompts ready for AI generation.

**Let's start with your story!**

You can provide:
- **Option A:** Just a story NAME or one-line concept
- **Option B:** A basic idea or theme (2-3 sentences)
- **Option C:** A complete story outline

What would you like to share?`,
  timestamp: new Date(),
});

// Create a new chat
export const createNewChat = (): Chat => ({
  id: generateId(),
  title: 'New Chat',
  messages: [getInitialAIMessage()],
  createdAt: new Date(),
  updatedAt: new Date(),
});

// Get all chats from localStorage
export const getAllChats = (): Chat[] => {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const chats = JSON.parse(stored);
    // Convert date strings back to Date objects
    return chats.map((chat: any) => ({
      ...chat,
      createdAt: new Date(chat.createdAt),
      updatedAt: new Date(chat.updatedAt),
      messages: chat.messages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      })),
    }));
  } catch (err) {
    console.error('Failed to load chats:', err);
    return [];
  }
};

// Save all chats to localStorage
export const saveAllChats = (chats: Chat[]): void => {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  } catch (err) {
    console.error('Failed to save chats:', err);
  }
};

// Get active chat ID
export const getActiveChatId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_CHAT_KEY);
};

// Set active chat ID
export const setActiveChatId = (chatId: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACTIVE_CHAT_KEY, chatId);
};

// Save a single chat (updates or adds)
export const saveChat = (chat: Chat): void => {
  const chats = getAllChats();
  const index = chats.findIndex(c => c.id === chat.id);

  if (index >= 0) {
    chats[index] = { ...chat, updatedAt: new Date() };
  } else {
    chats.unshift(chat);
  }

  saveAllChats(chats);
};

// Delete a chat
export const deleteChat = (chatId: string): void => {
  const chats = getAllChats();
  const filtered = chats.filter(c => c.id !== chatId);
  saveAllChats(filtered);

  // If deleted chat was active, clear active
  if (getActiveChatId() === chatId) {
    localStorage.removeItem(ACTIVE_CHAT_KEY);
  }
};

// Get a single chat by ID
export const getChatById = (chatId: string): Chat | null => {
  const chats = getAllChats();
  return chats.find(c => c.id === chatId) || null;
};

// Update chat title based on first user message
export const generateChatTitle = (messages: ChatMessage[]): string => {
  const firstUserMessage = messages.find(m => m.role === 'user');
  if (!firstUserMessage) return 'New Chat';

  // Take first 40 chars of first user message
  const title = firstUserMessage.text.substring(0, 40);
  return title.length < firstUserMessage.text.length ? `${title}...` : title;
};
