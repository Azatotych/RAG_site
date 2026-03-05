import { ModelOption, SourceDocument } from './types';

export const cn = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ');

export const buildRequestUrl = (base: string, endpoint: string) => {
  if (!endpoint) return null;
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  if (!base) return endpoint;

  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${normalizedBase}${normalizedEndpoint}`;
};

export const describeRequestFailure = (err: unknown, fallback: string) => {
  if (err instanceof DOMException && err.name === 'AbortError') {
    return 'Причина: превышено время ожидания ответа от API.';
  }

  if (err instanceof TypeError) {
    const message = err.message.toLowerCase();
    if (message.includes('name not resolved') || message.includes('dns')) {
      return 'Причина: адрес API не найден (DNS/URL).';
    }
    if (message.includes('failed to fetch')) {
      return 'Причина: не удалось подключиться к серверу API.';
    }
  }

  return fallback;
};

const normalizeDocument = (item: unknown, index: number): SourceDocument | null => {
  if (typeof item === 'string') {
    const trimmed = item.trim();
    if (!trimmed) return null;

    const parts = trimmed.split(/[\\/]/);
    return { id: trimmed, name: parts[parts.length - 1] || trimmed, path: trimmed };
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
  const name =
    typeof rawName === 'string' && rawName.trim() ? rawName.trim() : path?.split(/[\\/]/).pop() ?? id;

  return { id, name, path };
};

export const parseDocumentsResponse = (payload: unknown) => {
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
  return rawDocuments
    .map((item, index) => normalizeDocument(item, index))
    .filter((document): document is SourceDocument => Boolean(document))
    .filter((document) => {
      if (seenIds.has(document.id)) return false;
      seenIds.add(document.id);
      return true;
    });
};

const normalizeModel = (item: unknown, index: number): ModelOption | null => {
  if (typeof item === 'string') {
    const trimmed = item.trim();
    if (!trimmed) return null;
    return { id: trimmed, label: trimmed };
  }

  if (!item || typeof item !== 'object') return null;

  const record = item as Record<string, unknown>;
  const rawId = record.id ?? record.model ?? record.name;
  const rawLabel = record.label ?? record.name ?? record.title ?? record.id ?? record.model;

  const id = typeof rawId === 'string' ? rawId.trim() : '';
  const label = typeof rawLabel === 'string' ? rawLabel.trim() : '';
  if (!id || !label) return null;

  return { id, label };
};

export const parseModelsResponse = (payload: unknown): ModelOption[] => {
  const rawModels = Array.isArray(payload)
    ? payload
    : payload &&
        typeof payload === 'object' &&
        Array.isArray((payload as { models?: unknown[] }).models)
      ? (payload as { models: unknown[] }).models
      : payload &&
          typeof payload === 'object' &&
          Array.isArray((payload as { items?: unknown[] }).items)
        ? (payload as { items: unknown[] }).items
        : null;

  if (!rawModels) {
    throw new Error('Некорректный формат списка моделей.');
  }

  const seen = new Set<string>();
  return rawModels
    .map((item, index) => normalizeModel(item, index))
    .filter((model): model is ModelOption => Boolean(model))
    .filter((model) => {
      if (seen.has(model.id)) return false;
      seen.add(model.id);
      return true;
    });
};

const isLikelyMathExpression = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return false;

  const hasLatexTokens = /\\[a-zA-Z]+|[\\^_{}]/.test(trimmed);
  const hasEquationSign = /[=<>]/.test(trimmed);
  const hasMathWord = /\b(?:sin|cos|tan|cot|log|ln|exp|arctan|gamma|lim|sum|int)\b/i.test(trimmed);
  const hasLatinOrDigits = /[A-Za-z0-9]/.test(trimmed);
  const hasCyrillic = /[А-Яа-яЁё]/.test(trimmed);

  if (hasLatexTokens && (hasEquationSign || hasMathWord)) return true;
  if (hasEquationSign && hasLatinOrDigits && !hasCyrillic) return true;
  return false;
};

export const normalizeAssistantMath = (content: string) => {
  if (!content.includes('(') || !content.includes(')')) return content;

  let out = '';
  let index = 0;

  while (index < content.length) {
    if (content[index] !== '(') {
      out += content[index];
      index += 1;
      continue;
    }

    let depth = 0;
    let end = -1;

    for (let cursor = index; cursor < content.length; cursor += 1) {
      const char = content[cursor];
      if (char === '(') depth += 1;
      if (char === ')') depth -= 1;
      if (depth === 0) {
        end = cursor;
        break;
      }
    }

    if (end === -1) {
      out += content.slice(index);
      break;
    }

    const rawSegment = content.slice(index, end + 1);
    const inner = content.slice(index + 1, end).trim();
    const prevChar = index > 0 ? content[index - 1] : '';
    const nextChar = end + 1 < content.length ? content[end + 1] : '';
    const boundToWord =
      /[A-Za-zА-Яа-яЁё0-9_\\]/.test(prevChar) || /[A-Za-zА-Яа-яЁё0-9_\\]/.test(nextChar);

    if (!boundToWord && isLikelyMathExpression(inner)) {
      out += `$${inner}$`;
    } else {
      out += rawSegment;
    }

    index = end + 1;
  }

  return out;
};
