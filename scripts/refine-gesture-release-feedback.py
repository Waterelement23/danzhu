"""Audition revision: remove trailing dead air; audible elastic recoil on cancel.
Uses only the selected C-based processed pull, preserves old revisions and A shot.
"""
from pathlib import Path
import wave, hashlib, json
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'assets/audio/gesture-selected-ac-v2'
OUT=ROOT/'assets/audio/gesture-selected-ac-v3'
OUT.mkdir(parents=True,exist_ok=True)
SR=48000

def read(path):
 with wave.open(str(path)) as w:
  assert (w.getframerate(),w.getnchannels(),w.getsampwidth())==(SR,1,2)
  return np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').astype(float)/32768

def rms(x):return np.sqrt(np.mean(x*x))

def smooth(x,n):
 n=int(n)|1; q=np.pad(x,(n//2,n//2),mode='reflect');s=np.r_[0.,np.cumsum(q)]
 return (s[n:]-s[:-n])/n

def fade(x,a,b):
 x=x.copy();i=round(a*SR);j=round(b*SR)
 if i>1:x[:i]*=np.sin(np.linspace(0,np.pi/2,i))**2
 if j>1:x[-j:]*=np.cos(np.linspace(0,np.pi/2,j))**2
 x[0]=x[-1]=0
 return x

# Remove old edge fades by selecting the interior. Audio occupies the whole file.
original=read(BASE/'charge-continuous.wav')
charge=original[round(.055*SR):round(2.425*SR)].copy()
charge*=10**(-26.5/20)/rms(charge)
charge=fade(charge,.012,.025)
# User hears a continuing pull until cancellation, then a separate recoil tail.
partial=charge[:round(1.5*SR)].copy()
history=partial[-round(.85*SR):][::-1].copy()
N=round(.65*SR)
u=np.linspace(0,1,N)
# Descending resampling speed gives explicit high-to-low elasticity; no A launch layer.
speed=1.9-.95*(u*u*(3-2*u))
positions=np.cumsum(speed);positions=(positions-positions[0])/(positions[-1]-positions[0])*(len(history)-1)
cancel=np.interp(positions,np.arange(len(history)),history)
env=np.sqrt(np.maximum(smooth(cancel*cancel,.07*SR),1e-12))
cancel*=smooth(np.clip(rms(cancel)/env,.5,2),.04*SR)
cancel*=10**(-25.0/20)/rms(cancel)
# A brief clear start, then slackening. No early disappearance behind the charge.
cancel*=np.exp(-np.maximum(0,u-.17)*1.55)
cancel=fade(cancel,.008,.065)
overlap=round(.015*SR)
transition=len(partial)-overlap
cancel_demo=np.zeros(len(partial)+len(cancel)-overlap)
cancel_demo[:len(partial)]=partial
cancel_demo[transition:len(partial)]*=np.cos(np.linspace(0,np.pi/2,overlap))**2
c=cancel.copy();c[:overlap]*=np.sin(np.linspace(0,np.pi/2,overlap))**2
cancel_demo[transition:]+=c
cancel_demo[0]=cancel_demo[-1]=0
release=read(ROOT/'assets/audio/gesture-selected-ac/release.wav')
fire=np.zeros(len(charge)+len(release)-overlap)
fire[:len(charge)]=charge
fire[len(charge)-overlap:]+=release
combined=np.r_[fire,np.zeros(round(.6*SR)),cancel_demo]
clips={'charge-continuous-audition':charge,'cancel-only-audition':cancel,
 'charge-cancel-audition':cancel_demo,'gesture-audition':combined}
report={'status':'offline audition v3, not integrated; human listening approval pending',
 'source':'C: Anthousai rubber.wav (CC0); processed through gesture-selected-ac-v2. A launch retained from renne100 Slingshot (CC0).',
 'sourceHash':hashlib.sha256((BASE/'charge-continuous.wav').read_bytes()).hexdigest(),
 'changes':{'trailingPadding':0,'chargeGainTargetRmsDb':-26.5,'chargeCut':[.055,2.425],
 'cancelSeconds':.65,'reverseRecentSeconds':.85,'descendingResampleSpeedShape':[1.9,.95],
 'pitchChange':'intentional high-to-low through variable resampling; not pitch-preserving',
 'cancelRmsTargetBeforeDecayDb':-25,'crossfadeMs':15},'files':{}}
for name,x in clips.items():
 assert np.isfinite(x).all() and max(abs(x))<.95
 path=OUT/f'{name}.wav';pcm=np.round(x*32767).astype('<i2')
 with wave.open(str(path),'wb') as w:
  w.setparams((1,2,SR,0,'NONE','not compressed'));w.writeframes(pcm.tobytes())
 with wave.open(str(path)) as w:
  assert (w.getframerate(),w.getnchannels(),w.getsampwidth(),w.getnframes())==(SR,1,2,len(x))
  q=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2')
  assert q[0]==q[-1]==0 and max(abs(q.astype(float)))<32767
  nonzero=np.flatnonzero(q)
  trailing=(len(q)-1-nonzero[-1])/SR
  assert trailing<.01
 report['files'][path.name]={'seconds':len(x)/SR,'peakDbFS':round(float(20*np.log10(max(abs(x)))),2),
 'rmsDbFS':round(float(20*np.log10(rms(x))),2),'trailingSilenceSeconds':trailing,
 'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'clippedSamples':0}
late=rms(charge[-round(.5*SR):-round(.03*SR)])
early=rms(charge[round(.3*SR):round(.8*SR)])
ratio=float(20*np.log10(late/early))
# Explicitly check the two user-reported issues rather than only file validity.
assert ratio>-2
pre=rms(cancel_demo[transition-round(.15*SR):transition])
post=rms(cancel_demo[transition+round(.02*SR):transition+round(.17*SR)])
assert post/pre>.85
report['feedbackChecks']={'lastHalfSecondVsEarlyDb':round(ratio,2),'cancelOnsetVsChargeDb':round(float(20*np.log10(post/pre)),2),
 'cancelOnsetInSeparateDemo':transition/SR,'cancelOnsetInCombined':(len(fire)+round(.6*SR)+transition)/SR}
(OUT/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
