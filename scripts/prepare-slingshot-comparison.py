"""Level-adjust public CC0 preview candidates for audition; no runtime edits."""
from pathlib import Path
import hashlib, json, subprocess, wave
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/audio/slingshot-comparison'
report={'status':'audition only; not selected or integrated','sourceQuality':'public HQ MP3 previews',
 'processing':'mono 48kHz, whole-clip gain targeting active RMS -24dBFS with peak cap -6dBFS, 3ms edge fades; no EQ/pitch/time edits', 'files':{}}
for name,author,sid in [('slingshot-a','renne100',353033),('slingshot-b','olver',513934),('rubber-stretch','Anthousai',399008)]:
 src=OUT/'source'/f'{name}.mp3'
 data=subprocess.check_output(['ffmpeg','-v','error','-i',str(src),'-ac','1','-ar','48000','-f','f32le','pipe:1'])
 x=np.frombuffer(data,dtype='<f4').astype(float)
 block=480
 levels=np.array([np.sqrt(np.mean(x[i:i+block]**2)) for i in range(0,len(x),block)])
 active=levels[levels>levels.max()*.01]
 r=np.sqrt(np.mean(active**2))
 gain=min(10**(-24/20)/r,10**(-6/20)/np.max(np.abs(x)))
 x*=gain
 k=144
 x[:k]*=np.sin(np.linspace(0,np.pi/2,k))**2
 x[-k:]*=np.cos(np.linspace(0,np.pi/2,k))**2
 x[0]=x[-1]=0
 assert np.isfinite(x).all() and np.max(np.abs(x))<.99
 dest=OUT/f'{name}-audition.wav'
 pcm=np.round(x*32767).astype('<i2')
 with wave.open(str(dest),'wb') as w:
  w.setparams((1,2,48000,0,'NONE','not compressed'));w.writeframes(pcm.tobytes())
 with wave.open(str(dest)) as w:
  assert (w.getnchannels(),w.getsampwidth(),w.getframerate(),w.getnframes())==(1,2,48000,len(x))
  d=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2')
  assert d[0]==d[-1]==0 and np.max(np.abs(d.astype(float)))<32767
 report['files'][dest.name]={'author':author,'source':f'https://freesound.org/people/{author}/sounds/{sid}/','license':'CC0 1.0',
 'duration':round(len(x)/48000,4),'gainDb':round(float(20*np.log10(gain)),2),
 'peakDbFS':round(float(20*np.log10(np.max(np.abs(x)))),2),'clippedSamples':0,
 'sourceSha256':hashlib.sha256(src.read_bytes()).hexdigest(),'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()}
(OUT/'validation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
