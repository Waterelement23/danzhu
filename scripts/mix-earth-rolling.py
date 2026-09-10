"""Offline audition: quiet low-passed rolling plus softened falling-sand texture.

Usage: python scripts/mix-earth-rolling.py /path/to/source-directory
Requires ffmpeg and numpy. No looping, pitch shifting or game integration.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import wave

import numpy as np

SR = 48000
SOURCE_DIR = Path(sys.argv[1]).resolve()
OUT = Path(__file__).resolve().parents[1] / 'assets/audio/marble-earth-layered'
OUT.mkdir(parents=True, exist_ok=True)
SOURCES = {
    'rolling': {
        'filename': 'marble_tile_drop_and_rolling.wav',
        'sourceRange': [2.02, 4.16],
        'license': 'not supplied; local audition only',
        'surfaceBasis': 'tile-like per user; actual recording surface unverified',
        'filters': 'highpass=f=140:p=2,equalizer=f=1180:t=q:w=1:g=-8,'
                   'lowpass=f=750:p=2,lowpass=f=750:p=2',
    },
    'sand': {
        'filename': '569738__sheyvan__gravel-stone-dirt-debris-falling-small-1-5.wav',
        'sourceRange': [.15, 2.29],
        'author': 'Sheyvan', 'license': 'CC0 1.0',
        'url': 'https://freesound.org/people/Sheyvan/sounds/569738/',
        'recordedObject': 'falling gravel/stone/dirt debris; texture layer, not marble rolling',
        'filters': 'highpass=f=180:p=2,lowpass=f=1500:p=2,lowpass=f=1500:p=2,'
                   'acompressor=threshold=0.003:ratio=4:attack=0.5:release=45:knee=4:makeup=1',
    },
}

def rms(x):
    return float(np.sqrt(np.mean(x * x)))

signals = {}
for name, source in SOURCES.items():
    path = SOURCE_DIR / source['filename']
    source['sha256'] = hashlib.sha256(path.read_bytes()).hexdigest()
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(path),
        '-ac', '1', '-ar', str(SR), '-af', source['filters'], '-f', 'f32le', '-'])
    a, b = source['sourceRange']
    signals[name] = np.frombuffer(raw, dtype='<f4').astype(np.float64)[round(a * SR):round(b * SR)].copy()
    assert len(signals[name]) == round(2.14 * SR) and np.isfinite(signals[name]).all()

manifest = {
    'status': 'user likes direction; sand impacts too prominent, revision requested',
    'sources': SOURCES, 'sampleRate': SR, 'channels': 1, 'bitDepth': 16,
    'integratedInGame': False,
    'processing': 'Continuous rolling tail with fourth-order 750 Hz low-pass; '
                  'falling-sand texture low-passed at 1500 Hz with softened peaks. '
                  'Lower rolling level retained: no final loudness normalization. '
                  'No loop, time stretch, pitch shift or synthetic noise.',
    'clips': [],
}

def level(x, db):
    gain = 10 ** (db / 20) / rms(x)
    return x * gain, float(20 * np.log10(gain))

def fade(x):
    x = x.copy()
    x[:960] *= np.linspace(0, 1, 960)
    x[-2880:] *= np.linspace(1, 0, 2880)
    return x

def write(name, x, **metadata):
    assert np.isfinite(x).all() and 0 < np.max(np.abs(x)) < 1
    path = OUT / (name + '.wav')
    with wave.open(str(path), 'wb') as w:
        w.setparams((1, 2, SR, 0, 'NONE', 'not compressed'))
        w.writeframes(np.round(x * 32767).astype('<i2').tobytes())
    manifest['clips'].append({'filename': path.name, 'duration': len(x) / SR,
        'rmsDbFS': float(20 * np.log10(rms(x))),
        'peakDbFS': float(20 * np.log10(np.max(np.abs(x)))),
        'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'loop': False, **metadata})

roll, gain = level(signals['rolling'], -33)
manifest['rollingGainDb'] = gain
write('earth-roll-low-friction', fade(roll), rollingTargetRmsDbFS=-33)
audition = [np.zeros(round(.25 * SR)), fade(roll), np.zeros(round(.8 * SR))]
for name, db in [('light-sand', -39), ('more-sand', -35)]:
    sand, gain = level(signals['sand'], db)
    mixed = fade(roll + sand)
    write('earth-roll-' + name, mixed, rollingTargetRmsDbFS=-33,
          sandTargetRmsDbFS=db, sandGainDb=gain)
    audition.extend([mixed, np.zeros(round(.8 * SR))])
write('earth-roll-layered-comparison', np.concatenate(audition),
      sequence=['low-friction', 'light-sand', 'more-sand'], silenceBetweenSeconds=.8)
for source in SOURCES.values():
    assert hashlib.sha256((SOURCE_DIR / source['filename']).read_bytes()).hexdigest() == source['sha256']
(OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(manifest['clips'], indent=2))
