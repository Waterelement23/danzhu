"""Offline stationary rolling-loop and stone-impact candidates. No game integration.
Usage: python scripts/build-game-audio-candidates.py
Requires numpy and ffmpeg. Source audio is never modified.
"""
from pathlib import Path
import hashlib
import json
import subprocess
import wave
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
AUDIO = ROOT / 'assets/audio'
OUT = AUDIO / 'game-audio-candidates'
OUT.mkdir(parents=True, exist_ok=True)
SR, SECONDS = 48000, 8
N = SR * SECONDS
sources = {}


def read(path):
    sources[str(path.relative_to(ROOT))] = hashlib.sha256(path.read_bytes()).hexdigest()
    with wave.open(str(path)) as w:
        assert (w.getframerate(), w.getnchannels(), w.getsampwidth()) == (SR, 1, 2)
        return np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(float) / 32768


def rms(x):
    return float(np.sqrt(np.mean(x*x)))


def at_level(x, db):
    return x * (10**(db/20) / rms(x))


def circular_mean(x, size):
    # Centered periodic smoothing preserves seamless wrap-around.
    size = int(size) | 1
    half = size // 2
    padded = np.pad(x, (half, half), mode='wrap')
    sums = np.concatenate(([0.], np.cumsum(padded)))
    return (sums[size:] - sums[:-size]) / size


def spectrum(x):
    # The average power spectrum discards the original chronological pass-by.
    x = x[2880:-2880]
    size = 4096
    w = np.hanning(size)
    power = np.mean([abs(np.fft.rfft(x[i:i+size]*w))**2
                     for i in range(0, len(x)-size+1, 1024)], axis=0)
    power = np.convolve(np.pad(power, (2, 2), mode='edge'), np.ones(5)/5, mode='valid')
    return np.fft.rfftfreq(size, 1/SR), power


def stationary(reference, seed, cutoff):
    rng = np.random.default_rng(seed)
    f, power = spectrum(reference)
    freq = np.fft.rfftfreq(N, 1/SR)
    shape = np.sqrt(np.interp(freq, f, power))
    shape /= np.sqrt(1+(freq/cutoff)**8)
    shape *= freq**2 / (freq**2+110**2)
    shape[0] = 0
    # Random phases and amplitudes yield a new periodic texture. This is source-
    # spectrum-based synthesis, not a restored recording or repeated source chunk.
    bins = (rng.normal(size=len(freq)) + 1j*rng.normal(size=len(freq))) * shape
    bins[-1] = bins[-1].real
    x = np.fft.irfft(bins, n=N)
    envelope = np.sqrt(np.maximum(circular_mean(x*x, .3*SR), 1e-20))
    gain = np.clip(rms(x)/envelope, .7, 1.4)
    gain = circular_mean(gain, .15*SR)
    return x * gain


def texture_modulation(seed, depth):
    rng = np.random.default_rng(seed)
    count = 200
    points = rng.uniform(-1, 1, count)
    phase = np.arange(N)/N*count
    index = np.floor(phase).astype(int)
    t = phase-index
    t = t*t*(3-2*t)
    db = depth * (points[index]*(1-t)+points[(index+1)%count]*t)
    return 10**(db/20)


manifest = {
    'status': 'user accepted rolling loop naturalness and stone-impact timbre; in-game integration pending',
    'sampleRate': SR, 'channels': 1, 'bitDepth': 16, 'integratedInGame': False,
    'userReview': {'date': '2026-09-10', 'status': 'accepted in offline audition', 'rollingFeedback': '用户未听出机械重复感或忽远忽近，感觉比较自然。', 'stoneFeedback': '用户认为碰石声比较像碰石头。', 'selectedRollingVariant': None, 'scope': 'A/B/C rolling candidates retained; no preferred variant selected; in-game behavior not yet tested'},
    'rollingMethod': 'Stationary random-phase resynthesis from mean source power spectra; '
                     'original time envelope and stereo motion discarded. Mild periodic '
                     'RMS stabilization; sand modulation has 40 ms knots, not a pass-by envelope.',
    'limitations': 'Synthesized approximation using existing timbre, not real soil recording. '
                   'Every finite loop repeats; 8-second loops and three-repeat auditions '
                   'require listening for mechanical repetition and seam artifacts.',
    'sources': sources, 'clips': [],
    'provenance': {
        'rollingAndSand': json.loads((AUDIO/'marble-earth-layered-v2/manifest.json').read_text())['sources'],
        'glassImpacts': json.loads((AUDIO/'marble-collision/manifest.json').read_text())['source'],
    },
}


def write(name, x, **meta):
    assert np.isfinite(x).all() and 0 < max(abs(x)) < .95
    path = OUT / (name+'.wav')
    pcm = np.round(x*32767).astype('<i2')
    with wave.open(str(path), 'wb') as w:
        w.setparams((1, 2, SR, 0, 'NONE', 'not compressed'))
        w.writeframes(pcm.tobytes())
    manifest['clips'].append({'filename': path.name, 'duration': len(x)/SR,
        'rmsDbFS': 20*np.log10(rms(x)), 'peakDbFS': 20*np.log10(max(abs(x))),
        'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'auditionApproved': True, **meta})


roll = read(AUDIO/'marble-earth-layered-v2/earth-roll-low-friction.wav')
sand = read(AUDIO/'marble-earth-layered-v2/sand-layer-after.wav')
variants = [
    ('a-smooth', 'A 平滑土面', 750, 950, -33, -46, .3, 9201),
    ('b-fine-sand', 'B 细砂土面', 750, 1100, -34, -41, .8, 9202),
    ('c-grainy', 'C 颗粒稍明显', 850, 1250, -34.5, -38.5, 1.3, 9203),
]
for name, label, roll_cutoff, sand_cutoff, roll_db, sand_db, depth, seed in variants:
    bed = at_level(stationary(roll, seed, roll_cutoff), roll_db)
    grain = stationary(sand, seed+100, sand_cutoff)*texture_modulation(seed+200, depth)
    grain = at_level(grain, sand_db)
    mix = bed+grain
    # Common audition level, retaining a quiet roll compared with collision sounds.
    mix = at_level(mix, -33)
    write('earth-loop-'+name, mix, label=label, loop=True, runtimeReady=False,
          loopStart=0, loopEnd=SECONDS, seed=seed, sourceRollDb=roll_db, sourceSandDb=sand_db,
          rollLowpassHz=roll_cutoff, sandLowpassHz=sand_cutoff, particleModulationDb=depth)
    preview = np.tile(mix, 3)
    preview[:2400] *= np.linspace(0, 1, 2400)
    preview[-4800:] *= np.linspace(1, 0, 4800)
    write('earth-loop-'+name+'-audition', preview, label=label, loop=False, repeats=3,
          internalSeamsSeconds=[8, 16], purpose='24-second constant-distance audition; only outer edges faded')

# Derive stone-contact candidates from the approved glass-glass hits. Keep the
# same pitch and relative levels; soften brightness and damp the ringing tail.
stone_filters = 'highpass=f=90:p=2,equalizer=f=2400:t=q:w=0.7:g=-4,lowpass=f=3600:p=2'
audition = [np.zeros(round(.25*SR))]
for i in range(1, 9):
    source = AUDIO/f'marble-collision/marble-collision-{i:02}.wav'
    read(source)
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(source),
                                  '-af', stone_filters, '-f', 'f32le', '-'])
    x = np.frombuffer(raw, dtype='<f4').astype(float)[:round(.2*SR)]
    time = np.arange(len(x))/SR
    x *= np.exp(-np.maximum(time-.03, 0)/.045)
    x *= 10**(-1/20)
    x[-960:] *= np.linspace(1, 0, 960)
    write(f'marble-stone-{i:02}', x, loop=False, runtimeReady=False,
          derivation='glass collision with EQ, 45ms exponential tail damping after 30ms, -1dB gain',
          filters=stone_filters, source=str(source.relative_to(ROOT)))
    audition.extend([x, np.zeros(round(.6*SR))])
write('marble-stone-audition', np.concatenate(audition), loop=False,
      sequence='stone candidates 01 through 08 once each',
      credit='Derived from Two marbles colliding by D43thsilence, Freesound 755084, CC BY 4.0; EQ, gain and tail changed.')
for name, expected in sources.items():
    assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest() == expected
(OUT/'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
print('Generated', len(manifest['clips']), 'audio files in', OUT)
