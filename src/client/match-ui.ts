import type { Player, Presence } from '../shared/types';
export function invitationCode(url: string): string | null {
  const code = new URL(url).searchParams.get('room')?.toUpperCase();
  return code && /^[A-F0-9]{8}$/.test(code) ? code : null;
}
export function invitationUrl(base: string, code: string): string {
  const url = new URL(base);
  url.search = '';
  url.hash = '';
  url.searchParams.set('room', code.toUpperCase());
  return url.href;
}
export function playerName(player: Player, presence: Presence | null): string {
  return (
    (presence ? (presence.player === player ? '你 · ' : '对手 · ') : '') +
    (player === 0 ? '蓝方' : '金方')
  );
}
export function rematchView(presence: Presence | null) {
  if (!presence) return { label: '再来一局', message: '', disabled: false };
  if (!presence.connected.every(Boolean))
    return {
      label: '等待对方连接',
      message: '对方已离开或断线，可以离开房间重新邀请。',
      disabled: true,
    };
  if (presence.rematch[presence.player])
    return {
      label: '已邀请 · 等待对方',
      message: '已向对方发出再战邀请，等待接受。',
      disabled: true,
    };
  if (presence.rematch[1 - presence.player])
    return {
      label: '接受邀请',
      message: '对方邀请你再来一局，接受后开始新的对局。',
      disabled: false,
    };
  return { label: '再来一局', message: '', disabled: false };
}
/** Pixel travel owns power; compensate the forward-facing camera tilt only for direction. */
export function touchAim(dx: number, dy: number, fullPowerPixels: number) {
  const travel = Math.hypot(dx, dy);
  const x = -dx,
    z = -dy / Math.sin((58 * Math.PI) / 180);
  const length = Math.hypot(x, z);
  return {
    direction: length
      ? { x: x === 0 ? 0 : x / length, z: z === 0 ? 0 : z / length }
      : { x: 0, z: -1 },
    power: travel < 5 ? 0 : Math.min(1, travel / fullPowerPixels),
  };
}
