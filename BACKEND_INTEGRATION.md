# Интеграция backend, модели и источников

Этот документ описывает API-контракт для сайта так, чтобы:
- сохранить совместимость с текущим `POST /api/chat`;
- добавить RAG-режим с выбором источников;
- не давать frontend прямой доступ к серверной файловой системе;
- не заставлять MLOps-команду переписывать рабочий chat pipeline.

## Основная идея

Frontend остаётся тонким клиентом:
- показывает список документов;
- даёт выбрать до 10 источников;
- переключает режим `chat` или `rag`;
- отправляет историю сообщений и выбранные `source id`.

Backend отвечает за:
- чтение документов из серверной директории;
- сбор списка доступных источников;
- retrieval по выбранным документам;
- вызов модели;
- возврат ответа в старом формате.

## Совместимость со старым механизмом

Старый контракт сохраняется:
- endpoint остаётся `POST /api/chat`;
- поле `messages` остаётся обязательным;
- поле `stream` можно оставить как есть;
- ответ остаётся `{ "reply": "..." }`.

Новые поля делаются необязательными:
- `mode`;
- `sources`.

Если backend получает старый запрос без новых полей, он должен работать как обычный чат.

## Минимальный набор endpoint

### `POST /api/chat`

Старый формат:

```json
{
  "messages": [
    { "role": "user", "content": "Привет" }
  ],
  "stream": false
}
```

Новый совместимый формат:

```json
{
  "messages": [
    { "role": "user", "content": "Сделай краткое резюме документа" }
  ],
  "stream": false,
  "mode": "rag",
  "sources": ["report-2025", "manual-ops"]
}
```

Правила:
- `messages` обязателен;
- `mode` по умолчанию рекомендуется считать `chat`;
- `sources` по умолчанию `[]`;
- если `mode = "chat"`, `sources` можно игнорировать;
- если `mode = "rag"`, backend работает только с переданными источниками.

Ответ остаётся прежним:

```json
{
  "reply": "Краткое резюме документа..."
}
```

Дополнительно backend может вернуть служебные поля:

```json
{
  "reply": "Краткое резюме документа...",
  "meta": {
    "mode": "rag",
    "used_sources": ["report-2025"]
  }
}
```

### `GET /api/documents`

Frontend не читает серверную директорию напрямую. Он только запрашивает backend.

Рекомендуемый ответ:

```json
{
  "documents": [
    {
      "id": "report-2025",
      "name": "report_2025.pdf",
      "path": "docs/report_2025.pdf"
    },
    {
      "id": "manual-ops",
      "name": "ops_manual.docx",
      "path": "docs/ops_manual.docx"
    }
  ]
}
```

Допустим и упрощённый формат:

```json
[
  "docs/report_2025.pdf",
  "docs/ops_manual.docx"
]
```

Но для продакшн-интеграции лучше объектный формат с устойчивым `id`.

## Семантика новых полей

### `mode`

Поддерживаемые значения:
- `chat` — обычный запрос к модели без retrieval;
- `rag` — запрос с retrieval по выбранным источникам.

Рекомендации:
- если поле отсутствует, считать `chat`;
- если пришло неизвестное значение, логировать и деградировать в `chat`.

### `sources`

Это массив идентификаторов документов:

```json
["report-2025", "manual-ops"]
```

Рекомендации:
- использовать стабильный `id`, а не путь как основной ключ;
- если часть `id` не найдена, backend не должен падать;
- backend должен сам проверять лимит источников, даже если frontend уже ограничивает его 10.

## Как встроить RAG без сильной переделки

Если сейчас есть рабочий код обычного чата, лучше оставить его и добавить диспетчер:

```python
if mode == "rag":
    reply = rag_chat(messages, sources)
else:
    reply = chat(messages)
```

То есть старый путь не меняется, а RAG добавляется как отдельная ветка логики.

Рекомендуемая схема:
1. Сохранить текущий `chat_service.reply(messages)`.
2. Добавить `rag_service.reply(messages, source_ids)`.
3. Добавить `document_registry`, который отдаёт список документов.
4. В роуте `/api/chat` выбирать ветку по `mode`.
5. Возвращать тот же формат `{ "reply": "..." }`.

## Как должен работать backend внутри

### Обычный режим `chat`

Backend:
- принимает `messages`;
- вызывает текущую модель как раньше;
- возвращает `reply`.

### Режим `rag`

Backend:
- принимает `messages` и `sources`;
- находит документы по `source id`;
- делает retrieval только по выбранным документам;
- собирает контекст;
- вызывает модель;
- возвращает `reply`.

Если `mode = "rag"` и `sources = []`, рекомендуется вернуть `400 Bad Request`.

## Рекомендуемый backend env

Минимум:

```env
HOST=0.0.0.0
PORT=8080
DOCUMENTS_DIR=/srv/rag/documents
MAX_SELECTED_SOURCES=10
MODEL_NAME=your-model
```

Если retrieval уже выделен:

```env
VECTOR_STORE_URI=http://vector-db:6333
EMBEDDING_MODEL=your-embedding-model
RERANKER_MODEL=your-reranker
```

Frontend эти параметры знать не должен.

## Рекомендуемая структура backend

- `routes/chat.py`
  Принимает `POST /api/chat`.
- `routes/documents.py`
  Отдаёт `GET /api/documents`.
- `services/document_registry.py`
  Сканирует директорию и строит список документов.
- `services/chat_service.py`
  Текущий вызов модели без retrieval.
- `services/rag_service.py`
  Retrieval, сборка контекста и вызов модели.

## Поведение `GET /api/documents`

Есть два варианта:

### Вариант A. Живое чтение директории

Backend перечитывает папку при каждом запросе.

Плюсы:
- просто;
- список всегда актуален.

Минусы:
- лишняя нагрузка на больших каталогах.

### Вариант B. Кэш с обновлением

Backend хранит кэш и обновляет его:
- по таймеру;
- по кнопке refresh;
- по событию индексатора.

Для начала проекта достаточно варианта A.

## Рекомендуемые статусы

### `GET /api/documents`

- `200` — список документов;
- `500` — ошибка доступа к директории или внутренняя ошибка.

### `POST /api/chat`

- `200` — успешный ответ модели;
- `400` — невалидный запрос, пустой `messages`, слишком много `sources`, неизвестный `mode`;
- `404` — если переданные источники не найдены и вы хотите считать это ошибкой;
- `500` — ошибка retrieval, модели или внутренней логики;
- `504` — таймаут модели или retrieval.

## Что нужно сделать MLOps-команде

Минимальный план:
1. Сохранить текущий `POST /api/chat` и старый ответ.
2. Добавить необязательные поля `mode` и `sources`.
3. Добавить `GET /api/documents`.
4. Настроить `DOCUMENTS_DIR`.
5. Сделать разрешение `source id -> file`.
6. В ветке `rag` использовать retrieval только по выбранным документам.
7. Проверить, что старый запрос без `mode/sources` по-прежнему работает.

## Пример минимальной логики backend

```python
@app.get("/api/documents")
def get_documents():
    docs = document_registry.list_documents()
    return {"documents": docs}


@app.post("/api/chat")
def chat(req: ChatRequest):
    mode = req.mode or "chat"
    sources = req.sources or []

    if mode == "rag":
        if not sources:
            raise HTTPException(status_code=400, detail="No sources selected")
        reply = rag_service.reply(messages=req.messages, source_ids=sources)
    else:
        reply = chat_service.reply(messages=req.messages)

    return {"reply": reply}
```

## Чего не стоит делать

Не рекомендуется:
- давать frontend прямой доступ к серверной папке;
- передавать на frontend полный текст документов;
- заставлять frontend знать устройство индекса или vector store;
- менять ответ chat endpoint, если этого можно избежать.

## Итог

Рекомендуемый контракт:
- `POST /api/chat` со старой совместимостью;
- `GET /api/documents` для списка источников;
- необязательные поля `mode` и `sources`;
- тот же ответ `{ "reply": "..." }`.

Этот вариант минимально вторгается в текущую систему и подходит для команды, у которой уже работает обычный chat endpoint.
