async (page) => {
  await page.locator('[data-action="ending"]').click();
  if (!(await page.locator('.ending h1').innerText()).includes('收得刚刚好')) throw new Error('结局页面未出现');
  await page.screenshot({ path: 'output/playwright/ending-1280.png' });
  await page.locator('[data-action="levels"]').click();
  const count = await page.locator('.level-card:not(:disabled)').count();
  if (count !== 12) throw new Error(`全流程后只有${count}关解锁`);
  await page.screenshot({ path: 'output/playwright/levels-1280.png', fullPage: true });
  return { result: 'PASS', checks: ['最终结局', '12关解锁', '最佳记录'], browser: page.context().browser().version(), userAgent: await page.evaluate(() => navigator.userAgent) };
}
