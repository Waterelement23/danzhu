async (page) => {
  const browser=page.context().browser(), reports=[], errors=[];
  for(const viewport of [{width:390,height:844},{width:844,height:390}]) {
    const ctx=await browser.newContext({viewport,deviceScaleFactor:3,isMobile:true,hasTouch:true});
    const p=await ctx.newPage();
    try {
      p.on('pageerror',e=>errors.push(e.message));
      await p.goto('http://localhost:5173/');
      await p.locator('#scene[data-environment="ready"]').waitFor({timeout:60000});
      await p.evaluate(async()=>{
        const url=performance.getEntriesByType('resource').find(r=>r.name.includes('/src/client/scene.ts')).name;
        const {MarbleScene}=await import(url), render=MarbleScene.prototype.render;
        MarbleScene.prototype.render=function(dt){window.cameraTest=this;return render.call(this,dt);};
      });
      await p.waitForFunction(()=>!!window.cameraTest);
      await p.locator('#practice').click();
      await p.waitForFunction(()=>window.cameraTest.canAct);
      await p.evaluate(()=>{const s=window.cameraTest,shoot=s.onShoot;window.testShots=[];s.onShoot=(...args)=>{window.testShots.push(args);shoot(...args);};});
      const check=(v,m)=>{if(!v)throw Error(m);};
      const state=()=>p.evaluate(()=>({shots:window.testShots.length,power:window.cameraTest.power,drag:window.cameraTest.dragging,turn:window.cameraTest.snapshot.turn}));
      const box=await p.locator('#scene canvas').boundingBox();
      check(box.height>viewport.height-100,'Full height scene');check(box.width>=viewport.width-2,'Full width scene');
      check(await p.locator('#aim-pad').count()===0,'No dedicated pad');
      check(await p.locator('#drag-hint').isVisible(),'Initial hint');
      await p.screenshot({path:`/tmp/danzhu-direct-serve-${viewport.width}.png`});
      const cdp=await ctx.newCDPSession(p), x=Math.round(box.x+box.width*.27),y=Math.round(box.y+box.height*.45);
      const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y,id=0])=>({x,y,id}))});
      await touch('touchStart',[[x,y]]);await touch('touchEnd',[]);
      check((await state()).shots===0,'Tap must not shoot');
      await touch('touchStart',[[x,y]]);await touch('touchMove',[[x,y+45]]);
      check((await state()).power>.1,'Blank scene starts aiming');
      check(await p.locator('#mobile-cancel').isVisible(),'Cancel while aiming');
      await touch('touchMove',[[x,y]]);await touch('touchEnd',[]);
      check((await state()).shots===0,'Return to origin cancels');
      await touch('touchStart',[[x,y]]);await touch('touchMove',[[x,y+45]]);
      await touch('touchStart',[[x,y+45],[x+60,y,1]]);await touch('touchEnd',[]);
      check(!(await state()).drag&&(await state()).shots===0,'Second finger cancels');
      await touch('touchStart',[[x,y]]);await touch('touchMove',[[x,y+45]]);await touch('touchCancel',[]);
      check(!(await state()).drag&&(await state()).shots===0,'System cancel');
      await p.locator('#mobile-menu summary').tap();await p.locator('#mobile-sound').tap();
      check((await state()).shots===0&&!(await state()).drag,'Menu isolated');
      await p.locator('#mobile-menu summary').tap();
      await p.locator('#serve-position').evaluate(e=>{e.value='-800';e.dispatchEvent(new Event('input',{bubbles:true}));});
      await touch('touchStart',[[x,y]]);await touch('touchMove',[[x,y+14]]);await touch('touchEnd',[]);
      await p.waitForFunction(()=>window.cameraTest.snapshot.turn===2&&window.cameraTest.canAct,null,{timeout:30000});
      check((await state()).shots===1,'Valid drag fires');
      check(await p.locator('#drag-hint').isHidden(),'Successful shot dismisses hint');
      await p.locator('#serve-position').evaluate(e=>{e.value='800';e.dispatchEvent(new Event('input',{bubbles:true}));});
      await touch('touchStart',[[x,y]]);await touch('touchMove',[[x,y+14]]);await touch('touchEnd',[]);
      await p.waitForFunction(()=>window.cameraTest.snapshot.turn===3&&window.cameraTest.canAct,null,{timeout:30000});
      await p.waitForTimeout(700);
      check(await p.locator('#view-toggle').getAttribute('aria-pressed')==='true','Auto view after entries');
      const render=await p.evaluate(()=>{const s=window.cameraTest,c=s.renderer.domElement;return {width:c.width,height:c.height,fps:s.quality.fps,idle:s.quality.idleFps,ratio:s.renderer.getPixelRatio()};});
      check(render.width*render.height<=900000,'Mobile pixel budget');
      check(render.fps===30&&render.idle===15,'Frame budget');
      await p.screenshot({path:`/tmp/danzhu-direct-${viewport.width}.png`});
      const yaw=await p.evaluate(()=>window.cameraTest.viewYaw);
      await touch('touchStart',[[x,y]]);await touch('touchMove',[[x,y+45]]);
      const aim=await p.evaluate(()=>({yaw:window.cameraTest.viewYaw,d:window.cameraTest.aimDirection}));
      check(Math.abs(aim.yaw-yaw)<.001&&Math.abs(aim.d.x+Math.sin(yaw))<.001,'Camera-relative touch');
      await touch('touchCancel',[]);
      reports.push({viewport,scene:box,render,shots:(await state()).shots});
    } finally {await ctx.close();}
  }
  if(errors.length)throw Error(errors.join('\n'));
  return {passed:true,reports,errors};
}
