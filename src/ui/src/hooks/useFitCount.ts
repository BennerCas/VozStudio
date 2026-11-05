import { useEffect, useState, type RefObject } from 'react';

export interface FitCountOptions {
  /** Altura estimada de cada tarjeta expresada como porcentaje de la altura del Stage (cqh) */
  itemCqh: number;
  /** Separacion vertical entre tarjetas expresada como porcentaje de la altura del Stage (cqh) */
  gapCqh: number;
  minItems?: number;
  maxItems?: number;
}

/**
 * Calcula dinamicamente cuantos elementos caben en un contenedor sin provocar
 * jamas desbordamiento vertical (scrollHeight <= clientHeight) usando ResizeObserver.
 */
export function useFitCount(
  containerRef: RefObject<HTMLElement | null>,
  stageRef: RefObject<HTMLElement | null>,
  options: FitCountOptions,
): number {
  const { itemCqh, gapCqh, minItems = 1, maxItems = 6 } = options;
  const [fitCount, setFitCount] = useState<number>(Math.min(3, maxItems));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const recalculate = () => {
      const containerEl = containerRef.current;
      if (!containerEl) return;

      const availableHeight = containerEl.clientHeight;
      const stageHeight =
        stageRef.current?.clientHeight ||
        Math.min(window.innerHeight, (window.innerWidth * 9) / 16) ||
        720;

      if (availableHeight <= 0 || stageHeight <= 0) return;

      const itemPx = (stageHeight * itemCqh) / 100;
      const gapPx = (stageHeight * gapCqh) / 100;
      // Margen defensivo de 4px para absorber redondeos subpixel en cualquier DPI
      const safeAvailable = Math.max(0, availableHeight - 4);
      const computed = Math.floor((safeAvailable + gapPx) / (itemPx + gapPx));
      const clamped = Math.max(minItems, Math.min(maxItems, computed));

      setFitCount((prev) => (prev === clamped ? prev : clamped));
    };

    recalculate();

    const observer = new ResizeObserver(() => {
      recalculate();
    });

    observer.observe(container);
    if (stageRef.current) {
      observer.observe(stageRef.current);
    }
    window.addEventListener('resize', recalculate);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', recalculate);
    };
  }, [containerRef, stageRef, itemCqh, gapCqh, minItems, maxItems]);

  return fitCount;
}
