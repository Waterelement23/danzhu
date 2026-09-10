"""Current audition: retain continuous C charge and A release; cancel only fades charge."""
from pathlib import Path
import json,hashlib,wave
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/audio/gesture-selected-ac-v4'
OUT.mkdir(parents=True,exist_ok=True)
SR=48000

def read(path):
 with wave.open(str(path)) as w:
  assert (w.getframerate(),w.getnchannels(),w.getsampwidth())==(SR,1,2)
  return np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').copy()
charge_path=ROOT/'assets/audio/gesture-selected-ac-v3/charge-continuous-audition.wav'
release_path=ROOT/'assets/audio/gesture-selected-ac/release.wav'
charge=read(charge_path);release=read(release_path)
# No reversed or added cancellation voice: only the last 40ms of the active charge fades.
cancel=charge[:round(1.5*SR)].astype(float)
n=round(.04*SR)
cancel[-n:]*=np.cos(np.linspace(0,np.pi/2,n))**2
cancel=np.round(cancel).astype('<i2');cancel[-1]=0
fire=np.zeros(len(charge)+len(release)-720,dtype=float)
fire[:len(charge)]=charge
fire[len(charge)-720:]+=release
assert max(abs(fire))<32767
combined=np.r_[np.round(fire).astype('<i2'),np.zeros(round(.6*SR),dtype='<i2'),cancel]
clips={'charge-continuous':charge,'release':release,'charge-cancel-audition':cancel,'gesture-audition':combined}
report={'status':'current audition; cancel has no added sound; not integrated',
 'cancelPolicy':'fade only the playing charge over 40ms; no reverse/recoil/release sound',
 'sources':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [charge_path,release_path]},'files':{}}
for name,x in clips.items():
 p=OUT/f'{name}.wav'
 with wave.open(str(p),'wb') as w:
  w.setparams((1,2,SR,0,'NONE','not compressed'));w.writeframes(x.astype('<i2').tobytes())
 with wave.open(str(p)) as w:
  actual=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2')
  assert np.array_equal(x,actual) and x[0]==x[-1]==0 and max(abs(x.astype(float)))<32767
 report['files'][p.name]={'seconds':len(x)/SR,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'clippedSamples':0}
assert np.array_equal(cancel[:-n],charge[:len(cancel)-n])
assert len(cancel)==round(1.5*SR)
(OUT/'validation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
