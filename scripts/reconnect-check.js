async (page) => {
  await page.addInitScript(() => {
    const Native = window.WebSocket;
    window.__duelSockets = [];
    window.WebSocket = class extends Native {
      constructor(...args) {
        super(...args);
        window.__duelSockets.push(this);
      }
    };
  });
  await page.goto('http://localhost:5173/');
  await page.locator('#create').click();
  await page.waitForFunction(() =>
    /^[A-F0-9]{8}$/.test(document.querySelector('#copy-code')?.textContent || ''),
  );
  const code = await page.locator('#copy-code').textContent();
  const ctx = await page.context().browser().newContext(),
    b = await ctx.newPage();
  try {
    await b.goto('http://localhost:5173/');
    await b.locator('#room-code').fill(code);
    await b.locator('#join').click();
    await page.locator('#ready').click();
    await b.locator('#ready').click();
    await page.waitForFunction(() => document.querySelector('#ready')?.hasAttribute('hidden'));
    const terrainSeed = await page.locator('#scene').getAttribute('data-terrain-seed');
    const closeSocket = () => {
      const s = window.__duelSockets
        .filter((s) => s.url.includes(':2567/') && s.readyState === 1)
        .at(-1);
      if (!s) throw new Error('No room socket');
      s.close(1000);
    };
    await page.evaluate(closeSocket);
    await page.waitForFunction(() =>
      document.querySelector('#connection')?.textContent?.includes('连接中断'),
    );
    await page.waitForFunction(
      () => document.querySelector('#connection')?.textContent === '已连接房间',
      {},
      { timeout: 10000 },
    );
    if ((await page.locator('#copy-code').textContent()) !== code)
      throw new Error('Reconnected to wrong room');
    if ((await page.locator('#scene').getAttribute('data-terrain-seed')) !== terrainSeed)
      throw new Error('Reconnect changed terrain');
    await page.evaluate(closeSocket);
    await page.waitForFunction(() =>
      document.querySelector('#connection')?.textContent?.includes('连接中断'),
    );
    await page.locator('#leave').click();
    await page.locator('#practice').click();
    await page.waitForFunction(
      () => document.querySelector('#mode-tag')?.textContent === '本机双人练习',
    );
    await page.waitForTimeout(1500);
    if ((await page.locator('#connection').textContent()) !== '本机双人练习')
      throw new Error('Disposed connection contaminated practice');
    if ((await page.locator('#mode-tag').textContent()) !== '本机双人练习')
      throw new Error('Wrong mode after stale recovery');
    return {
      passed: true,
      checks: [
        'early socket loss reconnects same seat',
        'reconnect preserves terrain seed',
        'cancel retry by returning lobby',
        'old connection cannot overwrite practice',
      ],
    };
  } finally {
    await ctx.close();
  }
};
