export type Role = 'user' | 'assistant' | 'error';
export type ModelMode = 'rag' | 'chat';

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  meta?: string;
}

export interface SourceDocument {
  id: string;
  name: string;
  path?: string;
}

export interface ChatSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface ModelOption {
  id: string;
  label: string;
}

export type ChatMessagesByMode = Record<ModelMode, ChatMessage[]>;
export type ChatStorage = Record<string, ChatMessagesByMode>;
