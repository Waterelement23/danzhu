async (page) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto('http://localhost:5173/');
  await page.locator('#practice').click();
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  await page.screenshot({ path: 'output/playwright/standing.png', fullPage: true });
  const rect = await page.locator('#scene canvas').boundingBox();
  // Project the documented standing release position using the scene's fixed camera.
  const origin = { x: 0, y: 0.818, z: 1.5 },
    cam = { x: 2.4, y: 5.5, z: 7.6 },
    target = { x: 0, y: 0.05, z: 0 };
  const normalize = (v) => {
      const l = Math.hypot(...v);
      return v.map((n) => n / l);
    },
    cross = (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ],
    dot = (a, b) => a.reduce((s, n, i) => s + n * b[i], 0);
  const z = normalize([cam.x - target.x, cam.y - target.y, cam.z - target.z]),
    x = normalize(cross([0, 1, 0], z)),
    y = cross(z, x),
    rel = [origin.x - cam.x, origin.y - cam.y, origin.z - cam.z];
  const halfH = Math.max(1.6, 2.35 / (rect.width / rect.height)),
    px = rect.x + rect.width / 2 + (dot(rel, x) * rect.height) / (2 * halfH),
    py = rect.y + rect.height / 2 - (dot(rel, y) * rect.height) / (2 * halfH);
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
    const box = await touchPage.locator('#scene canvas').boundingBox(),
      hh = Math.max(1.6, 2.35 / (box.width / box.height));
    const tx = box.x + box.width / 2 + (dot(rel, x) * box.height) / (2 * hh),
      ty = box.y + box.height / 2 - (dot(rel, y) * box.height) / (2 * hh);
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
