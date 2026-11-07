import { expect, test } from '@playwright/test';
import { STUDIO_PRESETS } from '../../src/ui/src/data/presetCatalog';

const BACKEND_URL = 'http://127.0.0.1:8880';
const PROJECT_ROOT = 'C:\\antigravityAS\\VozStudio-Omni-ES';

interface ChildProcessLike {
  pid?: number;
  kill: (signal?: string) => boolean;
}

async function backendHealthy(): Promise<boolean> {
  try {
    return (await fetch(`${BACKEND_URL}/api/v1/system/status`, {
      signal: AbortSignal.timeout(1500),
    })).ok;
  } catch {
    return false;
  }
}

async function importChildProcess(): Promise<{
  spawn: (command: string, args: string[], options: Record<string, unknown>) => ChildProcessLike;
}> {
  const dynamicImport = new Function('specifier', 'return import(specifier);') as (
    specifier: string,
  ) => Promise<{ spawn: (command: string, args: string[], options: Record<string, unknown>) => ChildProcessLike }>;
  return dynamicImport('node:child_process');
}

async function waitForBackend(): Promise<void> {
  const deadline = Date.now() + 40000;
  while (Date.now() < deadline) {
    if (await backendHealthy()) return;
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  throw new Error('FastAPI no respondió en 40 segundos.');
}

test.describe('flujo Figma conectado al backend local', () => {
  test.describe.configure({ timeout: 360000 });
  let spawned: ChildProcessLike | null = null;

  test.beforeAll(async () => {
    if (await backendHealthy()) return;
    const childProcess = await importChildProcess();
    spawned = childProcess.spawn(
      'python',
      ['-m', 'src.main.main'],
      { cwd: PROJECT_ROOT, stdio: 'ignore', windowsHide: true },
    );
    await waitForBackend();
  });

  test.afterAll(async () => {
    try {
      await fetch(`${BACKEND_URL}/api/v1/engines/unload`, {
        method: 'POST',
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // El backend puede haberse cerrado externamente.
    }
    spawned?.kill();
  });

  test('sintetiza un WAV de Kokoro desde la interfaz Figma y lo incorpora a la biblioteca', async ({ page }) => {
    const clientErrors: string[] = [];
    page.on('pageerror', (error) => clientErrors.push(error.message));

    await page.setViewportSize({ width: 1600, height: 980 });
    await page.goto(`${BACKEND_URL}/`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Iniciar VozStudio' }).click();
    await expect(page.locator('.splash-screen')).toBeHidden();
    await expect(page.locator('main h1').first()).toHaveText('Estudio neural');
    await expect(page.locator('.online')).toContainText('local online');
    await expect(page.locator('.engine-matrix button')).toHaveCount(8);
    await expect(page.locator('.studio-voice-list button').first()).toBeVisible();

    await page.locator('.engine-matrix button').filter({ hasText: 'Kokoro' }).first().click();
    await page.locator('.studio-voice-list button').first().click();
    await page.locator('.direct-editor textarea').fill(
      'Verificación Figma conectada a Kokoro con síntesis local en español.',
    );

    const synthesis = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/synthesize') && response.request().method() === 'POST',
      { timeout: 150000 },
    );
    await page.locator('.four-actions .synth-action').click();
    const response = await synthesis;
    expect(response.status()).toBe(200);

    const payload = (await response.json()) as {
      item: { id: string; archivo: string; audio_url: string; motor: string; metricas: { duracion_audio_seg?: number } };
    };
    expect(payload.item.motor).toBe('kokoro');
    expect(payload.item.metricas.duracion_audio_seg ?? 0).toBeGreaterThan(0);

    try {
      await expect(page.locator('.output-library-list')).toContainText(payload.item.archivo);
      const audio = await page.request.get(`${BACKEND_URL}${payload.item.audio_url}`);
      expect(audio.status()).toBe(200);
      expect(audio.headers()['content-type']).toContain('audio/wav');
      expect((await audio.body()).subarray(0, 4).toString('ascii')).toBe('RIFF');
      expect(clientErrors).toEqual([]);
    } finally {
      await page.request.delete(
        `${BACKEND_URL}/api/v1/library/${encodeURIComponent(payload.item.id)}`,
      );
    }
  });

  test('las rutas nativas de preset ejecutan su configuración real, instrucción y auditoría exactas', async ({ page }) => {
    const generatedIds: string[] = [];
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto(`${BACKEND_URL}/`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Iniciar VozStudio' }).click();
    await page.locator('.splash-screen').waitFor({ state: 'hidden' });
    await page.locator('.sidebar nav button').filter({ hasText: 'Presets' }).first().click();

    try {
      const nativeRecipes = ['kokoro', 'cosyvoice', 'qwen3_tts'].map((engineId) => {
        const preset = STUDIO_PRESETS.find((entry) => entry.engineId === engineId);
        if (!preset) throw new Error(`Falta una receta nativa para ${engineId}.`);
        return preset;
      });
      let activeCollection: string | null = null;
      for (const preset of nativeRecipes) {
        if (preset.collection !== activeCollection) {
          const collectionTestId = `preset-collection-${preset.collection === 'Fundamentos' ? 'Fundamentos' : 'Latino-neural'}`;
          await page.getByTestId(collectionTestId).click();
          activeCollection = preset.collection;
        }
        const synthesis = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/synthesize') && response.request().method() === 'POST',
          { timeout: 150000 },
        );
        await page.getByTestId(`preview-preset-${preset.id}`).click();
        const response = await synthesis;
        expect(response.status()).toBe(200);

        const payload = (await response.json()) as {
          item: {
            id: string;
            motor: string;
            voz_id: string;
            parametros: {
              speed?: number;
              pitch_semitones?: number;
              emotion_prompt?: string | null;
              instruct_prompt?: string | null;
            };
            modelo_origen: string;
            contexto: { backend?: string };
          };
        };
        generatedIds.push(payload.item.id);
        expect(payload.item.motor).toBe(preset.engineId);
        expect(payload.item.voz_id).toBe(preset.voiceId);
        expect(payload.item.parametros.speed).toBe(preset.speed);
        expect(payload.item.parametros.pitch_semitones).toBe(preset.pitch);
        expect(payload.item.parametros.emotion_prompt).toBe(
          preset.emotion === 'NEUTRO' ? null : preset.emotion.toLowerCase(),
        );
        expect(payload.item.parametros.instruct_prompt).toBe(preset.designInstruction);
        expect(`${payload.item.modelo_origen} ${payload.item.contexto.backend}`).not.toMatch(/fallback| via /i);
      }
    } finally {
      await Promise.all(
        generatedIds.map((id) =>
          page.request.delete(`${BACKEND_URL}/api/v1/library/${encodeURIComponent(id)}`),
        ),
      );
    }
  });

  test('el laboratorio conserva una instrucción editable, limita el texto a 6.000 caracteres y crea variantes', async ({ page }) => {
    const generatedIds: string[] = [];
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto(`${BACKEND_URL}/`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Iniciar VozStudio' }).click();
    await page.locator('.splash-screen').waitFor({ state: 'hidden' });
    await page.locator('.sidebar nav button').filter({ hasText: 'Presets' }).first().click();
    await page.getByTestId('preset-collection-Latino-neural').click();
    await page.getByTestId('preset-card-terror-nocturno').click();

    const instruction = 'Voz masculina madura, seca y cercana; sin eco, con suspense contenido y pausas breves.';
    await page.locator('.instruction-editor textarea').fill(instruction);
    await expect(page.locator('.text-editor textarea')).toHaveAttribute('maxlength', '6000');
    await page.locator('.text-editor textarea').fill('La puerta volvió a cerrarse, aunque nadie estaba en el pasillo.');

    try {
      const synthesis = page.waitForResponse(
        (response) => response.url().includes('/api/v1/synthesize') && response.request().method() === 'POST',
        { timeout: 150000 },
      );
      await page.getByTestId('generate-preset-lab').click();
      const response = await synthesis;
      expect(response.status()).toBe(200);
      const payload = (await response.json()) as {
        item: { id: string; motor: string; parametros: { instruct_prompt?: string | null } };
      };
      generatedIds.push(payload.item.id);
      expect(payload.item.motor).toBe('qwen3_tts');
      expect(payload.item.parametros.instruct_prompt).toBe(instruction);
      await expect(page.getByTestId('preset-lab-audit')).toContainText('AUDIO NATIVO AUDITADO');

      await page.getByRole('button', { name: /Duplicar/ }).click();
      await expect(page.getByTestId('preset-collection-Mis-variantes')).toBeVisible();
      await expect(page.locator('[data-preset-id]')).toHaveCount(1);
      await page.getByRole('button', { name: /3 variantes/ }).click();
      await expect(page.locator('[data-preset-id]')).toHaveCount(4);
    } finally {
      await Promise.all(
        generatedIds.map((id) =>
          page.request.delete(`${BACKEND_URL}/api/v1/library/${encodeURIComponent(id)}`),
        ),
      );
    }
  });
});
