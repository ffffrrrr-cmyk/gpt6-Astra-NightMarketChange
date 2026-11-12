async (page) => {
  const report = __LEVEL_REPORT__;
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  let data = await page.evaluate(() => window.nightMarketDiagnostics());
  if (data.modal === 'result' && data.state.status === 'won') await page.getByRole('button', { name: '下一夜', exact: true }).click();
  data = await page.evaluate(() => window.nightMarketDiagnostics());
  if (data.modal === 'intro') await page.getByRole('button', { name: '点灯营业', exact: true }).click();
  data = await page.evaluate(() => window.nightMarketDiagnostics());
  check(data.levelId === report.levelId && data.state.cycle === 0, `关卡初态不匹配：${data.levelId}/${data.state.cycle}`);
  const bounds = await page.evaluate(() => ['#submit', '#guide-bar', '#progress-strip', '#cash-items', '.queue-footer'].map(selector => { const rect = document.querySelector(selector).getBoundingClientRect(); return { selector, visible: rect.top >= 0 && rect.bottom <= innerHeight + 1 && rect.right <= innerWidth }; }));
  check(bounds.every(item => item.visible), `布局越界：${JSON.stringify(bounds)}`);
  for (const [index, step] of report.efficient.steps.entries()) {
    await page.locator(`[data-action="guest"][data-guest="${step.guestId}"]`).click();
    for (let count = 0; count < step.change.fives; count++) await page.locator('[data-action="note5"]').click();
    for (let count = 0; count < step.change.ones; count++) await page.locator('[data-action="coin1"]').click();
    if (index % 2) await page.locator('#submit').click();
    else await page.keyboard.press('Enter');
    data = await page.evaluate(() => window.nightMarketDiagnostics());
    check(data.state.served.length === index + 1, `${report.levelId}第${index + 1}客失败：${data.state.failure}`);
    check(data.state.cycle === index + 1, '重复结账');
  }
  check(data.modal === 'result' && data.state.status === 'won', '缺少胜利结算');
  check(data.state.piecesGiven === report.efficient.pieces, '浏览器与内核计分不一致');
  return { result: 'PASS', levelId: report.levelId, viewport: page.viewportSize(), orders: data.state.served.length, pieces: data.state.piecesGiven, bounds };
}
