import { AnimatedIcon } from '../icons/AnimatedIcon';

export interface OrientationGuardProps {
  width: number;
  height: number;
}

export function OrientationGuard({ width, height }: OrientationGuardProps) {
  return (
    <div className="acoustic-viewport p-4">
      <div className="acoustic-mesh" aria-hidden="true" />
      <div
        className="glass-panel relative z-10 flex h-full max-h-[420px] w-full max-w-[520px] flex-col items-center justify-between p-6 text-center"
        data-panel="orientation-guard"
      >
        <div className="badge-chip badge-amber">RELACION DE ESTUDIO 16:9 REQUERIDA</div>

        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-400/35 bg-cyan-500/10 text-cyan-300">
            <AnimatedIcon name="maximize" variant="pulse" trigger="always" className="!h-6 !w-6" />
          </div>
          <h1 className="font-display text-lg font-bold tracking-wide text-slate-100">
            VOZSTUDIO OMNI-ES
          </h1>
          <p className="text-xs leading-relaxed text-slate-300">
            Esta consola acustica de masterizacion neural opera sobre un lienzo fijo 16:9 libre de
            scroll. Amplie la ventana a escritorio horizontal (minimo 900 px de ancho) para
            desplegar los tres modulos de control.
          </p>
          <div className="font-mono-tech rounded border border-sky-400/20 bg-slate-950/70 px-3 py-1 text-xs text-cyan-300">
            VIEWPORT ACTUAL: {width} x {height} px
          </div>
        </div>

        <footer className="w-full border-t border-sky-400/15 pt-3 text-[11px] font-semibold tracking-wider text-slate-400">
          HUMAN AI SYNERGY BY BENNER CASTILLO - 2026®
        </footer>
      </div>
    </div>
  );
}
