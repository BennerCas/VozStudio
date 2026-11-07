import { expect, test } from '@playwright/test';
import { PRESET_COLLECTIONS, STUDIO_PRESETS } from '../../src/ui/src/data/presetCatalog';

async function enterFigmaApp(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  const start = page.getByRole('button', { name: 'Iniciar VozStudio' });
  await expect(start).toBeVisible();
  await start.click();
  await expect(page.locator('.splash-screen')).toBeHidden();
  await expect(page.locator('.app-shell')).toBeVisible();
}

test('recorre las pantallas exportadas desde Figma sin errores de cliente', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 1600, height: 980 });
  await enterFigmaApp(page);

  const expectedPages = [
    ['Inicio', 'Buenos días, Benner'],
    ['Estudio neural', 'Estudio neural'],
    ['DNA Design', 'DNA Design'],
    ['Proyectos', 'Proyectos'],
    ['Mis voces', 'Mis voces'],
    ['Clonación en lote', 'Clonación en lote'],
    ['Diseño de voz', 'Diseño de voz en lote'],
    ['Presets', 'Presets profesionales'],
  ] as const;

  for (const [navigationLabel, title] of expectedPages) {
    await page.locator('.sidebar nav button').filter({ hasText: navigationLabel }).first().click();
    await expect(page.locator('main h1').first()).toHaveText(title);
  }

  await page.locator('.side-settings').click();
  await expect(page.locator('main h1').first()).toHaveText('Configuración técnica');
  expect(pageErrors).toEqual([]);
});

test('aplica un preset de Figma al estudio real sin cambiar la interfaz', async ({ page }) => {
  await enterFigmaApp(page);
  await page.locator('.sidebar nav button').filter({ hasText: 'Presets' }).first().click();
  await page.locator('.use-preset').first().click();

  await expect(page.locator('main h1').first()).toHaveText('Estudio neural');
  await expect(page.locator('.direct-editor textarea')).toHaveValue(STUDIO_PRESETS[0].script);
  await expect(page.getByTestId('active-preset-status')).toContainText('Documental íntimo');
  await expect(page.locator('.toast')).toContainText('Preset activo');
});

test('las dos colecciones de 20 presets aplican su receta completa en una cuadrícula 5 por 4 sin scroll 16:9', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await enterFigmaApp(page);
  await page.locator('.sidebar nav button').filter({ hasText: 'Presets' }).first().click();

  for (const collection of PRESET_COLLECTIONS) {
    const collectionTestId = `preset-collection-${collection === 'Fundamentos' ? 'Fundamentos' : 'Latino-neural'}`;
    const collectionPresets = STUDIO_PRESETS.filter((preset) => preset.collection === collection);
    await page.getByTestId(collectionTestId).click();

    const grid = page.locator('.preset-grid');
    const cards = page.locator('[data-preset-id]');
    await expect(cards).toHaveCount(collectionPresets.length);
    const gridGeometry = await grid.evaluate((element) => {
      const styles = getComputedStyle(element);
      const columns = styles.gridTemplateColumns.split(' ').filter(Boolean).length;
      const rows = styles.gridTemplateRows.split(' ').filter(Boolean).length;
      const rect = element.getBoundingClientRect();
      return { columns, rows, bottom: rect.bottom, viewport: window.innerHeight };
    });
    expect(gridGeometry.columns).toBe(5);
    expect(gridGeometry.rows).toBe(4);
    expect(gridGeometry.bottom).toBeLessThanOrEqual(gridGeometry.viewport - 37);

    for (const preset of collectionPresets) {
      await page.getByTestId(`apply-preset-${preset.id}`).click();
      await expect(page.locator('main h1').first()).toHaveText('Estudio neural');
      await expect(page.getByTestId('active-preset-status')).toHaveAttribute('data-preset-id', preset.id);
      await expect(page.locator('.direct-editor textarea')).toHaveValue(preset.script);
      await expect(page.locator('.pro-controls input[type="range"]').nth(0)).toHaveValue(String(preset.speed));
      await expect(page.locator('.pro-controls input[type="range"]').nth(1)).toHaveValue(String(preset.pitch));
      await expect(page.locator('.pro-controls select')).toHaveValue(preset.emotion);
      await page.locator('.sidebar nav button').filter({ hasText: 'Presets' }).first().click();
      await page.getByTestId(collectionTestId).click();
    }
  }
});
