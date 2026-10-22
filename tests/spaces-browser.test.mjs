/* global document, localStorage -- page.evaluate callbacks run in the browser */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildPreview } from '../scripts/build.mjs';
import { launchChromium } from '../scripts/qa/browser.mjs';
import { startNavServer } from '../scripts/qa/nav-layout.mjs';
import { previewCall } from '../scripts/preview-server.mjs';
import { SPACES as SPACE_MODEL, viewsOf } from '../ui/spaces.js';
import { pageAvailable } from '../ui/capabilities.js';
import { openPage } from '../scripts/qa/open-page.mjs';

/* The redesign's shell in a real browser, on the sample library: the sidebar holds the five spaces and settings and fits a 900px window
   without scrolling; every space opens; its header switches between its views; the crumb names space and view; no view draws more than one
   primary button; and the course is picked once, in the top bar, not on the pages. Needs a Chromium; without one the test says so. */

test('the five spaces: one row each, every view reachable from its space header, one primary per view, the course only in the top bar', { timeout: 300000 }, async (t) => {
  let browser;
  try { browser = await launchChromium(); } catch (error) { t.skip(`no Chromium to measure with: ${String(error.message).split('\n')[0]}`); return; }
  const dist = await mkdtemp(join(tmpdir(), 'study-spaces-dist-'));
  await buildPreview({ outdir: dist });
  const running = await startNavServer({ distDir: dist });
  await previewCall(running.server, 'sample.load', {});
  const snapshot = await previewCall(running.server, 'snapshot', {});
  const SPACES = Object.fromEntries(SPACE_MODEL.map(space => {
    const views = viewsOf(space, id => pageAvailable(snapshot, id));
    return [space.id, views.length > 1 ? views : []];
  }));
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => { try { localStorage.setItem('study-ui-language', 'zh'); localStorage.setItem('study-theme', 'dark'); } catch { /* blocked */ } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  const settle = (ms = 900) => page.waitForTimeout(ms);
  try {
    await page.goto(running.server.url);
    await page.locator('.sidebar').first().waitFor({ timeout: 30000 });
    await settle();
    const later = page.getByRole('button', { name: '以后再说' });
    if (await later.count()) { await later.click(); await settle(); }

    const rows = await page.evaluate(() => [...document.querySelectorAll('.sidebar .side-spaces > .nav')].map((row) => row.dataset.space));
    assert.deepEqual(rows, Object.keys(SPACES), 'the sidebar is the five spaces, in order');
    assert.equal(await page.locator('.sidebar [data-tour="nav-settings"]').count(), 1, 'settings stays at the foot');
    const nav = await page.locator('.sidebar .side-spaces').evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight }));
    assert.ok(nav.scroll <= nav.client, `the spaces fit without scrolling (${nav.scroll} > ${nav.client})`);

    const primaries = () => page.evaluate(() => [...document.querySelectorAll('main .sh-btn--primary')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim()));
    for (const [space, views] of Object.entries(SPACES)) {
      await page.locator(`.sidebar [data-space="${space}"]`).click();
      await settle();
      assert.equal(await page.locator(`.sidebar [data-space="${space}"]`).getAttribute('aria-current'), 'page', `${space} is lit`);
      const tabs = await page.evaluate(() => [...document.querySelectorAll('.space-header__view')].map((tab) => tab.dataset.view));
      assert.deepEqual(tabs, views, `${space}: its header lists its views`);
      for (const view of views.length ? views : [null]) {
        if (view) { await page.locator(`.space-header__view[data-view="${view}"]`).click(); await settle(1200); }
        if (view) assert.equal(await page.locator(`.space-header__view[data-view="${view}"]`).getAttribute('aria-current'), 'page');
        const shown = await primaries();
        assert.ok(shown.length <= 1, `${space}/${view ?? ''} draws one primary at most: ${shown.join(' | ')}`);
        // 生成 keeps a course filter inside its source picker (a filter of the list, L2), not a page scope.
        if (view !== 'generate') assert.equal(await page.locator('main .page-scope:not(.topbar *)').count(), 0, `${space}/${view ?? ''} has no scope picker of its own`);
        assert.equal(await page.locator('main [aria-label="切换当前课程"]').count(), 0, 'the course is switched only in the top bar');
      }
    }

    await page.locator('.sidebar [data-space="practice"]').click();
    await settle();
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('.topbar .crumbs .crumb')].map((c) => c.textContent)), ['练习', '考试'],
      'the crumb is space › view, and the space remembers the view last opened');
    assert.equal(await page.locator('.topbar .top-course').count(), 1, 'the course is picked in the top bar');
    await openPage(page, 'bank');
    await page.locator('.map-deck').first().getByRole('button', { name: '更多操作', exact: true }).click();
    await page.getByRole('menuitem', { name: '管理题组', exact: true }).click();
    await page.locator('.manage-head .sh-page-header__back').click();
    await page.locator('.bank-page').waitFor({ timeout: 3000 });
    await page.locator('.map-play').first().click();
    await page.waitForFunction(() => document.querySelector('.study-app')?.dataset.usageArea === 'review');
    await openPage(page, 'library');
    assert.equal(await page.locator('.study-app').getAttribute('data-usage-area'), 'library', 'QA helper leaves a run in the same space for Today');
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
    await browser.close();
    await running.close();
  }
});
