"""Extract the selected glass-marble recording for offline audition.

Usage: python scripts/extract-collision-audio.py /path/to/source-directory
Requires ffmpeg and numpy. Does not modify the original or integrate game audio.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import wave

import numpy as np

SR = 48000
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/audio/marble-collision'
SOURCE = Path(sys.argv[1]).resolve() / '755084__d43thsilence__two-marbles-colliding.wav'
# Bounds include the attack and decay to the measured noise floor (~250 ms).
SPANS = [(.510, .805), (2.470, 2.765), (4.440, 4.735), (6.450, 6.745),
         (8.400, 8.695), (10.475, 10.770), (12.490, 12.785), (14.495, 14.790)]

OUT.mkdir(parents=True, exist_ok=True)
source_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
# The source's L/R impact correlation is slightly negative. Select one consistent
# channel rather than summing channels and changing the transient by cancellation.
raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(SOURCE),
    '-af', 'pan=mono|c0=c1', '-ar', str(SR), '-f', 'f32le', '-'])
x = np.frombuffer(raw, dtype='<f4').astype(np.float64)
assert len(x) == 17 * SR and np.isfinite(x).all()
parts = [x[round(a * SR):round(b * SR)].copy() for a, b in SPANS]
# A single gain for the source preserves relative levels across all eight hits.
gain = min(1.0, 10 ** (-3 / 20) / max(np.max(np.abs(p)) for p in parts))
manifest = {
    'status': 'source selected by user; eight extracted hits awaiting audition',
    'source': {
        'title': 'Two marbles colliding', 'author': 'D43thsilence',
        'url': 'https://freesound.org/people/D43thsilence/sounds/755084/',
        'filename': SOURCE.name, 'sha256': source_hash,
        'license': 'CC BY 4.0', 'licenseUrl': 'https://creativecommons.org/licenses/by/4.0/',
        'credit': 'Two marbles colliding by D43thsilence (Freesound), CC BY 4.0. '
                  'Modified: right-channel extraction, resampling, trimming, shared gain and edge fades.',
    },
    'sampleRate': SR, 'channels': 1, 'bitDepth': 16,
    'processing': {'sourceChannel': 'right', 'gainDb': float(20 * np.log10(gain)),
        'attackFadeMs': 1, 'releaseFadeMs': 25, 'pitchShift': False,
        'denoise': False, 'compression': False, 'filter': None},
    'integratedInGame': False, 'clips': [],
}

def write(name, samples, **metadata):
    assert len(samples) and np.isfinite(samples).all() and np.max(np.abs(samples)) < 1
    pcm = np.round(samples * 32767).astype('<i2')
    path = OUT / (name + '.wav')
    with wave.open(str(path), 'wb') as w:
        w.setparams((1, 2, SR, 0, 'NONE', 'not compressed'))
        w.writeframes(pcm.tobytes())
    manifest['clips'].append({'filename': path.name, 'duration': len(samples) / SR,
        'peakDbFS': float(20 * np.log10(np.max(np.abs(samples)))),
        'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), **metadata})

audition = [np.zeros(round(.25 * SR))]
for i, (part, span) in enumerate(zip(parts, SPANS), 1):
    part *= gain
    part[:48] *= np.linspace(0, 1, 48)
    part[-1200:] *= np.linspace(1, 0, 1200)
    write(f'marble-collision-{i:02}', part, sourceRange=list(span), loop=False,
          reviewStatus='source approved; extracted cut awaiting user audition')
    audition.extend([part, np.zeros(round(.6 * SR))])
write('marble-collision-audition', np.concatenate(audition), loop=False,
      sequence='01 through 08, once each; 600 ms silence after each hit')
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == source_hash
(OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'gainDb': manifest['processing']['gainDb'], 'clips': manifest['clips']}, indent=2))
