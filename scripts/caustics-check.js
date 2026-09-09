async (page) => {
  const errors = [];
  const onError = (error) => errors.push(error.message);
  const onConsole = (message) => {
    if (message.type() === 'error') errors.push(message.text());
  };
  page.on('pageerror', onError);
  page.on('console', onConsole);
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('http://localhost:5173/scripts/caustics-fixture.html');
    await page.waitForFunction(
      () => document.querySelector('#scene').dataset.environment === 'ready',
      {},
      { timeout: 60000 },
    );
    const initialization = await page.evaluate(() => demo.caustics.world.stats);
    if (initialization.nodes >= initialization.triangles * 2)
      throw new Error('Optical index has excessive spatial subdivision');
    const ground = await page.evaluate(() => {
      place();
      closeView();
      const f = demo.caustics.fields[0];
      let peak = 0,
        fingerprint = 0;
      for (let i = 0; i < f.texture.image.data.length; i += 4) {
        peak = Math.max(peak, f.texture.image.data[i + 1]);
        fingerprint += f.texture.image.data[i + 1] * i;
      }
      return { peak, fingerprint, ...demo.caustics.stats };
    });
    if (ground.deposits <= 0 || ground.peak < 1)
      throw new Error('No converged transmitted light on the ground');
    await page.screenshot({ path: 'output/playwright/caustic-close.png' });
    const rotated = await page.evaluate(() => {
      place(0, 0, undefined, Math.PI / 2);
      return demo.caustics.fields[0].texture.image.data.reduce(
        (sum, value, index) => (index % 4 === 1 ? sum + value * (index - 1) : sum),
        0,
      );
    });
    if (Math.abs(rotated - ground.fingerprint) < 1)
      throw new Error('Opaque inner ribbon rotation did not affect the light');
    const airborne = await page.evaluate(() => {
      place(0, 0, 0.8);
      const f = demo.caustics.fields[0];
      let peak = 0;
      for (let i = 1; i < f.texture.image.data.length; i += 4)
        peak = Math.max(peak, f.texture.image.data[i]);
      return { peak, ...demo.caustics.stats };
    });
    if (airborne.peak >= ground.peak)
      throw new Error('Airborne marble kept a fixed contact-focus highlight');
    const timing = await page.evaluate(() => {
      demo.resize();
      const times = [];
      for (let i = 0; i < 20; i++) {
        place(i * 0.001, 0, undefined, i * 0.04);
        times.push(demo.caustics.stats.updateMs);
      }
      return {
        meanMs: times.reduce((a, b) => a + b) / times.length,
        samples: demo.caustics.stats.photons,
      };
    });
    if (errors.length) throw new Error(errors.join('\n'));
    return {
      passed: true,
      checks: [
        'ground shadow contains focused transmitted light',
        'ribbon rotation changes caustic',
        'height changes focus rather than a fixed glow',
        'WebGL materials compile without errors',
      ],
      initialization,
      ground,
      airborne,
      timing,
    };
  } finally {
    page.off('pageerror', onError);
    page.off('console', onConsole);
  }
};
