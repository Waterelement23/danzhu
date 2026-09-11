async (page) => {
  const reports=[],errors=[];
  for(const viewport of [{width:390,height:844},{width:1440,height:1000}]) {
    const ctx=await page.context().browser().newContext({viewport,isMobile:viewport.width<500,hasTouch:viewport.width<500});
    const p=await ctx.newPage();
    const check=(v,m)=>{if(!v)throw Error(m);};
    try {
      p.on('pageerror',e=>errors.push(e.message));
      await p.goto('http://localhost:5173/');
      await p.locator('#scene[data-environment="ready"]').waitFor({timeout:60000});
      check(await p.locator('#room-code,#join-form,#join').count()===0,'No manual room code entry');
      await p.evaluate(async()=>{
        const {MarbleGame}=await import('/src/shared/game.ts');
        const snap=MarbleGame.prototype.snapshot;
        MarbleGame.prototype.snapshot=function(){const s=snap.call(this);return {...s,secondsLeft:window.testSeconds??s.secondsLeft};};
        const {GameAudio}=await import(performance.getEntriesByType('resource').find(r=>r.name.includes('/src/client/audio.ts')).name),unlock=GameAudio.prototype.unlock;
        GameAudio.prototype.unlock=function(){window.testAudio=this;return unlock.call(this);};
      });
      await p.locator('#practice').click();
      await p.waitForFunction(()=>window.testAudio?.state.running);
      await p.evaluate(()=>{const a=window.testAudio;window.testAnalyser=a.context.createAnalyser();a.master.connect(window.testAnalyser);window.testSeconds=11;});
      await p.waitForTimeout(100);
      check(await p.locator('#turn-countdown').isHidden(),'Hidden above ten seconds');
      const played=()=>p.evaluate(()=>window.testAudio.state.played.countdown);
      const before=await played();
      await p.evaluate(()=>window.testSeconds=10);
      await p.waitForFunction(()=>document.querySelector('#turn-countdown').textContent==='10');
      const peak=await p.evaluate(()=>{const v=new Float32Array(window.testAnalyser.fftSize);window.testAnalyser.getFloatTimeDomainData(v);return Math.max(...v.map(Math.abs));});
      check(peak>0.00001,'Actual countdown audio signal');
      check(await played()===before+1,'One beep at ten');
      await p.waitForTimeout(220);
      check(await played()===before+1,'No repeated beep from snapshot updates');
      const number=await p.locator('#turn-countdown').boundingBox(),scene=await p.locator('#scene').boundingBox();
      check(Math.abs(number.x+number.width/2-scene.x-scene.width/2)<1,'Centered horizontally');
      check(Math.abs(number.y+number.height/2-scene.y-scene.height/2)<1,'Centered vertically');
      check(await p.locator('#turn-countdown').evaluate(e=>getComputedStyle(e).pointerEvents)==='none','Does not intercept touch');
      await p.screenshot({path:`/tmp/danzhu-countdown-${viewport.width}.png`});
      await p.evaluate(()=>{window.testAudio.setMuted(true);window.testSeconds=9;});
      await p.waitForTimeout(150);check(await played()===before+1,'Muted countdown silent');
      await p.evaluate(()=>window.testAudio.setMuted(false));
      await p.waitForTimeout(100);check(await played()===before+1,'Unmute does not replay same second');
      await p.evaluate(()=>window.testSeconds=3);
      await p.waitForFunction(()=>document.querySelector('#turn-countdown').classList.contains('urgent'));
      check(await played()===before+2,'Only current second on a time jump');
      await p.evaluate(()=>{document.querySelector('#power').value='10';document.querySelector('#power').dispatchEvent(new Event('input'));document.querySelector('#shoot').click();});
      await p.waitForFunction(()=>document.querySelector('#turn-countdown').hidden);
      check(await p.evaluate(()=>!window.testAudio.countdownVoice),'Shot stops warning voice');
      reports.push({viewport,peak,beeps:await played()});
    } finally {await ctx.close();}
  }
  if(errors.length)throw Error(errors.join('\n'));
  return {passed:true,reports,errors};
}
