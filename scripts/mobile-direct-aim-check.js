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
      const touch=async(type,points)=>{await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y,id=0])=>({x,y,id}))});await p.waitForTimeout(60);};
      async function chooseServe(wanted) {
        const point=await p.evaluate(wanted=>{
          const s=window.cameraTest,r=s.renderer.domElement.getBoundingClientRect();
          const points=s.serveLine.samples, a=points.reduce((a,b)=>Math.abs(b.worldX-wanted)<Math.abs(a.worldX-wanted)?b:a);
          return {x:r.x+a.x,y:r.y+a.y,worldX:a.worldX};
        },wanted);
        await p.touchscreen.tap(point.x,point.y);
        return point;
      }

      check(await p.locator('#serve-position').count()===0,'No serve slider');
      check(await p.locator('#mobile-serve').isHidden(),'No empty bottom panel');
      const line=await p.evaluate(()=>{const s=window.cameraTest,r=s.renderer.domElement.getBoundingClientRect();return s.serveLine.samples.map(v=>({...v,x:v.x+r.x,y:v.y+r.y}));});
      const left=line[0],right=line[line.length-1],middle=line[8];
      await touch('touchStart',[[left.x,left.y]]);
      check(await p.evaluate(()=>window.cameraTest.serveX===0&&window.cameraTest.power===0),'Selection waits for release');
      check(await p.locator('#drag-feedback').isHidden(),'Selection does not start charge');
      await touch('touchEnd',[]);
      check(Math.abs(await p.evaluate(()=>window.cameraTest.serveX)-left.worldX)<.001,'Left endpoint');
      await p.touchscreen.tap(right.x+12,right.y);
      check(Math.abs(await p.evaluate(()=>window.cameraTest.serveX)-right.worldX)<.001,'Endpoint touch tolerance');
      await touch('touchStart',[[left.x,left.y]]);await touch('touchMove',[[left.x,left.y-25]]);
      check(Math.abs(await p.evaluate(()=>window.cameraTest.serveX)-right.worldX)<.001,'Drag locks serve point');
      await touch('touchMove',[[left.x,left.y]]);await touch('touchEnd',[]);
      check(Math.abs(await p.evaluate(()=>window.cameraTest.serveX)-right.worldX)<.001,'Returning drag is not a tap');
      await touch('touchStart',[[left.x,left.y]]);await touch('touchStart',[[left.x,left.y],[left.x+40,left.y-30,1]]);await touch('touchEnd',[]);
      check(Math.abs(await p.evaluate(()=>window.cameraTest.serveX)-right.worldX)<.001,'Second finger discards selection');
      await p.touchscreen.tap(middle.x,middle.y);
      await p.waitForTimeout(100);
      await p.screenshot({path:`/tmp/danzhu-serve-line-${viewport.width}.png`});
      await touch('touchStart',[[x,y]]);await touch('touchEnd',[]);
      check(Math.abs(await p.evaluate(()=>window.cameraTest.serveX))<.001,'Field tap does not move the serve');

      check((await state()).shots===0,'Tap must not shoot');
      await touch('touchStart',[[x,y]]);await touch('touchMove',[[x,y+45]]);
      check((await state()).power>.1,'Blank scene starts aiming');
      check(await p.locator('#mobile-cancel').count()===0,'No unreachable cancel button');
      check(await p.locator('#drag-origin').isVisible(),'Visible gesture origin');
      const bubble=await p.locator('#drag-feedback').boundingBox();
      check(Math.abs(bubble.y-(y+45))<100,'Feedback follows finger');
      await touch('touchMove',[[x,y+12]]);
      check((await state()).power===0,'Return zone zeros power');
      check(await p.locator('#drag-feedback.is-cancelling').isVisible(),'Cancellation feedback');
      check(await p.evaluate(()=>!window.cameraTest.aim.visible),'No arrow when cancelling');
      await touch('touchMove',[[x,y+20]]);
      check((await state()).power===0,'Hysteresis preserves cancellation');
      await p.screenshot({path:`/tmp/danzhu-cancel-${viewport.width}.png`});
      await touch('touchMove',[[x,y+24]]);
      check((await state()).power>0,'Pull away restores charge');
      check(await p.locator('#drag-feedback.is-cancelling').count()===0,'Feedback restored');
      await touch('touchMove',[[x,y]]);await touch('touchEnd',[]);
      check((await state()).shots===0,'Return to origin cancels');
      check(await p.locator('#drag-origin').isHidden(),'Feedback cleared');
      await touch('touchStart',[[x,y]]);await touch('touchMove',[[x,y+45]]);
      await p.evaluate(({x,y})=>{const s=window.cameraTest;s.renderer.domElement.dispatchEvent(new PointerEvent('pointerup',{pointerId:s.pointerId,pointerType:'touch',clientX:x,clientY:y+12,bubbles:true}));},{x,y});
      await touch('touchEnd',[]);
      check((await state()).shots===0,'Release coordinates checked without final move');

      await touch('touchStart',[[x,y]]);await touch('touchMove',[[x,y+45]]);
      await touch('touchStart',[[x,y+45],[x+60,y,1]]);await touch('touchEnd',[]);
      check(!(await state()).drag&&(await state()).shots===0,'Second finger cancels');
      await touch('touchStart',[[x,y]]);await touch('touchMove',[[x,y+45]]);await touch('touchCancel',[]);
      check(!(await state()).drag&&(await state()).shots===0,'System cancel');
      await p.locator('#mobile-menu summary').tap();await p.locator('#mobile-sound').tap();
      check((await state()).shots===0&&!(await state()).drag,'Menu isolated');
      await p.locator('#mobile-menu summary').tap();
      const firstPoint=await chooseServe(-.8);
      await touch('touchStart',[[x,y]]);await touch('touchMove',[[x,y+14]]);await touch('touchEnd',[]);
      await p.waitForFunction(()=>window.cameraTest.snapshot.turn===2&&window.cameraTest.canAct,null,{timeout:30000});
      check((await state()).shots===1,'Valid drag fires');
      check(Math.abs(await p.evaluate(()=>window.testShots[0][2])-firstPoint.worldX)<.001,'Selected serve reaches shot');
      check(await p.locator('#drag-hint').isHidden(),'Successful shot dismisses hint');
      await chooseServe(.8);
      await touch('touchStart',[[x,y]]);await touch('touchMove',[[x,y+14]]);await touch('touchEnd',[]);
      await p.waitForFunction(()=>window.cameraTest.snapshot.turn===3&&window.cameraTest.canAct,null,{timeout:30000});
      await p.waitForTimeout(700);
      check(await p.locator('#view-toggle').getAttribute('aria-pressed')==='true','Auto view after entries');
      check(await p.locator('.serve-line').isHidden(),'Line selection ends after entry');
      const render=await p.evaluate(()=>{const s=window.cameraTest,c=s.renderer.domElement;return {width:c.width,height:c.height,fps:s.quality.fps,idle:s.quality.idleFps,ratio:s.renderer.getPixelRatio()};});
      check(render.width*render.height<=900000,'Mobile pixel budget');
      check(render.fps===30&&render.idle===15,'Frame budget');
      await p.screenshot({path:`/tmp/danzhu-direct-${viewport.width}.png`});
      const yaw=await p.evaluate(()=>window.cameraTest.viewYaw);
      await touch('touchStart',[[x,y]]);await touch('touchMove',[[x,y+45]]);
      const aim=await p.evaluate(()=>({yaw:window.cameraTest.viewYaw,d:window.cameraTest.aimDirection}));
      check(Math.abs(aim.yaw-yaw)<.001&&Math.abs(aim.d.x+Math.sin(yaw))<.001,'Camera-relative touch');
      await touch('touchMove',[[x,y+12]]);
      await touch('touchMove',[[x,y+24]]);
      await touch('touchEnd',[]);
      check((await state()).shots===3,'Restored charge fires exactly once');
      reports.push({viewport,scene:box,render,shots:(await state()).shots});
    } finally {await ctx.close();}
  }
  if(errors.length)throw Error(errors.join('\n'));
  return {passed:true,reports,errors};
}
