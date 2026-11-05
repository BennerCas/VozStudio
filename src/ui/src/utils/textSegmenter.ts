export const MAX_BLOCK_CHARS = 460;
export const MAX_BLOCK_LINES = 5;

function clampSingleChunk(chunk: string, maxChars: number): string[] {
  const result: string[] = [];
  let rest = chunk.trim();
  while (rest.length > maxChars) {
    let cut = -1;
    const windowSlice = rest.slice(0, maxChars + 1);

    // Preferir corte en fin de oracion respetando aperturas hispanas (¿, ¡)
    const sentencePunct = ['. ', '? ', '! ', '; ', ': ', '.\n', '?\n', '!\n'];
    for (const sep of sentencePunct) {
      const idx = windowSlice.lastIndexOf(sep);
      if (idx >= Math.floor(maxChars * 0.35)) {
        cut = Math.max(cut, idx + 1);
      }
    }

    // Siguiente prioridad: antes de signo de apertura ¿ o ¡
    if (cut === -1) {
      const idxQ = windowSlice.lastIndexOf(' ¿');
      const idxE = windowSlice.lastIndexOf(' ¡');
      const bestOpen = Math.max(idxQ, idxE);
      if (bestOpen >= Math.floor(maxChars * 0.35)) {
        cut = bestOpen;
      }
    }

    // Siguiente prioridad: coma o salto de linea
    if (cut === -1) {
      const commaIdx = Math.max(windowSlice.lastIndexOf(', '), windowSlice.lastIndexOf('\n'));
      if (commaIdx >= Math.floor(maxChars * 0.3)) {
        cut = commaIdx + 1;
      }
    }

    // Siguiente prioridad: ultimo espacio
    if (cut === -1) {
      const spaceIdx = windowSlice.lastIndexOf(' ');
      if (spaceIdx >= Math.floor(maxChars * 0.2)) {
        cut = spaceIdx;
      }
    }

    // Corte duro defensivo si pegan cadena continua sin espacios
    if (cut <= 0) {
      cut = maxChars;
    }

    const head = rest.slice(0, cut).trim();
    if (head.length > 0) {
      result.push(head);
    }
    rest = rest.slice(cut).trim();
  }

  if (rest.length > 0) {
    result.push(rest);
  }
  return result;
}

function enforceLineLimit(chunk: string, maxLines: number): string[] {
  const lines = chunk.split('\n');
  if (lines.length <= maxLines) {
    return [chunk];
  }
  const out: string[] = [];
  for (let i = 0; i < lines.length; i += maxLines) {
    const group = lines.slice(i, i + maxLines).join('\n').trim();
    if (group.length > 0) {
      out.push(group);
    }
  }
  return out.length > 0 ? out : [''];
}

export function segmentSpanishText(
  rawText: string,
  maxChars: number = MAX_BLOCK_CHARS,
  maxLines: number = MAX_BLOCK_LINES,
): string[] {
  const normalized = rawText.replace(/\r\n/g, '\n');
  if (normalized.trim().length === 0) {
    return [''];
  }

  // Si cabe holgadamente en un solo bloque visual, conservar tal cual (limitando saltos excesivos)
  if (normalized.length <= maxChars && normalized.split('\n').length <= maxLines) {
    return [normalized];
  }

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const blocks: string[] = [];
  let accumulator = '';

  const flushAccumulator = () => {
    if (accumulator.trim().length > 0) {
      for (const lineSafe of enforceLineLimit(accumulator.trim(), maxLines)) {
        blocks.push(...clampSingleChunk(lineSafe, maxChars));
      }
    }
    accumulator = '';
  };

  for (const para of paragraphs) {
    const candidate = accumulator.length > 0 ? `${accumulator}\n${para}` : para;
    if (candidate.length <= maxChars && candidate.split('\n').length <= maxLines) {
      accumulator = candidate;
    } else {
      flushAccumulator();
      for (const lineSafe of enforceLineLimit(para, maxLines)) {
        blocks.push(...clampSingleChunk(lineSafe, maxChars));
      }
    }
  }
  flushAccumulator();

  return blocks.length > 0 ? blocks : [''];
}

export function updateBlockWithAutoSplit(
  currentBlocks: string[],
  activeIndex: number,
  newValue: string,
  maxChars: number = MAX_BLOCK_CHARS,
  maxLines: number = MAX_BLOCK_LINES,
): { blocks: string[]; activeIndex: number } {
  const cleanValue = newValue.replace(/\r\n/g, '\n');
  const lineCount = cleanValue.split('\n').length;

  // Edicion normal dentro del presupuesto visual del bloque activo
  if (cleanValue.length <= maxChars && lineCount <= maxLines) {
    const next = [...currentBlocks];
    next[activeIndex] = cleanValue;
    // Si el usuario vacio un bloque intermedio y hay mas de uno, permitir edicion limpia
    return { blocks: next, activeIndex };
  }

  // El usuario pego o escribio mas alla de la capacidad visual -> segmentar sin scroll
  const splitPieces = segmentSpanishText(cleanValue, maxChars, maxLines);
  const before = currentBlocks.slice(0, activeIndex);
  const after = currentBlocks.slice(activeIndex + 1);
  const merged = [...before, ...splitPieces, ...after].filter(
    (b, idx, arr) => arr.length === 1 || b.trim().length > 0 || idx === activeIndex,
  );

  const safeBlocks = merged.length > 0 ? merged : [''];
  const nextIndex = Math.min(activeIndex, safeBlocks.length - 1);
  return { blocks: safeBlocks, activeIndex: nextIndex };
}

export function joinDocumentBlocks(blocks: string[]): string {
  return blocks
    .map((b) => b.trim())
    .filter((b) => b.length > 0)
    .join(' ');
}
