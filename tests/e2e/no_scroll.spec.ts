import { expect, test, type Page } from '@playwright/test';

const DESKTOP_RESOLUTIONS = [
  { width: 1920, height: 1080, label: '1920x1080 (Full HD 16:9)' },
  { width: 1366, height: 768, label: '1366x768 (Laptop HD ~16:9)' },
  { width: 2560, height: 1440, label: '2560x1440 (QHD 16:9)' },
  { width: 1280, height: 800, label: '1280x800 (WXGA 16:10)' },
] as const;

const LONG_SPANISH_DOCUMENT = Array.from(
  { length: 14 },
  (_, idx) =>
    `Capitulo ${idx + 1}: ¿Como opera el motor acustico neural en nuestra estacion local? ¡La arquitectura ONNX Runtime junto con DirectML procesa cada fonema en espanol con precision milimetrica, manteniendo 25 gigabytes de techo dinamico y cero dependencia de red externa!`,
).join(' ');

async function assertStrictZeroScroll(page: Page, stageContext: string): Promise<void> {
  const violations = await page.evaluate(() => {
    const bad: string[] = [];

    const checkNode = (el: Element | null, name: string) => {
      if (!el) return;
      const htmlEl = el as HTMLElement;
      const style = window.getComputedStyle(htmlEl);
      if (style.display === 'none' || style.visibility === 'hidden') return;

      const overflowY = style.overflowY;
      const overflowX = style.overflowX;
      if (
        overflowY === 'auto' ||
        overflowY === 'scroll' ||
        overflowX === 'auto' ||
        overflowX === 'scroll'
      ) {
        bad.push(`${name}: overflow prohibido (${overflowX}/${overflowY})`);
      }

      if (htmlEl.scrollHeight > htmlEl.clientHeight + 1) {
        bad.push(
          `${name}: scrollHeight (${htmlEl.scrollHeight}) > clientHeight (${htmlEl.clientHeight}) + 1`,
        );
      }
      if (htmlEl.scrollWidth > htmlEl.clientWidth + 1) {
        bad.push(
          `${name}: scrollWidth (${htmlEl.scrollWidth}) > clientWidth (${htmlEl.clientWidth}) + 1`,
        );
      }
    };

    checkNode(document.documentElement, 'documentElement');
    checkNode(document.body, 'body');
    checkNode(document.getElementById('root'), '#root');
    checkNode(document.querySelector('[data-testid="studio-stage-16-9"]'), 'studio-stage-16-9');

    const panels = document.querySelectorAll(
      '[data-panel], header, main, aside, section, footer, textarea',
    );
    panels.forEach((panel, index) => {
      const id =
        panel.getAttribute('data-panel') ||
        panel.getAttribute('data-testid') ||
        `${panel.tagName.toLowerCase()}#${index}`;
      checkNode(panel, id);
    });

    return bad;
  });

  expect(
    violations,
    `Violaciones de CERO SCROLL detectadas en [${stageContext}]:\n${violations.join('\n')}`,
  ).toEqual([]);
}

async function assertZeroEmojisInVisibleDom(page: Page): Promise<void> {
  const offendingChars = await page.evaluate(() => {
    // El unico simbolo especial autorizado por DISENO.md es U+00AE (®) en la firma oficial
    const text = (document.body.innerText || '').replace(/\u00AE/g, '');
    const emojiPattern = new RegExp(
      '[\\u2600-\\u27BF\\uFE0F\\u200D]|\\p{Extended_Pictographic}',
      'gu',
    );
    return text.match(emojiPattern) ?? [];
  });
  expect(
    offendingChars,
    `Se detectaron caracteres emoji prohibidos en document.body.innerText: ${offendingChars.join(', ')}`,
  ).toEqual([]);
}

async function openNeuralStudio(page: Page, orientationGuard: boolean = false): Promise<void> {
  const sidebarLauncher = page.getByTestId('open-live-studio');
  if (await sidebarLauncher.isVisible()) {
    await sidebarLauncher.click();
  } else {
    await page.getByTestId('open-live-studio-home').click();
  }
  if (orientationGuard) {
    await expect(page.locator('h1')).toHaveText('VOZSTUDIO OMNI-ES');
    return;
  }
  await expect(page.getByTestId('studio-stage-16-9')).toBeVisible();
}

for (const viewport of DESKTOP_RESOLUTIONS) {
  test(`Cumplimiento estricto 16:9 Cero Scroll, Cero Emojis y Flujos en ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');
    await openNeuralStudio(page);

    // 1. Verificar carga del escenario 16:9, H1 unico y firma obligatoria DISENO.md
    await expect(page.getByTestId('studio-stage-16-9')).toBeVisible();
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.getByTestId('official-footer-signature')).toHaveText(
      'HUMAN AI SYNERGY BY BENNER CASTILLO - 2026®',
    );

    await assertZeroEmojisInVisibleDom(page);
    await assertStrictZeroScroll(page, `${viewport.label} - Carga Inicial`);

    // 2. Cambio entre pestañas de motores neurales + paginacion de voces en Piper
    await page.getByTestId('engine-tab-piper').click();
    await expect(page.getByTestId('engine-tab-piper')).toHaveAttribute('aria-selected', 'true');
    await assertStrictZeroScroll(page, `${viewport.label} - Motor Piper`);

    const nextVoicePageBtn = page.getByTestId('voices-paginator-next');
    if (await nextVoicePageBtn.isEnabled()) {
      await nextVoicePageBtn.click();
      await expect(page.getByTestId('voices-paginator-indicator')).toContainText('2 /');
      await assertStrictZeroScroll(page, `${viewport.label} - Pagina 2 de Voces Piper`);
    }

    for (const engId of ['mms', 'styletts2', 'f5_spanish', 'cosyvoice', 'xtts_v2', 'qwen3_tts', 'kokoro']) {
      await page.getByTestId(`engine-tab-${engId}`).click();
      await assertStrictZeroScroll(page, `${viewport.label} - Motor ${engId}`);
    }

    // 3. Conmutacion a Laboratorio Zero-Shot (sin modal) y retorno a Sintesis Directa
    await page.getByTestId('mode-tab-clone').click();
    await expect(page.getByTestId('clone-lab-panel')).toBeVisible();
    await expect(page.getByTestId('ref-mode-mic-btn')).toBeVisible();
    await expect(page.getByTestId('dsp-toggle-nasal')).toBeVisible();
    await expect(page.getByTestId('apply-dsp-clean-btn')).toBeVisible();
    await page.getByTestId('dsp-toggle-nasal').click();
    await page.getByTestId('ref-mode-upload-btn').click();
    await expect(page.getByTestId('upload-ref-wav-btn')).toBeVisible();
    await page.getByTestId('ref-mode-mic-btn').click();
    await expect(page.getByTestId('teleprompter-box')).toBeVisible();
    await page.getByTestId('script-btn-narrativa_calida').click();
    await expect(page.getByTestId('clone-reference-text')).toHaveValue(/Al caer la tarde/);
    await assertZeroEmojisInVisibleDom(page);
    await assertStrictZeroScroll(page, `${viewport.label} - Laboratorio Zero-Shot`);

    // 3.1 Conmutacion a DNA Design (Qwen3 VoiceDesign y CosyVoice Instruct-TTS)
    await page.getByTestId('mode-tab-dna').click();
    await expect(page.getByTestId('dna-design-panel')).toBeVisible();
    await expect(page.getByTestId('qwen-voice-design-prompt')).toBeVisible();
    await expect(page.getByTestId('enhance-qwen-prompt-btn')).toBeVisible();
    await assertStrictZeroScroll(page, `${viewport.label} - DNA Design Qwen`);

    await page.getByTestId('switch-dna-cosy-btn').click();
    await expect(page.getByTestId('cosy-instruct-prompt')).toBeVisible();
    await expect(page.getByTestId('insert-tag-risa')).toBeVisible();
    await assertStrictZeroScroll(page, `${viewport.label} - DNA Design CosyVoice`);

    // Pestaña de metadatos de timbre en Inspector
    await page.getByTestId('inspector-tab-voice').click();
    await expect(page.getByTestId('voice-metadata-editor')).toBeVisible();
    await assertStrictZeroScroll(page, `${viewport.label} - Inspector Metadatos Timbre`);

    await page.getByTestId('mode-tab-direct').click();
    await expect(page.getByTestId('direct-composer-panel')).toBeVisible();

    // 4. Pegado/insercion de texto largo (>2000 caracteres) -> segmentacion automatica sin scroll
    expect(LONG_SPANISH_DOCUMENT.length).toBeGreaterThan(2000);
    const textarea = page.getByTestId('composer-textarea');
    await textarea.fill(LONG_SPANISH_DOCUMENT);

    // Debe haberse dividido en multiples bloques paginados (Bloque 1/N, Bloque 2/N...)
    await expect(page.getByTestId('block-chip-1')).toBeVisible();
    await expect(page.getByTestId('block-chip-2')).toBeVisible();
    await assertStrictZeroScroll(page, `${viewport.label} - Texto >2000 caracteres segmentado`);

    // Navegar al bloque 2 y verificar que sigue sin scroll
    await page.getByTestId('block-chip-2').click();
    await assertStrictZeroScroll(page, `${viewport.label} - Edicion Bloque 2`);

    // 5. Sintetizar bloque activo y verificar Biblioteca + Inspector JSON sin scroll
    await page.getByTestId('synthesize-block-btn').click();
    await expect(page.getByTestId('inspector-tab-json')).toBeEnabled({ timeout: 25000 });
    await assertZeroEmojisInVisibleDom(page);
    await assertStrictZeroScroll(page, `${viewport.label} - Post Sintesis e Inspector JSON`);
  });
}

test('Transicion a DIRECTML / LOCAL ONLINE e integracion API sin scroll (1920x1080)', async ({
  page,
}) => {
  await page.route('**/api/v1/system/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        app: 'VozStudio Omni-ES',
        version: '1.0.0',
        active_engine: 'kokoro',
        active_provider: 'DmlExecutionProvider',
        estimated_engine_mb: 326,
        hardware: {
          ram_total_gb: 32,
          ram_used_gb: 12.2,
          ram_available_gb: 19.8,
          process_rss_mb: 420,
          vram_limit_gb: 25,
          cpu_threads: 12,
          dml_available: true,
          available_providers: ['DmlExecutionProvider', 'CPUExecutionProvider'],
        },
      }),
    });
  });

  await page.route('**/api/v1/engines', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ engines: [] }),
    });
  });

  await page.route('**/api/v1/voices**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ voices: [] }),
    });
  });

  await page.route('**/api/v1/library**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: Array.from({ length: 6 }, (_, i) => ({
          id: `item_${i + 1}`,
          archivo: `20261104_21000${i}_audio_kokoro_prueba_${i + 1}.wav`,
          audio_url: `/biblioteca/20261104_21000${i}_audio_kokoro_prueba_${i + 1}.wav`,
          modelo_origen: 'Kokoro-82M v1.0',
          motor: 'kokoro',
          voz_id: 'ef_dora',
          parametros: { speed: 1.0, emotion: 'neutro', sample_rate: 24000 },
          prompt_original: 'Prueba auditada en biblioteca sin scroll.',
          metricas: {
            caracteres_entrada: 42,
            fragmentos: 1,
            duracion_audio_seg: 2.8,
            tiempo_inferencia_ms: 48,
            rtf: 0.017,
            pico_memoria_mb: 326,
          },
          contexto: { app: 'VozStudio Omni-ES' },
        })),
      }),
    });
  });

  await page.route('**/api/v1/engines/unload', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ unloaded: true }),
    });
  });

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await openNeuralStudio(page);

  await expect(page.getByTestId('connection-status-badge')).toContainText(
    'DIRECTML / LOCAL ONLINE',
  );
  await expect(page.getByTestId('library-paginator-next')).toBeEnabled();
  await page.getByTestId('library-paginator-next').click();
  await page.getByTestId('unload-vram-btn').click();

  await assertZeroEmojisInVisibleDom(page);
  await assertStrictZeroScroll(page, '1920x1080 - Modo DIRECTML / LOCAL ONLINE + Paginacion Biblioteca');
});

test('Guardia de orientacion vertical / movil (<900px) sin scroll y con firma oficial', async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/');
  await openNeuralStudio(page, true);

  await expect(page.locator('h1')).toHaveText('VOZSTUDIO OMNI-ES');
  await expect(page.locator('footer')).toContainText(
    'HUMAN AI SYNERGY BY BENNER CASTILLO - 2026®',
  );
  await assertZeroEmojisInVisibleDom(page);
  await assertStrictZeroScroll(page, '768x1024 - Guardia Vertical');
});
