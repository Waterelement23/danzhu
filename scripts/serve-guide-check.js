async (page) => {
  const errors = [];
  const listener = (m) => {
    if (m.type() === 'error') errors.push(m.text());
  };
  page.on('console', listener);
  await page.reload();
  await page.waitForFunction(
    () => document.querySelector('#scene').dataset.environment === 'ready',
  );
  await page.locator('#practice').click();
  const frame = () =>
    page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
  const expectIdle = async () => {
    await frame();
    if (await page.locator('.serve-guide').isHidden()) throw new Error('Height guide is missing');
    if (await page.locator('.flight-path').getAttribute('d'))
      throw new Error('Trajectory visible before aiming');
    if (await page.locator('.flight-end').getAttribute('d'))
      throw new Error('Landing point visible before aiming');
  };
  // A server/practice update must not turn the default power into aiming input.
  const timer = await page.locator('#timer').textContent();
  await page.waitForFunction(
    (previous) => document.querySelector('#timer').textContent !== previous,
    timer,
  );
  await expectIdle();
  await page.locator('#scene').screenshot({ path: 'output/playwright/serve-idle-guide.png' });
  const start = await page.locator('.height-path').evaluate((el) => {
    const p = el.getPointAtLength(0),
      rect = el.ownerSVGElement.getBoundingClientRect();
    return { x: rect.x + p.x, y: rect.y + p.y - 6 };
  });
  await page.mouse.move(start.x, start.y);
  await expectIdle();
  await page.mouse.click(start.x, start.y);
  await expectIdle();
  if (!(await page.locator('#turn-title').textContent()).includes('站着'))
    throw new Error('A click fired the default power');
  await page.mouse.down();
  await page.mouse.move(start.x - 12, start.y + 26, { steps: 6 });
  await page.waitForFunction(() => !!document.querySelector('.flight-path').getAttribute('d'));
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expectIdle();
  const cancelledTimer = await page.locator('#timer').textContent();
  await page.waitForFunction(
    (previous) => document.querySelector('#timer').textContent !== previous,
    cancelledTimer,
  );
  await expectIdle();
  // Deliberately adjusting the accessible fine controls also counts as aiming.
  await page.locator('#power').evaluate((el) => {
    el.value = '25';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForFunction(
    () => document.querySelector('.serve-guide')?.dataset.prediction === 'ground',
  );
  await page.locator('#scene').screenshot({ path: 'output/playwright/serve-height-guide.png' });
  await page.locator('#angle').evaluate((el) => {
    el.value = '30';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('#power').evaluate((el) => {
    el.value = '60';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForFunction(
    () => document.querySelector('.serve-guide')?.dataset.prediction !== 'none',
  );
  const path1 = await page.locator('.flight-path').getAttribute('d');
  await page.locator('#scene').screenshot({ path: 'output/playwright/serve-flight-guide.png' });
  await page.locator('#serve-position').evaluate((el) => {
    el.value = '900';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('#angle').evaluate((el) => {
    el.value = '60';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('#power').evaluate((el) => {
    el.value = '100';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForFunction(
    () => document.querySelector('.serve-guide')?.dataset.prediction === 'out',
  );
  if ((await page.locator('.flight-path').getAttribute('d')) === path1)
    throw new Error('Stale trajectory');
  await page.locator('#angle').evaluate((el) => {
    el.value = '0';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('#power').evaluate((el) => {
    el.value = '14';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#scene').screenshot({ path: 'output/playwright/serve-guide-mobile.png' });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  if (overflow) throw new Error('Overflow');
  await page.locator('#shoot').evaluate((el) => el.click());
  await page.waitForFunction(() => document.querySelector('.serve-guide').hidden);
  await page.waitForFunction(() =>
    document.querySelector('#turn-title').textContent.includes('贴地'),
  );
  if (await page.locator('.serve-guide').isVisible())
    throw new Error('High flight guide remained for ground serve');
  await page.setViewportSize({ width: 1440, height: 1000 });
  page.off('console', listener);
  if (errors.length) throw new Error(errors.join('\n'));
  return {
    passed: true,
    checks: [
      'idle and hover show height only',
      'click without drag does not fire',
      'drag reveals trajectory',
      'cancel stays clear across updates',
      'fine controls reveal first contact',
      'aim updates',
      'out before contact',
      'mobile fits',
      'shot hides guide',
      'ground serve has no high flight',
    ],
    errors,
  };
};
