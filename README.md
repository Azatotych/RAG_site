# Локальный ассистент (SPA)

Минимальный чат-UI на React + TypeScript + Vite для общения с локальным LLM-бэкендом. Сообщения хранятся только в памяти текущей вкладки.

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

Настройте адрес API через `.env` или переменные среды:

```
VITE_API_BASE_URL=http://localhost:8080
VITE_CHAT_ENDPOINT=/api/chat
```

Итоговый запрос: `POST ${VITE_API_BASE_URL}${VITE_CHAT_ENDPOINT}` с телом:

```json
{
  "messages": [
    {"role":"user","content":"..."},
    {"role":"assistant","content":"..."}
  ],
  "stream": false
}
```

Ответ по умолчанию: `{ "reply": "текст ответа ассистента" }`.
