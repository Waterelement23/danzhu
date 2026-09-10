"""Offline waveform-based audition cuts; not yet approved or wired into gameplay.
Usage: python scripts/extract-marble-audio.py /path/to/marble_tile_drop_and_rolling.wav
Requires ffmpeg and numpy. Output: assets/audio/marble-tile
"""
import json
import subprocess
import sys
import wave
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/audio/marble-tile'
OUT.mkdir(parents=True, exist_ok=True)
SR = 48000
source = Path(sys.argv[1]).resolve()
# Retain float headroom until gain is applied: the source contains >0 dBFS float samples.
raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(source), '-ac', '1', '-ar', str(SR),
                               '-af', 'highpass=f=80', '-f', 'f32le', '-'])
x = np.frombuffer(raw, dtype='<f4').copy()
impact_gain = 10 ** (-3 / 20) / np.max(np.abs(x))
manifest = {'source': source.name, 'sourceDuration': len(x) / SR, 'sampleRate': SR,
            'surface': 'tile',
            'surfaceBasis': 'user listening assessment; actual recording surface unverified',
            'originalSourceName': 'marble_drop_and_rolling.wav',
            'status': 'reserved for future tile court; not suitable for dirt court per user audition',
            'processing': 'mono, 48 kHz, 80 Hz high-pass, PCM16; original preserved', 'clips': []}

def write(name, data, **meta):
    name = "marble-tile-" + name
    peak = float(np.max(np.abs(data)))
    assert np.all(np.isfinite(data)) and peak < 1
    pcm = np.round(np.clip(data, -1, 1) * 32767).astype('<i2')
    with wave.open(str(OUT / (name + '.wav')), 'wb') as f:
        f.setnchannels(1); f.setsampwidth(2); f.setframerate(SR); f.writeframes(pcm.tobytes())
    manifest['clips'].append({'name': name + '.wav', 'duration': len(data) / SR,
        'peakDbFS': round(20 * np.log10(max(peak, 1e-12)), 2), **meta})
    return data

def fade(data, attack=.001, release=.018):
    data = data.copy()
    a, b = int(attack * SR), int(release * SR)
    data[:a] *= np.linspace(0, 1, a)
    data[-b:] *= np.linspace(1, 0, b)
    return data

cuts = [('bounce-01', .237, .414), ('bounce-02', .428, .582), ('bounce-03', .594, .731)]
bounces = []
for name, start, end in cuts:
    bounces.append(write(name, fade(x[round(start * SR):round(end * SR)] * impact_gain),
        sourceRange=[start, end], gainDb=round(float(20 * np.log10(impact_gain)), 2)))
# Pause between single contacts for an easy audition; this is not a fixed in-game sequence.
montage = np.concatenate([part for b in bounces for part in (b, np.zeros(int(.55 * SR)))])
write('bounce-audition', montage, purpose='three isolated impacts separated by silence')
start, end = 2.02, 4.16
roll = x[round(start * SR):round(end * SR)].copy()
# Modest gain for audition. Do not flatten every transient or fabricate soil texture.
roll_gain = min(10 ** ((-26 - 20 * np.log10(np.sqrt(np.mean(roll ** 2)))) / 20),
                10 ** (-6 / 20) / np.max(np.abs(roll)))
roll *= roll_gain
write('rolling-tail', fade(roll, .012, .040), sourceRange=[start, end],
      gainDb=round(float(20 * np.log10(roll_gain)), 2), purpose='tail candidate before loop construction')
# Overlap the original tail with its beginning; the loop seam then follows adjacent samples.
c = int(.12 * SR)
u = np.linspace(0, 1, c, endpoint=False)
loop = np.concatenate((roll[c:-c], roll[-c:] * (1 - u) + roll[:c] * u))
write('rolling-loop', loop, sourceRange=[start, end], crossfadeSeconds=.12,
      loop=True, purpose='crossfaded candidate; requires listening check for rhythmic repetition')
write('rolling-audition', fade(np.tile(loop, 3), .04, .08),
      purpose='three repeats to audition seams; runtime should loop marble-tile-rolling-loop.wav')
(OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(manifest, ensure_ascii=False, indent=2))
print('Loop seam delta:', float(abs(loop[0] - loop[-1])))
