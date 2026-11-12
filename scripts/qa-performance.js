async (page) => {
  const session = await page.context().newCDPSession(page);
  await session.send('HeapProfiler.collectGarbage');
  const dom = await session.send('Memory.getDOMCounters');
  const heap = await session.send('Runtime.getHeapUsage');
  await session.detach();
  return { capturedAt: new Date().toISOString(), browser: page.context().browser().version(), viewport: page.viewportSize(), diagnostics: await page.evaluate(() => { const data = window.nightMarketDiagnostics(); return { levelId: data.levelId, page: data.page, modal: data.modal, metrics: data.metrics, cycle: data.state?.cycle, documentHidden: document.hidden }; }), dom, heap };
}
