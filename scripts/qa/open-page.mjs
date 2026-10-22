/* global document -- the evaluate callback runs in the browser */
import { headerViewOf, spaceOf } from '../../ui/spaces.js';

/* How a browser check opens a page in the redesign's shell (ui/spaces.js): the space's row in the sidebar, then the view in the space header.
   The task console is the top bar's button; settings the sidebar's foot. Clicks are dispatched (like the older checks did on the sidebar rows),
   so a page behind a dialog or a tour is still reached. Waits until the view is lit; throws when the page has no way in here. */
export async function openPage(page, id, { timeout = 15000 } = {}) {
  if (id === 'tasks' || id === 'settings') {
    const selector = id === 'tasks' ? '.topbar [data-tour="nav-tasks"]' : '.sidebar [data-tour="nav-settings"]';
    await page.locator(selector).first().waitFor({ state: 'attached', timeout });
    await page.locator(selector).first().dispatchEvent('click');
    return;
  }
  const view = headerViewOf(id) === id ? id : null, space = spaceOf(id);
  if (!space || !view) throw new Error(`openPage: ${id} is not a view of any space`);
  const row = page.locator(`.sidebar [data-space="${space.id}"]`).first();
  await row.waitFor({ state: 'attached', timeout });
  const lit = () => page.evaluate(([s, v]) => {
    const tab = document.querySelector(`.space-header__view[data-view="${v}"]`);
    const spaceLit = document.querySelector(`.sidebar [data-space="${s}"]`)?.getAttribute('aria-current') === 'page';
    const actual = document.querySelector('.study-app')?.dataset.usageArea;
    return { spaceLit, tab: !!tab, current: actual === v || (v === 'book' && actual === 'outline') };
  }, [space.id, view]);
  let state = await lit();
  if (!state.spaceLit || (!state.current && !state.tab)) { await row.dispatchEvent('click'); }
  const deadline = Date.now() + timeout;
  let requested = false;
  for (;;) {
    state = await lit();
    if (state.spaceLit && state.current) return;
    if (state.spaceLit && state.tab && !state.current && !requested) {
      await page.locator(`.space-header__view[data-view="${view}"]`).first().dispatchEvent('click');
      requested = true;
    }
    if (Date.now() > deadline) throw new Error(`openPage: ${id} did not open (${JSON.stringify(state)})`);
    await page.waitForTimeout(150);
  }
}
