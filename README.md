# Локальный ассистент (SPA)

Frontend для локального LLM/RAG backend на `React + TypeScript + Vite`.

## Технологии

- React 18
- Vite 5
- Tailwind CSS 3
- Lucide React (иконки)
- React Markdown (`remark-gfm`, `rehype-sanitize`)

## Что умеет интерфейс

- режимы `rag` и `chat`;
- список документов из backend;
- выбор источников для RAG;
- загрузка документов через upload endpoint;
- потоковый вывод ответа модели;
- fallback на JSON-ответ `{ "reply": "..." }`;
- локальные чаты с сохранением в `localStorage`;
- рендер математических формул (KaTeX) в ответах модели;
- светлая/темная тема.

## Структура проекта

```text
src/
  App.tsx
  index.css
  main.tsx
  theme.tsx
  features/chat/
    config.ts
    types.ts
    utils.ts
    components/
      TopBar.tsx
      LeftSidebar.tsx
      ChatPanel.tsx
      SourcesPanel.tsx
```

## Запуск

```bash
npm install
npm run dev
```

Dev сервер зафиксирован на `http://127.0.0.1:5173` (см. `vite.config.ts`).

## Проверки

```bash
npm run lint
npm run build
```

## Переменные окружения

Создайте `.env` на основе `.env.example`:

```env
VITE_API_BASE_URL=http://localhost:8080
VITE_CHAT_ENDPOINT=/api/chat
VITE_DOCUMENTS_ENDPOINT=/api/documents
VITE_UPLOAD_ENDPOINT=/api/documents/upload
VITE_MODELS_ENDPOINT=/api/models
```

## API контракт (без изменений)

### `GET /api/documents`

Допустимы форматы:

```json
{
  "documents": [
    { "id": "report", "name": "report.pdf", "path": "docs/report.pdf" }
  ]
}
```

или:

```json
[
  "docs/report.pdf"
]
```

### `POST /api/chat`

Frontend отправляет:

```json
{
  "messages": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "stream": true,
  "model": "qwen2.5",
  "mode": "rag",
  "sources": ["report", "manual"]
}
```

`model` передается опционально (если выбран в UI).

Ответ:

- потоковый текст (если backend стримит),
- или JSON `{ "reply": "..." }`.

### `POST /api/documents/upload`

Отправка `multipart/form-data` с полем `files`.

### `GET /api/models`

Список доступных моделей для селектора в UI. Поддерживаемые форматы:

```json
{
  "models": [
    { "id": "qwen2.5", "label": "Qwen 2.5" },
    { "id": "llama3.1", "label": "Llama 3.1" }
  ]
}
```

или:

```json
["qwen2.5", "llama3.1"]
```

---

Подробный backend-контракт: [BACKEND_INTEGRATION.md](./BACKEND_INTEGRATION.md).
