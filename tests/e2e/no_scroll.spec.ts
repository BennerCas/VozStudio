import { expect, test } from '@playwright/test';

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
  await expect(page.locator('.direct-editor textarea')).toHaveValue(/Documental íntimo/);
  await expect(page.locator('.toast')).toContainText('Preset aplicado');
});
