import './style.css';
import { MarbleScene } from './scene';
import { CONFIG, SERVE_RANGE, MAP_VERSION, PROTOCOL_VERSION } from '../shared/map';
import type { GameSnapshot, Presence, Shot, Result } from '../shared/types';
import { practice, online, hasSession, type GameTransport, type Hooks } from './transport';
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const marbleIcon =
  '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 30C30 32 7 6 31 8M5 21C18 28 22 13 35 18" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
$('app').innerHTML = `
<header class="site-header"><a class="brand" href="/">${marbleIcon}<span>弹珠<small>MARBLE CLUB</small></span></a><nav><span class="edition">童年游乐计划 · 001</span><button id="rules-open" class="text-button">玩法说明 <span>↗</span></button></nav></header>
<main>
 <section class="intro"><div><p class="eyebrow"><span></span> 一颗玻璃珠，一整个下午</p><h1>再玩一个下午<span>。</span></h1><p class="intro-copy">圈一块地，约一个朋友。把童年的手感，弹回来。</p></div>   <section id="lobby" class="panel lobby"><span class="section-number">01 — LET’S PLAY</span><h2>约一场弹珠</h2><p class="muted">不用下载，不用注册。<br>一个房间码，就能一起玩。</p><button id="create" class="primary">创建双人房间 <span>↗</span></button><div class="join-label">朋友已经开好房间？</div><form id="join-form" class="join-form"><input id="room-code" aria-label="房间码" autocomplete="off" maxlength="8" placeholder="输入 8 位房间码"/><button id="join" type="submit" aria-label="加入房间">→</button></form><div class="divider"><span>也可以先找找手感</span></div><button id="practice" class="secondary">本机双人练习 <span>↗</span></button><button id="resume" class="text-button resume" hidden>恢复上一局连接 →</button></section></section>
   <section id="controls" class="panel controls" hidden><div class="control-heading"><span id="turn-eyebrow" class="section-number">轮到你了</span><span id="timer" class="timer">30s</span></div><h2 id="turn-title">准备入场</h2><p id="turn-description" class="muted">从发球线弹入第一颗球。</p><div id="room-share" class="room-share" hidden><small>房间码 · 发给朋友</small><button id="copy-code" aria-label="复制房间码"></button></div><button id="ready" class="primary" hidden>我准备好了 <span>✓</span></button><div id="serve-control"><label for="serve-position">发球位置 <span id="serve-value">中间</span></label><input id="serve-position" type="range" min="-900" max="900" value="0"/><div class="range-captions"><span>左侧</span><span>沿发球线移动</span><span>右侧</span></div></div><div class="power-display"><label>击球力度 <span id="power-text">25%</span></label><div class="power-track"><i id="power-bar"></i></div><p>按住自己的弹珠，向后拖动蓄力<br>松手弹出 · Esc 取消</p></div><details id="fine-aim"><summary>精细瞄准 <span>＋</span></summary><div class="fine-settings"><label for="angle">方向 <span id="angle-value">0°</span></label><input id="angle" type="range" min="-180" max="180" value="0"/><label for="power">力度</label><input id="power" type="range" min="1" max="100" value="25"/><button id="shoot" class="secondary">按当前方向弹出 →</button></div></details><div class="shrink-info"><span>◎</span><span id="shrink-label">前 3 轮不缩圈</span></div><button id="leave" class="text-button leave">← 返回大厅</button></section>
 <div class="game-layout">
  <section class="board-card" aria-label="弹珠场地">
   <div class="board-top"><div><span class="terrain-dot"></span><strong>老院子的土地</strong><span class="board-meta">缓坡 · 石块 · 真实弹跳</span></div><div class="players" id="players"><div id="player0" class="player blue"><i></i><span id="name0">PLAYER 01</span></div><div class="versus">VS</div><div id="player1" class="player amber"><i></i><span id="name1">PLAYER 02</span></div></div><span id="mode-tag" class="mode-tag">练习 / 1V1 联网</span></div>

   <div id="scene" class="scene"></div>
   <div class="board-note"><span class="note-line"></span><span id="board-hint">从发球线开始，落点由你决定。</span></div>
   <div class="board-bottom"><span><i class="live-dot"></i><span id="connection">准备好，把第一颗球弹出去。</span></span><span id="round-label">01 / 土地场</span></div>
   <div id="result" class="result-overlay" role="status" aria-live="polite" hidden><div class="result-card"><span class="eyebrow">这一局，记住了</span><div id="result-ball" class="result-ball"></div><h2 id="result-title"></h2><p id="result-reason"></p><button id="rematch" class="primary">再来一局 <span>↗</span></button><button id="result-home" class="text-button">回到院子</button></div></div>
  </section>

 </div>
 <footer><span>玻璃里藏着的，是整个夏天。</span><span>GROUND RULES. GOOD TIMES.</span></footer>
</main>
<div id="toast" class="toast" role="status" hidden></div>
<dialog id="rules"><button id="rules-close" class="dialog-close" aria-label="关闭说明">×</button><p class="eyebrow">HOW TO PLAY</p><h2>还是小时候的规则。</h2><ol><li><strong>先手高位发球。</strong>从发球线上方弹入，落地后可能弹跳，等球停稳。</li><li><strong>后手贴地入场。</strong>可以直接瞄准先手的弹珠，命中就赢。</li><li><strong>之后原地轮流弹。</strong>拖住自己的球向后拉，松手发射；也可展开精细瞄准。</li><li><strong>哪个先发生，就按哪个判。</strong>先命中获胜，先出界失败。飞过对方头顶不算击中。</li><li><strong>边界看球心。</strong>空中越线也算出界。第 4 轮起双方各弹一次后缩圈；两球同时被圈外淘汰为平局。</li></ol><p class="muted">每次瞄准 30 秒；发球超时直接判负，普通回合连续两次超时判负。第 20 轮仍未分胜负为平局。联网断线保留席位 30 秒。</p></dialog>`;
let snapshot: GameSnapshot = {
  mapVersion: MAP_VERSION,
  protocolVersion: PROTOCOL_VERSION,
  match: 0,
  turn: 1,
  round: 1,
  active: 0,
  first: 0,
  phase: 'aiming',
  served: [false, false],
  balls: [],
  boundary: CONFIG.half,
  nextBoundary: CONFIG.half,
  secondsLeft: 30,
  time: 0,
  result: null,
};
let presence: Presence | null = null,
  transport: GameTransport | null = null,
  mode: 'lobby' | 'practice' | 'online' = 'lobby',
  connected = true,
  pending = false,
  loading = false;
let serveX = 0,
  power = 0.25,
  direction = { x: 0, z: -1 },
  lastTurn = '',
  toastTimer: ReturnType<typeof setTimeout>,
  pendingTimer: ReturnType<typeof setTimeout>;
let scene: MarbleScene;
try {
  scene = new MarbleScene($('scene'), (d, p, x) => sendShot(d, p, x));
} catch (error) {
  $('scene').innerHTML =
    '<p class="webgl-error">当前浏览器无法创建 3D 场景，请开启硬件加速后重试。</p>';
  throw error;
}
scene.update(snapshot, false);
function notify(message: string) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($('toast').hidden = true), 4500);
}
function canAct() {
  return (
    mode !== 'lobby' &&
    connected &&
    !pending &&
    snapshot.phase === 'aiming' &&
    (mode === 'practice' ||
      (!!presence?.started &&
        presence.connected.every(Boolean) &&
        presence.player === snapshot.active))
  );
}
function updatePower(p: number) {
  power = p;
  $('power-text').textContent = `${Math.round(p * 100)}%`;
  $('power-bar').style.width = `${p * 100}%`;
  $<HTMLInputElement>('power').value = String(Math.round(p * 100));
}
scene.onPower = updatePower;
scene.onAim = (d, p) => {
  direction = d;
  updatePower(p);
};
function sendShot(d = direction, p = power, x = serveX) {
  if (!canAct() || !transport) return;
  pending = true;
  scene.clearAim();
  const shot: Shot = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    match: snapshot.match,
    turn: snapshot.turn,
    direction: d,
    power: p,
    serveX: x,
  };
  clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => {
    pending = false;
    refresh();
  }, 4000);
  transport.shoot(shot);
  refresh();
}
const hooks: Hooks = {
  snapshot(s) {
    snapshot = s;
    const turn = `${s.match}:${s.turn}`;
    if (turn !== lastTurn) {
      lastTurn = turn;
      serveX = 0;
      $<HTMLInputElement>('serve-position').value = '0';
      $('serve-value').textContent = '中间';
      scene.setServeX(0);
      direction = { x: 0, z: -1 };
      $<HTMLInputElement>('angle').value = '0';
      $('angle-value').textContent = '0°';
      updatePower(0.25);
      pending = false;
    }
    refresh();
  },
  presence(p) {
    presence = p;
    refresh();
  },
  error: notify,
  connection(text, ok) {
    connected = ok;
    $('connection').textContent = text;
    refresh();
  },
  action() {
    pending = false;
    clearTimeout(pendingTimer);
    refresh();
  },
};
function refresh() {
  const isLobby = mode === 'lobby',
    onlineMode = mode === 'online',
    isServing = !snapshot.served[snapshot.active],
    isFirst = isServing && snapshot.active === snapshot.first;
  $('lobby').hidden = !isLobby;
  $('controls').hidden = isLobby;
  $('mode-tag').textContent = isLobby
    ? '练习 / 1V1 联网'
    : onlineMode
      ? '1V1 联网对战'
      : '本机双人练习';
  $('round-label').textContent = isLobby
    ? '01 / 土地场'
    : `第 ${String(snapshot.round).padStart(2, '0')} 轮 · 土地场`;
  for (const p of [0, 1] as const) {
    $('player' + p).classList.toggle('active', !isLobby && snapshot.active === p);
    const name = `PLAYER 0${p + 1}` + (onlineMode && presence?.player === p ? ' · 你' : '');
    const status = isLobby
      ? ''
      : onlineMode && !presence?.connected[p]
        ? '等待连接'
        : snapshot.active === p
          ? '当前回合'
          : '等待回合';
    $('name' + p).textContent = name;
    $('player' + p).title = status;
    $('player' + p).setAttribute('aria-label', [name, status].filter(Boolean).join('，'));
  }
  $('timer').textContent =
    snapshot.phase === 'finished'
      ? '已结束'
      : snapshot.phase === 'moving'
        ? '滚动中'
        : `${Math.ceil(snapshot.secondsLeft)}s`;
  $('turn-eyebrow').textContent = onlineMode ? 'ONLINE DUEL' : 'LOCAL PRACTICE';
  let title = isFirst ? '站着，弹第一颗。' : isServing ? '贴地，瞄准入场。' : '看准，再弹一下。';
  let description = isFirst
    ? '从高处弹入，落地反弹后停稳。先选好你的发球位置。'
    : isServing
      ? '从发球线贴地弹入，可以直接击中对方获胜。'
      : '从弹珠停留的地方出手。地形会改变它的方向和速度。';
  if (snapshot.phase === 'finished') {
    title = '这一击，尘埃落定。';
    description = '胜负已确定，继续看完弹珠的运动。';
  } else if (!connected) {
    title = '等待恢复连接';
    description = '正在尝试恢复原来的席位，请稍候。';
  } else if (onlineMode && !presence?.started) {
    title = presence?.connected.every(Boolean) ? '人齐了，准备开局。' : '等一个老朋友。';
    description = '把下面的房间码发给朋友，双方准备后开始。';
  } else if (onlineMode && !presence?.connected.every(Boolean)) {
    title = '对方暂时掉线';
    description = '保留席位 30 秒；当前击球会完成，之后暂停操作。';
  } else if (snapshot.phase === 'moving') {
    title = '让它再滚一会儿。';
    description = '这一击已经出手。等所有弹珠停稳，再交换回合。';
  } else if (snapshot.phase === 'shrinking') {
    title = '场地正在缩小';
    description = '新的边界生效后继续。留意场地里的虚线。';
  } else if (onlineMode && presence?.player !== snapshot.active) {
    title = '轮到对方出手';
    description = '观察对方的落点，为下一击做准备。';
  }
  $('turn-title').textContent = title;
  $('turn-description').textContent = description;
  $('room-share').hidden = !onlineMode;
  $('copy-code').textContent = presence?.code ?? '连接中';
  $('ready').hidden = !onlineMode || !!presence?.started;
  $<HTMLButtonElement>('ready').disabled = !connected || !!presence?.ready[presence.player];
  $('ready').innerHTML = presence?.ready[presence.player]
    ? '已准备 · 等待对方'
    : '我准备好了 <span>✓</span>';
  $('serve-control').hidden = !isServing || !canAct();
  $('power-text').parentElement!.parentElement!.classList.toggle('disabled', !canAct());
  for (const id of ['angle', 'power', 'shoot', 'serve-position'])
    $<HTMLInputElement>(id).disabled = !canAct();
  $('shrink-label').textContent =
    snapshot.round < 4
      ? `距离首次缩圈还有 ${4 - snapshot.round} 轮`
      : `本轮结束后边长 ${Math.round(snapshot.nextBoundary * 200)} cm`;
  $('board-hint').textContent = isLobby
    ? '从发球线开始，落点由你决定。'
    : snapshot.phase === 'moving'
      ? '弹跳、滚动，每一步都有物理的答案。'
      : canAct()
        ? isFirst
          ? '先手高位发球 · 拉住空中的弹珠向后拖动'
          : '按住自己的弹珠，向后拖动，松手弹出'
        : '看看地形，想好下一步。';
  scene.update(snapshot, canAct());
  if (canAct()) scene.setAim(direction, power);
  updateResult();
}
const reasons: Record<Result['reason'], string> = {
  hit: '先碰到对方的弹珠，这一击赢了。',
  out: '弹珠的球心先越过了场地边界。',
  shrink: '新边界生效，圈外的弹珠被淘汰。',
  timeout: '超过了出手时间。',
  draw: '这一局平分秋色，再来一次。',
  physics: '物理模拟未能正常结束，本局不计胜负。',
  disconnect: '对方离开了房间或重连超时。',
  serve: '发球未能进入场地。',
};
function updateResult() {
  const r = snapshot.result;
  const shown = mode !== 'lobby' && !!r && scene.presentationTime >= r.time + 3;
  $('result').hidden = !shown;
  if (!r || !shown) return;
  $('result-title').textContent =
    r.winner === null ? '这局，算平手。' : `${r.winner === 0 ? '蓝色' : '琥珀'}弹珠获胜！`;
  $('result-reason').textContent = reasons[r.reason];
  $('result-ball').className = 'result-ball ' + (r.winner === 1 ? 'gold' : '');
  const wait = mode === 'online' && presence?.rematch[presence.player];
  $('rematch').textContent = wait ? '已邀请 · 等待对方' : '再来一局 ↗';
  $<HTMLButtonElement>('rematch').disabled =
    !!wait || (mode === 'online' && !presence?.connected.every(Boolean));
}
let sessionGeneration = 0;
async function start(kind: 'practice' | 'create' | 'join' | 'resume') {
  if (loading) return;
  const code = $<HTMLInputElement>('room-code').value.trim();
  if (kind === 'join' && !/^[A-Fa-f0-9]{8}$/.test(code)) {
    notify('请输入 8 位房间码');
    return;
  }
  loading = true;
  const generation = ++sessionGeneration;
  const current = () => generation === sessionGeneration;
  const scoped: Hooks = {
    snapshot: (s) => {
      if (current()) hooks.snapshot(s);
    },
    presence: (p) => {
      if (current()) hooks.presence(p);
    },
    error: (t) => {
      if (current()) hooks.error(t);
    },
    connection: (t, c) => {
      if (current()) hooks.connection(t, c);
    },
    action: () => {
      if (current()) hooks.action();
    },
  };
  for (const id of ['create', 'practice', 'join', 'resume'])
    $<HTMLButtonElement>(id).disabled = true;
  mode = kind === 'practice' ? 'practice' : 'online';
  presence = null;
  connected = true;
  lastTurn = '';
  try {
    const created =
      kind === 'practice' ? await practice(scoped) : await online(scoped, kind, code, current);
    if (!current()) {
      created.dispose();
      return;
    }
    transport = created;
    refresh();
  } catch (error) {
    if (!current()) return;
    mode = 'lobby';
    presence = null;
    notify(
      kind === 'resume'
        ? '上一局已结束，重新开一局吧。'
        : `暂时无法连接房间：${error instanceof Error ? error.message : '请检查服务是否启动'}`,
    );
    refresh();
  } finally {
    if (current()) {
      loading = false;
      for (const id of ['create', 'practice', 'join', 'resume'])
        $<HTMLButtonElement>(id).disabled = false;
      $('resume').hidden = !hasSession();
    }
  }
}
function home() {
  sessionGeneration++;
  loading = false;
  for (const id of ['create', 'practice', 'join', 'resume'])
    $<HTMLButtonElement>(id).disabled = false;
  transport?.dispose();
  transport = null;
  mode = 'lobby';
  presence = null;
  pending = false;
  clearTimeout(pendingTimer);
  snapshot = {
    mapVersion: MAP_VERSION,
    protocolVersion: PROTOCOL_VERSION,
    match: 0,
    turn: 1,
    round: 1,
    active: 0,
    first: 0,
    phase: 'aiming',
    served: [false, false],
    balls: [],
    boundary: CONFIG.half,
    nextBoundary: CONFIG.half,
    secondsLeft: 30,
    time: 0,
    result: null,
  };
  $('connection').textContent = '准备好，把第一颗球弹出去。';
  $('resume').hidden = !hasSession();
  refresh();
}
$('practice').onclick = () => void start('practice');
$('create').onclick = () => void start('create');
$('resume').onclick = () => void start('resume');
$('join-form').onsubmit = (e) => {
  e.preventDefault();
  void start('join');
};
$('ready').onclick = () => transport?.ready();
$('leave').onclick = home;
$('result-home').onclick = home;
$('rematch').onclick = () => transport?.rematch();
$('copy-code').onclick = () => {
  if (presence)
    void navigator.clipboard
      ?.writeText(presence.code)
      .then(() => notify('房间码已复制'))
      .catch(() => notify(`房间码：${presence!.code}`));
};
$('serve-position').oninput = () => {
  serveX = Number($<HTMLInputElement>('serve-position').value) / 1000;
  serveX = Math.max(-SERVE_RANGE, Math.min(SERVE_RANGE, serveX));
  $('serve-value').textContent =
    serveX === 0 ? '中间' : `${serveX < 0 ? '左' : '右'} ${Math.round(Math.abs(serveX) * 100)} cm`;
  scene.setServeX(serveX);
};
function fineAim() {
  const degrees = Number($<HTMLInputElement>('angle').value);
  direction = { x: Math.sin((degrees * Math.PI) / 180), z: -Math.cos((degrees * Math.PI) / 180) };
  $('angle-value').textContent = `${degrees}°`;
  updatePower(Number($<HTMLInputElement>('power').value) / 100);
  if (canAct()) scene.setAim(direction, power);
}
$('angle').oninput = fineAim;
$('power').oninput = fineAim;
$('shoot').onclick = () => sendShot();
$('rules-open').onclick = () => $<HTMLDialogElement>('rules').showModal();
$('rules-close').onclick = () => $<HTMLDialogElement>('rules').close();
$('rules').onclick = (e) => {
  if (e.target === $('rules')) $<HTMLDialogElement>('rules').close();
};
$('resume').hidden = !hasSession();
let previous = performance.now();
function animate(now: number) {
  const dt = Math.min((now - previous) / 1000, 0.1);
  previous = now;
  transport?.tick(dt);
  scene.render(dt);
  updateResult();
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
window.addEventListener('pagehide', (event) => {
  if (!event.persisted) scene.dispose();
});
