"""Linear blend skinning for the CC0 MakeHuman-derived FitCore mesh.

Targets are exported by the same TypeScript retargeter used by the app. This
module contains matrix math only; it does not reimplement exercise kinematics.
"""
import numpy as np


def rotation_from_y(direction):
    """Match THREE.Quaternion.setFromUnitVectors(Y, direction) exactly."""
    direction = np.asarray(direction, dtype=np.float64)
    norm = np.linalg.norm(direction)
    if norm < 1e-8:
        raise ValueError('A human bone must have a nonzero direction')
    x, y, z = direction / norm
    w = 1.0 + y
    if w < np.finfo(np.float64).eps:
        q = np.array([0.0, 0.0, 1.0, 0.0])
    else:
        q = np.array([z, 0.0, -x, w])
        q /= np.linalg.norm(q)
    x, y, z, w = q
    return np.array([
        [1 - 2*(y*y + z*z), 2*(x*y - z*w), 2*(x*z + y*w)],
        [2*(x*y + z*w), 1 - 2*(x*x + z*z), 2*(y*z - x*w)],
        [2*(x*z - y*w), 2*(y*z + x*w), 1 - 2*(x*x + y*y)],
    ])


def quaternion_matrix(quaternion):
    q = np.asarray(quaternion, dtype=np.float64)
    if not np.isfinite(q).all() or np.linalg.norm(q) < 1e-8:
        raise ValueError('Invalid exported bone quaternion')
    x, y, z, w = q / np.linalg.norm(q)
    return np.array([
        [1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)],
        [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)],
        [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)],
    ])


class HumanDeformer:
    def __init__(self, asset, grip=0.0):
        self.asset = asset
        self.positions = np.asarray(asset['positions'], dtype=np.float64).reshape(-1, 3)
        if not 0 <= grip <= 1: raise ValueError('Grip must be between zero and one')
        if grip and 'gripPositions' in asset:
            closed = np.asarray(asset['gripPositions'], dtype=np.float64).reshape(-1, 3)
            if closed.shape != self.positions.shape: raise ValueError('Grip morph shape differs')
            self.positions = self.positions + grip * (closed-self.positions)
        self.indices = np.asarray(asset['indices'], dtype=np.int32).reshape(-1, 3)
        self.skin_indices = np.asarray(asset['skinIndices'], dtype=np.int32).reshape(-1, 4)
        self.weights = np.asarray(asset['skinWeights'], dtype=np.float64).reshape(-1, 4)
        self.bones = asset['bones']
        if len(self.positions) != len(self.weights) or len(self.weights) != len(self.skin_indices):
            raise ValueError('Skin weights and mesh vertex counts differ')
        if not np.allclose(self.weights.sum(axis=1), 1, atol=1e-4):
            raise ValueError('Every vertex must have normalized skin weights')
        if self.skin_indices.min() < 0 or self.skin_indices.max() >= len(self.bones):
            raise ValueError('Skin indices reference an unknown bone')
        self.bind_from = np.asarray([b['from'] for b in self.bones], dtype=np.float64)
        self.bind_to = np.asarray([b['to'] for b in self.bones], dtype=np.float64)
        self.bind_lengths = np.linalg.norm(self.bind_to - self.bind_from, axis=1)
        self.bind_rotations = np.asarray([rotation_from_y(b - a) for a, b in zip(self.bind_from, self.bind_to)])
        identity = self.skin(self.bones)
        if not np.allclose(identity, self.positions, atol=1e-5):
            raise ValueError('The human bind pose does not preserve the source geometry')

    def skin(self, targets):
        if len(targets) != len(self.bones):
            raise ValueError('Frame must define every human bone')
        if any(t['name'] != b['name'] for t, b in zip(targets, self.bones)):
            raise ValueError('Frame bone names/order differ from the human model')
        target_from = np.asarray([b['from'] for b in targets], dtype=np.float64)
        target_to = np.asarray([b['to'] for b in targets], dtype=np.float64)
        lengths = np.linalg.norm(target_to - target_from, axis=1)
        ratios = lengths / np.maximum(self.bind_lengths, 1e-8)
        rotations = np.asarray([quaternion_matrix(t['rotation']) if 'rotation' in t else rotation_from_y(b-a) for t,a,b in zip(targets,target_from,target_to)])
        scales = np.tile(np.eye(3), (len(self.bones), 1, 1))
        scales[:, 1, 1] = ratios
        linear = rotations @ scales @ self.bind_rotations.transpose(0, 2, 1)
        offsets = target_from - np.einsum('nij,nj->ni', linear, self.bind_from)
        transformed = np.einsum('nkij,nj->nki', linear[self.skin_indices], self.positions)
        transformed += offsets[self.skin_indices]
        result = np.einsum('nk,nkj->nj', self.weights, transformed)
        if not np.isfinite(result).all():
            raise ValueError('Human skinning produced a non-finite vertex')
        return result

    def blender_positions(self, targets):
        # Existing scene uses Z up and +Y forward. This swaps Y/Z, so reverse
        # triangle winding when constructing the Blender mesh to preserve normals.
        return np.ascontiguousarray(self.skin(targets)[:, [0, 2, 1]], dtype=np.float32)
