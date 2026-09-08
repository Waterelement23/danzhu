async (page) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto('http://localhost:5173/');
  await page.locator('#practice').click();
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  await page.screenshot({ path: 'output/playwright/standing.png', fullPage: true });
  const rect = await page.locator('#scene canvas').boundingBox();
  // Independently project the standing serve through the documented perspective camera.
  const projectServe = (rect) => {
    const sin = Math.sin((58 * Math.PI) / 180),
      cos = Math.cos((58 * Math.PI) / 180);
    const tan = Math.tan((21 * Math.PI) / 180),
      aspect = rect.width / rect.height;
    let distance = 0;
    for (const x of [-1.66, 1.66])
      for (const z of [-1.66, 1.66])
        for (const y of [0, 0.88]) {
          const depth = (y - 0.05) * sin + z * cos;
          const vertical = (y - 0.05) * cos - z * sin;
          distance = Math.max(
            distance,
            depth + Math.abs(vertical) / (tan * 0.94),
            depth + Math.abs(x) / (tan * aspect * 0.94),
          );
        }
    const depth = distance - (0.818 - 0.05) * sin - 1.5 * cos;
    const vertical = (0.818 - 0.05) * cos - 1.5 * sin;
    return {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2 - ((vertical / (depth * tan)) * rect.height) / 2,
    };
  };
  const { x: px, y: py } = projectServe(rect);
  await page.mouse.move(px, py);
  await page.mouse.down();
  await page.mouse.move(px - 8, py + 25, { steps: 8 });
  const power = await page.locator('#power-text').textContent();
  if (power === '25%' || power === '0%') throw new Error('Drag did not change power');
  await page.keyboard.press('Escape');
  await page.mouse.up();
  if ((await page.locator('#turn-title').textContent()) !== '站着，弹第一颗。')
    throw new Error('Cancel fired a shot');
  await page.mouse.move(px, py);
  await page.mouse.down();
  await page.mouse.move(px - 8, py + 25, { steps: 8 });
  await page.mouse.up();
  await page.waitForFunction(
    () => document.querySelector('#turn-title')?.textContent === '让它再滚一会儿。',
  );
  await page.waitForFunction(
    () => document.querySelector('#turn-title')?.textContent === '贴地，瞄准入场。',
    {},
    { timeout: 20000 },
  );
  const mobile = await page
    .context()
    .browser()
    .newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
  try {
    const touchPage = await mobile.newPage();
    await touchPage.goto('http://localhost:5173/');
    await touchPage.locator('#practice').click();
    await touchPage.locator('#scene canvas').scrollIntoViewIfNeeded();
    await touchPage.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
    const box = await touchPage.locator('#scene canvas').boundingBox();
    const { x: tx, y: ty } = projectServe(box);
    const cdp = await mobile.newCDPSession(touchPage);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: tx, y: ty }],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: tx - 3, y: ty + 10 }],
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await touchPage.waitForFunction(
      () => document.querySelector('#turn-title')?.textContent === '让它再滚一会儿。',
    );
    await touchPage.waitForFunction(
      () => document.querySelector('#turn-title')?.textContent === '贴地，瞄准入场。',
      {},
      { timeout: 20000 },
    );
    await touchPage.screenshot({ path: 'output/playwright/mobile-playing.png', fullPage: true });
  } finally {
    await mobile.close();
  }
  return {
    passed: true,
    checks: [
      'mouse drag changes power',
      'Escape cancels without firing',
      'mouse release fires',
      'high serve settles to second serve',
      'trusted mobile touch drag fires',
    ],
    power,
    point: { px, py },
  };
};
