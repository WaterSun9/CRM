import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/Users/mahvishsadafv2/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const output = 'output/vendor-calendar-qa';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function openCalendar(width, tableMissing) {
    const page = await browser.newPage({ viewport: { width, height: 812 } });
    await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.hostname === '127.0.0.1') return route.continue();
        if (url.pathname.startsWith('/rest/v1/crm_availability')) {
            return route.fulfill(tableMissing
                ? { status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST205', message: "Could not find the table 'public.crm_availability' in the schema cache" }) }
                : { status: 200, contentType: 'application/json', body: '[]' });
        }
        return route.abort();
    });
    await page.goto('http://127.0.0.1:5174/');
    await page.waitForTimeout(1800);
    await page.keyboard.press('Meta+Shift+S');
    await page.getByRole('button', { name: 'Vendors', exact: true }).click();
    await page.getByRole('button', { name: 'My calendar' }).click();
    await page.getByRole('heading', { name: 'Availability calendar' }).waitFor();
    return page;
}

try {
    for (const width of [320, 375]) {
        const page = await openCalendar(width, true);
        await page.getByText('Calendar is unavailable until office setup is complete. Please contact the office.').waitFor();
        assert.equal(await page.locator('#availability-entry-form').count(), 0);
        const dimensions = await page.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth, day: document.querySelector('[aria-label^="Select "]')?.getBoundingClientRect().width, chat: document.querySelector('[aria-label="Open chat"]')?.getBoundingClientRect().width }));
        assert.ok(dimensions.page <= dimensions.viewport, `Horizontal overflow at ${width}px: ${JSON.stringify(dimensions)}`);
        assert.ok(dimensions.day >= 38, `Calendar day too narrow at ${width}px: ${JSON.stringify(dimensions)}`);
        assert.ok(dimensions.chat <= 44, `Chat button too wide at ${width}px: ${JSON.stringify(dimensions)}`);
        await page.screenshot({ path: `${output}/missing-table-${width}.png`, fullPage: true });
        await page.close();
    }
    const page = await openCalendar(375, false);
    await page.locator('#availability-entry-form').waitFor();
    await page.locator('[aria-label^="Select "]').first().click();
    assert.equal(await page.getByText('Selected:', { exact: false }).count() > 0, true);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `${output}/ready-375.png`, fullPage: true });
    await page.close();
    console.log('Vendor calendar mobile layout and missing-table handling: pass');
} finally {
    await browser.close();
}
