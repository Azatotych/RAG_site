import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { useTheme } from './theme';

type Role = 'user' | 'assistant' | 'error';
type Mode = 'gpt' | 'rag';

type LibraryNode =
  | {
      id: string;
      title: string;
      type: 'section';
      children: LibraryNode[];
    }
  | {
      id: string;
      title: string;
      type: 'document';
      category: string;
      meta?: string;
    };

interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  meta?: string;
}

interface SelectedDocument {
  id: string;
  title: string;
  category: string;
  meta?: string;
}

const generateId = () => crypto.randomUUID?.() ?? `msg-${Date.now()}-${Math.random()}`;

const apiBase = import.meta.env.VITE_API_BASE_URL ?? '';
const chatEndpoint = import.meta.env.VITE_CHAT_ENDPOINT ?? '';

const mockLibraryTree: LibraryNode[] = [
  {
    id: 'study-materials',
    title: 'Учебная литература',
    type: 'section',
    children: [
      {
        id: 'study-tactics',
        title: 'Тематика: Тактика и стратегическое планирование',
        type: 'section',
        children: [
          {
            id: 'doc-field-manual',
            title: 'Полевой устав. Выписка 2023',
            category: 'Учебная литература',
            meta: '2023',
            type: 'document',
          },
          {
            id: 'doc-training-memo',
            title: 'Методическое пособие по работе с РЛС',
            category: 'Учебная литература',
            meta: '2022',
            type: 'document',
          },
        ],
      },
    ],
  },
  {
    id: 'orders-academy',
    title: 'Приказы начальника академии',
    type: 'section',
    children: [
      {
        id: 'orders-2024',
        title: '2024',
        type: 'section',
        children: [
          {
            id: 'order-2024-09-15-123',
            title: '2024-09-15 №123',
            category: 'Приказы начальника академии',
            meta: '2024',
            type: 'document',
          },
          {
            id: 'order-2024-04-02-042',
            title: '2024-04-02 №042',
            category: 'Приказы начальника академии',
            meta: '2024',
            type: 'document',
          },
        ],
      },
    ],
  },
  {
    id: 'orders-mod',
    title: 'Приказы Министерства обороны',
    type: 'section',
    children: [
      {
        id: 'mod-2024',
        title: '2024',
        type: 'section',
        children: [
          {
            id: 'mod-2024-10-01-310',
            title: '2024-10-01 №310',
            category: 'Приказы Министерства обороны',
            meta: '2024',
            type: 'document',
          },
          {
            id: 'mod-2024-03-12-088',
            title: '2024-03-12 №088',
            category: 'Приказы Министерства обороны',
            meta: '2024',
            type: 'document',
          },
        ],
      },
    ],
  },
  {
    id: 'internal-docs',
    title: 'Внутренняя документация',
    type: 'section',
    children: [
      {
        id: 'internal-operations',
        title: 'Раздел: Оперативные процедуры',
        type: 'section',
        children: [
          {
            id: 'internal-ops-checklist',
            title: 'Чек-лист запуска смены связи',
            category: 'Внутренняя документация',
            meta: 'Версия 1.4',
            type: 'document',
          },
          {
            id: 'internal-ops-safety',
            title: 'Правила безопасности на аппаратных узлах',
            category: 'Внутренняя документация',
            meta: 'Актуализировано 2024-05',
            type: 'document',
          },
        ],
      },
    ],
  },
];

function isDocument(node: LibraryNode): node is Extract<LibraryNode, { type: 'document' }> {
  return node.type === 'document';
}

function App() {
  const { theme, toggleTheme } = useTheme();
  const [mode, setMode] = useState<Mode>('gpt');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [stickToBottom, setStickToBottom] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<SelectedDocument[]>([]);
  const [selectedMenuOpen, setSelectedMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const canSend = inputValue.trim().length > 0 && !isLoading;

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectedMenuOpen && dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setSelectedMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDrawerOpen(false);
        setSelectedMenuOpen(false);
        setToast(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedMenuOpen]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const requestUrl = useMemo(() => (!apiBase || !chatEndpoint ? null : `${apiBase}${chatEndpoint}`), []);

  const createErrorMessage = (reason: string, requestUrlValue: string | null): ChatMessage => ({
    id: generateId(),
    role: 'error',
    content: reason,
    meta: requestUrlValue ?? 'URL не задан',
  });

  const resetUiState = () => {
    setMessages([]);
    setSelectedDocs([]);
    setIsDrawerOpen(false);
    setSelectedMenuOpen(false);
  };

  const handleModeChange = (nextMode: Mode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    resetUiState();
  };

  const handleDocToggle = (doc: SelectedDocument) => {
    const alreadySelected = selectedDocs.some((item) => item.id === doc.id);
    if (alreadySelected) {
      setSelectedDocs((prev) => prev.filter((item) => item.id !== doc.id));
      return;
    }

    if (selectedDocs.length >= 10) {
      setToast('Лимит контекста: 10 документов. Уберите один документ, чтобы добавить новый.');
      return;
    }

    setSelectedDocs((prev) => [...prev, doc]);
  };

  const progressColorClass = () => {
    if (selectedDocs.length >= 9) return 'progress danger';
    if (selectedDocs.length >= 7) return 'progress warning';
    return 'progress normal';
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
          mode,
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
          selected_documents: mode === 'rag' ? selectedDocs.map((doc) => doc.id) : [],
          stream: false,
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
      let reason = 'Причина: не удалось подключиться к серверу API (соединение отклонено или сервер не запущен).';
      if (err instanceof DOMException && err.name === 'AbortError') {
        reason = 'Причина: превышено время ожидания ответа от API.';
      } else if (err instanceof TypeError) {
        const message = err.message.toLowerCase();
        if (message.includes('name not resolved') || message.includes('dns')) {
          reason = 'Причина: адрес API не найден (ошибка DNS или неверный URL).';
        } else if (message.includes('failed to fetch')) {
          reason = 'Причина: не удалось подключиться к серверу API (соединение отклонено или сервер не запущен).';
        }
      }

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

  const renderNode = (node: LibraryNode) => {
    if (isDocument(node)) {
      const isSelected = selectedDocs.some((item) => item.id === node.id);
      return (
        <div key={node.id} className="doc-row">
          <div className="doc-info">
            <div className="doc-title">{node.title}</div>
            <div className="doc-meta">{node.category}</div>
          </div>
          <button
            type="button"
            className={`doc-toggle ${isSelected ? 'selected' : ''}`}
            onClick={() =>
              handleDocToggle({ id: node.id, title: node.title, category: node.category, meta: node.meta })
            }
            aria-label={isSelected ? 'Убрать документ из контекста' : 'Добавить документ в контекст'}
          >
            {isSelected ? '✓' : '+'}
          </button>
        </div>
      );
    }

    return (
      <div key={node.id} className="section">
        <div className="section-title">{node.title}</div>
        <div className="section-children">{node.children.map((child) => renderNode(child))}</div>
      </div>
    );
  };

  return (
    <div className="page">
      {toast && (
        <div className="toast" role="status" onClick={() => setToast(null)}>
          {toast}
        </div>
      )}
      <header className="topbar">
        <div className="topbar-left">
          <h1 className="title" aria-label="Название чата">
            Локальный ассистент
          </h1>
          <div className="mode-switch" role="group" aria-label="Переключатель режимов">
            <button
              type="button"
              className={`mode-button ${mode === 'gpt' ? 'active' : ''}`}
              onClick={() => handleModeChange('gpt')}
            >
              GPT режим
            </button>
            <button
              type="button"
              className={`mode-button ${mode === 'rag' ? 'active' : ''}`}
              onClick={() => handleModeChange('rag')}
            >
              RAG режим
            </button>
          </div>
        </div>
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

      {mode === 'rag' && (
        <div className="context-bar">
          <div className="context-left">
            <button className="primary-button" type="button" onClick={() => setIsDrawerOpen(true)}>
              Выбрать литературу
            </button>
            <div className="context-progress" aria-label={`Выбрано документов: ${selectedDocs.length} из 10`}>
              <div className="context-count">Контекст: {selectedDocs.length}/10</div>
              <div className="progress-track">
                <div className={progressColorClass()} style={{ width: `${(selectedDocs.length / 10) * 100}%` }} />
              </div>
            </div>
          </div>
          <div className="context-right" ref={dropdownRef}>
            <button
              type="button"
              className="ghost-button dropdown-trigger"
              onClick={() => setSelectedMenuOpen((prev) => !prev)}
            >
              Выбранные документы ▾
            </button>
            {selectedMenuOpen && (
              <div className="dropdown" role="menu">
                {selectedDocs.length === 0 ? (
                  <div className="dropdown-empty">Документы не выбраны.</div>
                ) : (
                  selectedDocs.map((doc) => (
                    <div key={doc.id} className="dropdown-item">
                      <div className="dropdown-info">
                        <span className="dropdown-title">{doc.title}</span>
                        <span className="dropdown-meta">{doc.category}</span>
                      </div>
                      <button
                        type="button"
                        className="doc-remove"
                        onClick={() => setSelectedDocs((prev) => prev.filter((item) => item.id !== doc.id))}
                        aria-label="Убрать документ из контекста"
                      >
                        –
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <main className="main">
        <section className="chat" aria-label="Лента сообщений">
          <div ref={listRef} className="messages" role="log" aria-live="polite">
            {messages.length === 0 && (
              <div className="empty">Начните диалог, чтобы увидеть ответы ассистента.</div>
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
                  submitMessage();
                }
              }}
              disabled={isLoading}
              aria-label="Поле ввода сообщения"
              rows={3}
            />
            <div className="composer-actions">
              <button type="submit" className="primary-button" disabled={!canSend} aria-label="Отправить сообщение">
                Отправить
              </button>
              {isLoading && <span className="status">Генерация…</span>}
            </div>
          </form>
        </section>
      </main>

      {isDrawerOpen && (
        <>
          <div className="overlay" onClick={() => setIsDrawerOpen(false)} aria-label="Закрыть боковую панель" />
          <aside className="drawer" role="dialog" aria-label="Выбор литературы">
            <div className="drawer-header">
              <h2>Литература</h2>
              <button className="ghost-button" type="button" onClick={() => setIsDrawerOpen(false)} aria-label="Закрыть">
                ×
              </button>
            </div>
            <div className="drawer-search">
              <input type="text" placeholder="Поиск (макет)" aria-label="Поиск по литературе" disabled />
            </div>
            <div className="drawer-content">{mockLibraryTree.map((node) => renderNode(node))}</div>
          </aside>
        </>
      )}
    </div>
  );
}

export default App;
