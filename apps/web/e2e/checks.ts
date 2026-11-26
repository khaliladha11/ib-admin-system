// Pemeriksaan bersama e2e: target sentuh dan scroll ke samping.
import { expect, type Page } from '@playwright/test';

/** Semua kontrol yang terlihat minimal 44×44px dan tidak ada scroll ke samping. */
export async function checkTargets(page: Page, name: string) {
  const small = await page.evaluate(() =>
    [
      ...document.querySelectorAll(
        'button, a[href], select, input:not([type=checkbox]):not([type=radio]), [role=radio], label:has(> input)',
      ),
    ]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return (
          r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && !el.closest('.sr-only')
        );
      })
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.height < 43.5 || r.width < 43.5;
      })
      .map(
        (el) =>
          `${el.tagName} "${el.textContent.trim().slice(0, 30)}" ${String(Math.round(el.getBoundingClientRect().width))}×${String(Math.round(el.getBoundingClientRect().height))}`,
      ),
  );
  expect(small, `${name}: target sentuh < 44px`).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, `${name}: scroll ke samping`).toBeLessThanOrEqual(0);
}
