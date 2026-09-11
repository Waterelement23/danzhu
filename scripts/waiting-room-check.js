async(page)=>{
 const base='http://localhost:5173/';
 const browser=page.context().browser();
 const contexts=[await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true})];
 const errors=[];const check=(v,m)=>{if(!v)throw Error(m);};
 async function open(ctx,url){const p=await ctx.newPage();await p.addInitScript(()=>{const Native=window.WebSocket;window.roomSockets=[];window.WebSocket=class extends Native {constructor(...args){super(...args);window.roomSockets.push(this);}};});p.on('pageerror',e=>errors.push(e.message));await p.goto(url);await p.locator('#scene[data-environment="ready"]').waitFor({timeout:90000});return p;}
 async function waiting(p){await p.locator('#ready').waitFor({state:'visible'});await p.waitForFunction(()=>!document.querySelector('#ready').disabled&&!document.querySelector('.entering-scene'));}
 try {
  let a=await open(contexts[0],base);await a.locator('#create').click();await waiting(a);
  const invite=await a.evaluate(()=>location.href);
  let b=await open(contexts[1],invite);await waiting(b);
  const oldToken=await b.evaluate(()=>sessionStorage.getItem('danzhu-reconnect'));
  await b.evaluate(()=>window.roomSockets.filter(s=>s.readyState===1).at(-1).close(1000));
  await b.waitForFunction(old=>sessionStorage.getItem('danzhu-reconnect')!==old && document.querySelector('#connection').textContent==='已连接房间',oldToken);
  await waiting(b);
  await b.evaluate(()=>document.querySelector('#leave').click());
  await a.waitForFunction(()=>document.querySelector('#player1').title.includes('等待连接'));
  await b.goto(invite);await waiting(b);
  check(await a.locator('#ready').isVisible(),'Explicit leave/rejoin does not start game');
  await b.close();
  await a.waitForFunction(()=>document.querySelector('#player1').title.includes('等待连接'));
  b=await open(contexts[1],invite);await waiting(b);
  check(await b.locator('#toast').isHidden(),'Closed guest rejoins without error');
  await a.close();
  await b.waitForFunction(()=>document.querySelector('#player0').title.includes('等待连接'));
  a=await open(contexts[0],invite);await waiting(a);
  check(await a.locator('#toast').isHidden(),'Closed host rejoins without error');
  await a.locator('#ready').click();await b.locator('#ready').click();
  await a.waitForFunction(()=>document.querySelector('#ready').hidden);
  check(errors.length===0,errors.join('\n'));
  return {passed:true,checks:['waiting-room network recovery rejoins with a new token','explicit leave and same invitation rejoin','closed guest immediately frees seat','closed host immediately frees seat','new guests must ready before start'],errors};
 } finally {for(const ctx of contexts)await ctx.close();}
}
