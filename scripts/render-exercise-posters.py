"""Render canonical previews of the same CC0 human skin used by the app."""
import argparse, hashlib, json, os, subprocess
from pathlib import Path
p=argparse.ArgumentParser()
p.add_argument('--motions',default='.local/3d/human-motions')
p.add_argument('--output',default='public/exercise-posters')
p.add_argument('--size',type=int,default=640)
a=p.parse_args()
root=Path(__file__).resolve().parent.parent
output=(root/a.output).resolve();output.mkdir(parents=True,exist_ok=True)
manifest=[]
for index,file in enumerate(sorted((root/a.motions).glob('*.json'))):
    data=json.loads(file.read_text());exercise_id=data['exercise']['id']
    frame=data['frameCount']//3;temporary=root/'.local/3d/human-posters'/exercise_id
    temporary.mkdir(parents=True,exist_ok=True)
    log=temporary/'render.log'
    with log.open('w') as stream:
        subprocess.run(['blender','-b','-t','2','--python-exit-code','1','--python','scripts/render-exercises.py','--','--input',str(file),'--out',str(temporary),'--engine','workbench','--size',str(a.size),'--frame',str(frame)],cwd=root,env={**os.environ,'OPENBLAS_NUM_THREADS':'1','LP_NUM_THREADS':'2','XDG_CACHE_HOME':'/tmp/fitcore-blender-cache'},stdout=stream,stderr=subprocess.STDOUT,check=True)
    image=temporary/f'frame-{frame:04d}.png';dest=output/f'{exercise_id}.webp'
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(image),'-c:v','libwebp','-quality','88','-frames:v','1',str(dest)],check=True)
    manifest.append({'exerciseId':exercise_id,'file':dest.name,'width':a.size,'height':a.size,'bytes':dest.stat().st_size,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'humanModelSha256':data['humanModel']['sha256']})
    print(f'Human preview {index+1}/38: {exercise_id}',flush=True)
if len(manifest)!=38:raise RuntimeError(f'Expected 38 canonical previews, got {len(manifest)}')
(output/'manifest.json').write_text(json.dumps({'schema':1,'kind':'continuous-human-cc0-base','previews':manifest},indent=2)+'\n')
print('All 38 human previews verified and written.',flush=True)
