#!/usr/bin/env python3
"""Prepare the pinned, CC0 MakeHuman graphical assets for the FitCore player.

No MakeHuman program code is copied or executed. This original converter reads
only the licensed OBJ, morph data, skeleton data and vertex weights. Obtain the
source checkout at the revision recorded below, then pass --source PATH.
"""
from __future__ import annotations
import argparse
import collections
import hashlib
import json
import math
import subprocess
from pathlib import Path

REVISION = 'a8bc2d54ff0ac92e78ff71431b1023eda42bf482'
REPOSITORY = 'https://github.com/makehumancommunity/makehuman'
TARGETS = [
    ('macrodetails/african-male-young.target', 1 / 3),
    ('macrodetails/asian-male-young.target', 1 / 3),
    ('macrodetails/caucasian-male-young.target', 1 / 3),
    ('macrodetails/universal-male-young-maxmuscle-averageweight.target', 1),
]
NAMES = [
    'pelvis', 'spine', 'chest', 'neck', 'head',
    'clavicleLeft', 'upperArmLeft', 'forearmLeft', 'handLeft',
    'thighLeft', 'shinLeft', 'footLeft',
    'clavicleRight', 'upperArmRight', 'forearmRight', 'handRight',
    'thighRight', 'shinRight', 'footRight',
]
REGION_NAMES = [
    'neutral', 'Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps', 'Abdômen',
    'Quadríceps', 'Posteriores de coxa', 'Glúteos', 'Panturrilhas',
    'shorts', 'handsfeet', 'hair',
]


def average(points):
    return [sum(p[i] for p in points) / len(points) for i in range(3)]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def grip_vertices(vertices, rig, original_weights):
    """Create an original relaxed cylindrical grip from CC0 phalanx weights.

    Rotations are composed in the original rig hierarchy. Only vertices with
    a finger-bone influence receive any delta; the body and wrist remain fixed.
    """
    add = lambda a, b: [a[i] + b[i] for i in range(3)]
    sub = lambda a, b: [a[i] - b[i] for i in range(3)]
    mul = lambda a, n: [v * n for v in a]
    dot = lambda a, b: sum(a[i] * b[i] for i in range(3))
    cross = lambda a, b: [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]
    def unit(a):
        length = math.sqrt(dot(a, a))
        return mul(a, 1 / (length or 1))
    def point(bone, end):
        return average([vertices[i] for i in rig['joints'][rig['bones'][bone][end]]])
    def rotation(axis, angle):
        x,y,z = unit(axis); c,s = math.cos(angle),math.sin(angle); q = 1-c
        return [[c+x*x*q,x*y*q-z*s,x*z*q+y*s], [y*x*q+z*s,c+y*y*q,y*z*q-x*s], [z*x*q-y*s,z*y*q+x*s,c+z*z*q]]
    def apply(matrix, p):
        return [dot(row,p) for row in matrix]
    def combine(a,b):
        return [[sum(a[i][k]*b[k][j] for k in range(3)) for j in range(3)] for i in range(3)]
    identity = [[1,0,0],[0,1,0],[0,0,1]]
    transforms = {}
    for side in ['L','R']:
        wrist = point('wrist.'+side,'head')
        middle = point('finger3-1.'+side,'head')
        index = point('finger2-1.'+side,'head')
        little = point('finger5-1.'+side,'head')
        palm_normal = unit(cross(sub(index,little),sub(middle,wrist)))
        # The resting palmar side points medially, toward the body's center.
        if palm_normal[0] * wrist[0] > 0:
            palm_normal = mul(palm_normal,-1)
        for finger in range(1,6):
            base_name = f'finger{finger}-1.{side}'
            base_dir = unit(sub(point(base_name,'tail'),point(base_name,'head')))
            if finger == 1:
                # Thumb opposition aims across the palm, outside the curled fingers.
                aim = unit(sub(average([index,middle]),point(base_name,'head')))
                axis = unit(cross(base_dir,aim))
                angles = [32,40,30]
            else:
                axis = unit(cross(base_dir,palm_normal))
                angles = [52,72,48]
            for segment, degrees in enumerate(angles,1):
                name = f'finger{finger}-{segment}.{side}'
                parent = rig['bones'][name]['parent']
                parent_r,parent_t = transforms.get(parent,(identity,[0,0,0]))
                pivot = point(name,'head')
                local_r = rotation(axis,math.radians(degrees))
                local_t = sub(pivot,apply(local_r,pivot))
                transforms[name] = (combine(parent_r,local_r),add(apply(parent_r,local_t),parent_t))
    deltas = [[0.0,0.0,0.0] for _ in vertices]
    affected = set()
    for name,(matrix,translation) in transforms.items():
        for vertex,weight in original_weights[name]:
            if weight <= 0: continue
            delta = sub(add(apply(matrix,vertices[vertex]),translation),vertices[vertex])
            for axis in range(3): deltas[vertex][axis] += weight*delta[axis]
            affected.add(vertex)
    result = [add(p,deltas[i]) if i in affected else p[:] for i,p in enumerate(vertices)]
    return result,affected

def prepare(source, output):
    source = source.resolve()
    actual_revision = subprocess.check_output(['git', '-C', str(source), 'rev-parse', 'HEAD'], text=True).strip()
    if actual_revision != REVISION:
        raise ValueError(f'Expected pinned MakeHuman revision {REVISION}; found {actual_revision}')
    obj = source / 'makehuman/data/3dobjs/base.obj'
    rig_path = source / 'makehuman/data/rigs/default.mhskel'
    weights_path = source / 'makehuman/data/rigs/default_weights.mhw'
    license_path = source / 'LICENSE.ASSETS.md'
    setup_license = source / 'LICENSE.md'
    if 'explicitly released as CC0' not in obj.read_text()[:1000]:
        raise ValueError('Base asset must carry its explicit CC0 declaration.')
    rig = json.loads(rig_path.read_text())
    weights = json.loads(weights_path.read_text())
    if rig.get('license') != 'CC0' or weights.get('license') != 'CC0':
        raise ValueError('Rig and weights must explicitly declare CC0.')
    vertices, faces, body_ids = [], [], set()
    current_group = ''
    for line in obj.read_text().splitlines():
        if line.startswith('v '):
            vertices.append(list(map(float, line.split()[1:4])))
        elif line.startswith('g '):
            current_group = line[2:].strip()
        elif line.startswith('f ') and current_group == 'body':
            face = [int(part.split('/')[0]) - 1 for part in line.split()[1:]]
            faces.append(face)
            body_ids.update(face)
    if len(body_ids) != 13380 or len(faces) != 13378:
        raise ValueError('Unexpected pinned MakeHuman hm08 body topology.')
    source_files = [obj, rig_path, weights_path, license_path, setup_license]
    for name, influence in TARGETS:
        target = source / 'makehuman/data/targets' / name
        if 'explicitly released as CC0' not in target.read_text()[:1000]:
            raise ValueError(f'Morph must explicitly declare CC0: {name}')
        source_files.append(target)
        for line in target.read_text().splitlines():
            if not line or line.startswith('#'):
                continue
            index, dx, dy, dz = line.split()
            for axis, delta in enumerate([float(dx), float(dy), float(dz)]):
                vertices[int(index)][axis] += influence * delta
    minimum_y = min(vertices[i][1] for i in body_ids)
    height = max(vertices[i][1] for i in body_ids) - minimum_y
    scale = 1.85 / height
    vertices = [[x * scale, (y - minimum_y) * scale, z * scale] for x, y, z in vertices]

    def joint(bone, end):
        return average([vertices[i] for i in rig['joints'][rig['bones'][bone][end]]])

    source_to_reduced = {}
    for name in rig['bones']:
        if name == 'root' or name.startswith('pelvis.'):
            group = 'pelvis'
        elif name in ['spine05', 'spine04', 'spine03']:
            group = 'spine'
        elif name in ['spine02', 'spine01'] or name.startswith('breast.'):
            group = 'chest'
        elif name.startswith('neck'):
            group = 'neck'
        elif name.endswith(('.L', '.R')):
            # Source anatomical L is x positive; the player labels x-negative Left.
            side = 'Right' if name.endswith('.L') else 'Left'
            if name.startswith(('clavicle.', 'shoulder01.')):
                group = 'clavicle' + side
            elif name.startswith('upperarm'):
                group = 'upperArm' + side
            elif name.startswith('lowerarm'):
                group = 'forearm' + side
            elif name.startswith(('wrist.', 'finger', 'metacarpal')):
                group = 'hand' + side
            elif name.startswith('upperleg'):
                group = 'thigh' + side
            elif name.startswith('lowerleg'):
                group = 'shin' + side
            elif name.startswith(('foot.', 'toe')):
                group = 'foot' + side
            else:
                group = 'head'
        else:
            group = 'head'
        source_to_reduced[name] = NAMES.index(group)
    merged_weights = [collections.defaultdict(float) for _ in vertices]
    for bone, assignments in weights['weights'].items():
        reduced = source_to_reduced[bone]
        for vertex, weight in assignments:
            merged_weights[vertex][reduced] += weight

    head_from = joint('head', 'head')
    head_to = joint('head', 'tail')
    hip = average([joint('upperleg01.L', 'head'), joint('upperleg01.R', 'head')])
    endpoints = {
        'pelvis': (hip, joint('spine05', 'tail')),
        'spine': (joint('spine05', 'tail'), joint('spine02', 'head')),
        'chest': (joint('spine02', 'head'), joint('neck01', 'head')),
        'neck': (joint('neck01', 'head'), head_from),
        'head': (head_from, head_to),
    }
    rest_pose = {'hip': hip, 'neck': average([joint('neck01', 'head'), head_from]), 'head': average([head_from, head_to])}
    landmarks = {}
    for side, suffix in [('Left', 'R'), ('Right', 'L')]:
        shoulder = joint(f'upperarm01.{suffix}', 'head')
        elbow = joint(f'lowerarm01.{suffix}', 'head')
        wrist = joint(f'wrist.{suffix}', 'head')
        palm = joint(f'finger3-1.{suffix}', 'head')
        thigh = joint(f'upperleg01.{suffix}', 'head')
        knee = joint(f'lowerleg01.{suffix}', 'head')
        ankle = joint(f'foot.{suffix}', 'head')
        toe = joint(f'toe3-2.{suffix}', 'tail')
        endpoints['clavicle' + side] = (joint(f'clavicle.{suffix}', 'head'), shoulder)
        endpoints['upperArm' + side] = (shoulder, elbow)
        endpoints['forearm' + side] = (elbow, wrist)
        endpoints['hand' + side] = (wrist, palm)
        endpoints['thigh' + side] = (thigh, knee)
        endpoints['shin' + side] = (knee, ankle)
        endpoints['foot' + side] = (ankle, toe)
        key = side.lower()
        for name, value in [('Shoulder', shoulder), ('Elbow', elbow), ('Hand', wrist), ('Hip', thigh), ('Knee', knee), ('Ankle', ankle), ('Toe', toe)]:
            rest_pose[key + name] = value
        landmarks[key + 'Wrist'] = wrist
        landmarks[key + 'Palm'] = average([wrist, palm])
    rest_pose['chest'] = average([rest_pose['leftShoulder'], rest_pose['rightShoulder']])
    landmarks.update({'headBase': head_from, 'headCrown': head_to, 'neckBase': joint('neck01', 'head')})

    grip, grip_ids = grip_vertices(vertices, rig, weights['weights'])
    ordered = sorted(body_ids)
    remap = {original: index for index, original in enumerate(ordered)}
    positions, skin_indices, skin_weights, regions, anatomical_regions = [], [], [], [], []
    max_discarded = 0
    for vertex in ordered:
        p = vertices[vertex]
        positions.extend(round(v, 6) for v in p)
        ranked = sorted(merged_weights[vertex].items(), key=lambda v: -v[1])
        if not ranked or sum(w for _, w in ranked) <= 0:
            raise ValueError(f'Unweighted body vertex: {vertex}')
        max_discarded = max(max_discarded, sum(w for _, w in ranked[4:]))
        top = ranked[:4]
        total = sum(w for _, w in top)
        normalized = [round(weight / total, 7) for _, weight in top]
        normalized[-1] = round(1 - sum(normalized[:-1]), 7)
        skin_indices.extend([bone for bone, _ in top] + [0] * (4 - len(top)))
        skin_weights.extend(normalized + [0] * (4 - len(top)))
        dominant = NAMES[top[0][0]]
        x, y, z = p
        # Coarse editorial display regions, not a medical segmentation atlas.
        if hip[1] - 0.12 < y < hip[1] + 0.04 and abs(x) < 0.25 and z < hip[2] - 0.04:
            region = 9
        elif dominant.startswith('clavicle'):
            region = 3
        elif dominant.startswith('upperArm'):
            shoulder_y = rest_pose['leftShoulder' if x < 0 else 'rightShoulder'][1]
            region = 3 if y > shoulder_y - 0.095 else (4 if z > 0.035 else 5)
        elif dominant.startswith('thigh'):
            region = 7 if z > 0.015 else 8
        elif dominant.startswith('shin'):
            region = 10
        elif dominant.startswith(('hand', 'foot')):
            region = 12
        elif dominant == 'chest':
            region = 1 if z > 0.035 else 2
        elif dominant == 'spine':
            region = 6 if z > 0.03 else 2
        elif dominant == 'pelvis':
            region = 6 if z > 0.03 else 0
        else:
            region = 0
        anatomical_regions.append(region)
        # Preserve opaque clothing/hair independently of the illustrative muscle map.
        # The app may tint the back of the shorts through anatomical region 9;
        # the front remains the normal opaque garment color.
        if y > head_from[1] + 0.105 or (y > head_from[1] + 0.025 and z < head_from[2] + 0.015):
            region = 13
        elif hip[1] - 0.18 < y < hip[1] + 0.08 and abs(x) < 0.31:
            region = 11
        regions.append(region)
    triangles = []
    for face in faces:
        for i in range(1, len(face) - 1):
            triangles.extend([remap[face[0]], remap[face[i]], remap[face[i + 1]]])
    round_point = lambda p: [round(v, 6) for v in p]
    data = {
        'version': 1,
        'name': 'FitCore athletic human — continuous CC0 body mesh',
        'units': 'meters',
        'axes': 'Y-up, positive Z forward; player Left is negative X',
        'height': 1.85,
        'positions': positions,
        'indices': triangles,
        'gripPositions': [round(value, 6) for index in ordered for value in grip[index]],
        'gripMorph': {'kind': 'relaxed-cylindrical-grip', 'source': 'CC0 phalanx weights; original hierarchical rotations', 'affectedVertices': len(grip_ids.intersection(body_ids)), 'fingerAnglesDegrees': [52, 72, 48], 'thumbAnglesDegrees': [32, 40, 30]},
        'skinIndices': skin_indices,
        'skinWeights': skin_weights,
        'regions': regions,
        'anatomicalRegions': anatomical_regions,
        'regionNames': REGION_NAMES,
        'garmentRegions': {'shorts': 11, 'hair': 13},
        'regionClassification': 'Editorial illustration only; not a clinical anatomical segmentation or measured activation map',
        'bones': [{'name': name, 'from': round_point(endpoints[name][0]), 'to': round_point(endpoints[name][1])} for name in NAMES],
        'restPose': {k: round_point(v) for k, v in rest_pose.items()},
        'restLandmarks': {k: round_point(v) for k, v in landmarks.items()},
        'source': {
            'repository': REPOSITORY,
            'revision': REVISION,
            'license': 'CC0-1.0',
            'copyright': rig['copyright'],
            'assetsOnly': True,
            'makeHumanCodeIncluded': False,
            'morphs': [{'path': name, 'influence': weight} for name, weight in TARGETS],
            'sha256': {str(p.relative_to(source)): digest(p) for p in source_files},
        },
        'validation': {
            'bodyVertexCount': len(ordered),
            'bodySourceFaces': len(faces),
            'triangles': len(triangles) // 3,
            'sourceBoneCount': len(rig['bones']),
            'reducedBoneCount': len(NAMES),
            'maxDiscardedInfluence': round(max_discarded, 8),
            'helperFacesIncluded': False,
            'anatomicalClinicalValidation': False,
        },
    }
    assert all(math.isfinite(v) for v in positions)
    assert len(skin_indices) == len(ordered) * 4 == len(skin_weights)
    assert max_discarded <= 0.031
    assert all(abs(sum(skin_weights[i:i+4]) - 1) < 1e-6 for i in range(0, len(skin_weights), 4))
    output.mkdir(parents=True, exist_ok=True)
    path = output / 'athletic-human.json'
    path.write_text(json.dumps(data, separators=(',', ':'), ensure_ascii=False) + '\n')
    (output / 'CC0-1.0.txt').write_text(license_path.read_text())
    (output / 'SOURCE-LICENSE.md').write_text(setup_license.read_text())
    (output / 'NOTICE.md').write_text(
        '# Continuous human mesh\n\n'
        'This model derives exclusively from graphical data bundled with MakeHuman, released under **CC0 1.0 Universal**, including commercial use. '
        'No MakeHuman AGPL program code is included in this project. The original preparation script is maintained in `scripts/prepare-human-model.py`.\n\n'
        f'Source: {REPOSITORY}/tree/{REVISION}\n\n'
        'Included graphical inputs: `makehuman/data/3dobjs/base.obj`, `makehuman/data/rigs/default.mhskel`, `default_weights.mhw`, '
        'and the four adult male morph data files listed in `athletic-human.json`. Each graphical input explicitly declares CC0; source hashes are preserved in the JSON.\n\n'
        'Copyright at source release: Data Collection AB, Joel Palmius, Jonas Hauquier; target files additionally credit Manuel Bastioni and record the transfer of rights. '
        'CC0 does not require attribution, but provenance is preserved here. `CC0-1.0.txt` and `SOURCE-LICENSE.md` reproduce the source licensing declarations.\n\n'
        'FitCore adaptations: adult athletic morph blend, body-only filtering, metric normalization, reduced skinning weights, and editorial color/garment region masks. '
        'The `gripPositions` morph articulates the original CC0 finger weights using original project rotation logic; it does not change the body or use a proprietary animation. The mesh has continuous human face, fingers and feet; helper geometry is excluded. This is a graphical human model, not a clinical anatomical atlas. '
        '`anatomicalRegions` preserves the coarse editorial muscle map before the opaque clothing and hair masks in `regions`. Region 9 is restricted to the posterior hip; the front of the shorts is not marked as a gluteal region.\n\n'
        'Reproduce after obtaining the pinned source revision:\n\n'
        '```bash\npython scripts/prepare-human-model.py --source /path/to/makehuman --out public/models/human\n```\n'
    )
    print(json.dumps({'asset': str(path), 'bytes': path.stat().st_size, **data['validation']}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True, type=Path)
    parser.add_argument('--out', default=Path('public/models/human'), type=Path)
    args = parser.parse_args()
    prepare(args.source, args.out)
