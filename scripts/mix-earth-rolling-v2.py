"""Refined offline audition: retain the rolling bed and attenuate sand impact envelopes.

Usage: python scripts/mix-earth-rolling-v2.py /path/to/source-directory
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
OUT = Path(__file__).resolve().parents[1] / 'assets/audio/marble-earth-layered-v2'
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
    'status': 'timbre accepted by user; source contains far-near-far motion; audition only, not a runtime rolling loop',
    'sources': SOURCES, 'sampleRate': SR, 'channels': 1, 'bitDepth': 16,
    'integratedInGame': False,
    'playbackConstraints': {'timbreReview': 'acceptable per user', 'sourceMotion': 'far-near-far, identified by user in original recording and derivatives', 'runtimeReady': False, 'allowDirectLoop': False, 'reason': 'Recorded approach/recession would repeat independently of the marble position.', 'requiredPreparation': 'Create sufficiently steady close-perspective rolling textures; do not merely crossfade the full pass-by recording. Validate sustained fixed-distance playback before integration.', 'runtimeControl': 'Distance and pan from rendered world-space positions; rolling intensity from speed, surface and contact state. Fade rolling out during airborne or stopped states.'},
    'processing': 'Continuous rolling tail with fourth-order 750 Hz low-pass; '
                  'falling-sand texture low-passed at 1500 Hz, with additional envelope attenuation of louder events. '
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
        'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'loop': False, 'allowDirectLoop': False, **metadata})

roll, gain = level(signals['rolling'], -33)
manifest['rollingGainDb'] = gain
write('earth-roll-low-friction', fade(roll), rollingTargetRmsDbFS=-33)
# Start from exactly the previous light-sand mix, so only sand event levels change.
sand, sand_gain = level(signals['sand'], -39)
previous = fade(roll + sand)
# A centered 10 ms RMS window anticipates impact attacks. Attenuation never
# increases quiet detail; the 5 ms smoothing avoids abrupt gain changes.
window = 480
power = np.pad(sand * sand, (window // 2, window - 1 - window // 2), mode='edge')
envelope = np.sqrt(np.convolve(power, np.ones(window) / window, mode='valid'))
threshold = float(np.percentile(envelope, 65))
minimum_gain = 10 ** (-18 / 20)
attenuation = np.clip((threshold / np.maximum(envelope, 1e-12)) ** .85, minimum_gain, 1)
smooth = 240
attenuation = np.convolve(np.pad(attenuation, (smooth // 2, smooth - 1 - smooth // 2),
                                mode='edge'), np.ones(smooth) / smooth, mode='valid')
assert len(attenuation) == len(sand) and np.min(attenuation) > 0 and np.max(attenuation) <= 1 + 1e-12
soft_sand = sand * attenuation
mixed = fade(roll + soft_sand)
manifest['sandTransientControl'] = {
    'referenceSandRmsDbFS': -39, 'sandGainDbBeforeAttenuation': sand_gain,
    'envelopeWindowMs': 10, 'thresholdPercentile': 65,
    'thresholdDbFS': float(20 * np.log10(threshold)),
    'attenuationExponent': .85, 'maxAttenuationDb': 18, 'gainSmoothingMs': 5,
    'actualMaxAttenuationDb': float(-20 * np.log10(np.min(attenuation))),
    'beforeRmsDbFS': float(20 * np.log10(rms(sand))),
    'afterRmsDbFS': float(20 * np.log10(rms(soft_sand))),
    'peakReductionDb': float(20 * np.log10(np.max(np.abs(sand)) / np.max(np.abs(soft_sand)))),
    'makeupGain': False,
}
write('earth-roll-previous-light-sand', previous, purpose='unchanged previous light-sand mix')
write('earth-roll-soft-sand', mixed, purpose='same rolling bed, quieter sand impacts; no makeup gain',
      reviewStatus='timbre accepted; contains recorded pass-by motion, not runtime-ready')
write('sand-layer-before', fade(sand), purpose='diagnostic isolated layer, not a rolling asset')
write('sand-layer-after', fade(soft_sand), purpose='diagnostic isolated layer, not a rolling asset')
audition = [np.zeros(round(.25 * SR)), previous, np.zeros(round(.8 * SR)), mixed,
            np.zeros(round(.3 * SR))]
write('earth-roll-soft-sand-comparison', np.concatenate(audition),
      sequence=['previous-light-sand', 'soft-sand'], silenceBetweenSeconds=.8)
for source in SOURCES.values():
    assert hashlib.sha256((SOURCE_DIR / source['filename']).read_bytes()).hexdigest() == source['sha256']
(OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(manifest['clips'], indent=2))
