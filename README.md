# Локальный ассистент (SPA)

Минимальный чат-интерфейс на React + TypeScript + Vite для локального LLM/RAG backend.

Подробная инструкция по API и подключению backend находится в [BACKEND_INTEGRATION.md](./BACKEND_INTEGRATION.md).

Приложение умеет:
- показывать чат с ответами модели;
- переключать режим `RAG` и режим обычной нейросети;
- загружать список документов с backend;
- позволять выбрать до 10 источников через чекбоксы;
- показывать шкалу заполнения лимита источников;
- рендерить markdown-ответы модели;
- сохранять только тему интерфейса в `localStorage`.

История сообщений и выбор документов живут только в памяти текущей вкладки.

## Запуск

```bash
npm install
npm run dev
```

Сборка:

```bash
npm run build
```

## Переменные окружения

Настройте адреса backend API через `.env` или переменные среды:

```env
VITE_API_BASE_URL=http://localhost:8080
VITE_CHAT_ENDPOINT=/api/chat
VITE_DOCUMENTS_ENDPOINT=/api/documents
```

`VITE_API_BASE_URL` можно оставить пустым, если frontend и backend работают на одном origin, а endpoints заданы как относительные пути.

## Контракт списка документов

Frontend не может сам читать серверную директорию с файлами, поэтому backend должен отдать список документов отдельным endpoint.

Ожидается `GET ${VITE_API_BASE_URL}${VITE_DOCUMENTS_ENDPOINT}`.

Поддерживаются такие форматы ответа:

```json
[
  "docs/report.pdf",
  "docs/manual.docx"
]
```

или:

```json
{
  "documents": [
    { "id": "report", "name": "report.pdf", "path": "docs/report.pdf" },
    { "id": "manual", "name": "manual.docx", "path": "docs/manual.docx" }
  ]
}
```

Также поддерживается ключ `items` вместо `documents`.

## Контракт chat API

Frontend отправляет `POST ${VITE_API_BASE_URL}${VITE_CHAT_ENDPOINT}` с телом:

```json
{
  "messages": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "stream": false,
  "mode": "rag",
  "sources": ["report", "manual"]
}
```

Где:
- `mode` принимает `rag` или `chat`;
- `sources` содержит выбранные документы только в `rag`-режиме;
- frontend ограничивает выбор максимум 10 источниками.

Ожидаемый ответ:

```json
{ "reply": "текст ответа ассистента" }
```

Если backend недоступен, endpoint не настроен или API вернул ошибку, приложение продолжает работать и показывает ошибку в интерфейсе.
