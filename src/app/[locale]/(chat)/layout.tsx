import { ReactNode } from 'react';

import { getMetadata } from '@/shared/lib/seo';

import { ChatLayoutClient } from './chat-layout-client';

export const generateMetadata = getMetadata({
  title: 'GPT101 Chat',
  description: 'GPT101 AI 对话工具',
  noIndex: true,
});

export default function ChatLayout({ children }: { children: ReactNode }) {
  return <ChatLayoutClient>{children}</ChatLayoutClient>;
}
