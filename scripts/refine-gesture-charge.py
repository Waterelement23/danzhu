"""Continuous C-based charge and short reversed cancellation auditions.
Requires NumPy + ffmpeg. Does not modify prior candidates or game runtime.
"""
from pathlib import Path
import numpy as np
import subprocess, wave, json, hashlib
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/audio/gesture-selected-ac-v2'
OUT.mkdir(parents=True,exist_ok=True)
SRC=ROOT/'assets/audio/slingshot-comparison/source/rubber-stretch.mp3'
SR=48000

def ff(x,filters):
 p=subprocess.run(['ffmpeg','-v','error','-f','f32le','-ar',str(SR),'-ac','1','-i','pipe:0','-af',filters,'-f','f32le','pipe:1'],input=x.astype('<f4').tobytes(),stdout=subprocess.PIPE,check=True)
 return np.frombuffer(p.stdout,dtype='<f4').astype(float)

def mean(x,n):
 n=int(n)|1
 a=np.pad(x,(n//2,n//2),mode='reflect')
 c=np.r_[0.,np.cumsum(a)]
 return (c[n:]-c[:-n])/n

def rms(x): return np.sqrt(np.mean(x*x))

def fade(x,attack=.03,release=.06):
 x=x.copy();a=min(len(x)//2,round(attack*SR));b=min(len(x)//2,round(release*SR))
 x[:a]*=np.sin(np.linspace(0,np.pi/2,a))**2
 x[-b:]*=np.cos(np.linspace(0,np.pi/2,b))**2
 x[0]=x[-1]=0
 return x

raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(SRC),'-ac','1','-ar',str(SR),'-f','f32le','pipe:1'])
x=np.frombuffer(raw,dtype='<f4').astype(float)[round(1.70*SR):round(3.10*SR)]
x=ff(x,'highpass=f=110,lowpass=f=6000')
# Suppress isolated snap-like peaks while retaining the source's time/frequency texture.
limit=3.2*np.sqrt(np.maximum(mean(x*x,.045*SR),1e-12))
x=limit*np.tanh(x/limit)
# Gentle 100ms envelope stabilization, not hard gating or repeated grains.
env=np.sqrt(np.maximum(mean(x*x,.100*SR),1e-12))
gain=mean(np.clip(rms(x)/env,.45,2.2),.060*SR)
x=ff(x*gain,'lowpass=f=6000')
# One contiguous source passage is lengthened; no loop or repeated stretch/release cycles.
bed=ff(x,'atempo=0.56')
bed*=10**(-29/20)/rms(bed)

def charge(seconds, tail=True):
 y=ff(bed,f'atempo={len(bed)/SR/seconds}') if abs(len(bed)/SR-seconds)>.03 else bed.copy()
 # Duration may vary slightly with atempo; trim/pad with the low-energy ending.
 target=round(seconds*SR)
 y=np.pad(y,(0,max(0,target-len(y))),mode='edge')[:target]
 y*=np.linspace(.82,1.10,len(y))
 return fade(y, release=.06 if tail else .00005)

def cancel_from(history):
 # Reverse only the actual recent pull, then shorten and let its energy fall away.
 tail=history[-round(.50*SR):][::-1].copy()
 y=ff(tail,'atempo=1.35')
 y*=.85*np.linspace(1,.12,len(y))
 return fade(y,.022,.045)

long=charge(2.5)
partial=charge(1.45, tail=False)
# Cancellation uses the un-faded recent pull; crossfade supplies the turn-around.
cancel=cancel_from(partial)
overlap=round(.022*SR)
stop=np.zeros(len(partial)+len(cancel)-overlap)
stop[:len(partial)]=partial
stop[len(partial)-overlap:len(partial)]*=np.cos(np.linspace(0,np.pi/2,overlap))**2
stop[len(partial)-overlap:]+=cancel
with wave.open(str(ROOT/'assets/audio/gesture-selected-ac/release.wav')) as w:
 release=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').astype(float)/32768

def place(dst,at,x,gain=1):
 i=round(at*SR);dst[i:i+len(x)]+=x*gain

continuous=np.zeros(round(3.1*SR));place(continuous,.25,long)
cancel_demo=np.zeros(round(2.8*SR));place(cancel_demo,.25,stop)
combined=np.zeros(8*SR)
place(combined,.3,long)
place(combined,2.788,release)
place(combined,4.9,stop)
clips={'charge-continuous':long,'charge-cancel':cancel,'charge-continuous-audition':continuous,
       'charge-cancel-audition':cancel_demo,'gesture-audition':combined}
block=4800
windows=np.array([rms(bed[i:i+block]) for i in range(block,len(bed)-2*block,block)])
report={'status':'offline revision; not integrated; user approval pending',
 'source':{'author':'Anthousai','url':'https://freesound.org/people/Anthousai/sounds/399008/','license':'CC0 1.0','sha256':hashlib.sha256(SRC.read_bytes()).hexdigest()},
 'processing':{'sourceCut':[1.7,3.1],'filters':'110Hz highpass / 6kHz lowpass',
 'transients':'soft limiting relative to 45ms RMS, threshold 3.2x RMS',
 'envelope':'100ms RMS stabilization, 60ms gain smoothing, gain bounded .45..2.2',
 'stretchTempo':.56,'cancel':'reverse last 0.50s of actual pull, atempo 1.35, gain .85 fading to .102, 22ms overlap',
 'loops':False,'pitchShift':False,'bed100msRangeDb':round(float(20*np.log10(max(windows)/min(windows))),2)},
 'combinedTimeline':{'charge':[.3,2.8],'fire':2.788,'secondCharge':4.9,'cancelAt':4.9+len(partial)/SR-overlap/SR},'files':{}}
for name,y in clips.items():
 assert np.isfinite(y).all() and max(abs(y))<.9
 pcm=np.round(y*32767).astype('<i2');path=OUT/f'{name}.wav'
 with wave.open(str(path),'wb') as w:
  w.setparams((1,2,SR,0,'NONE','not compressed'));w.writeframes(pcm.tobytes())
 with wave.open(str(path)) as w:
  assert (w.getframerate(),w.getnchannels(),w.getsampwidth(),w.getnframes())==(SR,1,2,len(y))
  q=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2')
  assert q[0]==q[-1]==0 and max(abs(q.astype(float)))<32767
 report['files'][path.name]={'seconds':len(y)/SR,'peakDbFS':round(float(20*np.log10(max(abs(y)))),2),
 'rmsDbFS':round(float(20*np.log10(rms(y))),2),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'clippedSamples':0}
# Cancellation now has nonzero energy after the pull stops, then fades to silence.
assert rms(stop[len(partial):])>.001
assert rms(stop[-round(.06*SR):])<rms(stop[len(partial):len(partial)+round(.06*SR)])
(OUT/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
