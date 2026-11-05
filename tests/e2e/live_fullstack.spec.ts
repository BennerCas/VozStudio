import { expect, test, type Page } from '@playwright/test';

const LIVE_BACKEND_URL = 'http://127.0.0.1:8880';
const PROJECT_ROOT = 'C:\\antigravityAS\\VozStudio-Omni-ES';

interface SpawnedProcessLike {
  pid?: number;
  exitCode: number | null;
  killed: boolean;
  kill: (signal?: string) => boolean;
  stdout?: { on: (event: string, cb: (chunk: unknown) => void) => void } | null;
  stderr?: { on: (event: string, cb: (chunk: unknown) => void) => void } | null;
}

interface ChildProcessModuleLike {
  spawn: (
    command: string,
    args: string[],
    options: {
      cwd?: string;
      stdio?: 'ignore' | 'pipe';
      windowsHide?: boolean;
    },
  ) => SpawnedProcessLike;
  spawnSync: (
    command: string,
    args: string[],
    options?: { stdio?: 'ignore'; windowsHide?: boolean },
  ) => unknown;
}

async function loadChildProcessModule(): Promise<ChildProcessModuleLike> {
  const dynamicImport = new Function('specifier', 'return import(specifier);') as (
    specifier: string,
  ) => Promise<ChildProcessModuleLike>;
  return dynamicImport('node:child_process');
}

async function isBackendHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${LIVE_BACKEND_URL}/api/v1/system/status`, {
      method: 'GET',
      signal: AbortSignal.timeout(1500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForBackendReady(timeoutMs: number = 35000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isBackendHealthy()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  throw new Error(
    `El servidor Uvicorn en ${LIVE_BACKEND_URL} no respondio dentro de ${timeoutMs} ms.`,
  );
}

async function assertStrictZeroScrollLive(page: Page, contextLabel: string): Promise<void> {
  const violations = await page.evaluate(() => {
    const bad: string[] = [];

    const inspectElement = (el: Element | null, label: string) => {
      if (!el) return;
      const htmlEl = el as HTMLElement;
      const style = window.getComputedStyle(htmlEl);
      if (style.display === 'none' || style.visibility === 'hidden') return;

      if (
        style.overflowY === 'auto' ||
        style.overflowY === 'scroll' ||
        style.overflowX === 'auto' ||
        style.overflowX === 'scroll'
      ) {
        bad.push(`${label}: overflow prohibido (${style.overflowX}/${style.overflowY})`);
      }
      if (htmlEl.scrollHeight > htmlEl.clientHeight + 1) {
        bad.push(
          `${label}: scrollHeight (${htmlEl.scrollHeight}) > clientHeight (${htmlEl.clientHeight}) + 1`,
        );
      }
      if (htmlEl.scrollWidth > htmlEl.clientWidth + 1) {
        bad.push(
          `${label}: scrollWidth (${htmlEl.scrollWidth}) > clientWidth (${htmlEl.clientWidth}) + 1`,
        );
      }
    };

    inspectElement(document.documentElement, 'documentElement');
    inspectElement(document.body, 'body');
    inspectElement(document.getElementById('root'), '#root');
    inspectElement(
      document.querySelector('[data-testid="studio-stage-16-9"]'),
      'studio-stage-16-9',
    );

    const panels = document.querySelectorAll(
      '[data-panel], header, main, aside, section, footer, textarea',
    );
    panels.forEach((node, idx) => {
      const id =
        node.getAttribute('data-panel') ||
        node.getAttribute('data-testid') ||
        `${node.tagName.toLowerCase()}#${idx}`;
      inspectElement(node, id);
    });

    return bad;
  });

  expect(
    violations,
    `Violaciones CERO SCROLL en vivo [${contextLabel}]:\n${violations.join('\n')}`,
  ).toEqual([]);
}

test.describe('Certificacion E2E Full-Stack en Vivo (FastAPI + Bundle Dist en 127.0.0.1:8880)', () => {
  test.describe.configure({ timeout: 120000 });

  let uvicornProc: SpawnedProcessLike | null = null;
  let spawnedBySuite = false;

  test.beforeAll(async () => {
    const alreadyUp = await isBackendHealthy();
    if (!alreadyUp) {
      const cp = await loadChildProcessModule();
      uvicornProc = cp.spawn(
        'python',
        [
          '-m',
          'uvicorn',
          'src.main.main:app',
          '--host',
          '127.0.0.1',
          '--port',
          '8880',
          '--log-level',
          'warning',
        ],
        {
          cwd: PROJECT_ROOT,
          stdio: 'pipe',
          windowsHide: true,
        },
      );
      spawnedBySuite = true;
      await waitForBackendReady(40000);
    }
  });

  test.afterAll(async () => {
    try {
      await fetch(`${LIVE_BACKEND_URL}/api/v1/engines/unload`, {
        method: 'POST',
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // Ignorar si ya se detuvo
    }

    if (spawnedBySuite && uvicornProc && uvicornProc.pid) {
      const cp = await loadChildProcessModule();
      cp.spawnSync('taskkill', ['/PID', String(uvicornProc.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      uvicornProc = null;
    }
  });

  test('Sirve SPA produccion sin 404, sintetiza Kokoro ef_dora real, audita JSON y mantiene Cero Scroll en 1920x1080 y 1366x768', async ({
    page,
  }) => {
    const httpErrors: string[] = [];
    page.on('response', (res) => {
      if (res.url().startsWith(LIVE_BACKEND_URL) && res.status() >= 400) {
        httpErrors.push(`${res.status()} ${res.request().method()} ${res.url()}`);
      }
    });

    // 1. Carga en 1920x1080 sobre el servidor FastAPI real (127.0.0.1:8880)
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`${LIVE_BACKEND_URL}/`, { waitUntil: 'networkidle' });

    // Verificar favicon explicito sin 404
    const favRes = await page.request.get(`${LIVE_BACKEND_URL}/favicon.ico`);
    expect(favRes.status()).toBeLessThan(400);

    await expect(page.getByTestId('studio-stage-16-9')).toBeVisible();
    await expect(page.getByTestId('official-footer-signature')).toHaveText(
      'HUMAN AI SYNERGY BY BENNER CASTILLO - 2026®',
    );
    await expect(page.getByTestId('connection-status-badge')).toContainText(
      'DIRECTML / LOCAL ONLINE',
      { timeout: 10000 },
    );

    await assertStrictZeroScrollLive(page, '1920x1080 - Carga Online Real');

    // 2. Seleccionar motor Kokoro y voz ef_dora, e ingresar frase en espanol
    await page.getByTestId('engine-tab-kokoro').click();
    await expect(page.getByTestId('voice-card-ef_dora')).toBeVisible();
    await page.getByTestId('voice-card-ef_dora').click();

    const testPrompt =
      'Verificacion integral en vivo de VozStudio Omni con Kokoro en espanol.';
    await page.getByTestId('clear-composer-btn').click();
    await page.getByTestId('composer-textarea').fill(testPrompt);

    // 3. Disparar sintesis neural real contra POST /api/v1/synthesize
    const synthResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes('/api/v1/synthesize') && res.request().method() === 'POST',
      { timeout: 60000 },
    );
    await page.getByTestId('synthesize-main-btn').click();
    const synthRes = await synthResponsePromise;
    expect(synthRes.status()).toBe(200);

    const synthJson = (await synthRes.json()) as {
      item: {
        id: string;
        archivo: string;
        audio_url: string;
        motor: string;
        voz_id: string;
        metricas: { duracion_audio_seg: number; rtf: number };
      };
    };
    const createdItem = synthJson.item;
    expect(createdItem.motor).toBe('kokoro');
    expect(createdItem.voz_id).toBe('ef_dora');
    expect(createdItem.metricas.duracion_audio_seg).toBeGreaterThan(1.0);

    try {
      // 4. Comprobar aparicion en Biblioteca Auditada + Inspector Tecnico JSON + Streaming WAV real
      await expect(page.getByTestId('library-list-container')).toContainText(
        createdItem.archivo,
      );
      await expect(page.getByTestId('inspector-tab-json')).toBeEnabled();
      await expect(page.getByTestId('inspector-grid')).toContainText('kokoro / ef_dora');
      await expect(page.getByTestId('inspector-grid')).toContainText(createdItem.archivo);

      const wavFetch = await page.request.get(`${LIVE_BACKEND_URL}${createdItem.audio_url}`);
      expect(wavFetch.status()).toBe(200);
      expect(wavFetch.headers()['content-type']).toContain('audio/wav');
      const wavBytes = await wavFetch.body();
      expect(wavBytes.subarray(0, 4).toString('ascii')).toBe('RIFF');

      await assertStrictZeroScrollLive(
        page,
        '1920x1080 - Post Sintesis Real Kokoro + Biblioteca + Inspector JSON',
      );

      // 5. Redimensionar a 1366x768 con datos reales del backend y certificar CERO SCROLL
      await page.setViewportSize({ width: 1366, height: 768 });
      await page.waitForTimeout(250);
      await expect(page.getByTestId('connection-status-badge')).toContainText(
        'DIRECTML / LOCAL ONLINE',
      );
      await expect(page.getByTestId('inspector-grid')).toContainText('kokoro / ef_dora');
      await assertStrictZeroScrollLive(
        page,
        '1366x768 - Datos Reales Backend + Biblioteca + Inspector JSON',
      );

      // 6. Verificar que no existio ningun 404 ni error HTTP en toda la sesion
      expect(httpErrors, `Errores HTTP detectados:\n${httpErrors.join('\n')}`).toEqual([]);
    } finally {
      // Limpiar el artefacto temporal de prueba para no ensuciar biblioteca/
      await page.request.delete(
        `${LIVE_BACKEND_URL}/api/v1/library/${encodeURIComponent(createdItem.id)}`,
      );
      await page.request.post(`${LIVE_BACKEND_URL}/api/v1/engines/unload`);
    }
  });
});
