import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { useTheme } from './theme';

type Role = 'user' | 'assistant' | 'error';
type ModelMode = 'rag' | 'chat';

interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  meta?: string;
}

interface SourceDocument {
  id: string;
  name: string;
  path?: string;
}

const sourceLimit = 10;
const generateId = () => crypto.randomUUID?.() ?? `msg-${Date.now()}-${Math.random()}`;

const apiBase = import.meta.env.VITE_API_BASE_URL ?? '';
const chatEndpoint = import.meta.env.VITE_CHAT_ENDPOINT ?? '';
const documentsEndpoint = import.meta.env.VITE_DOCUMENTS_ENDPOINT ?? '';

const buildRequestUrl = (base: string, endpoint: string) => {
  if (!endpoint) return null;
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  if (!base) return endpoint;

  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${normalizedBase}${normalizedEndpoint}`;
};

const describeRequestFailure = (err: unknown, fallback: string) => {
  if (err instanceof DOMException && err.name === 'AbortError') {
    return 'Причина: превышено время ожидания ответа от API.';
  }

  if (err instanceof TypeError) {
    const message = err.message.toLowerCase();
    if (message.includes('name not resolved') || message.includes('dns')) {
      return 'Причина: адрес API не найден (ошибка DNS или неверный URL).';
    }
    if (message.includes('failed to fetch')) {
      return 'Причина: не удалось подключиться к серверу API (соединение отклонено или сервер не запущен).';
    }
  }

  return fallback;
};

const normalizeDocument = (item: unknown, index: number): SourceDocument | null => {
  if (typeof item === 'string') {
    const trimmed = item.trim();
    if (!trimmed) return null;

    const parts = trimmed.split(/[\\/]/);
    return {
      id: trimmed,
      name: parts[parts.length - 1] || trimmed,
      path: trimmed,
    };
  }

  if (!item || typeof item !== 'object') return null;

  const record = item as Record<string, unknown>;
  const rawId = record.id;
  const rawName = record.name ?? record.title ?? record.filename;
  const rawPath = record.path;

  const path = typeof rawPath === 'string' && rawPath.trim() ? rawPath.trim() : undefined;
  const id =
    typeof rawId === 'string' && rawId.trim()
      ? rawId.trim()
      : path ??
        (typeof rawName === 'string' && rawName.trim() ? rawName.trim() : `document-${index + 1}`);

  const derivedName =
    typeof rawName === 'string' && rawName.trim()
      ? rawName.trim()
      : path?.split(/[\\/]/).pop() ?? id;

  return {
    id,
    name: derivedName,
    path,
  };
};

const parseDocumentsResponse = (payload: unknown) => {
  const rawDocuments = Array.isArray(payload)
    ? payload
    : payload &&
        typeof payload === 'object' &&
        Array.isArray((payload as { documents?: unknown[] }).documents)
      ? (payload as { documents: unknown[] }).documents
      : payload &&
          typeof payload === 'object' &&
          Array.isArray((payload as { items?: unknown[] }).items)
        ? (payload as { items: unknown[] }).items
        : null;

  if (!rawDocuments) {
    throw new Error('Некорректный формат списка документов.');
  }

  const seenIds = new Set<string>();
  const documents = rawDocuments
    .map((item, index) => normalizeDocument(item, index))
    .filter((document): document is SourceDocument => Boolean(document))
    .filter((document) => {
      if (seenIds.has(document.id)) return false;
      seenIds.add(document.id);
      return true;
    });

  return documents;
};

function App() {
  const { theme, toggleTheme } = useTheme();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [stickToBottom, setStickToBottom] = useState(true);
  const [modelMode, setModelMode] = useState<ModelMode>('rag');
  const [documents, setDocuments] = useState<SourceDocument[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [isDocumentsLoading, setIsDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  // State is intentionally in-memory only to align with the no-persistence requirement.
  const listRef = useRef<HTMLDivElement | null>(null);

  const requestUrl = buildRequestUrl(apiBase, chatEndpoint);
  const documentsUrl = buildRequestUrl(apiBase, documentsEndpoint);
  const selectedCount = selectedDocuments.length;
  const selectedProgress = Math.round((selectedCount / sourceLimit) * 100);
  const canSend =
    inputValue.trim().length > 0 &&
    !isLoading &&
    (modelMode === 'chat' || selectedDocuments.length > 0);

  useEffect(() => {
    const listEl = listRef.current;
    if (!listEl) return;

    const handleScroll = () => {
      const distanceFromBottom = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight;
      setStickToBottom(distanceFromBottom < 48);
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

      const payload = await response.json();
      const nextDocuments = parseDocumentsResponse(payload);

      setDocuments(nextDocuments);
      setSelectedDocuments((prev) =>
        prev.filter((documentId) => nextDocuments.some((document) => document.id === documentId)).slice(0, sourceLimit)
      );
      setDocumentsError(null);
    } catch (err) {
      setDocuments([]);
      setSelectedDocuments([]);
      setDocumentsError(
        describeRequestFailure(err, 'Не удалось загрузить документы из backend. Проверьте доступность API.')
      );
      console.error('Failed to load documents', err);
    } finally {
      window.clearTimeout(timeoutId);
      setIsDocumentsLoading(false);
    }
  }, [documentsUrl]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const toggleDocument = (documentId: string) => {
    setDocumentsError(null);
    setSelectedDocuments((prev) => {
      if (prev.includes(documentId)) {
        return prev.filter((id) => id !== documentId);
      }

      if (prev.length >= sourceLimit) {
        setDocumentsError(`Можно выбрать не более ${sourceLimit} источников.`);
        return prev;
      }

      return [...prev, documentId];
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

    setMessages(nextMessages);
    setInputValue('');
    setIsLoading(true);

    if (!requestUrl) {
      const errorMessage = createErrorMessage(
        'Причина: не задан адрес API (VITE_API_BASE_URL или VITE_CHAT_ENDPOINT).',
        requestUrl
      );
      setMessages((prev) => [...prev, errorMessage]);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: requestMessages,
          stream: false,
          mode: modelMode,
          sources: modelMode === 'rag' ? selectedDocuments : [],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorMessage = createErrorMessage(
          `Причина: сервер API вернул HTTP ${response.status} ${response.statusText}.`,
          requestUrl
        );
        setMessages((prev) => [...prev, errorMessage]);
        return;
      }

      let data: { reply?: string } | null = null;
      try {
        data = await response.json();
      } catch (err) {
        const errorMessage = createErrorMessage(
          'Причина: API вернул некорректный ответ (не JSON или отсутствует поле reply).',
          requestUrl
        );
        setMessages((prev) => [...prev, errorMessage]);
        console.error('Failed to parse JSON', err);
        return;
      }

      const replyText = data?.reply;
      if (!replyText) {
        const errorMessage = createErrorMessage(
          'Причина: API вернул некорректный ответ (не JSON или отсутствует поле reply).',
          requestUrl
        );
        setMessages((prev) => [...prev, errorMessage]);
        return;
      }

      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: replyText,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const reason = describeRequestFailure(
        err,
        'Причина: не удалось подключиться к серверу API (соединение отклонено или сервер не запущен).'
      );

      const errorMessage = createErrorMessage(reason, requestUrl);
      setMessages((prev) => [...prev, errorMessage]);
      console.error('API request failed', err);
    } finally {
      window.clearTimeout(timeoutId);
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="page">
      <header className="topbar">
        <h1 className="title" aria-label="Название чата">
          Локальный ассистент
        </h1>
        <div className="topbar-actions">
          <button
            className="ghost-button"
            type="button"
            onClick={toggleTheme}
            aria-label={`Переключить тему на ${theme === 'light' ? 'тёмную' : 'светлую'}`}
          >
            {theme === 'light' ? 'Тёмная тема' : 'Светлая тема'}
          </button>
          <button className="ghost-button" type="button" onClick={clearChat} aria-label="Очистить чат">
            Очистить чат
          </button>
        </div>
      </header>

      <main className="main">
        <div className="workspace">
          <aside className="control-panel" aria-label="Панель настроек RAG">
            <section className="panel-card">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Режим модели</h2>
                  <p className="panel-description">
                    Переключайте обычный чат и режим с использованием выбранных источников.
                  </p>
                </div>
              </div>
              <div className="mode-switch" role="tablist" aria-label="Режим модели">
                <button
                  type="button"
                  className={`mode-button ${modelMode === 'rag' ? 'active' : ''}`}
                  onClick={() => setModelMode('rag')}
                  aria-pressed={modelMode === 'rag'}
                >
                  RAG режим
                </button>
                <button
                  type="button"
                  className={`mode-button ${modelMode === 'chat' ? 'active' : ''}`}
                  onClick={() => setModelMode('chat')}
                  aria-pressed={modelMode === 'chat'}
                >
                  Обычная нейросеть
                </button>
              </div>
              <p className="mode-hint">
                {modelMode === 'rag'
                  ? 'В запрос будут переданы только отмеченные источники.'
                  : 'Источники можно отметить заранее, но в этом режиме они не отправляются в модель.'}
              </p>
            </section>

            <section className="panel-card">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Источники</h2>
                  <p className="panel-description">
                    Backend должен вернуть список документов из рабочей директории модели.
                  </p>
                </div>
                <button type="button" className="ghost-button compact-button" onClick={() => void loadDocuments()}>
                  Обновить
                </button>
              </div>

              <div className="source-summary">
                <div className="source-summary-row">
                  <span>
                    Выбрано {selectedCount} из {sourceLimit}
                  </span>
                  <span>{selectedProgress}%</span>
                </div>
                <div
                  className={`progress-track ${
                    selectedCount === sourceLimit ? 'is-full' : selectedCount >= sourceLimit - 2 ? 'is-warning' : ''
                  }`}
                  aria-hidden="true"
                >
                  <div className="progress-fill" style={{ width: `${selectedProgress}%` }} />
                </div>
              </div>

              {documentsError && <div className="panel-status error">{documentsError}</div>}
              {!documentsError && isDocumentsLoading && <div className="panel-status">Загрузка списка документов…</div>}

              {!isDocumentsLoading && documents.length === 0 && !documentsError ? (
                <div className="panel-empty">Список документов пуст. Добавьте файлы в индексируемую директорию backend.</div>
              ) : (
                <div className="document-list" role="list" aria-label="Список документов">
                  {documents.map((document) => {
                    const checked = selectedDocuments.includes(document.id);
                    const disableUnchecked = !checked && selectedCount >= sourceLimit;

                    return (
                      <label
                        key={document.id}
                        className={`document-item ${checked ? 'selected' : ''} ${disableUnchecked ? 'blocked' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleDocument(document.id)}
                          disabled={disableUnchecked}
                          aria-label={`Использовать документ ${document.name}`}
                        />
                        <span className="document-copy">
                          <span className="document-name">{document.name}</span>
                          {document.path && <span className="document-path">{document.path}</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </section>
          </aside>

          <section className="chat" aria-label="Лента сообщений">
            <div ref={listRef} className="messages" role="log" aria-live="polite">
              {messages.length === 0 && (
                <div className="empty">
                  {modelMode === 'rag'
                    ? 'Выберите источники и начните диалог, чтобы ассистент отвечал с учётом документов.'
                    : 'Начните диалог, чтобы увидеть ответы ассистента.'}
                </div>
              )}
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`bubble ${message.role}`}
                  aria-label={
                    message.role === 'user'
                      ? 'Сообщение пользователя'
                      : message.role === 'assistant'
                        ? 'Сообщение ассистента'
                        : 'Сообщение об ошибке'
                  }
                >
                  {message.role === 'assistant' ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeSanitize]}
                      components={{
                        a: (props) => (
                          <a {...props} target="_blank" rel="noreferrer">
                            {props.children}
                          </a>
                        ),
                      }}
                      className="message-text"
                    >
                      {message.content}
                    </ReactMarkdown>
                  ) : message.role === 'error' ? (
                    <div className="message-text error-text">
                      <div className="error-title">Ошибка: модель недоступна</div>
                      <div className="error-reason">{message.content}</div>
                      <div className="error-meta">URL: {message.meta}</div>
                    </div>
                  ) : (
                    <p className="message-text">{message.content}</p>
                  )}
                </article>
              ))}
            </div>

            <form className="composer" onSubmit={submitMessage} aria-label="Форма ввода сообщения">
              <div className="composer-header">
                <div>
                  <h2 className="panel-title">Запрос</h2>
                  <p className="panel-description">
                    {modelMode === 'rag'
                      ? selectedCount > 0
                        ? `В запрос уйдут ${selectedCount} выбранных источников.`
                        : 'Для RAG-режима выберите хотя бы один источник.'
                      : 'Будет выполнен обычный запрос без RAG-источников.'}
                  </p>
                </div>
                <span className="mode-badge">{modelMode === 'rag' ? 'RAG' : 'CHAT'}</span>
              </div>

              <label className="sr-only" htmlFor="message-input">
                Введите сообщение
              </label>
              <textarea
                id="message-input"
                className="input"
                value={inputValue}
                placeholder="Напишите сообщение и нажмите Enter"
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void submitMessage();
                  }
                }}
                disabled={isLoading}
                aria-label="Поле ввода сообщения"
                rows={4}
              />
              <div className="composer-actions">
                {!canSend && modelMode === 'rag' && selectedCount === 0 && (
                  <span className="status warning">Выберите хотя бы 1 источник</span>
                )}
                {isLoading && <span className="status">Генерация…</span>}
                <button type="submit" className="primary-button" disabled={!canSend} aria-label="Отправить сообщение">
                  Отправить
                </button>
              </div>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;
