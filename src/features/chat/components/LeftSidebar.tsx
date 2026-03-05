import { Check, MessageSquare, PencilLine, Plus, SunMoon, Trash2, X } from 'lucide-react';
import { RefObject } from 'react';
import { ModelMode, ModelOption } from '../types';
import { cn } from '../utils';

interface ChatItem {
  id: string;
  title: string;
  updatedAt: string;
}

interface LeftSidebarProps {
  mode: ModelMode;
  selectedModel: string;
  modelOptions: ModelOption[];
  isModelsLoading: boolean;
  modelsError: string | null;
  chats: ChatItem[];
  activeChatId: string;
  editingChatId: string | null;
  chatTitleDraft: string;
  renameInputRef: RefObject<HTMLInputElement | null>;
  themeLabel: string;
  onCreateChat: () => void;
  onModeChange: (mode: ModelMode) => void;
  onModelChange: (model: string) => void;
  onSelectChat: (chatId: string) => void;
  onStartRename: (chatId: string, title: string) => void;
  onRenameDraftChange: (title: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onDeleteChat: (chatId: string) => void;
  onClearActiveChat: () => void;
  onToggleTheme: () => void;
}

export function LeftSidebar({
  mode,
  selectedModel,
  modelOptions,
  isModelsLoading,
  modelsError,
  chats,
  activeChatId,
  editingChatId,
  chatTitleDraft,
  renameInputRef,
  themeLabel,
  onCreateChat,
  onModeChange,
  onModelChange,
  onSelectChat,
  onStartRename,
  onRenameDraftChange,
  onCommitRename,
  onCancelRename,
  onDeleteChat,
  onClearActiveChat,
  onToggleTheme,
}: LeftSidebarProps) {
  return (
    <aside className="panel order-2 flex min-h-0 flex-col rounded-3xl p-3 lg:order-1 lg:rounded-l-none lg:rounded-r-3xl">
      <button className="btn-base btn-primary w-full" type="button" onClick={onCreateChat}>
        <Plus className="h-4 w-4" />
        Новый чат
      </button>

      <div className="mt-3 inline-flex rounded-2xl bg-slate-100 p-1 dark:bg-[#2a2a2a]">
        <button
          type="button"
          className={cn('w-1/2 rounded-2xl px-3 py-1.5 text-sm', mode === 'rag' ? 'bg-white dark:bg-[#353535]' : 'text-slate-500 dark:text-[#9b9b9b]')}
          onClick={() => onModeChange('rag')}
        >
          RAG
        </button>
        <button
          type="button"
          className={cn('w-1/2 rounded-2xl px-3 py-1.5 text-sm', mode === 'chat' ? 'bg-white dark:bg-[#353535]' : 'text-slate-500 dark:text-[#9b9b9b]')}
          onClick={() => onModeChange('chat')}
        >
          Обычный
        </button>
      </div>

      <label className="mt-3 text-xs uppercase tracking-wide text-slate-500 dark:text-[#9f9f9f]" htmlFor="model-select">
        Модель
      </label>
      {isModelsLoading ? (
        <div className="mt-1 rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-500 dark:border-[#3a3a3a] dark:bg-[#2a2a2a] dark:text-[#9f9f9f]">
          Загрузка моделей...
        </div>
      ) : modelOptions.length > 0 ? (
        <select
          id="model-select"
          className="mt-1 rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-blue-500/60 focus:ring-2 dark:border-[#3a3a3a] dark:bg-[#2a2a2a]"
          value={selectedModel}
          onChange={(event) => onModelChange(event.target.value)}
        >
          {modelOptions.map((model) => (
            <option key={model.id} value={model.id}>
              {model.label}
            </option>
          ))}
        </select>
      ) : (
        <div className="mt-1 rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-500 dark:border-[#3a3a3a] dark:bg-[#2a2a2a] dark:text-[#9f9f9f]">
          {modelsError ?? 'Список моделей недоступен'}
        </div>
      )}

      <div className="mt-3 text-xs uppercase tracking-wide text-slate-500 dark:text-[#9f9f9f]">Чаты</div>
      <div className="mt-2 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">
        {chats.map((chat) => {
          const isEditing = editingChatId === chat.id;

          return (
            <div
              key={chat.id}
              className={cn(
                'flex items-center gap-2 rounded-2xl px-2.5 py-2 transition',
                chat.id === activeChatId ? 'bg-slate-100 dark:bg-[#303030]' : 'hover:bg-slate-100 dark:hover:bg-[#2c2c2c]'
              )}
              onClick={() => !isEditing && onSelectChat(chat.id)}
              role="button"
              tabIndex={0}
            >
              <MessageSquare className="h-4 w-4 shrink-0 text-slate-500 dark:text-[#9f9f9f]" />

              <div className="min-w-0 flex-1">
                {isEditing ? (
                  <input
                    ref={renameInputRef}
                    className="h-8 w-full rounded-xl border border-slate-300 bg-white px-2 text-sm outline-none ring-blue-500/60 focus:ring-2 dark:border-[#3a3a3a] dark:bg-[#2a2a2a]"
                    value={chatTitleDraft}
                    onChange={(event) => onRenameDraftChange(event.target.value)}
                    onBlur={onCommitRename}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') onCommitRename();
                      if (event.key === 'Escape') onCancelRename();
                    }}
                  />
                ) : (
                  <>
                    <div className="truncate text-sm font-medium">{chat.title}</div>
                    <div className="truncate text-xs text-slate-500 dark:text-[#9f9f9f]">{chat.updatedAt}</div>
                  </>
                )}
              </div>

              {isEditing ? (
                <>
                  <button
                    type="button"
                    className="rounded-xl p-1.5 hover:bg-slate-200 dark:hover:bg-[#3a3a3a]"
                    onClick={(event) => {
                      event.stopPropagation();
                      onCommitRename();
                    }}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="rounded-xl p-1.5 hover:bg-slate-200 dark:hover:bg-[#3a3a3a]"
                    onClick={(event) => {
                      event.stopPropagation();
                      onCancelRename();
                    }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="rounded-xl p-1.5 hover:bg-slate-200 dark:hover:bg-[#3a3a3a]"
                    onClick={(event) => {
                      event.stopPropagation();
                      onStartRename(chat.id, chat.title);
                    }}
                  >
                    <PencilLine className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="rounded-xl p-1.5 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-500/20 dark:hover:text-red-300"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteChat(chat.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <button className="btn-base btn-ghost w-full justify-start" type="button" onClick={onClearActiveChat}>
          <Trash2 className="h-4 w-4" />
          Очистить чат
        </button>
        <button className="btn-base btn-ghost w-full justify-start" type="button" onClick={onToggleTheme}>
          <SunMoon className="h-4 w-4" />
          Тема: {themeLabel}
        </button>
      </div>
    </aside>
  );
}
