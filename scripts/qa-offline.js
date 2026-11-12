async (page) => {
  const fileUrl = __FILE_URL__;
  const solution = __FIRST_SOLUTION__;
  const context = await page.context().browser().newContext({ viewport: { width: 1280, height: 720 }, offline: true });
  try {
    const target = await context.newPage();
    const errors = [];
    const external = [];
    target.on('pageerror', error => errors.push(error.message));
    target.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
    await target.goto(fileUrl);
    await target.locator('[data-action="new"]').click();
    await target.locator('[data-action="confirm-new"]').click();
    await target.getByRole('button', { name: '点灯营业', exact: true }).click();
    await target.locator('[data-action="note5"]').click();
    await target.locator('[data-action="coin1"]').click();
    await target.locator('[data-action="coin1"]').click();
    await target.locator('#submit').click();
    await target.locator('[data-action="tutorial-reset"]').click();
    for (const step of solution.steps) {
      await target.locator(`[data-guest="${step.guestId}"]`).click();
      for (let count = 0; count < step.change.fives; count++) await target.locator('[data-action="note5"]').click();
      for (let count = 0; count < step.change.ones; count++) await target.locator('[data-action="coin1"]').click();
      await target.locator('#submit').click();
    }
    const data = await target.evaluate(() => window.nightMarketDiagnostics());
    if (data.state.status !== 'won' || errors.length || external.length) throw new Error(JSON.stringify({ status: data.state.status, errors, external }));
    await target.screenshot({ path: 'output/playwright/offline-file-win.png' });
    return { result: 'PASS', url: fileUrl, offline: true, orders: 8, errors, externalRequests: external, storageNotice: data.storageNotice };
  } finally { await context.close(); }
}
