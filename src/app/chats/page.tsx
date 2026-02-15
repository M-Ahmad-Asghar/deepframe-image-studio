'use client';

import Link from 'next/link';
import {
  Clapperboard,
  MessageCircle,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';

const chatTypes = [
  {
    id: 'filmmaker',
    title: 'Filmmaker Assistant',
    description: 'DEEPFRAME AI cinematic video production system. Create Hollywood-style videos from story to final prompts.',
    href: '/deepframe-chat',
    icon: Clapperboard,
    gradient: 'from-blue-500 to-purple-600',
    shadowColor: 'rgba(99, 102, 241, 0.3)',
  },
  {
    id: 'normal',
    title: 'Normal Chat',
    description: 'General-purpose AI chat powered by Gemini. Ask questions, get help with writing, coding, analysis, and more.',
    href: '/normal-chat',
    icon: MessageCircle,
    gradient: 'from-emerald-500 to-teal-600',
    shadowColor: 'rgba(16, 185, 129, 0.3)',
  },
];

export default function ChatsPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-lg hover:bg-[var(--secondary)] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-lg">Chats</h1>
                <p className="text-xs text-[var(--muted-foreground)]">Choose a chat assistant</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-4 py-12">
        <div className="max-w-3xl w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {chatTypes.map((chat) => {
              const Icon = chat.icon;
              return (
                <Link
                  key={chat.id}
                  href={chat.href}
                  className="group card card-hover p-6 flex flex-col gap-4 transition-all duration-300"
                  style={{
                    // @ts-expect-error CSS custom property
                    '--hover-shadow': chat.shadowColor,
                  }}
                >
                  {/* Icon */}
                  <div
                    className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${chat.gradient} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}
                  >
                    <Icon className="w-7 h-7 text-white" />
                  </div>

                  {/* Text */}
                  <div>
                    <h2 className="text-lg font-bold mb-1 group-hover:text-[var(--primary)] transition-colors">
                      {chat.title}
                    </h2>
                    <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
                      {chat.description}
                    </p>
                  </div>

                  {/* Arrow indicator */}
                  <div className="flex items-center gap-1 text-xs text-[var(--muted-foreground)] group-hover:text-[var(--primary)] transition-colors mt-auto">
                    <span>Open chat</span>
                    <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
