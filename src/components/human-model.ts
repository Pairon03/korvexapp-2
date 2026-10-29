import type * as Three from "three";
import type { CatalogExercise } from "@/domain/exercise-catalog";
import {
  getHumanBoneTarget,
  getHumanBoneRotation,
  getHumanGrip,
  type HumanAsset,
} from "@/domain/human-rig";
import type { Skeleton as MotionSkeleton } from "@/domain/exercise-motion";

let assetPromise: Promise<HumanAsset> | undefined;
export function loadHumanAsset(): Promise<HumanAsset> {
  assetPromise ??= fetch("/models/human/athletic-human.json")
    .then(async (response) => {
      if (!response.ok) throw new Error("Human model unavailable");
      const data = (await response.json()) as HumanAsset;
      if (
        data.version !== 1 ||
        data.positions.length !== data.regions.length * 3 ||
        data.skinIndices.length !== data.regions.length * 4 ||
        data.skinWeights.length !== data.skinIndices.length ||
        data.bones.length !== 19
      )
        throw new Error("Invalid human model");
      return data;
    })
    .catch((error) => {
      assetPromise = undefined;
      throw error;
    });
  return assetPromise;
}

/** The CC0 human body is a single skinned surface, including face, hands and feet. */
export function createHumanModel(
  T: typeof Three,
  asset: HumanAsset,
  exercise: CatalogExercise,
) {
  const group = new T.Group();
  group.name = "FitCore anatomical human";
  const geometry = new T.BufferGeometry();
  geometry.setAttribute(
    "position",
    new T.Float32BufferAttribute(asset.positions, 3),
  );
  geometry.setIndex(asset.indices);
  geometry.setAttribute(
    "skinIndex",
    new T.Uint16BufferAttribute(asset.skinIndices, 4),
  );
  geometry.setAttribute(
    "skinWeight",
    new T.Float32BufferAttribute(asset.skinWeights, 4),
  );
  geometry.computeVertexNormals();
  if (asset.gripPositions) {
    const grip = new T.BufferGeometry();
    grip.setAttribute(
      "position",
      new T.Float32BufferAttribute(asset.gripPositions, 3),
    );
    grip.setIndex(asset.indices);
    grip.computeVertexNormals();
    geometry.morphAttributes.position = [
      grip.getAttribute("position") as Three.BufferAttribute,
    ];
    geometry.morphAttributes.normal = [
      grip.getAttribute("normal") as Three.BufferAttribute,
    ];
    grip.dispose();
  }
  const colors = new Float32Array(asset.regions.length * 3);
  const neutral = new T.Color("#b8bec3"),
    primary = new T.Color("#ff762d"),
    secondary = new T.Color("#e4b56a"),
    shorts = new T.Color("#202630"),
    hair = new T.Color("#27282c");
  asset.regions.forEach((index, i) => {
    const region = asset.regionNames[index];
    const anatomy = asset.regionNames[asset.anatomicalRegions[i]];
    const color =
      region === "shorts"
        ? anatomy === exercise.group && exercise.group === "Glúteos"
          ? primary
          : shorts
        : region === "hair"
          ? hair
          : region === exercise.group
            ? primary
            : exercise.secondaryMuscles.includes(region as never)
              ? secondary
              : neutral;
    color.toArray(colors, i * 3);
  });
  geometry.setAttribute("color", new T.BufferAttribute(colors, 3));
  const material = new T.MeshStandardMaterial({
    color: "#ffffff",
    vertexColors: true,
    roughness: 0.67,
    metalness: 0,
  });
  const mesh = new T.SkinnedMesh(geometry, material);
  if (mesh.morphTargetInfluences)
    mesh.morphTargetInfluences[0] = getHumanGrip(exercise.id);
  mesh.name = "Continuous athletic human skin";
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  const yAxis = new T.Vector3(0, 1, 0);
  const bones = asset.bones.map((def) => {
    const bone = new T.Bone();
    bone.name = def.name;
    bone.position.fromArray(def.from);
    bone.quaternion.setFromUnitVectors(
      yAxis,
      new T.Vector3(...def.to).sub(new T.Vector3(...def.from)).normalize(),
    );
    group.add(bone);
    return bone;
  });
  group.updateMatrixWorld(true);
  const skeleton = new T.Skeleton(bones);
  group.add(mesh);
  mesh.bind(skeleton);
  const update = (pose: MotionSkeleton) => {
    asset.bones.forEach((definition, i) => {
      const target = getHumanBoneTarget(definition, asset.restPose, pose),
        bone = bones[i];
      const direction = new T.Vector3(...target.to).sub(
        new T.Vector3(...target.from),
      );
      const restLength = new T.Vector3(...definition.to).distanceTo(
        new T.Vector3(...definition.from),
      );
      bone.position.fromArray(target.from);
      bone.quaternion.fromArray(getHumanBoneRotation(definition, target));
      bone.scale.set(1, direction.length() / Math.max(restLength, 1e-8), 1);
    });
    group.updateMatrixWorld(true);
    skeleton.update();
  };
  return {
    group,
    mesh,
    update,
    dispose() {
      geometry.dispose();
      material.dispose();
      skeleton.dispose();
    },
  };
}
