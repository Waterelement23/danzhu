"""Second offline rolling audition: reduce rumble/resonance and optionally soften attacks.

Usage: python scripts/process-muted-rolling-v2.py /path/to/marble_tile_drop_and_rolling.wav
Requires ffmpeg and numpy. No looping, added grit, pitch shift or game integration.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import wave

import numpy as np

SR = 48000
START, END = 2.02, 4.16
SOURCE = Path(sys.argv[1]).resolve()
OUT = Path(__file__).resolve().parents[1] / 'assets/audio/marble-earth-from-tile-v2'
OUT.mkdir(parents=True, exist_ok=True)
SOURCE_HASH = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
FILTERS = {
    'previous': 'highpass=f=100,equalizer=f=2200:t=q:w=0.7:g=-5,lowpass=f=1400:p=2',
    'less-resonant': 'highpass=f=180:p=2,equalizer=f=1180:t=q:w=1.1:g=-10,'
                     'equalizer=f=1900:t=q:w=0.8:g=-4,lowpass=f=3000:p=2',
    'soft-friction': 'highpass=f=240:p=2,equalizer=f=1180:t=q:w=1:g=-13,'
                     'equalizer=f=1900:t=q:w=0.8:g=-5,lowpass=f=2400:p=2,'
                     'acompressor=threshold=0.018:ratio=2.5:attack=2:release=65:makeup=1:knee=4',
}
signals = {}
for name, filters in FILTERS.items():
    # Process the full source so filter startup is outside the rolling cut.
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(SOURCE),
        '-ac', '1', '-ar', str(SR), '-af', filters, '-f', 'f32le', '-'])
    signals[name] = np.frombuffer(raw, dtype='<f4').astype(np.float64)[
        round(START * SR):round(END * SR)].copy()
    assert len(signals[name]) == round((END - START) * SR)

def rms(x):
    return float(np.sqrt(np.mean(x * x)))

# Match RMS across versions to compare timbre, with common headroom protection.
target = min(10 ** (-26 / 20), *[
    10 ** (-6 / 20) * rms(x) / float(np.max(np.abs(x))) for x in signals.values()])
manifest = {
    'status': 'rejected by user: still too sharp; retained for comparison',
    'source': {'filename': SOURCE.name, 'sha256': SOURCE_HASH,
        'surfaceBasis': 'tile-like timbre per user; actual recording surface unverified',
        'license': 'not supplied; local audition only'},
    'sourceRange': [START, END], 'sampleRate': SR, 'channels': 1, 'bitDepth': 16,
    'targetRmsDbFSBeforeFades': 20 * np.log10(target),
    'processing': 'Rumble/resonance EQ; soft-friction variant additionally uses gentle compression; RMS comparison gain and 12 ms/40 ms edge fades; '
                  'no pitch shift, time stretch, noise addition, transient slicing or looping',
    'integratedInGame': False, 'clips': [],
}

def write(name, x, **metadata):
    assert np.isfinite(x).all() and 0 < np.max(np.abs(x)) < 1
    path = OUT / (name + '.wav')
    with wave.open(str(path), 'wb') as w:
        w.setparams((1, 2, SR, 0, 'NONE', 'not compressed'))
        w.writeframes(np.round(x * 32767).astype('<i2').tobytes())
    manifest['clips'].append({'filename': path.name, 'duration': len(x) / SR,
        'peakDbFS': float(20 * np.log10(np.max(np.abs(x)))),
        'rmsDbFS': float(20 * np.log10(rms(x))),
        'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), **metadata})

audition = [np.zeros(round(.25 * SR))]
for name, x in signals.items():
    gain = target / rms(x)
    x *= gain
    x[:576] *= np.linspace(0, 1, 576)
    x[-1920:] *= np.linspace(1, 0, 1920)
    write('earth-roll-' + name, x, filters=FILTERS[name],
          gainDb=float(20 * np.log10(gain)), loop=False)
    audition.extend([x, np.zeros(round(.8 * SR))])
write('earth-roll-comparison', np.concatenate(audition), loop=False,
      sequence=['previous', 'less-resonant', 'soft-friction'], silenceBetweenSeconds=.8)
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == SOURCE_HASH
(OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(manifest, ensure_ascii=False, indent=2))
