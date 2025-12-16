import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

type Role = 'user' | 'assistant';

interface ChatMessage {
  id: string;
  role: Role;
  content: string;
}

const generateId = () => crypto.randomUUID?.() ?? `msg-${Date.now()}-${Math.random()}`;

const apiBase = import.meta.env.VITE_API_BASE_URL ?? '';
const chatEndpoint = import.meta.env.VITE_CHAT_ENDPOINT ?? '';

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stickToBottom, setStickToBottom] = useState(true);
  const listRef = useRef<HTMLDivElement | null>(null);

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

  const requestUrl = useMemo(() => {
    if (!apiBase || !chatEndpoint) return null;
    return `${apiBase}${chatEndpoint}`;
  }, [apiBase, chatEndpoint]);

  const submitMessage = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!canSend) return;
    if (!requestUrl) {
      setError('API не сконфигурирован. Проверьте переменные окружения.');
      return;
    }

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: inputValue.trim(),
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInputValue('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ошибка ${response.status}`);
      }

      const data: { reply?: string } = await response.json();
      const replyText = data.reply ?? 'Ассистент не вернул ответ.';

      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: replyText,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error(err);
      setError('Не удалось получить ответ от ассистента. Попробуйте ещё раз.');
      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: 'Произошла ошибка при обращении к API.',
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  return (
    <div className="page">
      <header className="topbar">
        <h1 className="title" aria-label="Название чата">
          Локальный ассистент
        </h1>
        <button className="ghost-button" type="button" onClick={clearChat} aria-label="Очистить чат">
          Очистить чат
        </button>
      </header>

      <main className="main">
        <section className="chat" aria-label="Лента сообщений">
          <div ref={listRef} className="messages" role="log" aria-live="polite">
            {messages.length === 0 && (
              <div className="empty">Начните диалог, чтобы увидеть ответы ассистента.</div>
            )}
            {messages.map((message) => (
              <article key={message.id} className={`bubble ${message.role}`} aria-label={message.role === 'user' ? 'Сообщение пользователя' : 'Сообщение ассистента'}>
                {message.role === 'assistant' ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeSanitize]}
                    linkTarget="_blank"
                    className="message-text"
                  >
                    {message.content}
                  </ReactMarkdown>
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
            {error && <div className="error" role="alert">{error}</div>}
          </form>
        </section>
      </main>
    </div>
  );
}

export default App;
