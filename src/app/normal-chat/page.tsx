'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useApiKeys } from '@/hooks/useApiKeys';
import { sendChatMessage, ChatAttachment } from '@/lib/geminiChat';
import {
  Chat,
  ChatMessage,
  generateChatTitle,
} from '@/lib/chatStorage';
import {
  getAllNormalChats,
  saveNormalChat,
  deleteNormalChat,
  createNormalChat,
  getNormalActiveChatId,
  setNormalActiveChatId,
} from '@/lib/normalChatStorage';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowLeft,
  Send,
  Trash2,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  MessageCircle,
  Bot,
  User,
  Plus,
  Menu,
  X,
  ImageIcon,
} from 'lucide-react';

const generateId = () => Math.random().toString(36).substring(2, 11);

export default function NormalChatPage() {
  // Chat state
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Attachments state
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // API Keys from existing system
  const { activeKey, getNextKey, limitKey, hasKeys } = useApiKeys();

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [activeChat?.messages, scrollToBottom]);

  // Load chats from localStorage on mount
  useEffect(() => {
    const loadedChats = getAllNormalChats();
    const activeChatId = getNormalActiveChatId();

    if (loadedChats.length === 0) {
      const newChat = createNormalChat();
      setChats([newChat]);
      setActiveChat(newChat);
      saveNormalChat(newChat);
      setNormalActiveChatId(newChat.id);
    } else {
      setChats(loadedChats);
      const active = activeChatId
        ? loadedChats.find(c => c.id === activeChatId) || loadedChats[0]
        : loadedChats[0];
      setActiveChat(active);
      setNormalActiveChatId(active.id);
    }
  }, []);

  // Handle image upload for chat
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: ChatAttachment[] = [];
    const maxImages = 5;

    Array.from(files).slice(0, maxImages - attachments.length).forEach(file => {
      if (file.type.startsWith('image/')) {
        newAttachments.push({
          type: 'image',
          file,
          preview: URL.createObjectURL(file),
        });
      }
    });

    setAttachments(prev => [...prev, ...newAttachments].slice(0, maxImages));

    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  // Remove attachment
  const removeAttachment = (index: number) => {
    setAttachments(prev => {
      const newAttachments = [...prev];
      URL.revokeObjectURL(newAttachments[index].preview);
      newAttachments.splice(index, 1);
      return newAttachments;
    });
  };

  // Create new chat
  const handleNewChat = () => {
    const newChat = createNormalChat();
    setChats(prev => [newChat, ...prev]);
    setActiveChat(newChat);
    saveNormalChat(newChat);
    setNormalActiveChatId(newChat.id);
    setSidebarOpen(false);
  };

  // Switch to a chat
  const handleSelectChat = (chat: Chat) => {
    setActiveChat(chat);
    setNormalActiveChatId(chat.id);
    setSidebarOpen(false);
  };

  // Delete a chat
  const handleDeleteChat = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    deleteNormalChat(chatId);
    const updatedChats = chats.filter(c => c.id !== chatId);

    if (updatedChats.length === 0) {
      const newChat = createNormalChat();
      setChats([newChat]);
      setActiveChat(newChat);
      saveNormalChat(newChat);
      setNormalActiveChatId(newChat.id);
    } else {
      setChats(updatedChats);
      if (activeChat?.id === chatId) {
        setActiveChat(updatedChats[0]);
        setNormalActiveChatId(updatedChats[0].id);
      }
    }
  };

  // Send message
  const handleSendMessage = async () => {
    if ((!inputText.trim() && attachments.length === 0) || isLoading || !activeChat) return;
    if (!hasKeys) {
      setError('Add your Gemini API key in Settings first');
      return;
    }

    const messageText = attachments.length > 0
      ? `${inputText.trim() || 'Analyze this image'}${attachments.length > 0 ? ` [${attachments.length} image${attachments.length > 1 ? 's' : ''} attached]` : ''}`
      : inputText.trim();

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      text: messageText,
      timestamp: new Date(),
    };

    const currentAttachments = [...attachments];

    const updatedMessages = [...activeChat.messages, userMessage];
    const updatedChat: Chat = {
      ...activeChat,
      messages: updatedMessages,
      title: activeChat.title === 'New Chat' ? generateChatTitle(updatedMessages) : activeChat.title,
      updatedAt: new Date(),
    };

    setActiveChat(updatedChat);
    setChats(prev => prev.map(c => c.id === updatedChat.id ? updatedChat : c));
    saveNormalChat(updatedChat);

    setInputText('');
    setAttachments([]);
    setIsLoading(true);
    setError(null);

    let currentKey = activeKey;
    if (!currentKey) {
      currentKey = getNextKey();
    }

    if (!currentKey) {
      setError('No API key available. Please add one in Settings.');
      setIsLoading(false);
      return;
    }

    let attempts = 0;
    const maxAttempts = 3;
    let lastError = '';

    while (attempts < maxAttempts) {
      const result = await sendChatMessage(
        currentKey.key,
        '', // No system prompt for normal chat
        activeChat.messages,
        inputText.trim() || 'Analyze this image',
        currentAttachments.length > 0 ? currentAttachments : undefined
      );

      if (result.success && result.text) {
        const aiMessage: ChatMessage = {
          id: generateId(),
          role: 'model',
          text: result.text,
          timestamp: new Date(),
        };

        const finalChat: Chat = {
          ...updatedChat,
          messages: [...updatedChat.messages, aiMessage],
          updatedAt: new Date(),
        };

        setActiveChat(finalChat);
        setChats(prev => prev.map(c => c.id === finalChat.id ? finalChat : c));
        saveNormalChat(finalChat);
        setIsLoading(false);
        return;
      }

      if (result.error === 'RATE_LIMITED') {
        limitKey(currentKey.id);
        currentKey = getNextKey();
        if (!currentKey) {
          setError('All API keys are rate limited. Please try again later.');
          setIsLoading(false);
          return;
        }
        attempts++;
        lastError = 'Rate limited, trying next key...';
      } else {
        setError(result.error || 'Failed to get response');
        setIsLoading(false);
        return;
      }
    }

    setError(lastError || 'Failed after multiple attempts');
    setIsLoading(false);
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle paste for images
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const maxImages = 5;
    const newAttachments: ChatAttachment[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file && attachments.length + newAttachments.length < maxImages) {
          newAttachments.push({
            type: 'image',
            file,
            preview: URL.createObjectURL(file),
          });
        }
      }
    }

    if (newAttachments.length > 0) {
      e.preventDefault();
      setAttachments(prev => [...prev, ...newAttachments].slice(0, maxImages));
    }
  }, [attachments.length]);

  // Copy message to clipboard
  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [inputText]);

  return (
    <div className="h-screen bg-[var(--background)] flex overflow-hidden">
      {/* Sidebar Overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 bg-[var(--card)] border-r border-[var(--border)] flex flex-col transition-transform lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold">Normal Chat</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 rounded-lg hover:bg-[var(--secondary)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white hover:opacity-90 transition-opacity"
          >
            <Plus className="w-5 h-5" />
            New Chat
          </button>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {chats.map(chat => (
            <div
              key={chat.id}
              onClick={() => handleSelectChat(chat)}
              className={cn(
                'group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors',
                activeChat?.id === chat.id
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'hover:bg-[var(--secondary)]'
              )}
            >
              <MessageCircle className="w-4 h-4 shrink-0" />
              <span className="flex-1 truncate text-sm">{chat.title}</span>
              <button
                onClick={(e) => handleDeleteChat(chat.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[var(--destructive)]/20 text-[var(--destructive)] transition-opacity"
                title="Delete chat"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Back to Chats */}
        <div className="p-3 border-t border-[var(--border)]">
          <Link
            href="/chats"
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-[var(--secondary)] text-[var(--muted-foreground)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Chats</span>
          </Link>
        </div>
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-72">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-[var(--background)]/80 backdrop-blur-xl border-b border-[var(--border)]">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-lg hover:bg-[var(--secondary)]"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div>
                <h1 className="font-bold text-lg truncate max-w-[200px] sm:max-w-none">
                  {activeChat?.title || 'New Chat'}
                </h1>
                <p className="text-[10px] text-[var(--muted-foreground)]">
                  Gemini AI Chat
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="max-w-4xl mx-auto space-y-4">
            {activeChat?.messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'flex gap-3',
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {/* Avatar for AI */}
                {msg.role === 'model' && (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}

                {/* Message Bubble */}
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl relative group',
                    msg.role === 'user'
                      ? 'bg-emerald-600 text-white rounded-tr-sm px-4 py-3'
                      : 'bg-[var(--secondary)] rounded-tl-sm px-5 py-4'
                  )}
                >
                  <div className="break-words prose prose-invert max-w-none">
                    {msg.role === 'model' ? (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ children }) => <p className="mb-4 leading-relaxed text-[15px]">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc pl-6 mb-4 space-y-2">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 space-y-2">{children}</ol>,
                          li: ({ children }) => <li className="leading-relaxed text-[15px]">{children}</li>,
                          strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                          em: ({ children }) => <em className="italic text-[var(--muted-foreground)]">{children}</em>,
                          code: ({ children }) => (
                            <code className="bg-black/40 px-2 py-1 rounded text-sm font-mono text-emerald-300">{children}</code>
                          ),
                          pre: ({ children }) => (
                            <pre className="bg-black/40 p-4 rounded-xl overflow-x-auto my-4 text-sm border border-white/10">{children}</pre>
                          ),
                          h1: ({ children }) => <h1 className="text-xl font-bold mb-4 mt-6 first:mt-0 text-white border-b border-white/10 pb-2">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-lg font-bold mb-3 mt-5 first:mt-0 text-white">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-base font-semibold mb-2 mt-4 first:mt-0 text-white">{children}</h3>,
                          blockquote: ({ children }) => (
                            <blockquote className="border-l-4 border-emerald-500 pl-4 my-4 italic text-[var(--muted-foreground)]">{children}</blockquote>
                          ),
                          hr: () => <hr className="my-6 border-white/10" />,
                          table: ({ children }) => (
                            <div className="overflow-x-auto my-4 rounded-lg border border-white/10">
                              <table className="w-full text-sm">{children}</table>
                            </div>
                          ),
                          thead: ({ children }) => (
                            <thead className="bg-black/40 text-white font-semibold">{children}</thead>
                          ),
                          tbody: ({ children }) => (
                            <tbody className="divide-y divide-white/10">{children}</tbody>
                          ),
                          tr: ({ children }) => (
                            <tr className="hover:bg-white/5 transition-colors">{children}</tr>
                          ),
                          th: ({ children }) => (
                            <th className="px-4 py-3 text-left text-white font-semibold border-b border-white/20">{children}</th>
                          ),
                          td: ({ children }) => (
                            <td className="px-4 py-3 text-[14px]">{children}</td>
                          ),
                        }}
                      >
                        {msg.text}
                      </ReactMarkdown>
                    ) : (
                      <span className="whitespace-pre-wrap text-[15px]">{msg.text}</span>
                    )}
                  </div>

                  {/* Timestamp */}
                  <div
                    className={cn(
                      'text-[10px] mt-1',
                      msg.role === 'user'
                        ? 'text-white/60'
                        : 'text-[var(--muted-foreground)]'
                    )}
                  >
                    {msg.timestamp.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>

                  {/* Copy Button (AI messages only) */}
                  {msg.role === 'model' && (
                    <button
                      onClick={() => copyToClipboard(msg.text, msg.id)}
                      className="absolute -right-10 top-2 p-2 rounded-lg bg-[var(--secondary)] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--muted)]"
                      title="Copy to clipboard"
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>

                {/* Avatar for User */}
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-[var(--secondary)] rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm text-[var(--muted-foreground)]">
                      Thinking...
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="flex justify-center">
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-2 flex items-center gap-2 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>{error}</span>
                  <button
                    onClick={() => setError(null)}
                    className="ml-2 hover:underline"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="sticky bottom-0 bg-[var(--background)] border-t border-[var(--border)] px-4 py-4">
          <div className="max-w-4xl mx-auto">
            {/* Attachment Preview */}
            {attachments.length > 0 && (
              <div className="flex gap-2 mb-3 flex-wrap">
                {attachments.map((attachment, index) => (
                  <div
                    key={index}
                    className="relative group w-20 h-20 rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--secondary)]"
                  >
                    <img
                      src={attachment.preview}
                      alt={`Attachment ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => removeAttachment(index)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1 py-0.5 truncate">
                      {attachment.file.name}
                    </div>
                  </div>
                ))}
                {attachments.length < 5 && (
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    className="w-20 h-20 rounded-lg border-2 border-dashed border-[var(--border)] flex items-center justify-center text-[var(--muted-foreground)] hover:border-emerald-500 hover:text-emerald-500 transition-colors"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                )}
              </div>
            )}

            <div className="flex gap-2 items-center">
              {/* Image Upload Button */}
              <input
                type="file"
                accept="image/*"
                multiple
                ref={imageInputRef}
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                onClick={() => imageInputRef.current?.click()}
                disabled={isLoading || attachments.length >= 5}
                className={cn(
                  'p-3 rounded-xl transition-all shrink-0',
                  !isLoading && attachments.length < 5
                    ? 'hover:bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-emerald-500'
                    : 'opacity-50 cursor-not-allowed'
                )}
                title={attachments.length >= 5 ? 'Max 5 images' : 'Attach images'}
              >
                <ImageIcon className="w-5 h-5" />
              </button>

              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  placeholder={
                    attachments.length > 0
                      ? 'Add a message or send images...'
                      : 'Type your message... (Ctrl+V to paste images)'
                  }
                  disabled={isLoading}
                  rows={1}
                  className="w-full px-4 py-3 bg-[var(--secondary)] border border-[var(--border)] rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ minHeight: '48px', maxHeight: '150px' }}
                />
              </div>

              <button
                onClick={handleSendMessage}
                disabled={(!inputText.trim() && attachments.length === 0) || isLoading}
                className={cn(
                  'p-3 rounded-xl transition-all shrink-0',
                  (inputText.trim() || attachments.length > 0) && !isLoading
                    ? 'bg-emerald-600 text-white hover:opacity-90'
                    : 'bg-[var(--secondary)] text-[var(--muted-foreground)] cursor-not-allowed'
                )}
                title="Send message"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* API Key Warning */}
            {!hasKeys && (
              <p className="text-xs text-[var(--muted-foreground)] mt-2 text-center">
                <Link href="/" className="text-emerald-500 hover:underline">
                  Add an API key
                </Link>{' '}
                to start chatting
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
