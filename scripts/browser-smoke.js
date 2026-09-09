async (page) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:5173/');
  await page.waitForFunction(
    () => document.querySelector('#scene')?.getAttribute('data-environment') === 'ready',
  );
  await page.getByRole('button', { name: '本机双人练习', exact: false }).click();
  await page.locator('#fine-aim summary').click();
  await page.locator('#serve-position').evaluate((e) => {
    e.value = '650';
    e.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('#power').evaluate((e) => {
    e.value = '14';
    e.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('#shoot').click();
  await page.waitForFunction(
    () => document.querySelector('#turn-title')?.textContent === '让它再滚一会儿。',
  );
  await page.waitForFunction(
    () => document.querySelector('#turn-title')?.textContent === '贴地，瞄准入场。',
    {},
    { timeout: 20000 },
  );
  await page.screenshot({ path: 'output/playwright/practice.png', fullPage: true });
  await page.locator('#leave').click();
  await page.locator('#create').click();
  await page.waitForFunction(() =>
    /^[A-F0-9]{8}$/.test(document.querySelector('#copy-code')?.textContent || ''),
  );
  const code = await page.locator('#copy-code').textContent();
  const ctx = await page
    .context()
    .browser()
    .newContext({ viewport: { width: 1280, height: 960 } });
  const other = await ctx.newPage();
  other.on('pageerror', (e) => errors.push(e.message));
  try {
    await other.goto('http://localhost:5173/');
    await other.getByRole('textbox', { name: '房间码' }).fill(code);
    await other.getByRole('button', { name: '加入房间', exact: true }).click();
    await page.locator('#ready').click();
    await other.locator('#ready').click();
    await page.waitForFunction(() => document.querySelector('#ready')?.hasAttribute('hidden'));
    const aFirst = (await page.locator('.player.active span').textContent()).includes('你');
    const first = aFirst ? page : other,
      second = aFirst ? other : page;
    if ((await first.locator('#fine-aim').getAttribute('open')) === null)
      await first.locator('#fine-aim summary').click();
    await first.locator('#serve-position').evaluate((e) => {
      e.value = '650';
      e.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await first.locator('#power').evaluate((e) => {
      e.value = '14';
      e.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await first.locator('#shoot').click();
    await second.waitForFunction(
      () => document.querySelector('#turn-title')?.textContent === '贴地，瞄准入场。',
      {},
      { timeout: 20000 },
    );
    const badgeA = await page.locator('.player.active').getAttribute('id'),
      badgeB = await other.locator('.player.active').getAttribute('id');
    if (badgeA !== badgeB) throw new Error('Browsers disagree about active player');
    const terrainSeed = await page.locator('#scene').getAttribute('data-terrain-seed');
    if (
      terrainSeed === '0' ||
      terrainSeed !== (await other.locator('#scene').getAttribute('data-terrain-seed'))
    )
      throw new Error('Browsers disagree about random terrain');
    await page.screenshot({ path: 'output/playwright/online-a.png', fullPage: true });
    await other.screenshot({ path: 'output/playwright/online-b.png', fullPage: true });
    if ((await second.locator('#fine-aim').getAttribute('open')) === null)
      await second.locator('#fine-aim summary').click();
    await second.locator('#serve-position').evaluate((e) => {
      e.value = '-650';
      e.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await second.locator('#power').evaluate((e) => {
      e.value = '14';
      e.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await second.locator('#shoot').click();
    await page.waitForFunction(
      () => document.querySelector('#round-label')?.textContent?.includes('02'),
      {},
      { timeout: 20000 },
    );
    await other.waitForFunction(() =>
      document.querySelector('#round-label')?.textContent?.includes('02'),
    );
    // End this match with a strong lateral shot, then both players request another match.
    await first.locator('#angle').evaluate((e) => {
      e.value = '90';
      e.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await first.locator('#power').evaluate((e) => {
      e.value = '100';
      e.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await first.locator('#shoot').click();
    await page.locator('#result').waitFor({ state: 'visible', timeout: 30000 });
    await other.locator('#result').waitFor({ state: 'visible', timeout: 30000 });
    await page.locator('#rematch').click();
    await other.locator('#rematch').click();
    await page.waitForFunction(
      (old) => document.querySelector('#scene').dataset.terrainSeed !== old,
      terrainSeed,
    );
    const newSeed = await page.locator('#scene').getAttribute('data-terrain-seed');
    await other.waitForFunction(
      (seed) => document.querySelector('#scene').dataset.terrainSeed === seed,
      newSeed,
    );
    if (await page.locator('#result').isVisible()) throw new Error('Old result survived rematch');
    await other.locator('#leave').click();
    await page.waitForFunction(() => !document.querySelector('#result')?.hasAttribute('hidden'));
    await page.screenshot({ path: 'output/playwright/result.png', fullPage: true });
    await page.locator('#result-home').click();
  } finally {
    await ctx.close();
  }
  await page.bringToFront();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  await page.screenshot({ path: 'output/playwright/mobile.png', fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  if (overflow) throw new Error('Mobile horizontal overflow');
  await page.getByRole('button', { name: '玩法说明', exact: false }).click();
  if (!(await page.locator('#rules').isVisible())) throw new Error('Rules dialog failed');
  await page.locator('#rules-close').click();
  if (errors.length) throw new Error(errors.join('\n'));
  return {
    passed: true,
    room: code,
    checks: [
      'practice standing serve to ground serve',
      'two independent browser contexts',
      'both ready',
      'two serves and round transition',
      'same active player',
      'both clients share random terrain',
      'rematch changes terrain for both clients',
      'disconnect result',
      'mobile no overflow',
      'rules dialog',
    ],
    pageErrors: errors,
  };
};
