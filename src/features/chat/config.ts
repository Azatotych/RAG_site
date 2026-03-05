import { ChatMessagesByMode } from './types';

export const generateId = () => crypto.randomUUID?.() ?? `msg-${Date.now()}-${Math.random()}`;

export const emptyChatMessages = (): ChatMessagesByMode => ({ rag: [], chat: [] });

export const chatPlaceholders = [
  'Спросите что-нибудь',
  'Задайте любой вопрос',
  'Чем могу помочь?',
  'О чем поговорим?',
  'Что вас интересует?',
  'Напишите ваш вопрос',
  'Чем займемся сегодня?',
  'Что хотите узнать?',
  'Спрашивайте, не стесняйтесь',
  'Что сегодня исследуем?',
  'Чем могу быть полезен?',
];

export const getRandomPlaceholder = () =>
  chatPlaceholders[Math.floor(Math.random() * chatPlaceholders.length)] ?? 'Спросите что-нибудь';
