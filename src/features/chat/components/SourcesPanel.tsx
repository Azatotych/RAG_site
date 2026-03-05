import { Database, RefreshCw, Search, ShieldAlert, UploadCloud } from 'lucide-react';
import { SourceDocument } from '../types';
import { cn } from '../utils';

interface SourcesPanelProps {
  sourceQuery: string;
  selectedCount: number;
  documentsError: string | null;
  isUploading: boolean;
  isDocumentsLoading: boolean;
  uploadEnabled: boolean;
  documents: SourceDocument[];
  selectedDocuments: string[];
  onQueryChange: (query: string) => void;
  onUploadFiles: (files: File[]) => void;
  onReload: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onToggleDocument: (documentId: string) => void;
}

export function SourcesPanel({
  sourceQuery,
  selectedCount,
  documentsError,
  isUploading,
  isDocumentsLoading,
  uploadEnabled,
  documents,
  selectedDocuments,
  onQueryChange,
  onUploadFiles,
  onReload,
  onSelectAll,
  onClearSelection,
  onToggleDocument,
}: SourcesPanelProps) {
  return (
    <aside className="panel order-3 flex min-h-[320px] flex-col rounded-3xl p-4 lg:min-h-0 lg:rounded-r-none lg:rounded-l-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-slate-600 dark:text-[#b0b0b0]" />
          <h2 className="text-sm font-semibold">Источники</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-[#2d2d2d] dark:text-[#b8b8b8]">
          {selectedCount}
        </span>
      </div>

      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-[#9f9f9f]" />
        <input
          className="w-full rounded-2xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none ring-blue-500/60 focus:ring-2 dark:border-[#3a3a3a] dark:bg-[#2a2a2a]"
          value={sourceQuery}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Поиск по документам..."
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <label className={cn('btn-base btn-ghost', (!uploadEnabled || isUploading) && 'cursor-not-allowed opacity-60')}>
          <UploadCloud className="h-4 w-4" />
          Загрузить
          <input
            className="hidden"
            type="file"
            accept=".pdf,.docx,.txt,.md"
            multiple
            disabled={!uploadEnabled || isUploading}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              if (files.length) onUploadFiles(files);
              event.currentTarget.value = '';
            }}
          />
        </label>

        <button type="button" className="btn-base btn-ghost" onClick={onReload}>
          <RefreshCw className="h-4 w-4" />
          Обновить
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className="btn-base btn-ghost" onClick={onSelectAll}>
          Выбрать все
        </button>
        <button type="button" className="btn-base btn-ghost" onClick={onClearSelection}>
          Снять выбор
        </button>
      </div>

      {documentsError && (
        <div className="mt-3 rounded-2xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/50 dark:bg-red-500/12 dark:text-red-300">
          <div className="mb-1 flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="font-medium">Ошибка загрузки документов</div>
          </div>
          <div className="text-xs">{documentsError}</div>
        </div>
      )}

      {!documentsError && isUploading && (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-[#3a3a3a] dark:bg-[#2a2a2a] dark:text-[#acacac]">
          Загрузка и индексация...
        </div>
      )}

      {!documentsError && isDocumentsLoading && (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-[#3a3a3a] dark:bg-[#2a2a2a] dark:text-[#acacac]">
          Загрузка списка документов...
        </div>
      )}

      <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {documents.map((document) => {
          const checked = selectedDocuments.includes(document.id);
          return (
            <label
              key={document.id}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-2 transition',
                checked
                  ? 'border-blue-300 bg-blue-50/70 dark:border-blue-500/40 dark:bg-blue-500/10'
                  : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-[#3a3a3a] dark:bg-[#272727] dark:hover:bg-[#303030]'
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggleDocument(document.id)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-[#4a4a4a] dark:bg-[#212121]"
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{document.name}</span>
                {document.path && (
                  <span className="mt-0.5 block break-all text-xs text-slate-500 dark:text-[#a0a0a0]">
                    {document.path}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </aside>
  );
}
