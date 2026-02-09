'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useApiKeys } from '@/hooks/useApiKeys';
import { sendChatMessage } from '@/lib/geminiChat';
import {
  Chat,
  ChatMessage,
  getAllChats,
  saveChat,
  deleteChat,
  createNewChat,
  getActiveChatId,
  setActiveChatId,
  generateChatTitle,
  generateId,
} from '@/lib/chatStorage';
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
  MessageSquare,
  Bot,
  User,
  Upload,
  Plus,
  Menu,
  X,
} from 'lucide-react';

export default function DeepframeChatPage() {
  // Chat state
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // System prompt state
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isPromptLoaded, setIsPromptLoaded] = useState(false);
  const [promptLineCount, setPromptLineCount] = useState(0);
  const [promptLoadError, setPromptLoadError] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // API Keys from existing system
  const { activeKey, getNextKey, limitKey, hasKeys } = useApiKeys();

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [activeChat?.messages, scrollToBottom]);

  // Load master prompt on mount
  useEffect(() => {
    const loadMasterPrompt = async () => {
      try {
        const response = await fetch('/deepframe/DEEPFRAME_MASTER_PROMPT_v9_0.txt');
        if (!response.ok) {
          throw new Error('Failed to fetch master prompt');
        }
        const text = await response.text();
        setSystemPrompt(text);
        setPromptLineCount(text.split('\n').length);
        setIsPromptLoaded(true);
        setPromptLoadError(false);
      } catch (err) {
        console.error('Failed to load DEEPFRAME master prompt:', err);
        setPromptLoadError(true);
        setIsPromptLoaded(false);
      }
    };

    loadMasterPrompt();
  }, []);

  // Load chats from localStorage on mount
  useEffect(() => {
    const loadedChats = getAllChats();
    const activeChatId = getActiveChatId();

    if (loadedChats.length === 0) {
      // No chats exist, create first one
      const newChat = createNewChat();
      setChats([newChat]);
      setActiveChat(newChat);
      saveChat(newChat);
      setActiveChatId(newChat.id);
    } else {
      setChats(loadedChats);
      // Find active chat or use first one
      const active = activeChatId
        ? loadedChats.find(c => c.id === activeChatId) || loadedChats[0]
        : loadedChats[0];
      setActiveChat(active);
      setActiveChatId(active.id);
    }
  }, []);

  // Handle file upload for custom prompt
  const handlePromptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setSystemPrompt(text);
        setPromptLineCount(text.split('\n').length);
        setIsPromptLoaded(true);
        setPromptLoadError(false);
      }
    };
    reader.onerror = () => {
      setError('Failed to read uploaded file');
    };
    reader.readAsText(file);
  };

  // Create new chat
  const handleNewChat = () => {
    const newChat = createNewChat();
    setChats(prev => [newChat, ...prev]);
    setActiveChat(newChat);
    saveChat(newChat);
    setActiveChatId(newChat.id);
    setSidebarOpen(false);
  };

  // Switch to a chat
  const handleSelectChat = (chat: Chat) => {
    setActiveChat(chat);
    setActiveChatId(chat.id);
    setSidebarOpen(false);
  };

  // Delete a chat
  const handleDeleteChat = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    deleteChat(chatId);
    const updatedChats = chats.filter(c => c.id !== chatId);

    if (updatedChats.length === 0) {
      // No chats left, create new one
      const newChat = createNewChat();
      setChats([newChat]);
      setActiveChat(newChat);
      saveChat(newChat);
      setActiveChatId(newChat.id);
    } else {
      setChats(updatedChats);
      // If deleted active chat, switch to first
      if (activeChat?.id === chatId) {
        setActiveChat(updatedChats[0]);
        setActiveChatId(updatedChats[0].id);
      }
    }
  };

  // Send message
  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading || !activeChat) return;
    if (!isPromptLoaded) {
      setError('DEEPFRAME system not loaded. Please wait or upload a prompt file.');
      return;
    }
    if (!hasKeys) {
      setError('Add your Gemini API key in Settings first');
      return;
    }

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      text: inputText.trim(),
      timestamp: new Date(),
    };

    // Update active chat with new message
    const updatedMessages = [...activeChat.messages, userMessage];
    const updatedChat: Chat = {
      ...activeChat,
      messages: updatedMessages,
      title: activeChat.title === 'New Chat' ? generateChatTitle(updatedMessages) : activeChat.title,
      updatedAt: new Date(),
    };

    setActiveChat(updatedChat);
    setChats(prev => prev.map(c => c.id === updatedChat.id ? updatedChat : c));
    saveChat(updatedChat);

    setInputText('');
    setIsLoading(true);
    setError(null);

    // Get current API key
    let currentKey = activeKey;
    if (!currentKey) {
      currentKey = getNextKey();
    }

    if (!currentKey) {
      setError('No API key available. Please add one in Settings.');
      setIsLoading(false);
      return;
    }

    // Try to send message, with key rotation on rate limit
    let attempts = 0;
    const maxAttempts = 3;
    let lastError = '';

    while (attempts < maxAttempts) {
      const result = await sendChatMessage(
        currentKey.key,
        systemPrompt,
        activeChat.messages,
        userMessage.text
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
        saveChat(finalChat);
        setIsLoading(false);
        return;
      }

      // Handle rate limit - try next key
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
        // Other error
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

  // Retry loading master prompt
  const retryLoadPrompt = async () => {
    setPromptLoadError(false);
    try {
      const response = await fetch('/deepframe/DEEPFRAME_MASTER_PROMPT_v9_0.txt');
      if (!response.ok) throw new Error('Failed to fetch');
      const text = await response.text();
      setSystemPrompt(text);
      setPromptLineCount(text.split('\n').length);
      setIsPromptLoaded(true);
    } catch {
      setPromptLoadError(true);
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
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold">DEEPFRAME</span>
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
            className="w-full flex items-center gap-2 px-4 py-3 rounded-xl bg-[var(--primary)] text-white hover:opacity-90 transition-opacity"
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
                  ? 'bg-[var(--primary)]/20 text-[var(--primary)]'
                  : 'hover:bg-[var(--secondary)]'
              )}
            >
              <MessageSquare className="w-4 h-4 shrink-0" />
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

        {/* Back to GemAI */}
        <div className="p-3 border-t border-[var(--border)]">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-[var(--secondary)] text-[var(--muted-foreground)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to GemAI</span>
          </Link>
        </div>
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-72">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-[var(--background)]/80 backdrop-blur-xl border-b border-[var(--border)]">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Mobile menu button */}
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
                  AI Prompt Assistant
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Upload Custom Prompt */}
              <input
                type="file"
                accept=".txt"
                ref={fileInputRef}
                onChange={handlePromptUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-lg hover:bg-[var(--secondary)] transition-colors"
                title="Upload custom prompt file"
              >
                <Upload className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* System Status */}
        <div className="px-4 py-2">
          <div
            className={cn(
              'px-4 py-2 rounded-lg text-sm flex items-center gap-2',
              isPromptLoaded
                ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                : promptLoadError
                ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                : 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400'
            )}
          >
            {isPromptLoaded ? (
              <>
                <Bot className="w-4 h-4" />
                <span>
                  DEEPFRAME ready. Master prompt loaded ({promptLineCount.toLocaleString()} lines).
                </span>
              </>
            ) : promptLoadError ? (
              <>
                <AlertCircle className="w-4 h-4" />
                <span>Failed to load master prompt.</span>
                <button
                  onClick={retryLoadPrompt}
                  className="ml-2 underline hover:no-underline"
                >
                  Retry
                </button>
                <span className="text-[var(--muted-foreground)]">or upload a .txt file</span>
              </>
            ) : (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading DEEPFRAME system...</span>
              </>
            )}
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Chat Messages */}
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
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}

                {/* Message Bubble */}
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl relative group',
                    msg.role === 'user'
                      ? 'bg-[var(--primary)] text-white rounded-tr-sm px-4 py-3'
                      : 'bg-[var(--secondary)] rounded-tl-sm px-5 py-4'
                  )}
                >
                  {/* Message Text with Markdown rendering for AI messages */}
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
                            <code className="bg-black/40 px-2 py-1 rounded text-sm font-mono text-purple-300">{children}</code>
                          ),
                          pre: ({ children }) => (
                            <pre className="bg-black/40 p-4 rounded-xl overflow-x-auto my-4 text-sm border border-white/10">{children}</pre>
                          ),
                          h1: ({ children }) => <h1 className="text-xl font-bold mb-4 mt-6 first:mt-0 text-white border-b border-white/10 pb-2">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-lg font-bold mb-3 mt-5 first:mt-0 text-white">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-base font-semibold mb-2 mt-4 first:mt-0 text-white">{children}</h3>,
                          blockquote: ({ children }) => (
                            <blockquote className="border-l-4 border-purple-500 pl-4 my-4 italic text-[var(--muted-foreground)]">{children}</blockquote>
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
                  <div className="w-8 h-8 rounded-lg bg-[var(--primary)] flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
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

            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="sticky bottom-0 bg-[var(--background)] border-t border-[var(--border)] px-4 py-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex gap-3 items-end">
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    isPromptLoaded
                      ? 'Type your message... (Shift+Enter for new line)'
                      : 'Loading DEEPFRAME system...'
                  }
                  disabled={!isPromptLoaded || isLoading}
                  rows={1}
                  className="w-full px-4 py-3 pr-12 bg-[var(--secondary)] border border-[var(--border)] rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[var(--primary)] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ minHeight: '48px', maxHeight: '150px' }}
                />
              </div>
              <button
                onClick={handleSendMessage}
                disabled={!inputText.trim() || isLoading || !isPromptLoaded}
                className={cn(
                  'p-3 rounded-xl transition-all',
                  inputText.trim() && isPromptLoaded && !isLoading
                    ? 'bg-[var(--primary)] text-white hover:opacity-90'
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
                <Link href="/" className="text-[var(--primary)] hover:underline">
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
