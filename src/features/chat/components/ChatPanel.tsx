import { Paperclip, Send } from 'lucide-react';
import { FormEvent, RefObject } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { ChatMessage, ModelMode } from '../types';
import { cn, normalizeAssistantMath } from '../utils';

interface ChatPanelProps {
  mode: ModelMode;
  messages: ChatMessage[];
  placeholder: string;
  inputValue: string;
  canSend: boolean;
  isLoading: boolean;
  isUploading: boolean;
  uploadEnabled: boolean;
  listRef: RefObject<HTMLDivElement | null>;
  onInputChange: (value: string) => void;
  onSubmit: (event?: FormEvent<HTMLFormElement>) => Promise<void>;
  onUploadFiles: (files: File[]) => void;
}

export function ChatPanel({
  mode,
  messages,
  placeholder,
  inputValue,
  canSend,
  isLoading,
  isUploading,
  uploadEnabled,
  listRef,
  onInputChange,
  onSubmit,
  onUploadFiles,
}: ChatPanelProps) {
  return (
    <section className="panel order-1 flex min-h-[56vh] flex-col overflow-hidden rounded-3xl lg:order-2 lg:min-h-0">
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto flex w-full max-w-[760px] flex-col gap-3 pb-2">
          {messages.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500 dark:border-[#454545] dark:bg-[#2b2b2b] dark:text-[#a6a6a6]">
              {mode === 'rag' ? 'Выберите источники и начните диалог.' : 'Начните диалог.'}
            </div>
          )}

          {messages.map((message) => (
            <article
              key={message.id}
              className={cn(
                'rounded-2xl px-4 py-3',
                message.role === 'user' && 'ml-auto max-w-[560px] bg-blue-600 text-white',
                message.role === 'assistant' && 'w-full border border-slate-200 bg-white dark:border-[#3c3c3c] dark:bg-[#262626]',
                message.role === 'error' &&
                  'w-full border border-red-300 bg-red-50 text-red-700 dark:border-red-500/50 dark:bg-red-500/12 dark:text-red-300'
              )}
            >
              {message.role === 'assistant' ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    a: (props) => (
                      <a {...props} target="_blank" rel="noreferrer">
                        {props.children}
                      </a>
                    ),
                  }}
                  className="md-copy"
                >
                  {normalizeAssistantMath(message.content)}
                </ReactMarkdown>
              ) : message.role === 'error' ? (
                <div className="space-y-1 text-sm">
                  <div className="font-semibold">Ошибка: модель недоступна</div>
                  <div>{message.content}</div>
                  <div className="text-xs opacity-85">URL: {message.meta}</div>
                </div>
              ) : (
                <p className="m-0 whitespace-pre-wrap break-words text-sm leading-relaxed">{message.content}</p>
              )}
            </article>
          ))}
        </div>
      </div>

      <form className="px-4 py-4" onSubmit={onSubmit}>
        <div className="mx-auto w-full max-w-[760px]">
          <textarea
            className="min-h-[88px] w-full resize-y rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none ring-blue-500/60 placeholder:text-slate-500 focus:ring-2 disabled:opacity-60 dark:border-[#3a3a3a] dark:bg-[#2a2a2a] dark:text-[#f1f1f1] dark:placeholder:text-[#989898]"
            value={inputValue}
            placeholder={placeholder}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void onSubmit();
              }
            }}
            disabled={isLoading}
            rows={3}
          />

          <div className="mt-3 flex items-center justify-end gap-2">
            <label className={cn('btn-base btn-ghost', (!uploadEnabled || isUploading) && 'cursor-not-allowed opacity-60')}>
              <Paperclip className="h-4 w-4" />
              Файл
              <input
                className="hidden"
                type="file"
                accept=".pdf,.docx,.txt,.md"
                multiple
                disabled={!uploadEnabled || isUploading}
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  if (files.length) onUploadFiles(files);
                  event.currentTarget.value = '';
                }}
              />
            </label>

            <button type="submit" className="btn-base btn-primary" disabled={!canSend}>
              <Send className="h-4 w-4" />
              {isLoading ? 'Отправка...' : 'Отправить'}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
