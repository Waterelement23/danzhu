"""Process user-selected A release + C stretch into offline gesture auditions.
Requires NumPy and ffmpeg; preserves source previews and existing runtime files.
"""
from pathlib import Path
import subprocess, wave, json, hashlib
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'assets/audio/slingshot-comparison/source'
OUT=ROOT/'assets/audio/gesture-selected-ac'
OUT.mkdir(parents=True,exist_ok=True)
SR=48000
sources={}

def read(name,filters):
 p=SRC/name
 sources[name]=hashlib.sha256(p.read_bytes()).hexdigest()
 return np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(p),'-af',filters,'-ac','1','-ar',str(SR),'-f','f32le','pipe:1']),dtype='<f4').astype(float)

def fade(x,attack=.018,release=.055):
 x=x.copy(); a=min(len(x)//2,round(attack*SR));b=min(len(x)//2,round(release*SR))
 x[:a]*=np.sin(np.linspace(0,np.pi/2,a))**2
 x[-b:]*=np.cos(np.linspace(0,np.pi/2,b))**2
 x[0]=x[-1]=0
 return x

def level(x,db,peak_db):
 # Constant gain only: preserve the chosen recording's texture/dynamics.
 x=x-x.mean()
 g=min(10**(db/20)/np.sqrt(np.mean(x*x)),10**(peak_db/20)/max(abs(x)))
 return x*g,float(20*np.log10(g))

def tempo(x,factor):
 out=subprocess.run(['ffmpeg','-v','error','-f','f32le','-ar',str(SR),'-ac','1','-i','pipe:0','-af',f'atempo={factor}','-f','f32le','pipe:1'],input=x.astype('<f4').tobytes(),stdout=subprocess.PIPE,check=True).stdout
 return np.frombuffer(out,dtype='<f4').astype(float)

stretch=read('rubber-stretch.mp3','highpass=f=110,lowpass=f=6500,acompressor=threshold=0.025:ratio=4:attack=0.3:release=35:makeup=1:knee=2.8')
shot=read('slingshot-a.mp3','highpass=f=90,lowpass=f=8500')
# Two complete active pulls separated by quiet handling in C; do not loop the 7.7s recording.
charge1,g1=level(stretch[round(.80*SR):round(3.20*SR)],-28,-12)
charge2,g2=level(stretch[round(5.50*SR):round(7.22*SR)],-28,-12)
charge1=fade(charge1);charge2=fade(charge2)
# Locate A's short attack from 1ms energy; avoid its ~0.4s leading silence.
block=48
energy=np.array([np.sqrt(np.mean(shot[i:i+block]**2)) for i in range(0,len(shot),block)])
active=np.flatnonzero(energy>energy.max()*10**(-28/20))
start=max(0,int(active[0])*block-round(.002*SR))
end=min(len(shot),(int(active[-1])+1)*block+round(.05*SR))
release,gr=level(shot[start:end],-23,-8)
release=fade(release,.0007,.025)
quick=fade(tempo(charge2,1.65))
clips={'charge-main':charge1,'charge-alternate':charge2,'charge-quick':quick,'release':release}

def put(dst,at,x,gain=1):
 i=round(at*SR);dst[i:i+len(x)]+=x*gain

charge_demo=np.zeros(7*SR)
put(charge_demo,.3,quick,.75)
put(charge_demo,2,charge1)
# A cancelled partial pull must fade out with no release or impact afterwards.
cancel=fade(charge2[:round(.65*SR)],.018,.06)
put(charge_demo,5.4,cancel,.8)
release_demo=np.zeros(3*SR)
for at,g in [(.3,.6),(1.2,.8),(2.1,1)]: put(release_demo,at,release,g)
combined=np.zeros(10*SR)
release_times=[]
for at,clip,g in [(.35,quick,.75),(3,charge1,1)]:
 put(combined,at,clip,g)
 r=at+len(clip)/SR-.012
 put(combined,r,release,g)
 release_times.append(r)
put(combined,7.7,cancel,.8)
clips.update({'charge-audition':charge_demo,'release-audition':release_demo,'gesture-audition':combined})
report={'status':'A selected for release, C selected for charge; processed timbre pending audition, not integrated',
 'sourceQuality':'Public HQ MP3 previews, not original WAV','sourceHashes':sources,
 'sources':{'release':{'author':'renne100','url':'https://freesound.org/people/renne100/sounds/353033/','license':'CC0 1.0'},
 'charge':{'author':'Anthousai','url':'https://freesound.org/people/Anthousai/sounds/399008/','license':'CC0 1.0'}},
 'processing':{'chargeCuts':[[.80,3.20],[5.50,7.22]],'chargeFilters':'110Hz highpass, 6.5kHz lowpass, 4:1 fast transient compression (threshold .025, attack .3ms, release 35ms)',
 'releaseCut':[start/SR,end/SR],'releaseFilters':'90Hz highpass, 8.5kHz lowpass',
 'constantGainsDb':[g1,g2,gr],'quickTempo':1.65,'pitchShift':False,
 'combinedReleaseTimes':release_times,'cancelAt':7.7,'cancelEnds':8.35},'files':{}}
for name,x in clips.items():
 assert np.isfinite(x).all() and np.max(np.abs(x))<.98
 path=OUT/f'{name}.wav'; pcm=np.round(x*32767).astype('<i2')
 with wave.open(str(path),'wb') as w:
  w.setparams((1,2,SR,0,'NONE','not compressed'));w.writeframes(pcm.tobytes())
 with wave.open(str(path)) as w:
  assert (w.getnchannels(),w.getsampwidth(),w.getframerate(),w.getnframes())==(1,2,SR,len(x))
  decoded=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2')
  assert decoded[0]==decoded[-1]==0 and max(abs(decoded.astype(float)))<32767
 report['files'][path.name]={'seconds':len(x)/SR,'peakDbFS':round(float(20*np.log10(max(abs(x)))),2),
 'rmsDbFS':round(float(20*np.log10(np.sqrt(np.mean(x*x)))),2),'clippedSamples':0,
 'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
# Check demo timing, including the cancellation tail with no subsequent shot.
assert np.max(np.abs(combined[round(8.35*SR):]))==0
(OUT/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
