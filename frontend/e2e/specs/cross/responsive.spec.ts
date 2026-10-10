import { devices } from '@playwright/test';

import { expect, test } from '../../fixtures/test.ts';
import { expectCleanPage } from '../../helpers/errors.ts';
import { assistantsCassette } from '../../mocks/cassettes/assistants.ts';
import { flowsCassette } from '../../mocks/cassettes/flows.ts';

const hasHorizontalOverflow = () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;

const { defaultBrowserType: _defaultBrowserType, ...pixel7 } = devices['Pixel 7'];

test.describe('responsive', { tag: '@cross' }, () => {
    test.use({ cassette: flowsCassette() });

    test.describe('mobile (real touch device profile)', () => {
        test.use(pixel7);

        test('collapses to the mobile shell without horizontal overflow', async ({ page, pageErrorLog }) => {
            await page.goto('/flows');

            await expect(page.getByRole('button', { name: 'Toggle Sidebar' })).toBeVisible();
            // Owned by the mobile shell: the sidebar collapses to an off-canvas sheet, so its
            // nav links are hidden until the trigger opens it (they are inline-visible on desktop).
            await expect(page.getByRole('link', { name: 'Dashboard' })).toBeHidden();
            expect(await page.evaluate(hasHorizontalOverflow)).toBe(false);

            await page.getByRole('row', { name: /E2E Alpha/ }).click();
            await expect(page.locator('header').getByText('E2E Alpha')).toBeVisible();
            await expect(page.getByRole('button', { name: 'Flow actions' })).toBeVisible();
            expect(await page.evaluate(hasHorizontalOverflow)).toBe(false);

            await page.getByRole('button', { name: 'Flow actions' }).click();
            await expect(page.getByRole('menuitem', { name: /Flows/ })).toBeVisible();
            await expect(page.getByRole('menuitem', { name: /favorites/ })).toBeVisible();
            await page.keyboard.press('Escape');

            expectCleanPage(pageErrorLog);
        });
    });

    test.describe('mobile assistant composer', () => {
        test.use({ cassette: assistantsCassette() });
        test.use(pixel7);

        test('keeps provider and assistant controls compact and readable', async ({ page, pageErrorLog }, testInfo) => {
            await page.goto('/flows/5');
            await page.getByRole('tab', { name: /Assistant|对话助手/ }).click();

            const textarea = page.locator('textarea').first();
            await expect(textarea).toBeVisible();

            const composer = textarea.locator('..');
            const form = composer.locator('xpath=ancestor::form[1]');
            const composerBox = await composer.boundingBox();

            expect(composerBox).not.toBeNull();
            expect(composerBox!.height).toBeLessThanOrEqual(160);
            expect(await page.evaluate(hasHorizontalOverflow)).toBe(false);

            for (const label of ['使用智能体', '允许控制自动执行']) {
                const labelBox = await form.getByText(label, { exact: true }).boundingBox();

                expect(labelBox).not.toBeNull();
                expect(labelBox!.width).toBeGreaterThan(labelBox!.height);
            }

            const screenshotPath = testInfo.outputPath('mobile-assistant-composer.png');
            await composer.screenshot({ path: screenshotPath });
            await testInfo.attach('mobile-assistant-composer', {
                contentType: 'image/png',
                path: screenshotPath,
            });

            const pageScreenshotPath = testInfo.outputPath('mobile-assistant-page.png');
            await page.screenshot({ path: pageScreenshotPath });
            await testInfo.attach('mobile-assistant-page', {
                contentType: 'image/png',
                path: pageScreenshotPath,
            });

            expectCleanPage(pageErrorLog);
        });
    });

    test.describe('sidebar boundary', () => {
        test('768 keeps the sidebar inline, 767 collapses it to the mobile sheet', async ({ page, pageErrorLog }) => {
            await page.setViewportSize({ height: 800, width: 768 });
            await page.goto('/flows');
            await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();

            await page.setViewportSize({ height: 800, width: 767 });
            // `hidden md:block` hides the desktop tree either way, so its absence — the closed mobile
            // sheet renders nothing — is the only reading that tells the hook's answer from the CSS.
            await expect(page.locator('[data-sidebar="sidebar"]')).toHaveCount(0);
            await expect(page.getByRole('link', { name: 'Dashboard' })).toBeHidden();
            expect(await page.evaluate(hasHorizontalOverflow)).toBe(false);
            expectCleanPage(pageErrorLog);
        });
    });

    test.describe('split boundary', () => {
        test('1280 shows the resizable split, 1279 merges into one tab row', async ({ page, pageErrorLog }) => {
            await page.setViewportSize({ height: 800, width: 1280 });
            await page.goto('/flows');
            await page.getByRole('row', { name: /E2E Alpha/ }).click();
            await expect(page.getByRole('separator').first()).toBeVisible();
            // Split layout: the central panel and the right rail are two separate tab rows.
            await expect(page.getByRole('tablist')).toHaveCount(2);

            await page.setViewportSize({ height: 800, width: 1279 });
            await expect(page.getByRole('separator')).toBeHidden();
            // Merged: the two tab groups collapse into a single tab row.
            await expect(page.getByRole('tablist')).toHaveCount(1);
            expect(await page.evaluate(hasHorizontalOverflow)).toBe(false);
            expectCleanPage(pageErrorLog);
        });
    });
});
