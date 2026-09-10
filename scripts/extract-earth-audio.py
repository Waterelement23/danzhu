"""Cut the two user-approved dirt sources into offline audition assets.
Usage: python scripts/extract-earth-audio.py /path/to/source-directory
Requires ffmpeg and numpy. Original files are never modified.
"""
import hashlib
import json
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

SR = 48000
ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = Path(sys.argv[1]).resolve()
OUT = ROOT / 'assets/audio/marble-earth'
OUT.mkdir(parents=True, exist_ok=True)
SOURCES = {
    'impact': {
        'filename': 'zapsplat_foley_stone_small_land_on_dirt_road_small_stones_004_23358.mp3',
        'author': 'ZapSplat',
        'url': 'https://www.zapsplat.com/music/small-stone-throw-land-on-dirt-road-and-small-stones-4/',
        'license': 'ZapSplat Standard License (Basic download; attribution required)',
        'credit': 'Sound effects obtained from https://www.zapsplat.com',
        'recordedObject': 'small stone landing on dirt road and small stones',
    },
    'grit': {
        'filename': '569738__sheyvan__gravel-stone-dirt-debris-falling-small-1-5.wav',
        'author': 'Sheyvan',
        'url': 'https://freesound.org/people/Sheyvan/sounds/569738/',
        'license': 'CC0 1.0',
        'credit': 'Gravel Stone Dirt Debris Falling Small 1 5 by Sheyvan (Freesound, CC0)',
        'recordedObject': 'small falling gravel / dirt / stone debris',
    },
}
manifest = {
    'status': 'impact cuts accepted; all gravel-based rolling candidates rejected: falling-grain impacts do not match marble rolling on dirt',
    'surface': 'dry-earth',
    'sampleRate': SR,
    'channels': 1,
    'sources': SOURCES,
    'processing': 'mono 48 kHz PCM16; impacts/details retain previous processing; rolling uses unfiltered source at original gain, no pitch change, denoising or compression',
    'rolling': {
        'status': 'rejected by user; retained for processing history only',
        'basis': 'Earlier feedback favored preserving continuous detail; latest louder audition rejects the source because falling-grain impacts do not match a glass marble rolling on dirt.',
        'naturalFile': 'earth-roll-natural.wav',
        'rejectedLoopFile': 'earth-roll-loop.wav',
        'auditionFile': 'earth-roll-varied-audition.wav',
        'method': 'Long continuous source windows with varied lengths/offsets and equal-power crossfades; no fixed short loop',
    },
    'clips': [],
}

def load(kind, highpass=True):
    path = SOURCE_DIR / SOURCES[kind]['filename']
    # Decode before gain adjustment to preserve floating-point headroom.
    command = ['ffmpeg', '-v', 'error', '-i', str(path), '-ac', '1', '-ar', str(SR)]
    if highpass:
        command += ['-af', 'highpass=f=60']
    raw = subprocess.check_output(command + ['-f', 'f32le', '-'])
    x = np.frombuffer(raw, dtype='<f4').astype(np.float64)
    assert len(x) and np.isfinite(x).all()
    SOURCES[kind]['sha256'] = hashlib.sha256(path.read_bytes()).hexdigest()
    SOURCES[kind]['decodedDuration'] = len(x) / SR
    return x

def fade(x, attack=.001, release=.012):
    y = x.copy()
    a, b = round(attack * SR), round(release * SR)
    assert a + b < len(y)
    y[:a] *= np.linspace(0, 1, a)
    y[-b:] *= np.linspace(1, 0, b)
    return y

def write(name, x, **meta):
    peak = float(np.max(np.abs(x)))
    assert np.isfinite(x).all() and 0 < peak < 1
    with wave.open(str(OUT / (name + '.wav')), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(np.round(x * 32767).astype('<i2').tobytes())
    manifest['clips'].append({
        'filename': name + '.wav',
        'duration': len(x) / SR,
        'peakDbFS': round(20 * np.log10(peak), 2),
        **meta,
    })

impact = load('impact')
grit = load('grit')
# Source-level gain preserves original relative impact levels. Grit remains below the main impact.
impact_gain = 10 ** (-4 / 20) / np.max(np.abs(impact))
grit_gain = 10 ** (-13 / 20) / np.max(np.abs(grit))
for kind, x, gain, spans in [
    ('impact', impact, impact_gain, [(.029, .120), (.167, .241), (.254, .323)]),
    ('grit', grit, grit_gain, [(.143, .239), (.363, .442), (.816, .911), (1.333, 1.409)]),
]:
    parts = []
    for i, (a, b) in enumerate(spans, 1):
        part = fade(x[round(a * SR):round(b * SR)] * gain)
        write(f'earth-{kind}-{i:02}', part, source=kind, sourceRange=[a, b],
              gainDb=round(float(20 * np.log10(gain)), 2), attackMs=1, releaseMs=12,
              loop=False)
        parts.append(part)
    # Every cut is played twice with silence to make its onset and tail easier to judge.
    audition = [np.zeros(round(.2 * SR))]
    for part in parts:
        for _ in range(2):
            audition.extend([part, np.zeros(round(.55 * SR))])
    write(f'earth-{kind}-audition', np.concatenate(audition),
          purpose='Each independent cut played twice with silent gaps; audition only, not an in-game sequence',
          source=kind, loop=False)

# Keep the quiet material between transients: it is part of the user-approved rolling texture.
rolling = load('grit', highpass=False)
write('earth-roll-natural', fade(rolling, .006, .015), source='grit',
      sourceRange=[0, len(rolling) / SR], gainDb=0, highpassHz=None,
      attackMs=6, releaseMs=15, loop=False,
      purpose='Complete source motion, original gain; only short endpoint fades')
# Trim only quiet outer padding. Preserve every event within the continuous selected range.
start, end, overlap = .04, 2.43, .08
body = rolling[round(start * SR):round(end * SR)].copy()
c = round(overlap * SR)
u = np.linspace(0, 1, c, endpoint=False)
# Move the cyclic seam away from the overlap: final sample flows into the adjacent source sample.
loop = np.concatenate((body[c:-c], body[-c:] * (1 - u) + body[:c] * u))
write('earth-roll-loop', loop, source='grit', sourceRange=[start, end], gainDb=0,
      highpassHz=None, crossfadeMs=80, loop=True, cycleStartsAtSourceTime=start+overlap,
      purpose='Full-motion loop candidate; no transient extraction or level flattening')
write('earth-roll-loop-audition', fade(np.tile(loop, 3), .012, .03), source='grit',
      gainDb=0, loop=False, repeats=3,
      purpose='Three uninterrupted cycles to audition seam and repeating motion; not a gameplay sequence')
def varied_motion(source, seconds=12, seed=569738):
    # An offline sketch of a streaming scheduler, NOT a longer file to loop verbatim in game.
    rng = np.random.default_rng(seed)
    target = round(seconds * SR)
    recent = []
    timeline = []
    output = np.empty(0, dtype=np.float64)

    def quiet_edge(t):
        # Find a nearby low-energy join instead of slicing through a loud particle transient.
        candidates = np.arange(round((t-.018)*SR), round((t+.018)*SR), 48)
        candidates = candidates[(candidates > 120) & (candidates < len(source)-120)]
        return int(min(candidates, key=lambda i: np.mean(source[i-120:i+120] ** 2)))

    while len(output) < target:
        for _ in range(200):
            duration = float(rng.uniform(.72, 1.12))
            start_time = float(rng.uniform(.055, 2.38-duration))
            # Avoid replaying the same local movement immediately, even with a tiny offset change.
            if recent and abs(start_time-recent[-1]) < .38:
                continue
            if len(recent) > 1 and abs(start_time-recent[-2]) < .18:
                continue
            a = quiet_edge(start_time)
            b = quiet_edge(start_time+duration)
            part = source[a:b].copy()
            if np.sqrt(np.mean(part**2)) >= .35*np.sqrt(np.mean(source**2)):
                break
        else:
            raise RuntimeError('Cannot choose a sufficiently different continuous window')
        overlap = min(round(float(rng.uniform(.09,.15))*SR), len(output))
        at = len(output)-overlap
        if overlap:
            theta = np.linspace(0, np.pi/2, overlap)
            output[-overlap:] = output[-overlap:]*np.cos(theta)+part[:overlap]*np.sin(theta)
        output = np.concatenate((output,part[overlap:]))
        timeline.append({'sourceRange':[a/SR,b/SR], 'outputStart':at/SR,
                         'crossfadeMs':overlap/SR*1000})
        recent.append(start_time)
    return fade(output[:target],.015,.06), timeline

varied, schedule = varied_motion(rolling)
write('earth-roll-varied-audition', varied, source='grit', loop=False, gainDb=0,
      highpassHz=None, seed=569738, schedule=schedule, pitchShift=False,
      purpose='12 second continuous variation audition; long windows keep connected texture; do not loop this file in game')

for clip in manifest['clips']:
    if clip['filename'].startswith('earth-impact'):
        clip['reviewStatus'] = 'accepted by user; unchanged'
    elif clip['filename'].startswith('earth-grit'):
        clip['reviewStatus'] = 'not suitable as rolling per user; legacy isolated grain detail only'
    elif clip['filename'].startswith('earth-roll-loop'):
        clip['reviewStatus'] = 'rejected by user: obvious periodic repetition; retained for comparison only'
    else:
        clip['reviewStatus'] = 'rejected by user: falling-grain impacts do not match marble rolling on dirt; archive only'

(OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(manifest, ensure_ascii=False, indent=2))
