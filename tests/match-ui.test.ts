import { expect, it } from 'vitest';
import {
  invitationCode,
  invitationUrl,
  rematchView,
  playerName,
  touchAim,
} from '../src/client/match-ui';
import type { Presence } from '../src/shared/types';
const presence: Presence = {
  code: 'ABCDEF12',
  player: 0,
  connected: [true, true],
  ready: [true, true],
  rematch: [false, false],
  started: true,
};
it('invites preserve the deployment path and contain no session data', () => {
  const url = invitationUrl('https://example.com/danzhu/?secret=x#old', 'abcdef12');
  expect(url).toBe('https://example.com/danzhu/?room=ABCDEF12');
  expect(invitationCode(url)).toBe('ABCDEF12');
  expect(invitationCode('https://example.com/?room=<script>')).toBe(null);
  expect(invitationCode('https://example.com/')).toBe(null);
});
it('renders incoming, outgoing and disconnected rematch states for each seat', () => {
  expect(rematchView(presence).label).toBe('再来一局');
  const request = { ...presence, rematch: [true, false] as [boolean, boolean] };
  expect(rematchView(request).disabled).toBe(true);
  expect(rematchView({ ...request, player: 1 }).label).toBe('接受邀请');
  expect(rematchView({ ...request, player: 1 }).message).toContain('对方');
  expect(rematchView({ ...request, player: 1, connected: [false, true] }).disabled).toBe(true);
});
it('identifies both seats from the local perspective and avoids you/opponent in local practice', () => {
  expect(playerName(0, presence)).toBe('你 · 蓝方');
  expect(playerName(1, presence)).toBe('对手 · 金方');
  expect(playerName(0, { ...presence, player: 1 })).toBe('对手 · 蓝方');
  expect(playerName(1, null)).toBe('金方');
});
it('touch aiming uses screen travel for power with a dead zone and clamp', () => {
  expect(touchAim(0, 0, 120).power).toBe(0);
  expect(touchAim(0, 60, 120).power).toBeCloseTo(0.5);
  expect(touchAim(0, 240, 120).power).toBe(1);
  expect(touchAim(0, 60, 120).direction).toEqual({ x: 0, z: -1 });
  expect(touchAim(60, 0, 120).direction.x).toBe(-1);
});
