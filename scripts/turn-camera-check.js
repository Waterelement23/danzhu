async (page) => {
  const ctx=await page.context().browser().newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
  const peers=[await ctx.newPage(),await ctx.newPage()], errors=[];
  const check=(ok,msg)=>{if(!ok)throw Error(msg);};
  async function open(p,url){
    p.on('pageerror',e=>errors.push(e.message));
    await p.goto(url); await p.locator('#scene[data-environment="ready"]').waitFor({timeout:60000});
    await p.evaluate(async()=>{
      const url=performance.getEntriesByType('resource').find(r=>r.name.includes('/src/client/scene.ts')).name;
      const {MarbleScene}=await import(url), render=MarbleScene.prototype.render;
      MarbleScene.prototype.render=function(dt){window.cameraTest=this;return render.call(this,dt);};
    });
    await p.waitForFunction(()=>!!window.cameraTest);
  }
  const state=p=>p.evaluate(()=>{const s=window.cameraTest;return {yaw:s.viewYaw,mode:s.turnView.mode,blocked:s.viewBlocked,phase:s.snapshot.phase,turn:s.snapshot.turn,player:s.viewPlayer,active:s.snapshot.active,zoomed:s.zoomed};});
  try{
    await open(peers[0],'http://localhost:5173/'); await peers[0].locator('#create').click();
    await peers[0].waitForFunction(()=>!!sessionStorage.getItem('danzhu-room'));
    const code=await peers[0].evaluate(()=>sessionStorage.getItem('danzhu-room'));
    await open(peers[1],'http://localhost:5173/?room='+code);
    await peers[0].locator('#ready').click(); await peers[1].locator('#ready').click();
    for(const p of peers)await p.waitForFunction(()=>window.cameraTest.viewPlayer!==null);
    const initial=await state(peers[0]), first=initial.player===initial.active?peers[0]:peers[1], second=first===peers[0]?peers[1]:peers[0];
    for(const p of peers)check(Math.abs((await state(p)).yaw)<.001,'First serve orientation');
    await first.evaluate(()=>window.cameraTest.onShoot({x:0,z:-1},.12,-.8));
    await first.waitForFunction(()=>window.cameraTest.snapshot.turn===2&&window.cameraTest.snapshot.phase==='aiming',null,{timeout:30000});
    for(const p of peers)check(Math.abs((await state(p)).yaw)<.001,'Second serve orientation');
    await second.evaluate(()=>window.cameraTest.onShoot({x:0,z:-1},.12,.8));
    await first.waitForFunction(()=>window.cameraTest.snapshot.turn===3&&window.cameraTest.snapshot.phase==='aiming',null,{timeout:30000});
    await first.waitForTimeout(700);
    const aimed=await state(first),watching=await state(second);
    check(aimed.mode==='aim'&&aimed.zoomed&&!aimed.blocked,'Owner facing opponent');
    check(Math.abs(watching.yaw)<.001&&watching.mode==='overview','Observer overview');
    const points=await first.evaluate(()=>{const s=window.cameraTest;return [s.snapshot.active,1-s.snapshot.active].map(i=>s.balls[i].position.clone().project(s.camera));});
    check(points[0].y<points[1].y&&points.every(p=>Math.abs(p.x)<.03&&Math.abs(p.y)<.9),'Pair alignment and fit');
    await first.screenshot({path:'/tmp/danzhu-turn-camera-mobile.png'});
    await first.locator('#view-toggle').click();await first.waitForTimeout(700);
    check(Math.abs((await state(first)).yaw)<.001,'Manual overview');
    await first.locator('#view-toggle').click();await first.waitForTimeout(700);
    const box=await first.locator('#scene canvas').boundingBox(),x=box.x+box.width*.27,y=box.y+box.height*.45;
    const cdp=await ctx.newCDPSession(first);
    const touch=(type,dy=0)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y:y+dy,id:0}]});
    await touch('touchStart');await touch('touchMove',50);
    const held=await first.evaluate(()=>{const s=window.cameraTest;return {yaw:s.yaw,d:{...s.aimDirection},power:s.power};});
    await first.waitForTimeout(200);
    check(Math.abs((await state(first)).yaw-held.yaw)<.00001,'Gesture camera lock');
    check(Math.abs(held.d.x+Math.sin(held.yaw))<.001&&Math.abs(held.d.z+Math.cos(held.yaw))<.001,'Screen-relative shot');
    await first.keyboard.press('Escape');await touch('touchEnd');
    check(await first.evaluate(()=>window.cameraTest.power===0),'Cancel aim');
    await first.locator('#view-toggle').click();await first.waitForTimeout(700);
    await first.locator('#view-toggle').click();await first.waitForTimeout(100);
    await touch('touchStart');await touch('touchMove',14);
    const releaseYaw=(await state(first)).yaw;
    await touch('touchEnd');
    await first.waitForFunction(()=>window.cameraTest.snapshot.phase==='moving');
    const shot=await state(first);check(shot.mode==='shot'&&Math.abs(shot.yaw-releaseYaw)<.005,'Mid-transition shot keeps yaw');
    await first.waitForFunction(()=>window.cameraTest.snapshot.turn===4&&window.cameraTest.snapshot.phase==='aiming',null,{timeout:30000});
    await second.waitForTimeout(700);
    check((await state(second)).mode==='aim'&&(await state(first)).mode==='overview','Turn handoff');
    check(!errors.length,errors.join('\n'));
    return {passed:true,checks:['fixed serves','independent cameras','pair fit','manual overview','screen-relative drag','gesture lock','cancel','shot yaw hold','turn handoff'],aimed,watching};
  }finally{await ctx.close();}
}
