import { GameAudio, type AudioFrame } from '../src/client/audio';
import type { GameSnapshot, GameSound } from '../src/shared/types';
const button = document.querySelector<HTMLButtonElement>('#run')!,
  result = document.querySelector('#result')!;
button.onclick = async () => {
  button.disabled = true;
  const audio = new GameAudio();
  audio.unlock();
  const saved = { muted: audio.state.muted, volume: audio.state.volume };
  const checks: Record<string, unknown> = {};
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const assert = (name: string, ok: boolean) => {
    checks[name] = ok;
    if (!ok) throw new Error(name);
  };
  const snapshot = (time: number, sounds: GameSound[] = []) =>
    ({ time, sounds, match: 1, terrainSeed: 1 }) as GameSnapshot;
  const frame = (time: number, grounded = true): AudioFrame => ({
    time,
    fresh: true,
    listener: { x: 0, y: 5, z: 3 },
    forward: { x: 0, y: -0.8, z: -0.6 },
    up: { x: 0, y: 0.6, z: -0.8 },
    balls: [
      {
        player: 0,
        grounded,
        rollingSpeed: grounded ? 0.8 : 0,
        position: { x: -0.7, y: 0.05, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        velocity: { x: 0.8, y: 0, z: 0 },
      },
    ],
  });
  try {
    for (let i = 0; i < 200 && audio.state.status !== 'ready'; i++) {
      if (audio.state.status === 'error') throw new Error('decode failed');
      await wait(30);
    }
    assert(
      'real_browser_decode_and_gesture_unlock',
      audio.state.status === 'ready' && audio.state.running,
    );
    audio.setMuted(false);
    audio.setVolume(0.7);
    audio.ingest(snapshot(0));
    audio.update(frame(0.1), true);
    await wait(120);
    assert('grounded_roll_starts', audio.state.rollingVoices === 1);
    const inner = audio as unknown as {
      context: AudioContext;
      master: GainNode;
      buffers: Map<string, AudioBuffer>;
      rolls: Map<number, { pan: PannerNode }>;
    };
    assert('all_22_buffers_decoded', inner.buffers.size === 22);
    assert('exact_8_second_loop', inner.buffers.get('roll-b')!.duration === 8);
    const analyser = inner.context.createAnalyser();
    analyser.fftSize = 2048;
    inner.master.disconnect(inner.context.destination);
    inner.master.connect(analyser);
    analyser.connect(inner.context.destination);
    await wait(120);
    const signal = new Float32Array(2048);
    analyser.getFloatTimeDomainData(signal);
    checks.signalDiagnostic = {
      audioTime: inner.context.currentTime,
      contextState: inner.context.state,
      masterGain: inner.master.gain.value,
      max: Math.max(...signal.map(Math.abs)),
      visible: !document.hidden,
    };
    assert(
      'actual_audio_signal_nonzero',
      signal.some((v) => Math.abs(v) > 0.00001),
    );
    assert(
      'world_position_reaches_panner',
      Math.abs(inner.rolls.get(0)!.pan.positionX.value + 0.7) < 0.01,
    );
    audio.update(frame(0.2, false), true);
    await wait(100);
    assert('airborne_roll_stops', audio.state.rollingVoices === 0);
    audio.chargeTo(0.5);
    audio.update(frame(0.2, false), true);
    assert('no_charge_without_gesture', audio.state.chargeVoices === 0);
    audio.beginCharge(0);
    let maxChargeVoices = 0;
    for (let i = 0; i < 100; i++) {
      audio.chargeTo(0.1 + i * 0.008);
      audio.update(frame(0.2, false), true);
      maxChargeVoices = Math.max(maxChargeVoices, audio.state.chargeVoices);
      await wait(30);
    }
    assert('sustained_pull_past_clip_duration', audio.state.chargeVoices > 0);
    assert('bounded_charge_sources', maxChargeVoices <= 4);
    analyser.getFloatTimeDomainData(signal);
    assert(
      'charge_actual_signal',
      signal.some((v) => Math.abs(v) > 0.00001),
    );
    await wait(120);
    audio.update(frame(0.2, false), true);
    await wait(70);
    analyser.getFloatTimeDomainData(signal);
    assert(
      'hold_fades_charge_to_silence',
      audio.state.chargeVoices === 0 && signal.every((v) => Math.abs(v) < 0.00001),
    );
    audio.chargeTo(0.92);
    audio.update(frame(0.2, false), true);
    assert('resume_pull_restarts_charge', audio.state.chargeVoices > 0);
    audio.chargeTo(0.7);
    assert('reducing_power_stops_charge', audio.state.chargeVoices === 0);
    audio.chargeTo(0.75);
    audio.update(frame(0.2, false), true);
    audio.endCharge();
    assert(
      'cancel_has_no_extra_voice_or_launch',
      audio.state.chargeVoices === 0 &&
        audio.state.impactVoices === 0 &&
        audio.state.played.launch === 0,
    );
    await wait(100);
    const hits = (['earth', 'marble', 'stone'] as const).map((kind, i) => ({
      id: i + 1,
      time: 0.3,
      kind,
      player: 0 as const,
      speed: 2,
      position: { x: 0, y: 0.05, z: 0 },
    }));
    audio.ingest(snapshot(0.4, hits));
    audio.update(frame(0.25, false), true);
    assert(
      'waits_for_presentation_time',
      Object.values(audio.state.played).every((n) => n === 0),
    );
    audio.update(frame(0.3, false), true);
    assert(
      'all_three_impact_families_play',
      (['earth', 'marble', 'stone'] as const).every((kind) => audio.state.played[kind] === 1),
    );
    audio.ingest(snapshot(0.4, hits));
    audio.update(frame(0.4, false), true);
    assert(
      'duplicate_snapshots_do_not_repeat',
      (['earth', 'marble', 'stone'] as const).every((kind) => audio.state.played[kind] === 1),
    );
    await wait(500);
    assert('finished_impact_nodes_released', audio.state.impactVoices === 0);
    audio.update(frame(0.5), true);
    audio.setMuted(true);
    assert('mute_stops_voices', audio.state.rollingVoices === 0);
    await wait(200);
    analyser.getFloatTimeDomainData(signal);
    assert(
      'mute_signal_silent',
      signal.every((v) => Math.abs(v) < 0.00001),
    );
    audio.setMuted(false);
    audio.update(frame(0.6), true);
    audio.update(frame(0.7), false);
    assert('leaving_stops_voices', audio.state.rollingVoices === 0);
    audio.reset();
    audio.ingest(snapshot(1, [{ ...hits[0], id: 4, time: 0.99 }]));
    audio.update(frame(1, false), true);
    assert('rejoin_does_not_replay_history', audio.state.played.earth === 1);
    audio.ingest(
      snapshot(1.1, [
        {
          id: 5,
          time: 1.1,
          kind: 'launch',
          player: 0,
          power: 0.6,
          position: { x: 0, y: 0.8, z: 1.65 },
        },
      ]),
    );
    audio.update(frame(1.05, false), true);
    assert('launch_waits_for_display', audio.state.played.launch === 0);
    audio.update(frame(1.1, false), true);
    assert('launch_plays_once', audio.state.played.launch === 1);
    audio.update(frame(1.15, false), true);
    assert('launch_not_repeated', audio.state.played.launch === 1);
    audio.beginCharge(0);
    audio.chargeTo(0.5);
    audio.update(frame(1.15, false), true);
    audio.setMuted(true);
    assert('mute_also_stops_charge', audio.state.chargeVoices === 0);
    audio.setMuted(false);
    audio.beginCharge(0);
    audio.chargeTo(0.5);
    audio.update(frame(1.15, false), true);
    audio.reset();
    assert('reset_also_stops_charge', audio.state.chargeVoices === 0);
    analyser.disconnect();
    result.textContent = JSON.stringify({ passed: true, checks }, null, 2);
  } catch (error) {
    result.textContent = JSON.stringify({ passed: false, error: String(error), checks }, null, 2);
  } finally {
    audio.setVolume(saved.volume);
    audio.setMuted(saved.muted);
    audio.dispose();
    button.disabled = false;
  }
};
