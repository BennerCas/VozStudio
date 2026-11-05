import { AnimatedIcon } from '../icons/AnimatedIcon';
import type { SystemStatus } from '../types/tts';

export interface HeaderBarProps {
  status: SystemStatus;
  isOnline: boolean;
  isUnloading: boolean;
  statusBanner: string | null;
  onUnloadEngines: () => void;
}

export function HeaderBar({
  status,
  isOnline,
  isUnloading,
  statusBanner,
  onUnloadEngines,
}: HeaderBarProps) {
  const hw = status.hardware;
  const ramPct =
    hw.ram_total_gb > 0 ? Math.min(100, Math.round((hw.ram_used_gb / hw.ram_total_gb) * 100)) : 35;

  return (
    <header
      className="glass-panel flex h-full w-full items-center justify-between px-[1cqw] py-[0.45cqh]"
      data-panel="header-bar"
    >
      {/* Identidad del estudio + H1 unico */}
      <div className="flex min-w-0 items-center gap-[0.75cqw]">
        <div className="flex h-[4.2cqh] w-[4.2cqh] min-h-[26px] min-w-[26px] shrink-0 items-center justify-center rounded-[0.65cqh] border border-cyan-400/40 bg-cyan-400/12 text-cyan-300 shadow-[0_0_16px_rgba(12,211,245,0.2)]">
          <AnimatedIcon name="audio-lines" variant="oscillate" trigger="hover" className="!w-[2.2cqh] !h-[2.2cqh]" />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-[0.55cqw]">
            <h1 className="font-display tx-lg truncate font-bold tracking-wider text-slate-50">
              VOZSTUDIO OMNI-ES
            </h1>
            <span className="badge-chip badge-neutral">v{status.version || '1.0.0'}</span>
          </div>
          <p className="tx-xs truncate text-[var(--text-secondary)]">
            {statusBanner || 'Consola Neural de Sintesis y Clonacion en Espanol sobre ONNX Runtime'}
          </p>
        </div>
      </div>

      {/* Telemetria en tiempo real + Estado Online/Offline + Liberacion VRAM */}
      <div className="flex shrink-0 items-center gap-[0.65cqw]">
        {/* Estado de Conexion Backend */}
        <div
          data-testid="connection-status-badge"
          className={`flex items-center gap-[0.38cqw] rounded-[0.55cqh] border px-[0.6cqw] py-[0.42cqh] font-mono-tech tx-xs font-semibold ${
            isOnline
              ? 'border-cyan-400/45 bg-cyan-500/14 text-cyan-200'
              : 'border-amber-400/45 bg-amber-500/14 text-amber-200'
          }`}
        >
          <span
            className={`inline-block h-[0.8cqh] w-[0.8cqh] min-h-[6px] min-w-[6px] rounded-full ${
              isOnline ? 'bg-cyan-400 shadow-[0_0_8px_#0cd3f5]' : 'bg-amber-400 shadow-[0_0_8px_#f5a623]'
            }`}
          />
          <span>{isOnline ? 'DIRECTML / LOCAL ONLINE' : 'OFFLINE PREVIEW'}</span>
        </div>

        {/* Telemetria RAM */}
        <div className="hidden sm:flex flex-col justify-center rounded-[0.55cqh] border border-sky-400/20 bg-slate-950/65 px-[0.6cqw] py-[0.3cqh] min-w-[9.5cqw]">
          <div className="flex items-center justify-between font-mono-tech tx-xs">
            <span className="text-[var(--text-muted)]">RAM</span>
            <span className="text-slate-200">
              {hw.ram_used_gb.toFixed(1)}/{hw.ram_total_gb.toFixed(0)} GB
            </span>
          </div>
          <div className="mt-[0.25cqh] h-[0.42cqh] min-h-[3px] w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-amber-400 transition-all duration-300"
              style={{ width: `${ramPct}%` }}
            />
          </div>
        </div>

        {/* Limite Hardware GEMINI.md */}
        <div className="flex items-center gap-[0.4cqw] rounded-[0.55cqh] border border-sky-400/20 bg-slate-950/65 px-[0.6cqw] py-[0.42cqh] font-mono-tech tx-xs text-slate-200">
          <AnimatedIcon name="hard-drive" variant="pulse" trigger="hover" className="text-amber-300" />
          <span>
            VRAM {hw.vram_limit_gb}GB / {hw.cpu_threads}H
          </span>
        </div>

        {/* Motor Residente + Boton Liberar VRAM */}
        <button
          type="button"
          onClick={onUnloadEngines}
          disabled={isUnloading}
          data-testid="unload-vram-btn"
          title="Desalojar sesion ONNX activa y ejecutar limpieza de memoria"
          className="flex items-center gap-[0.42cqw] rounded-[0.55cqh] border border-amber-400/35 bg-amber-500/12 px-[0.7cqw] py-[0.45cqh] tx-xs font-semibold text-amber-200 transition hover:border-amber-300 hover:bg-amber-500/22 disabled:opacity-50"
        >
          <AnimatedIcon
            name={isUnloading ? 'loader' : 'cpu'}
            variant={isUnloading ? 'spin' : 'pulse'}
            trigger={isUnloading ? 'always' : 'hover'}
            className="text-amber-300"
          />
          <span>
            {isUnloading
              ? 'Liberando...'
              : status.active_engine
                ? `Liberar VRAM (${Math.round(status.estimated_engine_mb)}MB)`
                : 'Liberar VRAM'}
          </span>
        </button>
      </div>
    </header>
  );
}
