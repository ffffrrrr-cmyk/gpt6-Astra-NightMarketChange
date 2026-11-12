async (page) => {
  const fixtures = __LEVEL_REPORTS__;
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const results = [];
  const browser = page.context().browser();
  const saved = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith('night-market-0003:'))));
  const corrupted = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  try {
    const active = saved['night-market-0003:active'];
    const backupKey = `night-market-0003:${active === 'a' ? 'b' : 'a'}`;
    const backup = JSON.parse(JSON.parse(saved[backupKey]).payload);
    await corrupted.addInitScript(entries => { if (location.origin === 'http://127.0.0.1:43103') for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value); }, { ...saved, [`night-market-0003:${active}`]: 'damaged' });
    const target = await corrupted.newPage();
    await target.goto('http://127.0.0.1:43103');
    const notice = await target.locator('#storage-notice').innerText();
    check(notice.includes('恢复上一份'), '损坏存档没有回退提示');
    await target.getByRole('button', { name: '继续营业', exact: true }).click();
    const data = await target.evaluate(() => window.nightMarketDiagnostics());
    check(JSON.stringify(data.state) === JSON.stringify(backup.current), '恢复状态与上一份不一致');
    if (data.state.status === 'playing') {
      const report = fixtures.find(item => item.levelId === data.levelId);
      for (const step of report.efficient.steps.slice(data.state.served.length)) {
        await target.locator(`[data-guest="${step.guestId}"]`).click();
        for (let count = 0; count < step.change.fives; count++) await target.locator('[data-action="note5"]').click();
        for (let count = 0; count < step.change.ones; count++) await target.locator('[data-action="coin1"]').click();
        await target.locator('#submit').click();
      }
      check((await target.evaluate(() => window.nightMarketDiagnostics().state.status)) === 'won', '回退后不能通关');
    }
    await target.screenshot({ path: 'output/playwright/corrupt-save-recovery.png' });
    results.push({ scenario: '损坏档恢复并完成结算', result: 'PASS', recoveredCycle: backup.current.cycle });
  } finally { await corrupted.close(); }
  const disabled = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  try {
    await disabled.addInitScript(() => {
      Storage.prototype.setItem = function () { throw new DOMException('Storage disabled for QA', 'SecurityError'); };
      Storage.prototype.getItem = function () { throw new DOMException('Storage disabled for QA', 'SecurityError'); };
    });
    const target = await disabled.newPage();
    await target.goto('http://127.0.0.1:43103');
    check((await target.locator('#storage-notice').innerText()).includes('仅保留在内存'), '禁用存储提示缺失');
    await target.locator('[data-action="new"]').click();
    await target.locator('[data-action="confirm-new"]').click();
    await target.getByRole('button', { name: '点灯营业', exact: true }).click();
    await target.locator('[data-action="note5"]').click();
    await target.locator('[data-action="coin1"]').click();
    await target.locator('[data-action="coin1"]').click();
    await target.locator('#submit').click();
    await target.locator('[data-action="tutorial-reset"]').click();
    const bounds = await target.evaluate(() => ['#submit', '#guide-bar', '#progress-strip', '.queue-footer'].map(selector => { const rect = document.querySelector(selector).getBoundingClientRect(); return { selector, bottom: rect.bottom, visible: rect.top >= 0 && rect.bottom <= innerHeight + 1 }; }));
    check(bounds.every(item => item.visible), `存储警告挤出关键控件：${JSON.stringify(bounds)}`);
    for (const step of fixtures[0].efficient.steps) {
      await target.locator(`[data-guest="${step.guestId}"]`).click();
      for (let count = 0; count < step.change.fives; count++) await target.locator('[data-action="note5"]').click();
      for (let count = 0; count < step.change.ones; count++) await target.locator('[data-action="coin1"]').click();
      await target.locator('#submit').click();
    }
    check((await target.evaluate(() => window.nightMarketDiagnostics().state.status)) === 'won', '禁用存储不能完成结算');
    await target.screenshot({ path: 'output/playwright/storage-disabled-win.png' });
    results.push({ scenario: '禁用存储仍能首关通关', result: 'PASS', served: 8, bounds });
  } finally { await disabled.close(); }
  return results;
}
