// Chat storage utilities for Normal Chat (separate from DEEPFRAME)

import { ChatMessage, Chat } from './chatStorage';

const STORAGE_KEY = 'normal-chats';
const ACTIVE_CHAT_KEY = 'normal-active-chat';

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 11);

// Get initial AI welcome message
export const getNormalInitialMessage = (): ChatMessage => ({
  id: generateId(),
  role: 'model',
  text: `Hi! I'm your AI assistant powered by Gemini. How can I help you today?

I can help with:
- **Answering questions** on any topic
- **Writing & editing** text, emails, essays
- **Coding help** — debugging, explaining, writing code
- **Analysis** — summarizing, comparing, brainstorming
- **Image analysis** — attach images and I'll describe or analyze them

Just type your message below to get started!`,
  timestamp: new Date(),
});

// Create a new normal chat
export const createNormalChat = (): Chat => ({
  id: generateId(),
  title: 'New Chat',
  messages: [getNormalInitialMessage()],
  createdAt: new Date(),
  updatedAt: new Date(),
});

// Get all normal chats from localStorage
export const getAllNormalChats = (): Chat[] => {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const chats = JSON.parse(stored);
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
    console.error('Failed to load normal chats:', err);
    return [];
  }
};

// Save all normal chats to localStorage
export const saveAllNormalChats = (chats: Chat[]): void => {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  } catch (err) {
    console.error('Failed to save normal chats:', err);
  }
};

// Get active normal chat ID
export const getNormalActiveChatId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_CHAT_KEY);
};

// Set active normal chat ID
export const setNormalActiveChatId = (chatId: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACTIVE_CHAT_KEY, chatId);
};

// Save a single normal chat (updates or adds)
export const saveNormalChat = (chat: Chat): void => {
  const chats = getAllNormalChats();
  const index = chats.findIndex(c => c.id === chat.id);

  if (index >= 0) {
    chats[index] = { ...chat, updatedAt: new Date() };
  } else {
    chats.unshift(chat);
  }

  saveAllNormalChats(chats);
};

// Delete a normal chat
export const deleteNormalChat = (chatId: string): void => {
  const chats = getAllNormalChats();
  const filtered = chats.filter(c => c.id !== chatId);
  saveAllNormalChats(filtered);

  if (getNormalActiveChatId() === chatId) {
    localStorage.removeItem(ACTIVE_CHAT_KEY);
  }
};
