import { test, expect } from '@playwright/test';
import { PAGES, stabilizePage } from './helpers';

test.describe('Régression visuelle des sections', () => {
  for (const pageDef of PAGES) {
    test(`Capture des sections - ${pageDef.name}`, async ({ page }) => {
      await page.goto(pageDef.url);
      await stabilizePage(page);

      const sections = page.locator('section');
      const count = await sections.count();
      expect(count).toBeGreaterThan(0);

      for (let i = 0; i < count; i++) {
        const section = sections.nth(i);
        const rawId = await section.getAttribute('id');
        let sectionId = rawId?.trim();
        if (!sectionId) {
          const cls = (await section.getAttribute('class')) || '';
          sectionId = cls.trim().split(/\s+/)[0] || 'sec';
        }
        sectionId = sectionId.replace(/[^a-zA-Z0-9_-]/g, '_');

        const snapshotName = `${pageDef.name}-section-${i}-${sectionId}.png`;

        await expect(section).toHaveScreenshot(snapshotName, {
          maxDiffPixelRatio: 0.01,
          animations: 'disabled',
          timeout: 15000,
        });
      }
    });
  }
});
