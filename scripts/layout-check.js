async (page) => {
  const results = [];
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 900, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('http://localhost:5173/');
    await page.waitForFunction(
      () => document.querySelector('#scene').dataset.environment === 'ready',
    );
    await page.locator('#practice').scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      const scene = document.querySelector('#scene');
      const canvas = scene.querySelector('canvas');
      const rect = scene.getBoundingClientRect();
      window.layoutProbe = {
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        canvas,
        sizes: [],
        frames: [],
        stop: false,
      };
      const probe = window.layoutProbe;
      probe.observer = new MutationObserver((entries) =>
        probe.sizes.push(...entries.map((e) => e.attributeName)),
      );
      probe.observer.observe(canvas, { attributes: true, attributeFilter: ['width', 'height'] });
      const sample = () => {
        const r = scene.getBoundingClientRect();
        probe.frames.push({ x: r.x, y: r.y, width: r.width, height: r.height });
        if (!probe.stop) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await page.locator('#practice').click();
    await page.waitForFunction(() => !document.querySelector('#controls').hidden);
    const timer = await page.locator('#timer').textContent();
    await page.waitForFunction(
      (previous) => document.querySelector('#timer').textContent !== previous,
      timer,
    );
    const result = await page.evaluate(() => {
      const p = window.layoutProbe;
      p.stop = true;
      p.observer.disconnect();
      return {
        before: p.rect,
        frames: p.frames,
        resized: p.sizes,
        sameCanvas: p.canvas === document.querySelector('#scene canvas'),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    if (!result.sameCanvas || result.resized.length)
      throw new Error(
        `Canvas recreated or resized at ${viewport.width}: ${JSON.stringify(result)}`,
      );
    if (
      result.frames.some((r) => Object.keys(r).some((k) => Math.abs(r[k] - result.before[k]) > 0.5))
    )
      throw new Error(`Scene shifted at ${viewport.width}: ${JSON.stringify(result)}`);
    if (result.overflow) throw new Error(`Horizontal overflow at ${viewport.width}`);
    await page.screenshot({
      path: `output/playwright/stable-practice-${viewport.width}.png`,
      fullPage: true,
    });
    results.push({
      width: viewport.width,
      scene: result.before,
      sampledFrames: result.frames.length,
      canvasResizes: result.resized.length,
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  return {
    passed: true,
    checks: [
      'desktop transition keeps scene bounds',
      'tablet transition keeps scene bounds',
      'mobile transition keeps scene bounds',
      'canvas is reused without backing-buffer resize',
      'no horizontal overflow',
    ],
    results,
  };
};
