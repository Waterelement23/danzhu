"""Bow-inspired gesture audition v2 from attributed public preview recordings.
Requires NumPy and ffmpeg. Runtime game audio and v1 are untouched.
"""
from pathlib import Path
import hashlib
import json
import subprocess
import wave
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'assets/audio/gesture-bow-v2'
SR = 48000
sources = {}


def load(name, target_db, peak_db):
    path = OUT/'source'/name
    raw = subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-af',
        'highpass=f=65,lowpass=f=9500','-ac','1','-ar',str(SR),'-f','f32le','pipe:1'])
    x = np.frombuffer(raw,dtype='<f4').astype(float)
    # Trim only leading/trailing near-silence; retain the tension and release texture.
    block = 240
    energy = np.array([np.sqrt(np.mean(x[i:i+block]**2)) for i in range(0,len(x),block)])
    active = np.flatnonzero(energy > max(1e-5,energy.max()*10**(-42/20)))
    start = max(0,int(active[0])*block-round(.01*SR))
    end = min(len(x),(int(active[-1])+1)*block+round(.025*SR))
    trimmed = x[start:end].copy()
    trimmed -= trimmed.mean()
    gain = min(10**(target_db/20)/np.sqrt(np.mean(trimmed**2)),
               10**(peak_db/20)/np.max(np.abs(trimmed)))
    trimmed *= gain
    a,b = round(.004*SR),round(.025*SR)
    trimmed[:a] *= np.sin(np.linspace(0,np.pi/2,a))**2
    trimmed[-b:] *= np.cos(np.linspace(0,np.pi/2,b))**2
    trimmed[0]=trimmed[-1]=0
    sources[name] = {'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
        'trimSeconds':[start/SR,end/SR],'gainDb':round(float(20*np.log10(gain)),3),
        'originalDecodedSeconds':len(x)/SR}
    return trimmed


def put(target,at,x,gain=1):
    i=round(at*SR)
    target[i:i+len(x)] += gain*x


draw=load('bow-draw-preview.mp3',-25,-9)
shoot=load('arrow-release-preview.mp3',-22,-6)
charge=np.zeros(6*SR)
release=np.zeros(4*SR)
sequence=np.zeros(10*SR)
timeline=[]
for i,level in enumerate([.55,.8,1.]):
    put(charge,.35+1.85*i,draw,level)
    put(release,.35+1.2*i,shoot,level)
    at=.35+3*i
    release_at=at+len(draw)/SR-.012
    put(sequence,at,draw,level)
    put(sequence,release_at,shoot,level)
    timeline.append({'strength':['light','medium','strong'][i],'drawAt':at,'releaseAt':round(release_at,4),'gain':level})
clips={'bow-charge':draw,'bow-release':shoot,'bow-charge-audition':charge,
       'bow-release-audition':release,'bow-gesture-audition':sequence}
report={'status':'v2 bow reference audition, not integrated; approval pending',
        'sourceAuthor':'SonoFxAudio', 'license':'CC BY 4.0',
        'licenseUrl':'https://creativecommons.org/licenses/by/4.0/',
        'sourcePages':['https://freesound.org/people/SonoFxAudio/sounds/649336/',
                       'https://freesound.org/people/SonoFxAudio/sounds/649335/'],
        'sourceQuality':'public HQ MP3 previews, not original WAV',
        'processing':'65Hz highpass, 9.5kHz lowpass, mono/48kHz, silence trim, gain, edge fades; no pitch shift or added synthetic layer',
        'sources':sources,'combinedTimeline':timeline,'files':{}}
for name,x in clips.items():
    assert np.isfinite(x).all() and np.max(np.abs(x))<.99
    pcm=np.round(x*32767).astype('<i2')
    path=OUT/f'{name}.wav'
    with wave.open(str(path),'wb') as w:
        w.setparams((1,2,SR,0,'NONE','not compressed')); w.writeframes(pcm.tobytes())
    with wave.open(str(path)) as w:
        assert (w.getnchannels(),w.getsampwidth(),w.getframerate())==(1,2,SR)
        actual=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2')
        assert len(actual)==len(pcm) and actual[0]==actual[-1]==0
        assert np.max(np.abs(actual.astype(float)))<32767
    report['files'][path.name]={'seconds':len(x)/SR,
        'peakDbFS':round(float(20*np.log10(np.max(np.abs(x)))),2),
        'rmsDbFS':round(float(20*np.log10(np.sqrt(np.mean(x*x)))),2),
        'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'clippedSamples':0,'edgeSamples':[0,0]}
(OUT/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
