"""Original FitCore articulated-mannequin render pipeline for Blender 4.3+.
Run with: blender -b -t 4 --python scripts/render-exercises.py -- --input FILE --out DIR
The illustrations are original educational artwork; they are not motion capture or clinical validation.
"""
import argparse, json, math, sys, time, subprocess, hashlib, shutil
from pathlib import Path
import bpy
from mathutils import Vector
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parent))
from human_deformer import HumanDeformer

args_list = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
p = argparse.ArgumentParser()
p.add_argument('--input', required=True)
p.add_argument('--human-asset', default='public/models/human/athletic-human.json')
p.add_argument('--out', default='.local/3d/render')
p.add_argument('--engine', choices=['eevee', 'workbench'], default='eevee')
p.add_argument('--frame', type=int, help='Render just this zero-based frame for benchmarking')
p.add_argument('--count', type=int, help='Render only the first N frames; benchmark only, no video')
p.add_argument('--size', type=int, default=720)
p.add_argument('--samples', type=int, default=16)
p.add_argument('--codec', choices=['h264', 'hevc', 'webm'], default='h264')
p.add_argument('--save-blend', action='store_true')
p.add_argument('--no-video', action='store_true')
p.add_argument('--no-render', action='store_true', help='Build an animated Blender project without rendering images')
p.add_argument('--encode-only', action='store_true', help='Reuse all existing frame PNGs and only encode/verify the video')
p.add_argument('--alpha', action='store_true', help='Transparent background for WebM export only')
a = p.parse_args(args_list)
if not 64 <= a.size <= 8192: p.error('--size must be between 64 and 8192')
if not 1 <= a.samples <= 256: p.error('--samples must be between 1 and 256')
if a.count is not None and a.count < 1: p.error('--count must be positive')
if a.encode_only and (a.frame is not None or a.count is not None or a.no_render or a.save_blend): p.error('--encode-only cannot be combined with frame/count/no-render/save-blend')
if a.alpha and a.codec != 'webm': p.error('--alpha requires --codec webm')
source = json.loads(Path(a.input).read_text())
ex = source['exercise']; frames = source['frames'];
human_bytes=Path(a.human_asset).read_bytes(); human_asset=json.loads(human_bytes)
human_sha256=hashlib.sha256(human_bytes).hexdigest()
if source.get('humanModel',{}).get('sha256') != human_sha256: raise ValueError('Human model provenance differs; regenerate motion JSON with the current model')
if any('humanBones' not in frame for frame in frames): raise ValueError('Export motion schema2 with shared human bone targets before rendering')
deformer=HumanDeformer(human_asset, float(source.get('humanGrip', 0)))
out = Path(a.out).resolve(); out.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE_NEXT' if a.engine == 'eevee' else 'BLENDER_WORKBENCH'
scene.render.resolution_x = a.size; scene.render.resolution_y = a.size; scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'; scene.render.film_transparent = a.alpha
scene.render.fps = int(source['fps']); scene.render.image_settings.color_mode = 'RGBA' if a.alpha else 'RGB'
scene.render.use_file_extension = True
scene.world.color = (0.004, 0.005, 0.008)
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (0.004, 0.0048, 0.007, 1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .3
if hasattr(scene, 'eevee') and hasattr(scene.eevee, 'taa_render_samples'): scene.eevee.taa_render_samples = a.samples
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
if a.engine == 'workbench':
    sh = scene.display.shading
    sh.light = 'STUDIO'; sh.studiolight_rotate_z = .35; sh.color_type = 'MATERIAL'
    sh.show_shadows = True; sh.show_cavity = True; sh.cavity_type = 'BOTH'
    sh.curvature_ridge_factor = 1.25; sh.curvature_valley_factor = .8
    sh.show_specular_highlight = True; sh.show_object_outline = False
    sh.background_type = 'WORLD'; sh.background_color = (.051, .059, .078)
    scene.display.render_aa = '8'

def mat(name, color, metallic=0., roughness=.55, emission=0.):
    m = bpy.data.materials.new(name); m.diffuse_color = (*color, 1); m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF'); bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Metallic'].default_value = metallic; bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Emission Color'].default_value = (*color, 1); bsdf.inputs['Emission Strength'].default_value = emission
    return m
slate = mat('Matte slate mannequin', (.19,.23,.29), .12, .54)
slate_dark = mat('Matte graphite joints', (.105,.13,.17), .1, .6)
primary = mat('Primary muscle energetic orange', (1.,.16,.018), .05, .45, .35)
secondary = mat('Secondary muscle amber', (1.,.49,.055), .05, .5, .12)
metal = mat('Equipment graphite metal', (.075,.095,.13), .75,.3)
chrome = mat('Equipment steel handles', (.32,.4,.48), .8,.26)
bench_mat = mat('Bench upholstery', (.045,.064,.085), .03,.68)
cyan = mat('Elastic cable cyan', (.08,.65,.78), .25,.45,.12)
red = mat('Caution HUD red', (1.,.03,.045), .1,.4, 1.8)
floor_mat = mat('Obsidian studio', (.003,.004,.006), .02,.86)
line_mat = mat('Studio grid', (.035,.055,.075), .2,.8)

def vec(raw): return Vector((raw[0], raw[2], raw[1]))
def smooth(obj):
    if hasattr(obj.data, 'polygons'):
        for face in obj.data.polygons: face.use_smooth = True
    return obj

def sphere(name, material, segments=24, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1)
    obj = bpy.context.object; obj.name = name; obj.data.materials.append(material); smooth(obj)
    return obj

def tube(name, material, radius=1):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=1)
    obj = bpy.context.object; obj.name = name; obj.data.materials.append(material); smooth(obj)
    return obj

def fit(obj, start, end, rx, ry=None):
    direction = end-start; obj.location = (start+end)/2
    obj.rotation_mode = 'QUATERNION'; obj.rotation_quaternion = direction.to_track_quat('Z', 'Y')
    obj.scale = (rx, ry or rx, max(.001, direction.length/2+rx*.25))

def ellipsoid(obj, center, scale, rotation=None):
    obj.location = center; obj.scale = scale
    if rotation: obj.rotation_mode = 'QUATERNION'; obj.rotation_quaternion = rotation

focus = ex['group']; second = set(ex.get('secondaryMuscles', []))
def muscle_material(group): return primary if group == focus else secondary if group in second else slate

# One continuous CC0 human surface. No spheres/capsules compose the body.
rest_vertices=np.ascontiguousarray(deformer.positions[:,[0,2,1]],dtype=np.float32)
triangles=deformer.indices[:,[0,2,1]].tolist()
mesh=bpy.data.meshes.new('Continuous athletic human skin')
mesh.from_pydata(rest_vertices.tolist(),[],triangles); mesh.update()
human=bpy.data.objects.new('MakeHuman CC0 continuous athletic body',mesh)
bpy.context.collection.objects.link(human); smooth(human)
human_mat=bpy.data.materials.new('Human skin and muscle vertex colors'); human_mat.use_nodes=True
bsdf=human_mat.node_tree.nodes.get('Principled BSDF'); bsdf.inputs['Roughness'].default_value=.58; bsdf.inputs['Metallic'].default_value=.05
attribute=human_mat.node_tree.nodes.new('ShaderNodeVertexColor'); attribute.layer_name='muscleColor'
human_mat.node_tree.links.new(attribute.outputs['Color'],bsdf.inputs['Base Color'])
mesh.materials.append(human_mat)
colors=mesh.color_attributes.new(name='muscleColor',type='FLOAT_COLOR',domain='POINT')
palette=[]
for region in human_asset['regionNames']:
    if region in ['shorts','hair']: c=(.018,.024,.035,1)
    elif region==focus: c=(1.,.19,.025,1)
    elif region in second: c=(1.,.54,.08,1)
    else: c=(.45,.49,.55,1)
    palette.append(c)
vertex_colors=np.asarray([palette[i] for i in human_asset['regions']],dtype=np.float32)
for i, region in enumerate(human_asset.get('anatomicalRegions', [])):
    if human_asset['regions'][i]==11 and human_asset['regionNames'][region]=='Glúteos' and focus=='Glúteos': vertex_colors[i]=(1.,.19,.025,1)
colors.data.foreach_set('color',vertex_colors.ravel())
mesh.color_attributes.active_color=colors
# Workbench uses vertex colors; equipment receives its own flat color attribute.
if a.engine=='workbench': scene.display.shading.color_type='VERTEX'
human_basis=None
if a.save_blend:
    human_basis=human.shape_key_add(name='Basis'); human.data.shape_keys.use_relative=False
# Small, stationary red torus indicators follow the caution joints. They indicate catalog cautions only.
hud=[]
for caution in ex.get('cautions',[]):
    keys={'Ombro':['leftShoulder','rightShoulder'],'Punho':['leftHand','rightHand'],'Cotovelo':['leftElbow','rightElbow'],'Joelho':['leftKnee','rightKnee'],'Tornozelo':['leftAnkle','rightAnkle'],'Lombar':['hip']}.get(caution,[])
    for key in keys:
        bpy.ops.mesh.primitive_torus_add(major_radius=.08,minor_radius=.003,major_segments=40,minor_segments=6)
        obj=bpy.context.object; obj.name='Catalog caution '+caution; obj.data.materials.append(red); hud.append((obj,key))

# Equipment objects are created once and updated for every frame.
equipment=[]
for idx,e in enumerate(frames[0]['equipment']):
    if e['kind']=='box':
        bpy.ops.mesh.primitive_cube_add(size=1); obj=bpy.context.object; obj.name='Upholstered machine panel '+str(idx); obj.data.materials.append(bench_mat if e.get('color') else metal)
        bevel=obj.modifiers.new('Soft manufactured edges','BEVEL'); bevel.width=.025; bevel.segments=3; obj.modifiers.new('Weighted metal normals','WEIGHTED_NORMAL')
    elif e['kind']=='weight':
        bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=1,depth=1); obj=bpy.context.object; obj.name='Weight plate '+str(idx); obj.data.materials.append(metal); smooth(obj)
        bevel=obj.modifiers.new('Plate edge bevel','BEVEL'); bevel.width=.025; bevel.segments=2; obj.modifiers.new('Plate normals','WEIGHTED_NORMAL')
    else:
        obj=tube('Frame or cable '+str(idx),cyan if e.get('color') else chrome)
    equipment.append(obj)

bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.005)); floor=bpy.context.object; floor.name='Obsidian studio floor'; floor.data.materials.append(floor_mat)
# Floor registration marks, restrained and deliberately away from the mannequin.
for n in range(-4,5):
    for axis in [0,1]:
        o=tube('Studio reference grid',line_mat)
        x=Vector((n*.5,-2,-.004)) if axis==0 else Vector((-2,n*.5,-.004))
        y=Vector((n*.5,2,-.004)) if axis==0 else Vector((2,n*.5,-.004)); fit(o,x,y,.0015)

def area(name, location, energy, color, size):
    bpy.ops.object.light_add(type='AREA',location=location); o=bpy.context.object; o.name=name; o.data.energy=energy; o.data.color=color; o.data.shape='DISK'; o.data.size=size; o.rotation_euler=(Vector((0,0,.8))-o.location).to_track_quat('-Z','Y').to_euler()
area('Cold neutral studio key',(-3,4,5),550,(.82,.9,1.),4)
area('Soft cyan contour rim',(3,-3,3.4),350,(.15,.7,1.),3)
area('Low neutral fill',(4,4,2.4),180,(.75,.83,1.),3)

if a.alpha:
    floor.hide_render=True
    for obj in scene.objects:
        if obj.name.startswith('Studio reference grid'): obj.hide_render=True

# Fit a stable camera to the whole motion, avoiding per-frame camera breathing.
points=[vec(v) for frame in frames[::max(1,len(frames)//12)] for v in frame['body'].values()]
for frame in frames[::max(1,len(frames)//12)]:
    for e in frame['equipment']:
        if e['kind']=='line': points.extend([vec(e['from']),vec(e['to'])])
        else: points.append(vec(e['center']))
lo=Vector(tuple(min(v[i] for v in points) for i in range(3))); hi=Vector(tuple(max(v[i] for v in points) for i in range(3)))
center=(lo+hi)/2
bpy.ops.object.camera_add(); camera=bpy.context.object; camera.name='Stable editorial studio camera'; scene.camera=camera; camera.data.type='ORTHO'
size=max(hi.x-lo.x,hi.y-lo.y,hi.z-lo.z)
lying=focus=='Abdômen' or 'supino-reto' in ex['id'] or ex['id'] in ['crucifixo-com-halteres','mesa-flexora','elevacao-pelvica']
back=focus in ['Costas','Panturrilhas']
preset=(source.get('presentation') or {}).get('camera', 'perspective')
directions={'front':(1.2,6,2.0),'side':(6,1.6,2.4),'back':(2.8,-5,2.5),'upper':(3,4,5.5),'perspective':(3,5,2.3)}
direction=Vector(directions.get(preset,(3,-5 if back else 5,3.0 if lying else 2.3))).normalized()
camera.location=center+direction*5
camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.ortho_scale=max(2.35,size*1.3)

# The same bone targets as WebGL deform the continuous surface on the CPU.
def update(frame):
    b={k:vec(v) for k,v in frame['body'].items()}
    posed=deformer.blender_positions(frame['humanBones'])
    human.data.vertices.foreach_set('co',posed.ravel())
    human.data.update()
    return posed

def update_equipment(frame):
    b={k:vec(v) for k,v in frame['body'].items()}
    for obj,key in hud:
        obj.location=b[key]+(camera.location-b[key]).normalized()*.10
        obj.rotation_euler=(camera.location-obj.location).to_track_quat('Z','Y').to_euler()
    for obj,e in zip(equipment,frame['equipment']):
        if e['kind']=='line': fit(obj,vec(e['from']),vec(e['to']),e['width']/2)
        elif e['kind']=='box': obj.location=vec(e['center']); obj.scale=(e['size'][0],e['size'][2],e['size'][1])
        else:
            obj.location=vec(e['center']); obj.scale=(e['radius'],e['radius'],e['length'])
            axis={'x':Vector((1,0,0)),'y':Vector((0,0,1)),'z':Vector((0,1,0))}[e['axis']]; obj.rotation_mode='QUATERNION'; obj.rotation_quaternion=axis.to_track_quat('Z','Y')

if a.engine=='workbench':
    for obj in scene.objects:
        if obj.type=='MESH' and obj is not human:
            m=obj.data.materials[0] if obj.data.materials else slate
            attr=obj.data.color_attributes.new(name='equipmentColor',type='FLOAT_COLOR',domain='POINT')
            attr.data.foreach_set('color',np.tile(np.asarray(m.diffuse_color,dtype=np.float32),(len(obj.data.vertices),1)).ravel())
            obj.data.color_attributes.active_color=attr

scene.frame_start=1; scene.frame_end=len(frames)
animated=[obj for obj in scene.objects if obj.type=='MESH' and obj is not human and obj is not floor and not obj.name.startswith('Studio reference grid')]
indices=[] if a.encode_only else [a.frame] if a.frame is not None else range(min(len(frames),a.count) if a.count else len(frames))
start=time.monotonic()
for index in indices:
    if index<0 or index>=len(frames): raise ValueError('Frame index out of bounds')
    scene.frame_set(index+1)
    posed=update(frames[index]); update_equipment(frames[index]); scene.render.filepath=str(out/f'frame-{index:04d}.png')
    if a.save_blend:
        key=human.shape_key_add(name=f'Human pose {index+1:04d}')
        key.data.foreach_set('co',posed.ravel()); key.interpolation='KEY_LINEAR'
        human.data.shape_keys.eval_time=key.frame
        human.data.shape_keys.keyframe_insert(data_path='eval_time',frame=index+1)
        for obj in animated:
            obj.keyframe_insert(data_path='location',frame=index+1)
            obj.keyframe_insert(data_path='scale',frame=index+1)
            obj.keyframe_insert(data_path='rotation_quaternion' if obj.rotation_mode=='QUATERNION' else 'rotation_euler',frame=index+1)
    if not a.no_render: bpy.ops.render.render(write_still=True)
    print(f'FITCORE_FRAME {index+1}/{len(frames)} elapsed={time.monotonic()-start:.2f}s',flush=True)
if a.save_blend:
    for obj in animated:
        if obj.animation_data and obj.animation_data.action:
            for curve in obj.animation_data.action.fcurves:
                for keyframe in curve.keyframe_points: keyframe.interpolation='LINEAR'
    scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=str(out/(ex['id']+'.blend')))
if a.frame is None and a.count is None and not a.no_video and not a.no_render:
    if not all((out/f'frame-{n:04d}.png').is_file() for n in range(len(frames))): raise RuntimeError('A complete matching frame sequence is required before encoding')
    video=out/(ex['id']+('.webm' if a.codec=='webm' else '.hevc.mp4' if a.codec=='hevc' else '.mp4'))
    codec={'h264':['-c:v','libx264','-preset','slow','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart'], 'hevc':['-c:v','libx265','-preset','medium','-crf','26','-pix_fmt','yuv420p','-tag:v','hvc1','-movflags','+faststart'], 'webm':['-c:v','libvpx-vp9','-crf','34','-b:v','0','-pix_fmt','yuva420p' if a.alpha else 'yuv420p']}[a.codec]
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-framerate',str(source['fps']),'-i',str(out/'frame-%04d.png'),*codec,'-an',str(video)],check=True)
    probe = json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-count_frames','-show_entries','stream=codec_name,width,height,avg_frame_rate,nb_read_frames,duration','-show_entries','format=duration,size','-of','json',str(video)]))
    stream=probe['streams'][0]
    rate_n,rate_d=stream['avg_frame_rate'].split('/')
    actual_fps=float(rate_n)/float(rate_d)
    actual_frames=int(stream['nb_read_frames'])
    if actual_frames != len(frames) or abs(actual_fps-source['fps'])>.001:
        raise RuntimeError('Encoded video does not match source frame count or cadence')
    if stream['width'] != a.size or stream['height'] != a.size:
        raise RuntimeError('Encoded dimensions do not match requested dimensions')
    if video.stat().st_size >= 1_500_000:
        raise RuntimeError('Video exceeds the 1.5 MB production limit; tune codec CRF before publication')
    poster=out/(ex['id']+'.poster.png'); poster_webp=out/(ex['id']+'.poster.webp')
    shutil.copyfile(out/f'frame-{len(frames)//2:04d}.png',poster)
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(poster),'-c:v','libwebp','-lossless','1','-compression_level','6','-frames:v','1',str(poster_webp)],check=True)
    manifest={'file':video.name,'poster':poster_webp.name,'posterBytes':poster_webp.stat().st_size,'reviewPoster':poster.name,'schema':1,'exerciseId':ex['id'],'kind':'continuous-human-skinned-mesh','humanModelSha256':human_sha256,'humanMeshSource':human_asset['source'],'humanVertexCount':len(deformer.positions),'renderer':a.engine,'codec':stream['codec_name'],'width':stream['width'],'height':stream['height'],'fps':actual_fps,'frameCount':actual_frames,'durationSeconds':float(probe['format']['duration']),'bytes':video.stat().st_size,'sha256':hashlib.sha256(video.read_bytes()).hexdigest(),'motionSourceSha256':hashlib.sha256(Path(a.input).read_bytes()).hexdigest(),'transparent':a.alpha,'clinicalValidation':False,'humanModel':source.get('humanModel'),'humanGrip':source.get('humanGrip'),'productionGuide':source.get('presentation')}
    (out/(ex['id']+('.hevc.manifest.json' if a.codec=='hevc' else '.manifest.json'))).write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(f'FITCORE_VIDEO {video} bytes={video.stat().st_size} frames={actual_frames} fps={actual_fps}',flush=True)
print(f'FITCORE_COMPLETE poses={len(list(indices))} rendered_frames={0 if a.no_render else len(list(indices))} elapsed={time.monotonic()-start:.2f}s',flush=True)
