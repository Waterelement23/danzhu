import './style.css';
import { FramePacer } from './render-budget';
import { invitationCode, invitationUrl, playerName, rematchView } from './match-ui';
import { GameAudio } from './audio';
import { MarbleScene } from './scene';
import type { DragFeedback } from './return-cancel';
import { CONFIG, MAP_VERSION, PROTOCOL_VERSION, nextTerrainSeed } from '../shared/map';
import type { GameSnapshot, Presence, Shot, Result } from '../shared/types';
import {
  practice,
  online,
  hasSession,
  sessionRoomCode,
  type GameTransport,
  type Hooks,
} from './transport';
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const marbleIcon =
  '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 30C30 32 7 6 31 8M5 21C18 28 22 13 35 18" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
$('app').innerHTML = `
<header class="site-header"><a class="brand" href="${import.meta.env.BASE_URL}">${marbleIcon}<span>弹珠<small>MARBLE CLUB</small></span></a><nav><span class="edition">童年游乐计划 · 001</span><div class="sound-controls"><button id="sound-toggle" class="text-button" aria-label="静音" aria-pressed="false">声音 开</button><input id="sound-volume" type="range" min="0" max="100" value="70" aria-label="音效音量" /></div><button id="rules-open" class="text-button">玩法说明 <span>↗</span></button></nav></header>
<main>
 <section class="intro"><div><p class="eyebrow"><span></span> 一颗玻璃珠，一整个下午</p><h1>再玩一个下午<span>。</span></h1><p class="intro-copy">圈一块地，约一个朋友。把童年的手感，弹回来。</p></div>   <div class="session-panels"><section id="lobby" class="panel lobby"><span class="section-number">01 — LET’S PLAY</span><h2>约一场弹珠</h2><p class="muted">不用下载，不用注册。<br>一个邀请链接，就能一起玩。</p><button id="create" class="primary">创建双人房间 <span>↗</span></button><div class="join-label">朋友已经开好房间？</div><form id="join-form" class="join-form"><input id="room-code" aria-label="房间码" autocomplete="off" maxlength="8" placeholder="输入 8 位房间码"/><button id="join" type="submit" aria-label="加入房间">→</button></form><div class="divider"><span>也可以先找找手感</span></div><button id="practice" class="secondary">本机双人练习 <span>↗</span></button><button id="resume" class="text-button resume" hidden>恢复上一局连接 →</button></section>
   <section id="controls" class="panel controls" hidden><div class="control-heading"><span id="turn-eyebrow" class="section-number">轮到你了</span><span id="timer" class="timer">30s</span></div><h2 id="turn-title">准备入场</h2><p id="turn-description" class="muted">从发球线弹入第一颗球。</p><div id="room-share" class="room-share" hidden><small>邀请朋友 · 打开链接直接加入</small><button id="copy-code" aria-label="复制邀请链接"></button></div><button id="ready" class="primary" hidden>我准备好了 <span>✓</span></button><div class="power-display"><label>击球力度 <span id="power-text">25%</span></label><div class="power-track"><i id="power-bar"></i></div><p>按住自己的弹珠，向后拖动蓄力<br>松手弹出 · Esc 取消</p></div><details id="fine-aim"><summary>精细瞄准 <span>＋</span></summary><div class="fine-settings"><label for="angle">方向 <span id="angle-value">0°</span></label><input id="angle" type="range" min="-180" max="180" value="0"/><label for="power">力度</label><input id="power" type="range" min="1" max="100" value="25"/><button id="shoot" class="secondary">按当前方向弹出 →</button></div></details><div class="shrink-info"><span>◎</span><span id="shrink-label">前 3 轮不缩圈</span></div><button id="leave" class="text-button leave">← 返回大厅</button></section></div></section>
 <div class="game-layout">
  <section class="board-card" aria-label="弹珠场地">
   <div class="board-top"><div><span class="terrain-dot"></span><strong>老院子的土地</strong><span class="board-meta">每局随机 · 起伏 · 石子</span></div><div class="players" id="players"><div id="player0" class="player blue"><i></i><span id="name0">PLAYER 01</span></div><div class="versus">VS</div><div id="player1" class="player amber"><i></i><span id="name1">PLAYER 02</span></div></div><span id="mode-tag" class="mode-tag">练习 / 1V1 联网</span></div>

   <div class="match-status" id="match-status" role="status" aria-live="polite" hidden></div>
   <div id="scene" class="scene"><button id="desktop-view-toggle" class="secondary camera-toggle" aria-pressed="false" hidden>出手视角</button><span id="camera-hint" class="camera-hint" role="status" hidden>当前方向有遮挡，已切回全景</span></div>
   <div id="mobile-play" class="mobile-play" hidden><div class="mobile-actions"><span id="mobile-timer" class="mobile-timer"></span><button id="view-toggle" class="secondary" aria-pressed="false" hidden>出手视角</button><details id="mobile-menu"><summary aria-label="游戏菜单">菜单</summary><div class="mobile-menu-items"><button id="mobile-sound" class="text-button" aria-label="切换音效">声音开</button><button id="mobile-help" class="text-button">操作提示</button><button id="mobile-leave" class="text-button">离开对局</button></div></details></div><div class="mobile-feedback"><span id="drag-hint" hidden>在场地内向后拖动，松手发射</span></div><div id="drag-origin" hidden><span></span></div><div id="drag-feedback" hidden><span id="drag-label"></span><div class="drag-power"><i id="drag-power"></i></div></div><div id="mobile-serve" hidden></div></div>
   <div class="board-note"><span class="note-line"></span><span id="board-hint">从发球线开始，落点由你决定。</span></div>
   <div class="board-bottom"><span><i class="live-dot"></i><span id="connection">准备好，把第一颗球弹出去。</span></span><span id="round-label">01 / 土地场</span></div>
   <div id="result" class="result-overlay" role="status" aria-live="polite" hidden><div class="result-card"><span class="eyebrow">这一局，记住了</span><div id="result-ball" class="result-ball"></div><h2 id="result-title"></h2><p id="result-reason"></p><p id="rematch-message" class="rematch-message" aria-live="polite" hidden></p><button id="rematch" class="primary"><span id="rematch-label">再来一局</span><span id="rematch-arrow" aria-hidden="true">↗</span></button><button id="result-home" class="text-button">回到院子</button></div></div>
  </section>

 </div>
 <footer><span>玻璃里藏着的，是整个夏天。</span><span>GROUND RULES. GOOD TIMES.</span></footer>
</main>
<div id="toast" class="toast" role="status" hidden></div>
<dialog id="rules"><button id="rules-close" class="dialog-close" aria-label="关闭说明">×</button><p class="eyebrow">HOW TO PLAY</p><h2>还是小时候的规则。</h2><ol><li><strong>每局一块新场地。</strong>起伏、浅凹和石子每局随机，双方共享同一场地，对局中保持不变。</li><li><strong>先手高位发球。</strong>轻点发球线附近选位置，默认在中间；向后拖动发射。先手从线上方弹入，落地后可能弹跳，等球停稳。</li><li><strong>后手贴地入场。</strong>可以直接瞄准先手的弹珠，命中就赢。</li><li><strong>之后原地轮流弹。</strong>手机可从场地任意位置向后拖动，松手发射，拖回起点取消。电脑拖住自己的球，也可展开精细瞄准。</li><li><strong>哪个先发生，就按哪个判。</strong>先命中获胜，先出界失败。飞过对方头顶不算击中。</li><li><strong>边界看球心。</strong>空中越线也算出界。第 4 轮起双方各弹一次后缩圈；两球同时被圈外淘汰为平局。</li></ol><p class="muted">每次瞄准 30 秒；发球超时直接判负，普通回合连续两次超时判负。第 20 轮仍未分胜负为平局。联网断线保留席位 30 秒。</p><p class="muted audio-credit">音效：<a href="https://freesound.org/people/D43thsilence/sounds/755084/" target="_blank" rel="noopener">D43thsilence</a>（CC BY 4.0，已剪辑与加工）；<a href="https://www.zapsplat.com" target="_blank" rel="noopener">Sound effects obtained from ZapSplat</a>；Sheyvan、Anthousai、renne100（CC0）。<a href="audio/CREDITS.txt" target="_blank" rel="noopener">完整音效来源</a></p></dialog>`;
$('scene').append($('mobile-play'));
const audio = new GameAudio();
function refreshAudio() {
  const state = audio.state;
  $('mobile-sound').textContent = state.muted ? '声音关' : '声音开';
  $('mobile-sound').setAttribute('aria-pressed', String(state.muted));
  $('sound-toggle').textContent = state.muted ? '声音 关' : '声音 开';
  $('sound-toggle').setAttribute('aria-pressed', String(state.muted));
  $('sound-toggle').setAttribute('aria-label', state.muted ? '开启音效' : '静音');
  $('sound-toggle').title = state.status === 'error' ? '音效加载失败，点击重试' : '切换音效';
  $('sound-toggle').dataset.status = state.status;
  $<HTMLInputElement>('sound-volume').value = String(Math.round(state.volume * 100));
}
audio.onChange = refreshAudio;
refreshAudio();
const unlockAudio = () => audio.unlock();
document.addEventListener('pointerdown', unlockAudio, { passive: true });
document.addEventListener('keydown', unlockAudio);
$('sound-toggle').onclick = () => {
  if (audio.state.status === 'error') audio.unlock();
  else audio.setMuted(!audio.state.muted);
};
$('sound-volume').oninput = () =>
  audio.setVolume(Number($<HTMLInputElement>('sound-volume').value) / 100);
let snapshot: GameSnapshot = {
  mapVersion: MAP_VERSION,
  protocolVersion: PROTOCOL_VERSION,
  terrainSeed: nextTerrainSeed(),
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
let gestureActive = false,
  aimHintSeen = false,
  serveHintSeen = false;
try {
  aimHintSeen = localStorage.getItem('danzhu-direct-aim-seen') === '1';
  serveHintSeen = localStorage.getItem('danzhu-serve-line-seen') === '1';
} catch {
  /* Storage may be disabled. */
}
let scene: MarbleScene;
let lastGesture: DragFeedback | null = null;
let chargeCancelled = false;
function refreshMobileAim() {
  const active = canAct(),
    menuOpen = $<HTMLDetailsElement>('mobile-menu').open;
  const serving = !snapshot.served[snapshot.active];
  $('drag-hint').textContent = serving
    ? '点发球线选位置，拖动场地发射'
    : '向后拖动发射，退回起点取消';
  $('drag-hint').hidden =
    !active || gestureActive || (serving ? serveHintSeen : aimHintSeen) || menuOpen;
  $('drag-feedback').hidden = !active || !gestureActive || !lastGesture;
  $('drag-origin').hidden = $('drag-feedback').hidden;
  $('mobile-serve').hidden =
    mode === 'lobby' ||
    gestureActive ||
    menuOpen ||
    ['room-share', 'ready'].every((id) => $(id).hidden);
}

try {
  scene = new MarbleScene($('scene'), (d, p, x) => sendShot(d, p, x), snapshot.terrainSeed);
} catch (error) {
  $('scene').innerHTML =
    '<p class="webgl-error">当前浏览器无法创建 3D 场景，请开启硬件加速后重试。</p>';
  throw error;
}
scene.update(snapshot, false);
export const ready = scene.ready;
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
  $('drag-power').style.width = `${p * 100}%`;
  $('drag-label').textContent = lastGesture?.cancelled
    ? '松手取消'
    : p > 0
      ? `力度 ${Math.round(p * 100)}% · 松手发射`
      : '松手取消';
  $<HTMLInputElement>('power').value = String(Math.round(p * 100));
}
scene.onPower = updatePower;
scene.onGesture = (feedback) => {
  lastGesture = feedback;
  if (feedback) {
    const origin = $('drag-origin'),
      bubble = $('drag-feedback');
    origin.style.left = `${feedback.origin.x}px`;
    origin.style.top = `${feedback.origin.y}px`;
    origin.querySelector('span')!.textContent = feedback.armed ? '退回取消' : '起点';
    for (const element of [origin, bubble])
      element.classList.toggle('is-cancelling', feedback.cancelled);
    bubble.style.left = `${Math.max(8, Math.min($('scene').clientWidth - 188, feedback.pointer.x - 90))}px`;
    bubble.style.top = `${Math.max(8, Math.min($('scene').clientHeight - 58, feedback.pointer.y - 86))}px`;
  }
  refreshMobileAim();
};
scene.onCharge = (phase, p) => {
  gestureActive = phase !== 'end' && canAct();
  refreshMobileAim();
  if (phase === 'end' || !canAct()) {
    audio.endCharge();
    chargeCancelled = false;
  } else if (lastGesture?.cancelled) {
    audio.endCharge();
    chargeCancelled = true;
  } else {
    if (phase === 'start' || chargeCancelled) audio.beginCharge(p);
    else audio.chargeTo(p);
    chargeCancelled = false;
  }
};
scene.onAim = (d, p) => {
  direction = d;
  const angle = ((((Math.atan2(d.x, -d.z) + scene.viewYaw) * 180) / Math.PI + 540) % 360) - 180;
  $<HTMLInputElement>('angle').value = String(Math.round(angle));
  $('angle-value').textContent = `${Math.round(angle)}°`;
  updatePower(p);
};
function sendShot(d = direction, p = power, x = serveX) {
  if (!canAct() || !transport) return;
  pending = true;
  if (mobileQuery.matches) {
    aimHintSeen = true;
    if (!snapshot.served[snapshot.active]) serveHintSeen = true;
    try {
      localStorage.setItem('danzhu-direct-aim-seen', '1');
      if (!snapshot.served[snapshot.active]) localStorage.setItem('danzhu-serve-line-seen', '1');
    } catch {
      /* Optional preference. */
    }
  }
  scene.holdShotView();
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
    audio.ingest(s);
    snapshot = s;
    const turn = `${s.match}:${s.turn}`;
    if (turn !== lastTurn) {
      lastTurn = turn;
      serveX = 0;
      scene.setServeX(0);
      direction = { x: 0, z: -1 };
      $<HTMLInputElement>('angle').value = '0';
      $('angle-value').textContent = '0°';
      updatePower(0);
      pending = false;
    }
    refresh();
  },
  presence(p) {
    presence = p;
    if (mode === 'online' && invitationCode(location.href) !== p.code)
      history.replaceState(null, '', invitationUrl(location.href, p.code));
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
  if (document.body.classList.contains('in-match') === isLobby)
    document.body.classList.toggle('in-match', !isLobby);
  $('mobile-play').hidden = isLobby;
  scene.setMatchMode(!isLobby);
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
    const name = isLobby ? `PLAYER 0${p + 1}` : playerName(p, onlineMode ? presence : null);
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
  $('mobile-timer').textContent = $('timer').textContent;
  $('turn-eyebrow').textContent =
    playerName(snapshot.active, onlineMode ? presence : null) + (isServing ? '发球' : '的回合');
  let title = isFirst ? '站着，弹第一颗。' : isServing ? '贴地，瞄准入场。' : '看准，再弹一下。';
  let description = isFirst
    ? '从高处弹入，落地反弹后停稳。轻点发球线选择位置，再拖动发射。'
    : isServing
      ? '轻点发球线选择位置，贴地弹入可直接击中对方获胜。'
      : '从弹珠停留的地方出手。地形会改变它的方向和速度。';
  if (snapshot.phase === 'finished') {
    title = '这一击，尘埃落定。';
    description = '胜负已确定，继续看完弹珠的运动。';
  } else if (!connected) {
    title = '等待恢复连接';
    description = '正在尝试恢复原来的席位，请稍候。';
  } else if (onlineMode && !presence?.started) {
    title = presence?.connected.every(Boolean) ? '人齐了，准备开局。' : '等一个老朋友。';
    description = '复制邀请链接发给朋友，打开即可入房；双方准备后开始。';
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
    title = isServing ? (isFirst ? '对手高位发球' : '对手贴地发球') : '轮到对手出手';
    description = '观察对方的落点，为下一击做准备。';
  }
  $('turn-title').textContent = title;
  $('turn-description').textContent = description;
  $('room-share').hidden = !onlineMode || (!!presence?.started && snapshot.phase !== 'finished');
  $('copy-code').textContent = presence ? '复制邀请链接 ↗' : '连接中';
  $('ready').hidden = !onlineMode || !!presence?.started;
  $<HTMLButtonElement>('ready').disabled = !connected || !!presence?.ready[presence.player];
  $('ready').innerHTML = presence?.ready[presence.player]
    ? '已准备 · 等待对方'
    : '我准备好了 <span>✓</span>';
  $('power-text').parentElement!.parentElement!.classList.toggle('disabled', !canAct());
  for (const id of ['angle', 'power', 'shoot']) $<HTMLInputElement>(id).disabled = !canAct();
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
  const actor = playerName(snapshot.active, onlineMode ? presence : null);
  const status =
    snapshot.phase === 'aiming' && (mode === 'practice' || presence?.started)
      ? `${actor}${isServing ? (isFirst ? ' · 高位发球' : ' · 贴地发球') : ' · 出手'}${canAct() ? ' · 轮到你操作' : ''}`
      : title;
  const statusNode = $('match-status');
  statusNode.hidden = isLobby;
  if (statusNode.textContent !== status) statusNode.textContent = status;
  statusNode.dataset.player = String(snapshot.active);
  statusNode.classList.toggle('my-turn', canAct());
  refreshMobileAim();
  scene.setPlayerLabels(
    isLobby
      ? null
      : [playerName(0, onlineMode ? presence : null), playerName(1, onlineMode ? presence : null)],
    mode === 'practice' || !!presence?.started,
  );
  // Snapshot refreshes are not user aiming input.
  const viewPlayer =
    mode === 'practice'
      ? snapshot.active
      : mode === 'online' && presence?.started && presence.connected.every(Boolean)
        ? presence.player
        : null;
  scene.update(snapshot, canAct(), viewPlayer);
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
  const shown = mode !== 'lobby' && !!r && scene.presentationTime >= r.time + 1.8;
  $('result').hidden = !shown;
  if (!r || !shown) return;
  $('result-title').textContent =
    r.winner === null ? '这局，算平手。' : `${r.winner === 0 ? '蓝色' : '琥珀'}弹珠获胜！`;
  $('result-reason').textContent = reasons[r.reason];
  $('result-ball').className = 'result-ball ' + (r.winner === 1 ? 'gold' : '');
  if (mode === 'online' && presence && r.winner !== null)
    $('result-title').textContent = r.winner === presence.player ? '你赢了！' : '对手获胜';
  const view = rematchView(mode === 'online' ? presence : null);
  $('rematch-label').textContent = view.label;
  $('rematch-arrow').hidden = view.disabled;
  $('rematch-message').textContent = view.message;
  $('rematch-message').hidden = !view.message;
  $('result-home').textContent = mode === 'online' ? '离开房间' : '回到院子';
  $<HTMLButtonElement>('rematch').disabled = view.disabled;
}
let sessionGeneration = 0;
async function start(kind: 'practice' | 'create' | 'join' | 'resume', invitedCode?: string) {
  if (loading) return;
  const code = invitedCode ?? $<HTMLInputElement>('room-code').value.trim();
  if (kind === 'join' && !/^[A-Fa-f0-9]{8}$/.test(code)) {
    notify('请输入 8 位房间码');
    return;
  }
  audio.reset();
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
      kind === 'practice'
        ? await practice(scoped, snapshot.terrainSeed)
        : await online(scoped, kind, code, current);
    if (!current()) {
      created.dispose();
      return;
    }
    transport = created;
    if (kind !== 'practice' && presence)
      history.replaceState(null, '', invitationUrl(location.href, (presence as Presence).code));
    refresh();
  } catch (error) {
    if (!current()) return;
    mode = 'lobby';
    presence = null;
    const message = error instanceof Error ? error.message : '请检查网络连接';
    notify(
      kind === 'resume'
        ? '上一局已结束，重新开一局吧。'
        : /not found|not exist|expired/i.test(message)
          ? '邀请已失效或房间已关闭，请朋友重新发一个邀请链接。'
          : /full|locked|seat/i.test(message)
            ? '房间已满或已经开局，请朋友重新创建房间邀请你。'
            : `暂时无法连接房间：${message}`,
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
  audio.reset();
  const cleanUrl = new URL(location.href);
  cleanUrl.searchParams.delete('room');
  history.replaceState(null, '', cleanUrl);
  scene.setZoom(false);
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
    terrainSeed: nextTerrainSeed(),
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
$('copy-code').onclick = async () => {
  if (!presence) return;
  const url = invitationUrl(location.href, presence.code);
  try {
    await navigator.clipboard.writeText(url);
    notify('邀请链接已复制，发给朋友即可加入');
  } catch {
    $<HTMLInputElement>('invite-link').value = url;
    $<HTMLDialogElement>('invite-dialog').showModal();
    $<HTMLInputElement>('invite-link').select();
  }
};
scene.onServePosition = (x) => {
  serveX = x;
};
function fineAim() {
  const degrees = Number($<HTMLInputElement>('angle').value);
  const angle = (degrees * Math.PI) / 180 - scene.viewYaw;
  direction = { x: Math.sin(angle), z: -Math.cos(angle) };
  $('angle-value').textContent = `${degrees}°`;
  updatePower(Number($<HTMLInputElement>('power').value) / 100);
  if (canAct()) scene.setAim(direction, power);
}
$('angle').oninput = fineAim;
$('power').oninput = () => {
  fineAim();
  if (canAct()) audio.chargeTo(power);
};
$('power').onpointerdown = () => {
  if (canAct()) audio.beginCharge(power);
};
$('power').onkeydown = (event) => {
  if (!event.repeat && canAct()) audio.beginCharge(power);
};
for (const event of ['pointerup', 'pointercancel', 'keyup', 'blur'])
  $('power').addEventListener(event, () => audio.endCharge());
$('shoot').onclick = () => {
  fineAim();
  sendShot();
};
$('rules-open').onclick = () => $<HTMLDialogElement>('rules').showModal();
$('rules-close').onclick = () => $<HTMLDialogElement>('rules').close();
$('rules').onclick = (e) => {
  if (e.target === $('rules')) $<HTMLDialogElement>('rules').close();
};
$('resume').hidden = !hasSession();
const inviteDialog = document.createElement('dialog');
inviteDialog.id = 'invite-dialog';
inviteDialog.innerHTML =
  '<h2>邀请朋友</h2><p>复制下方链接，打开即可加入房间。</p><input id="invite-link" readonly aria-label="邀请链接"/><form method="dialog"><button class="secondary">关闭</button></form>';
document.body.append(inviteDialog);
scene.onZoom = (zoomed) => {
  for (const id of ['view-toggle', 'desktop-view-toggle']) {
    const button = $<HTMLButtonElement>(id);
    button.textContent = zoomed ? '返回全景' : '出手视角';
    button.setAttribute('aria-pressed', String(zoomed));
    button.hidden = !scene.viewEligible;
    button.disabled = !scene.viewAvailable;
  }
  $('camera-hint').hidden = !scene.viewBlocked;
};
$('view-toggle').onclick = () => scene.setZoom(!scene.zoomed);
$('desktop-view-toggle').onclick = () => scene.setZoom(!scene.zoomed);
$('mobile-leave').onclick = () => {
  $<HTMLDetailsElement>('mobile-menu').open = false;
  home();
};
$('mobile-sound').onclick = () => audio.setMuted(!audio.state.muted);
$('mobile-help').onclick = () => {
  aimHintSeen = false;
  serveHintSeen = false;
  $<HTMLDetailsElement>('mobile-menu').open = false;
  refreshMobileAim();
};
$('mobile-menu').addEventListener('toggle', () => {
  if ($<HTMLDetailsElement>('mobile-menu').open) scene.clearAim();
  refreshMobileAim();
});
$('scene').addEventListener(
  'pointerdown',
  (event) => {
    if (event.target instanceof HTMLCanvasElement && $<HTMLDetailsElement>('mobile-menu').open) {
      $<HTMLDetailsElement>('mobile-menu').open = false;
      event.stopImmediatePropagation();
    }
  },
  true,
);

// Move existing controls rather than duplicating state and input handlers.
const mobileQuery = matchMedia('(max-width: 720px), (max-height: 500px) and (pointer: coarse)');
function placeControls() {
  scene.clearAim();
  const mobile = mobileQuery.matches && mode !== 'lobby';
  const destination = mobile ? $('mobile-serve') : $('controls');
  for (const id of ['room-share', 'ready'])
    if ($(id).parentElement !== destination) destination.append($(id));
}
mobileQuery.addEventListener('change', placeControls);
new MutationObserver(placeControls).observe(document.body, {
  attributes: true,
  attributeFilter: ['class'],
});
refresh();
const invited = invitationCode(location.href);
if (invited) {
  $<HTMLInputElement>('room-code').value = invited;
  void ready.then(async () => {
    if (sessionRoomCode() === invited && hasSession()) {
      await start('resume');
      if (mode !== 'lobby') return;
    }
    await start('join', invited);
  });
} else if (new URL(location.href).searchParams.has('room'))
  notify('邀请链接无效，请向朋友获取新的链接。');

const framePacer = new FramePacer(scene.quality.fps, scene.quality.idleFps);
const resetFramePacer = () => framePacer.reset();
document.addEventListener('visibilitychange', resetFramePacer);
let animationFrame = 0;
function animate(now: number) {
  animationFrame = requestAnimationFrame(animate);
  const elapsed = framePacer.take(now, scene.renderActive, document.hidden);
  if (elapsed === null) return;
  const dt = Math.min(elapsed, 0.1);
  transport?.tick(dt);
  scene.render(dt);
  audio.update(scene.audioFrame, mode !== 'lobby' && connected);
  if (import.meta.env.DEV) $('scene').dataset.audio = JSON.stringify(audio.state);
  updateResult();
}
animationFrame = requestAnimationFrame(animate);
window.addEventListener('pagehide', (event) => {
  audio.reset();
  if (!event.persisted) {
    cancelAnimationFrame(animationFrame);
    document.removeEventListener('visibilitychange', resetFramePacer);
    audio.dispose();
    scene.dispose();
    document.removeEventListener('pointerdown', unlockAudio);
    document.removeEventListener('keydown', unlockAudio);
  }
});
