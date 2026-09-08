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
      'visible height and first contact',
      'aim updates',
      'out before contact',
      'mobile fits',
      'shot hides guide',
      'ground serve has no high flight',
    ],
    errors,
  };
};
