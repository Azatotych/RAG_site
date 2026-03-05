import { PanelLeft } from 'lucide-react';
import { ModelMode } from '../types';

interface TopBarProps {
  mode: ModelMode;
  activeChatTitle: string;
  selectedModelLabel: string;
}

export function TopBar({ mode, activeChatTitle, selectedModelLabel }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/75 px-4 py-3 backdrop-blur-md dark:border-[#363636]/90 dark:bg-[#212121]/95">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <PanelLeft className="h-4 w-4 text-slate-500 dark:text-[#9f9f9f]" />
            <h1 className="font-display text-sm font-semibold sm:text-base">Локальный ассистент</h1>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-blue-700 dark:bg-[#2e2e2e] dark:text-[#9fc0ff]">
              {mode}
            </span>
          </div>
          <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-[#9c9c9c]">
            {activeChatTitle} • {selectedModelLabel}
          </div>
        </div>
      </div>
    </header>
  );
}
