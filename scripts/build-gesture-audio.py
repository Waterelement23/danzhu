"""Deterministic fingertip-friction / flick sound-design auditions (not recordings).
Run with Python + NumPy. Does not modify runtime game audio.
"""
from pathlib import Path
import hashlib
import json
import wave
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/audio/gesture-candidates'
OUT.mkdir(parents=True, exist_ok=True)
SR = 48000


def rms(x):
    return np.sqrt(np.mean(x*x))


def noise(seconds, seed, low=160, high=1700):
    n = round(seconds*SR)
    rng = np.random.default_rng(seed)
    f = np.fft.rfftfreq(n, 1/SR)
    shape = (f*f/(f*f+low*low)) / np.sqrt(1+(f/high)**8)
    bins = (rng.normal(size=len(f)) + 1j*rng.normal(size=len(f))) * shape
    bins[0] = 0
    bins[-1] = bins[-1].real
    x = np.fft.irfft(bins, n=n)
    return x / rms(x)


def fades(x, attack=.035, release=.055):
    x = x.copy()
    a, b = min(len(x)//2, round(attack*SR)), min(len(x)//2, round(release*SR))
    x[:a] *= np.sin(np.linspace(0, np.pi/2, a))**2
    x[-b:] *= np.cos(np.linspace(0, np.pi/2, b))**2
    x[0] = x[-1] = 0
    return x


def drag(seconds, start, end, seed):
    x = noise(seconds, seed)
    rng = np.random.default_rng(seed+1)
    # Non-periodic low-depth changes in friction, no pitched rise or distinct grains.
    anchors = np.linspace(0, 1, max(4, round(seconds*18)))
    t = np.linspace(0, 1, len(x))
    texture = np.interp(t, anchors, rng.uniform(.88, 1.12, len(anchors)))
    strength = start+(end-start)*(t*t*(3-2*t))
    return fades(x * texture * (.009 + .021*strength))


def flick(seed, strength):
    seconds = .14
    t = np.arange(round(seconds*SR))/SR
    # Short dull pressure impulse, with an aperiodic slip tail. No long glass ring.
    pulse = noise(seconds, seed, 180, 1900) * np.exp(-t/.008)
    body = (np.sin(2*np.pi*330*t) + .27*np.sin(2*np.pi*720*t)) * np.exp(-t/.009)
    slip = noise(seconds, seed+10, 260, 1500) * np.exp(-t/.019)
    x = fades(.62*pulse + .23*body + .15*slip, .0006, .025)
    x *= (0.11 + .17*strength) / np.max(np.abs(x))
    return x


clips = {f'release-{i+1:02d}': flick(701+i, s) for i,s in enumerate([.25,.55,.9])}
charge = np.zeros(6*SR)
release = np.zeros(round(3.2*SR))
combined = np.zeros(round(10*SR))


def put(target, at, x):
    offset = round(at*SR)
    target[offset:offset+len(x)] += x


for at, seconds, start, end, seed in [(.35,1.2,.1,.45,501),(2.2,1.4,.25,.8,502),(4.2,1.1,.7,.1,503)]:
    put(charge, at, drag(seconds,start,end,seed))
for i, at in enumerate([.4,1.35,2.3]):
    put(release,at,clips[f'release-{i+1:02d}'])
for i,(at,seconds,strength) in enumerate([(.4,.9,.25),(3.4,1.2,.55),(6.9,1.6,.9)]):
    # Drag ends at release; its short fade overlaps the fingertip impulse slightly.
    put(combined,at,drag(seconds+.035,.08,strength,601+i))
    put(combined,at+seconds,clips[f'release-{i+1:02d}'])
clips.update({'aim-charge-audition':charge,'release-audition':release,'gesture-audition':combined})
validation = {'source':'Procedural sound-design synthesis only; no sampled recording.',
              'status':'offline audition; user timbre approval pending; not integrated',
              'sampleRate':SR,'channels':1,'bitDepth':16,'files':{}}
for name,x in clips.items():
    assert np.isfinite(x).all() and np.max(np.abs(x))<.95
    assert x[0]==0 and x[-1]==0
    path=OUT/f'{name}.wav'
    pcm=np.round(x*32767).astype('<i2')
    with wave.open(str(path),'wb') as w:
        w.setparams((1,2,SR,0,'NONE','not compressed'))
        w.writeframes(pcm.tobytes())
    with wave.open(str(path)) as w:
        assert (w.getnchannels(),w.getsampwidth(),w.getframerate(),w.getnframes())==(1,2,SR,len(x))
        decoded=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2')
    assert np.max(np.abs(decoded.astype(float)))<32767
    validation['files'][path.name]={'seconds':len(x)/SR,'peakDbFS':round(float(20*np.log10(np.max(np.abs(x)))),2),
        'rmsDbFS':round(float(20*np.log10(rms(x))),2),'clippedSamples':int(np.sum(np.abs(decoded.astype(float))>=32767)),
        'edgeSamples':[int(decoded[0]),int(decoded[-1])],'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
(OUT/'validation.json').write_text(json.dumps(validation,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(validation,ensure_ascii=False,indent=2))
