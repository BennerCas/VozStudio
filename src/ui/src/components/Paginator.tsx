import { AnimatedIcon } from '../icons/AnimatedIcon';

export interface PaginatorProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  label?: string;
  onPageChange: (page: number) => void;
  testIdPrefix?: string;
}

export function Paginator({
  currentPage,
  totalPages,
  totalItems,
  label = 'ITEMS',
  onPageChange,
  testIdPrefix = 'paginator',
}: PaginatorProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, currentPage), safeTotalPages);

  return (
    <div
      className="flex shrink-0 items-center justify-between border-t border-sky-400/15 pt-[0.55cqh] tx-xs"
      data-testid={`${testIdPrefix}-bar`}
    >
      <span className="font-mono-tech text-[var(--text-muted)] truncate">
        {totalItems} {label}
      </span>

      <div className="flex items-center gap-[0.4cqw]">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          aria-label="Pagina anterior"
          data-testid={`${testIdPrefix}-prev`}
          className="flex h-[2.4cqh] w-[2.4cqh] min-h-[18px] min-w-[18px] items-center justify-center rounded border border-sky-400/25 bg-slate-900/80 text-sky-300 transition hover:border-cyan-400 hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <AnimatedIcon name="chevron-left" className="!w-[1.3cqh] !h-[1.3cqh]" />
        </button>

        <span
          className="font-mono-tech min-w-[4.2cqw] text-center font-semibold text-slate-200"
          data-testid={`${testIdPrefix}-indicator`}
        >
          {safePage} / {safeTotalPages}
        </span>

        <button
          type="button"
          disabled={safePage >= safeTotalPages}
          onClick={() => onPageChange(safePage + 1)}
          aria-label="Pagina siguiente"
          data-testid={`${testIdPrefix}-next`}
          className="flex h-[2.4cqh] w-[2.4cqh] min-h-[18px] min-w-[18px] items-center justify-center rounded border border-sky-400/25 bg-slate-900/80 text-sky-300 transition hover:border-cyan-400 hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <AnimatedIcon name="chevron-right" className="!w-[1.3cqh] !h-[1.3cqh]" />
        </button>
      </div>
    </div>
  );
}
