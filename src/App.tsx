import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { emptyChatMessages, generateId, getRandomPlaceholder } from './features/chat/config';
import { ChatPanel } from './features/chat/components/ChatPanel';
import { LeftSidebar } from './features/chat/components/LeftSidebar';
import { SourcesPanel } from './features/chat/components/SourcesPanel';
import { TopBar } from './features/chat/components/TopBar';
import { ChatMessage, ChatStorage, ModelMode, ModelOption, SourceDocument } from './features/chat/types';
import { buildRequestUrl, cn, describeRequestFailure, parseDocumentsResponse, parseModelsResponse } from './features/chat/utils';
import { useTheme } from './theme';

const apiBase = import.meta.env.VITE_API_BASE_URL ?? '';
const chatEndpoint = import.meta.env.VITE_CHAT_ENDPOINT ?? '';
const documentsEndpoint = import.meta.env.VITE_DOCUMENTS_ENDPOINT ?? '';
const uploadEndpoint = import.meta.env.VITE_UPLOAD_ENDPOINT ?? '';
const modelsEndpoint = import.meta.env.VITE_MODELS_ENDPOINT ?? '';

const chatsStorageKey = 'vas-chats-v1';

interface PersistedChatState {
  chats: Array<{ id: string; title: string; updatedAt: string }>;
  activeChatId: string;
  placeholdersByChat: Record<string, string>;
  messagesByChat: ChatStorage;
}

const normalizeMessages = (value: unknown): ChatMessage[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const role = record.role;
      const content = record.content;
      const meta = record.meta;

      if (role !== 'user' && role !== 'assistant' && role !== 'error') return null;
      if (typeof content !== 'string') return null;

      return {
        id: typeof record.id === 'string' && record.id.trim() ? record.id : `${role}-${index + 1}`,
        role,
        content,
        ...(typeof meta === 'string' ? { meta } : {}),
      };
    })
    .filter((message): message is ChatMessage => Boolean(message));
};

const normalizeMessagesByMode = (value: unknown) => {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    rag: normalizeMessages(record.rag),
    chat: normalizeMessages(record.chat),
  };
};

const createDefaultChatState = (): PersistedChatState => {
  const chatId = generateId();
  return {
    chats: [{ id: chatId, title: 'Новый чат', updatedAt: 'только что' }],
    activeChatId: chatId,
    placeholdersByChat: { [chatId]: getRandomPlaceholder() },
    messagesByChat: { [chatId]: emptyChatMessages() },
  };
};

const loadPersistedChatState = (): PersistedChatState => {
  if (typeof window === 'undefined') return createDefaultChatState();

  try {
    const raw = window.localStorage.getItem(chatsStorageKey);
    if (!raw) return createDefaultChatState();

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return createDefaultChatState();

    const parsedRecord = parsed as Record<string, unknown>;
    const rawChats = Array.isArray(parsedRecord.chats) ? parsedRecord.chats : [];
    const seenIds = new Set<string>();
    const chats = rawChats
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const record = item as Record<string, unknown>;
        const id = typeof record.id === 'string' ? record.id.trim() : '';
        if (!id || seenIds.has(id)) return null;
        seenIds.add(id);

        return {
          id,
          title: typeof record.title === 'string' && record.title.trim() ? record.title : 'Без названия',
          updatedAt:
            typeof record.updatedAt === 'string' && record.updatedAt.trim()
              ? record.updatedAt
              : 'только что',
        };
      })
      .filter((chat): chat is { id: string; title: string; updatedAt: string } => Boolean(chat));

    if (chats.length === 0) return createDefaultChatState();

    const requestedActiveChatId = typeof parsedRecord.activeChatId === 'string' ? parsedRecord.activeChatId : '';
    const activeChatId = chats.some((chat) => chat.id === requestedActiveChatId)
      ? requestedActiveChatId
      : chats[0].id;

    const rawMessagesByChat =
      parsedRecord.messagesByChat && typeof parsedRecord.messagesByChat === 'object'
        ? (parsedRecord.messagesByChat as Record<string, unknown>)
        : {};
    const rawPlaceholdersByChat =
      parsedRecord.placeholdersByChat && typeof parsedRecord.placeholdersByChat === 'object'
        ? (parsedRecord.placeholdersByChat as Record<string, unknown>)
        : {};

    const messagesByChat: ChatStorage = {};
    const placeholdersByChat: Record<string, string> = {};
    chats.forEach((chat) => {
      messagesByChat[chat.id] = normalizeMessagesByMode(rawMessagesByChat[chat.id]);
      const placeholder = rawPlaceholdersByChat[chat.id];
      placeholdersByChat[chat.id] =
        typeof placeholder === 'string' && placeholder.trim() ? placeholder : getRandomPlaceholder();
    });

    return { chats, activeChatId, placeholdersByChat, messagesByChat };
  } catch {
    return createDefaultChatState();
  }
};

function App() {
  const initialChatState = useMemo(loadPersistedChatState, []);
  const { theme, toggleTheme } = useTheme();

  const [mode, setMode] = useState<ModelMode>('rag');
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [isModelsLoading, setIsModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const [chats, setChats] = useState(initialChatState.chats);
  const [activeChatId, setActiveChatId] = useState<string>(initialChatState.activeChatId);
  const [placeholdersByChat, setPlaceholdersByChat] = useState<Record<string, string>>(
    initialChatState.placeholdersByChat
  );
  const [messagesByChat, setMessagesByChat] = useState<ChatStorage>(initialChatState.messagesByChat);

  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [chatTitleDraft, setChatTitleDraft] = useState('');

  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [stickToBottom, setStickToBottom] = useState(true);

  const [documents, setDocuments] = useState<SourceDocument[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [sourceQuery, setSourceQuery] = useState('');
  const [isDocumentsLoading, setIsDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const requestUrl = buildRequestUrl(apiBase, chatEndpoint);
  const documentsUrl = buildRequestUrl(apiBase, documentsEndpoint);
  const uploadUrl = buildRequestUrl(apiBase, uploadEndpoint);
  const modelsUrl = buildRequestUrl(apiBase, modelsEndpoint);

  const messages = useMemo(() => messagesByChat[activeChatId]?.[mode] ?? [], [messagesByChat, activeChatId, mode]);
  const selectedCount = selectedDocuments.length;
  const canSend = inputValue.trim().length > 0 && !isLoading && (mode === 'chat' || selectedCount > 0);
  const activeChat = chats.find((chat) => chat.id === activeChatId);
  const activePlaceholder = placeholdersByChat[activeChatId] ?? 'Спросите что-нибудь';
  const filteredDocuments = useMemo(() => {
    const query = sourceQuery.trim().toLowerCase();
    if (!query) return documents;
    return documents.filter((document) => document.name.toLowerCase().includes(query));
  }, [documents, sourceQuery]);

  useEffect(() => {
    if (!editingChatId) return;
    window.setTimeout(() => renameInputRef.current?.focus(), 0);
  }, [editingChatId]);

  useEffect(() => {
    setPlaceholdersByChat((prev) => {
      if (prev[activeChatId]) return prev;
      return { ...prev, [activeChatId]: getRandomPlaceholder() };
    });
  }, [activeChatId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!chats.length) return;

    const activeId = chats.some((chat) => chat.id === activeChatId) ? activeChatId : chats[0].id;
    const nextMessagesByChat: ChatStorage = {};
    const nextPlaceholdersByChat: Record<string, string> = {};

    chats.forEach((chat) => {
      nextMessagesByChat[chat.id] = messagesByChat[chat.id] ?? emptyChatMessages();
      nextPlaceholdersByChat[chat.id] = placeholdersByChat[chat.id] ?? getRandomPlaceholder();
    });

    const payload: PersistedChatState = {
      chats,
      activeChatId: activeId,
      messagesByChat: nextMessagesByChat,
      placeholdersByChat: nextPlaceholdersByChat,
    };

    window.localStorage.setItem(chatsStorageKey, JSON.stringify(payload));
  }, [chats, activeChatId, messagesByChat, placeholdersByChat]);

  const loadModels = useCallback(async () => {
    if (!modelsUrl) {
      setModelOptions([]);
      setSelectedModel('');
      setModelsError('Не задан адрес списка моделей (VITE_MODELS_ENDPOINT).');
      return;
    }

    setIsModelsLoading(true);
    setModelsError(null);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(modelsUrl, {
        method: 'GET',
        signal: controller.signal,
      });

      if (!response.ok) {
        setModelOptions([]);
        setSelectedModel('');
        setModelsError(`Не удалось загрузить модели: HTTP ${response.status} ${response.statusText}.`);
        return;
      }

      const nextModels = parseModelsResponse(await response.json());
      setModelOptions(nextModels);
      setSelectedModel((prev) => {
        if (prev && nextModels.some((model) => model.id === prev)) return prev;
        return nextModels[0]?.id ?? '';
      });
      setModelsError(null);
    } catch (err) {
      setModelOptions([]);
      setSelectedModel('');
      setModelsError(describeRequestFailure(err, 'Не удалось загрузить модели из backend.'));
    } finally {
      window.clearTimeout(timeoutId);
      setIsModelsLoading(false);
    }
  }, [modelsUrl]);

  useEffect(() => {
    void loadModels();
  }, [loadModels]);

  useEffect(() => {
    const listEl = listRef.current;
    if (!listEl) return;

    const handleScroll = () => {
      const distanceFromBottom = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight;
      setStickToBottom(distanceFromBottom < 56);
    };

    listEl.addEventListener('scroll', handleScroll);
    return () => listEl.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!stickToBottom) return;
    const listEl = listRef.current;
    if (!listEl) return;
    listEl.scrollTo({ top: listEl.scrollHeight, behavior: 'smooth' });
  }, [messages, stickToBottom]);

  const createErrorMessage = (reason: string, requestUrlValue: string | null): ChatMessage => ({
    id: generateId(),
    role: 'error',
    content: reason,
    meta: requestUrlValue ?? 'URL не задан',
  });

  const setActiveModeMessages = useCallback(
    (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
      setMessagesByChat((prev) => {
        const currentChat = prev[activeChatId] ?? emptyChatMessages();
        return {
          ...prev,
          [activeChatId]: {
            ...currentChat,
            [mode]: updater(currentChat[mode] ?? []),
          },
        };
      });
    },
    [activeChatId, mode]
  );

  const touchActiveChat = useCallback(() => {
    setChats((prev) => prev.map((chat) => (chat.id === activeChatId ? { ...chat, updatedAt: 'только что' } : chat)));
  }, [activeChatId]);

  const loadDocuments = useCallback(async () => {
    if (!documentsUrl) {
      setDocuments([]);
      setSelectedDocuments([]);
      setDocumentsError('Не задан адрес списка документов (VITE_DOCUMENTS_ENDPOINT).');
      return;
    }

    setIsDocumentsLoading(true);
    setDocumentsError(null);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(documentsUrl, {
        method: 'GET',
        signal: controller.signal,
      });

      if (!response.ok) {
        setDocuments([]);
        setSelectedDocuments([]);
        setDocumentsError(`Не удалось загрузить документы: HTTP ${response.status} ${response.statusText}.`);
        return;
      }

      const nextDocuments = parseDocumentsResponse(await response.json());
      setDocuments(nextDocuments);
      setSelectedDocuments((prev) =>
        prev.filter((documentId) => nextDocuments.some((document) => document.id === documentId))
      );
      setDocumentsError(null);
    } catch (err) {
      setDocuments([]);
      setSelectedDocuments([]);
      setDocumentsError(describeRequestFailure(err, 'Не удалось загрузить документы из backend.'));
      console.error('Failed to load documents', err);
    } finally {
      window.clearTimeout(timeoutId);
      setIsDocumentsLoading(false);
    }
  }, [documentsUrl]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!uploadUrl) {
        setDocumentsError('Не задан адрес загрузки (VITE_UPLOAD_ENDPOINT).');
        return;
      }

      setIsUploading(true);
      setDocumentsError(null);

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 600000);

      try {
        const formData = new FormData();
        files.forEach((file) => formData.append('files', file));

        const response = await fetch(uploadUrl, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });

        if (!response.ok) {
          const details = await response.text().catch(() => '');
          setDocumentsError(`Ошибка загрузки: HTTP ${response.status} ${response.statusText}. ${details}`);
          return;
        }

        await loadDocuments();
      } catch (err) {
        setDocumentsError(describeRequestFailure(err, 'Не удалось загрузить файлы.'));
        console.error('Upload failed', err);
      } finally {
        window.clearTimeout(timeoutId);
        setIsUploading(false);
      }
    },
    [uploadUrl, loadDocuments]
  );

  const createNewChat = () => {
    const chatId = generateId();
    const chatTitle = mode === 'rag' ? 'Новый RAG чат' : 'Новый чат';

    setChats((prev) => [{ id: chatId, title: chatTitle, updatedAt: 'только что' }, ...prev]);
    setMessagesByChat((prev) => ({ ...prev, [chatId]: emptyChatMessages() }));
    setPlaceholdersByChat((prev) => ({ ...prev, [chatId]: getRandomPlaceholder() }));
    setActiveChatId(chatId);
  };

  const commitRenameChat = () => {
    if (!editingChatId) return;
    const nextTitle = chatTitleDraft.trim() || 'Без названия';

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === editingChatId ? { ...chat, title: nextTitle, updatedAt: 'только что' } : chat
      )
    );
    setEditingChatId(null);
    setChatTitleDraft('');
  };

  const cancelRenameChat = () => {
    setEditingChatId(null);
    setChatTitleDraft('');
  };

  const deleteChat = (chatId: string) => {
    if (chats.length === 1) {
      setMessagesByChat((prev) => ({ ...prev, [chatId]: emptyChatMessages() }));
      return;
    }

    setChats((prev) => {
      const next = prev.filter((chat) => chat.id !== chatId);
      if (activeChatId === chatId && next[0]) {
        setActiveChatId(next[0].id);
      }
      return next;
    });

    setMessagesByChat((prev) => {
      const next = { ...prev };
      delete next[chatId];
      return next;
    });

    setPlaceholdersByChat((prev) => {
      const next = { ...prev };
      delete next[chatId];
      return next;
    });
  };

  const submitMessage = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!canSend) return;

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: inputValue.trim(),
    };
    const nextMessages = [...messages, userMessage];
    const requestMessages = nextMessages
      .filter((message) => message.role !== 'error')
      .map(({ role, content }) => ({ role, content }));

    const assistantId = generateId();
    setActiveModeMessages(() => [...nextMessages, { id: assistantId, role: 'assistant', content: '' }]);
    setInputValue('');
    setIsLoading(true);
    touchActiveChat();

    if (!requestUrl) {
      const errorMessage = createErrorMessage('Причина: не задан адрес API.', requestUrl);
      setActiveModeMessages((prev) => prev.filter((message) => message.id !== assistantId).concat(errorMessage));
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 600000);

    try {
      const requestPayload = {
        messages: requestMessages,
        stream: true,
        mode,
        sources: mode === 'rag' ? selectedDocuments : [],
        ...(selectedModel ? { model: selectedModel } : {}),
      };

      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const details = await response.text().catch(() => '');
        const errorMessage = createErrorMessage(
          `Причина: сервер API вернул HTTP ${response.status} ${response.statusText}.${details ? `\n${details}` : ''}`,
          requestUrl
        );
        setActiveModeMessages((prev) => prev.filter((message) => message.id !== assistantId).concat(errorMessage));
        return;
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        const data = (await response.json().catch(() => null)) as { reply?: string } | null;
        if (!data?.reply) {
          const errorMessage = createErrorMessage('Причина: JSON без поля reply.', requestUrl);
          setActiveModeMessages((prev) => prev.filter((message) => message.id !== assistantId).concat(errorMessage));
          return;
        }

        setActiveModeMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId ? { ...message, content: data.reply ?? '' } : message
          )
        );
        return;
      }

      if (!response.body) {
        const errorMessage = createErrorMessage('Причина: response.body отсутствует.', requestUrl);
        setActiveModeMessages((prev) => prev.filter((message) => message.id !== assistantId).concat(errorMessage));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulated = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        accumulated += decoder.decode(value, { stream: true });
        setActiveModeMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId ? { ...message, content: accumulated } : message
          )
        );
      }
    } catch (err) {
      const errorMessage = createErrorMessage(
        describeRequestFailure(err, 'Причина: нет соединения с API.'),
        requestUrl
      );
      setActiveModeMessages((prev) => prev.filter((message) => message.id !== assistantId).concat(errorMessage));
    } finally {
      window.clearTimeout(timeoutId);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar
        mode={mode}
        activeChatTitle={activeChat?.title ?? 'Чат'}
        selectedModelLabel={modelOptions.find((model) => model.id === selectedModel)?.label ?? 'модель не выбрана'}
      />

      <main
        className={cn(
          'grid min-h-0 flex-1 gap-3 p-3 lg:overflow-hidden',
          mode === 'rag'
            ? 'grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)_380px]'
            : 'grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]'
        )}
      >
        <LeftSidebar
          mode={mode}
          selectedModel={selectedModel}
          modelOptions={modelOptions}
          isModelsLoading={isModelsLoading}
          modelsError={modelsError}
          chats={chats}
          activeChatId={activeChatId}
          editingChatId={editingChatId}
          chatTitleDraft={chatTitleDraft}
          renameInputRef={renameInputRef}
          themeLabel={theme === 'light' ? 'светлая' : 'темная'}
          onCreateChat={createNewChat}
          onModeChange={setMode}
          onModelChange={setSelectedModel}
          onSelectChat={setActiveChatId}
          onStartRename={(chatId, title) => {
            setEditingChatId(chatId);
            setChatTitleDraft(title);
          }}
          onRenameDraftChange={setChatTitleDraft}
          onCommitRename={commitRenameChat}
          onCancelRename={cancelRenameChat}
          onDeleteChat={deleteChat}
          onClearActiveChat={() => setActiveModeMessages(() => [])}
          onToggleTheme={toggleTheme}
        />

        <ChatPanel
          mode={mode}
          messages={messages}
          placeholder={activePlaceholder}
          inputValue={inputValue}
          canSend={canSend}
          isLoading={isLoading}
          isUploading={isUploading}
          uploadEnabled={Boolean(uploadUrl)}
          listRef={listRef}
          onInputChange={setInputValue}
          onSubmit={submitMessage}
          onUploadFiles={(files) => {
            void uploadFiles(files);
          }}
        />

        {mode === 'rag' && (
          <SourcesPanel
            sourceQuery={sourceQuery}
            selectedCount={selectedCount}
            documentsError={documentsError}
            isUploading={isUploading}
            isDocumentsLoading={isDocumentsLoading}
            uploadEnabled={Boolean(uploadUrl)}
            documents={filteredDocuments}
            selectedDocuments={selectedDocuments}
            onQueryChange={setSourceQuery}
            onUploadFiles={(files) => {
              void uploadFiles(files);
            }}
            onReload={() => {
              void loadDocuments();
            }}
            onSelectAll={() => {
              setSelectedDocuments(documents.map((document) => document.id));
            }}
            onClearSelection={() => {
              setSelectedDocuments([]);
            }}
            onToggleDocument={(documentId) => {
              setDocumentsError(null);
              setSelectedDocuments((prev) =>
                prev.includes(documentId) ? prev.filter((id) => id !== documentId) : [...prev, documentId]
              );
            }}
          />
        )}
      </main>
    </div>
  );
}

export default App;
