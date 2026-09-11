async(page)=>{
 const browser=page.context().browser(), errors=[],reports=[];
 const check=(v,m)=>{if(!v)throw Error(m);};
 for(const viewport of [{width:390,height:844},{width:844,height:390},{width:1440,height:1000}]) {
  const ctx=await browser.newContext({viewport,isMobile:viewport.width<1000,hasTouch:viewport.width<1000});
  const p=await ctx.newPage();
  try {
   p.on('pageerror',e=>errors.push(e.message));await p.goto('http://localhost:5173/');
   await p.locator('#scene[data-environment="ready"]').waitFor({timeout:60000});
   await p.evaluate(async()=>{window.originalCanvas=document.querySelector('#scene canvas');const url=performance.getEntriesByType('resource').find(r=>r.name.includes('/src/client/scene.ts')).name;const {MarbleScene}=await import(url),render=MarbleScene.prototype.render;MarbleScene.prototype.render=function(dt){window.sceneTest=this;return render.call(this,dt);};});
   await p.locator('#practice').click();await p.locator('.entering-scene').waitFor({state:'attached'});
   const motion=await p.locator('#scene').evaluate(e=>({animations:e.getAnimations().length,background:getComputedStyle(e).backgroundColor,pointers:getComputedStyle(e).pointerEvents}));
   check(motion.animations>0&&motion.pointers==='none','Live scene transition blocks accidental gestures');
   await p.waitForFunction(()=>!document.querySelector('.entering-scene'));
   const state=await p.evaluate(()=>{const s=window.sceneTest,d=s.camera.position.clone().sub(s.focus);return {sameCanvas:window.originalCanvas===s.renderer.domElement,tilt:Math.atan2(d.y,Math.hypot(d.x,d.z))*180/Math.PI,transform:getComputedStyle(document.querySelector('#scene')).transform};});
   check(state.sameCanvas&&state.transform==='none','Canvas preserved and transform cleaned');
   check(Math.abs(state.tilt-50)<.01,'Lowered serving perspective');
   await p.screenshot({path:`/tmp/danzhu-entry-${viewport.width}.png`});
   await p.evaluate(()=>document.querySelector('#leave').click());
   await p.locator('#create').click();await p.locator('.entering-scene').waitFor({state:'attached'});
   await p.waitForFunction(()=>!document.querySelector('.entering-scene'));
   await p.evaluate(()=>document.querySelector('#leave').click());
   await p.emulateMedia({reducedMotion:'reduce'});
   await p.locator('#practice').click();await p.waitForFunction(()=>document.querySelector('#mode-tag').textContent==='本机双人练习');
   check(await p.locator('.entering-scene').count()===0,'Reduced motion skips transition');
   reports.push({viewport,...state,motion});
  }finally{await ctx.close();}
 }
 if(errors.length)throw Error(errors.join('\n'));
 return {passed:true,reports,errors};
}
