"use client";
import { useEffect, useRef, useState } from "react";
import type * as ThreeTypes from "three";
import { getCatalogExercise } from "@/domain/exercise-catalog";
import {
  getTimedExerciseMotion,
  type Skeleton,
  type Vec3,
} from "@/domain/exercise-motion";
import { ExerciseFigure, type ExerciseView } from "./exercise-figure";

type Model = { update: (body: Skeleton) => void; group: ThreeTypes.Group };
/** Locally rendered original 3D model. No remote models, images, or tracking. */
export function ExerciseScene({
  exerciseId,
  progress,
  view,
}: {
  exerciseId: string;
  progress: number;
  view: ExerciseView;
}) {
  const host = useRef<HTMLDivElement>(null),
    state = useRef({ progress, view });
  const [fallback, setFallback] = useState(false),
    [ready, setReady] = useState(false);
  useEffect(() => {
    state.current = { progress, view };
  }, [progress, view]);
  useEffect(() => {
    let stopped = false,
      raf = 0,
      dispose = () => {};
    const container = host.current;
    if (!container) return;
    const exercise = getCatalogExercise(exerciseId);
    if (!exercise) return;
    const initialize = async () => {
      const T = await import("three");
      if (stopped) return;
      const scene = new T.Scene();
      scene.background = new T.Color("#0D0F14");
      const renderer = new T.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "low-power",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.12;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = T.PCFSoftShadowMap;
      renderer.domElement.setAttribute(
        "aria-label",
        `Demonstração 3D de ${exercise.name}`,
      );
      renderer.domElement.setAttribute("role", "img");
      renderer.domElement.style.cssText =
        "display:block;width:100%;height:100%;";
      container.appendChild(renderer.domElement);
      const geometries = new Set<ThreeTypes.BufferGeometry>(),
        materials = new Set<ThreeTypes.Material>();
      const geom = <G extends ThreeTypes.BufferGeometry>(g: G): G => {
        geometries.add(g);
        return g;
      };
      const material = (color: string, emissive = false) => {
        const m = new T.MeshStandardMaterial({
          color,
          roughness: 0.64,
          metalness: 0.12,
          emissive: emissive ? color : "#000000",
          emissiveIntensity: emissive ? 0.25 : 0,
        });
        materials.add(m);
        return m;
      };
      const bodyMat = material("#68747e"),
        primary = material("#ff761c", true),
        secondary = material("#e8b352", true),
        equipmentMat = material("#343e49"),
        steel = material("#929fac");
      const focus = (group: string) =>
        group === exercise.group
          ? primary
          : exercise.secondaryMuscles.includes(group as never)
            ? secondary
            : bodyMat;
      const root = new T.Group();
      scene.add(root);
      const sphere = geom(new T.SphereGeometry(1, 24, 16)),
        tubeGeo = geom(new T.CapsuleGeometry(1, 1, 6, 12));
      const yAxis = new T.Vector3(0, 1, 0);
      const vector = (p: Vec3) => new T.Vector3(...p);
      const spherePart = (mat: ThreeTypes.Material) => {
        const mesh = new T.Mesh(sphere, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        root.add(mesh);
        return mesh;
      };
      const jointParts = new Map<string, ThreeTypes.Mesh>();
      for (const key of [
        "head",
        "hip",
        "leftShoulder",
        "rightShoulder",
        "leftElbow",
        "rightElbow",
        "leftKnee",
        "rightKnee",
        "leftHand",
        "rightHand",
      ])
        jointParts.set(
          key,
          spherePart(
            key.includes("Shoulder")
              ? focus("Ombros")
              : key === "hip"
                ? focus("Glúteos")
                : bodyMat,
          ),
        );
      const bones: {
        from: keyof Skeleton;
        to: keyof Skeleton;
        radius: number;
        mesh: ThreeTypes.Mesh;
      }[] = [];
      const bone = (
        from: keyof Skeleton,
        to: keyof Skeleton,
        radius: number,
        mat: ThreeTypes.Material,
      ) => {
        const mesh = new T.Mesh(tubeGeo, mat);
        mesh.castShadow = true;
        root.add(mesh);
        bones.push({ from, to, radius, mesh });
      };
      for (const s of ["left", "right"] as const) {
        bone(
          `${s}Shoulder`,
          `${s}Elbow`,
          0.052,
          focus(
            exercise.group === "Tríceps" ||
              exercise.secondaryMuscles.includes("Tríceps")
              ? "Tríceps"
              : "Bíceps",
          ),
        );
        bone(`${s}Elbow`, `${s}Hand`, 0.038, bodyMat);
        bone(
          `${s}Hip`,
          `${s}Knee`,
          0.082,
          focus(
            exercise.group === "Posteriores de coxa"
              ? "Posteriores de coxa"
              : "Quadríceps",
          ),
        );
        bone(`${s}Knee`, `${s}Ankle`, 0.052, focus("Panturrilhas"));
        bone(`${s}Ankle`, `${s}Toe`, 0.036, bodyMat);
      }
      bone("chest", "neck", 0.048, bodyMat);
      bone("neck", "head", 0.043, bodyMat);
      // Elliptical rings form a tapered torso, rather than a cylinder.
      const positions: number[] = [],
        indices: number[] = [],
        rings = [
          [-0.04, 0.14, 0.1],
          [0.06, 0.145, 0.115],
          [0.17, 0.115, 0.092],
          [0.29, 0.155, 0.11],
          [0.41, 0.218, 0.125],
          [0.49, 0.205, 0.1],
        ];
      const segments = 28;
      rings.forEach(([y, rx, rz]) => {
        for (let i = 0; i <= segments; i++) {
          const a = (i / segments) * Math.PI * 2;
          positions.push(Math.cos(a) * rx, y, Math.sin(a) * rz);
        }
      });
      for (let r = 0; r < rings.length - 1; r++)
        for (let j = 0; j < segments; j++) {
          const a = r * (segments + 1) + j,
            b = a + segments + 1;
          indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      const torsoGeo = geom(new T.BufferGeometry());
      torsoGeo.setAttribute(
        "position",
        new T.Float32BufferAttribute(positions, 3),
      );
      torsoGeo.setIndex(indices);
      torsoGeo.computeVertexNormals();
      const torso = new T.Mesh(torsoGeo, bodyMat);
      torso.castShadow = true;
      root.add(torso);
      const torsoDetails = new T.Group();
      root.add(torsoDetails);
      const muscle = (at: Vec3, size: Vec3, mat: ThreeTypes.Material) => {
        const mesh = new T.Mesh(sphere, mat);
        mesh.position.set(...at);
        mesh.scale.set(...size);
        mesh.castShadow = true;
        torsoDetails.add(mesh);
      };
      for (const sign of [-1, 1]) {
        muscle([sign * 0.09, 0.385, 0.091], [0.1, 0.06, 0.025], focus("Peito"));
        muscle(
          [sign * 0.1, 0.32, -0.085],
          [0.075, 0.14, 0.045],
          focus("Costas"),
        );
        for (const y of [0.285, 0.225, 0.165])
          muscle(
            [sign * 0.037, y, 0.084],
            [0.034, 0.027, 0.013],
            focus("Abdômen"),
          );
      }
      const cautionMat = new T.MeshBasicMaterial({
        color: "#ff585a",
        transparent: true,
        opacity: 0.65,
        depthTest: false,
      });
      materials.add(cautionMat);
      const ringGeo = geom(new T.TorusGeometry(0.08, 0.0035, 6, 44));
      const markers: { key: keyof Skeleton; mesh: ThreeTypes.Mesh }[] = [];
      const cautionJoints: Record<string, (keyof Skeleton)[]> = {
        Ombro: ["leftShoulder", "rightShoulder"],
        Cotovelo: ["leftElbow", "rightElbow"],
        Punho: ["leftHand", "rightHand"],
        Joelho: ["leftKnee", "rightKnee"],
        Tornozelo: ["leftAnkle", "rightAnkle"],
        Lombar: ["hip"],
      };
      for (const caution of exercise.cautions)
        for (const key of cautionJoints[caution] || []) {
          const mesh = new T.Mesh(ringGeo, cautionMat);
          mesh.renderOrder = 5;
          scene.add(mesh);
          markers.push({ key, mesh });
        }
      const model: Model = {
        group: root,
        update(b) {
          for (const [key, mesh] of jointParts) {
            mesh.position.set(...b[key as keyof Skeleton]);
            const radius =
              key === "head"
                ? 0.089
                : key === "hip"
                  ? 0.13
                  : key.includes("Shoulder")
                    ? 0.068
                    : key.includes("Knee")
                      ? 0.052
                      : key.includes("Elbow")
                        ? 0.04
                        : 0.037;
            mesh.scale.set(
              radius,
              key === "head" ? 0.118 : radius,
              radius * 0.86,
            );
          }
          for (const bone of bones) {
            const a = vector(b[bone.from]),
              c = vector(b[bone.to]),
              delta = c.clone().sub(a),
              len = delta.length();
            bone.mesh.position.copy(a).add(c).multiplyScalar(0.5);
            bone.mesh.quaternion.setFromUnitVectors(yAxis, delta.normalize());
            bone.mesh.scale.set(
              bone.radius,
              Math.max(0.001, len / 3),
              bone.radius,
            );
          }
          const direction = vector(b.chest).sub(vector(b.hip)).normalize();
          const rotation = new T.Quaternion().setFromUnitVectors(
            yAxis,
            direction,
          );
          torso.position.set(...b.hip);
          torso.quaternion.copy(rotation);
          jointParts.get("head")?.quaternion.copy(rotation);
          const pelvis = jointParts.get("hip");
          if (pelvis) {
            pelvis.quaternion.copy(rotation);
            pelvis.scale.set(0.145, 0.095, 0.105);
          }
          torsoDetails.position.copy(torso.position);
          torsoDetails.quaternion.copy(rotation);
          for (const marker of markers)
            marker.mesh.position.set(...b[marker.key]);
        },
      };
      const equipmentRoot = new T.Group();
      scene.add(equipmentRoot);
      const boxGeo = geom(new T.BoxGeometry(1, 1, 1)),
        cylinderGeo = geom(new T.CylinderGeometry(1, 1, 1, 24));
      const initial = getTimedExerciseMotion(exerciseId, 0),
        equipmentMeshes: ThreeTypes.Mesh[] = [];
      for (const e of initial.equipment) {
        const mesh = new T.Mesh(
          e.kind === "box" ? boxGeo : cylinderGeo,
          e.kind === "weight"
            ? equipmentMat
            : e.color
              ? material(e.color)
              : steel,
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        equipmentRoot.add(mesh);
        equipmentMeshes.push(mesh);
      }
      const updateEquipment = (
        frame: ReturnType<typeof getTimedExerciseMotion>,
      ) => {
        frame.equipment.forEach((e, i) => {
          const mesh = equipmentMeshes[i];
          if (!mesh) return;
          if (e.kind === "box") {
            mesh.position.set(...e.center);
            mesh.scale.set(...e.size);
            mesh.quaternion.identity();
          } else if (e.kind === "weight") {
            mesh.position.set(...e.center);
            mesh.scale.set(e.radius, e.length, e.radius);
            mesh.quaternion.setFromUnitVectors(
              yAxis,
              e.axis === "x"
                ? new T.Vector3(1, 0, 0)
                : e.axis === "y"
                  ? yAxis
                  : new T.Vector3(0, 0, 1),
            );
          } else {
            const a = vector(e.from),
              c = vector(e.to),
              d = c.clone().sub(a);
            mesh.position.copy(a).add(c).multiplyScalar(0.5);
            mesh.scale.set(e.width / 2, d.length(), e.width / 2);
            mesh.quaternion.setFromUnitVectors(yAxis, d.normalize());
          }
        });
      };
      scene.add(new T.HemisphereLight("#c8d8ed", "#22242a", 1.45));
      const keyLight = new T.DirectionalLight("#f0f4ff", 3.4);
      keyLight.position.set(-3, 5, 4);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.left = -3;
      keyLight.shadow.camera.right = 3;
      keyLight.shadow.camera.top = 4;
      keyLight.shadow.camera.bottom = -3;
      keyLight.shadow.normalBias = 0.018;
      scene.add(keyLight);
      const rim = new T.DirectionalLight("#45d9e9", 2.7);
      rim.position.set(2, 2, -4);
      scene.add(rim);
      const fill = new T.DirectionalLight("#738295", 0.8);
      fill.position.set(3, 1, 3);
      scene.add(fill);
      const floor = new T.Mesh(
        geom(new T.PlaneGeometry(30, 30)),
        material("#0D0F14"),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.022;
      floor.receiveShadow = true;
      scene.add(floor);
      const grid = new T.GridHelper(6, 18, "#293d4b", "#18232f");
      grid.position.y = -0.02;
      scene.add(grid);
      const gridMaterials = Array.isArray(grid.material)
        ? grid.material
        : [grid.material];
      gridMaterials.forEach((m) => materials.add(m));
      geometries.add(grid.geometry);
      const bounds = new T.Box3();
      for (let p = 0; p < 1; p += 0.125) {
        const f = getTimedExerciseMotion(exerciseId, p);
        Object.values(f.body).forEach((v) => bounds.expandByPoint(vector(v)));
        for (const e of f.equipment) {
          if (e.kind === "line") {
            bounds.expandByPoint(vector(e.from));
            bounds.expandByPoint(vector(e.to));
          } else {
            bounds.expandByPoint(vector(e.center));
          }
        }
      }
      bounds.expandByScalar(0.23);
      const center = bounds.getCenter(new T.Vector3()),
        size = bounds.getSize(new T.Vector3());
      const camera = new T.OrthographicCamera(-2, 2, 2, -2, 0.05, 50);
      const positionsByView: Record<ExerciseView, [number, number, number]> = {
        perspective: [3, 2.1, 4.5],
        front: [0, 0.8, 5],
        side: [5, 1, 0],
        back: [-2, 1.5, -5],
        upper: [2, 5, 3],
      };
      let lastView = "",
        lastWidth = 0,
        lastHeight = 0,
        lastProgress = -1;
      const render = () => {
        if (stopped) return;
        const width = container.clientWidth || 640,
          height = container.clientHeight || 400;
        if (
          width !== lastWidth ||
          height !== lastHeight ||
          state.current.view !== lastView
        ) {
          renderer.setSize(width, height, false);
          const half = Math.max(
            size.y * 0.61,
            size.z * 0.44,
            size.x * 0.6,
            1.06,
          );
          const aspect = width / height;
          camera.left = -half * aspect;
          camera.right = half * aspect;
          camera.top = half;
          camera.bottom = -half;
          camera.position
            .copy(center)
            .add(new T.Vector3(...positionsByView[state.current.view]));
          camera.lookAt(center);
          camera.updateProjectionMatrix();
          lastView = state.current.view;
          lastWidth = width;
          lastHeight = height;
          lastProgress = -1;
        }
        if (lastProgress !== state.current.progress) {
          const f = getTimedExerciseMotion(exerciseId, state.current.progress);
          model.update(f.body);
          updateEquipment(f);
          for (const marker of markers)
            marker.mesh.quaternion.copy(camera.quaternion);
          renderer.render(scene, camera);
          lastProgress = state.current.progress;
        }
        raf = requestAnimationFrame(render);
      };
      const lost = (event: Event) => {
        event.preventDefault();
        setFallback(true);
      };
      renderer.domElement.addEventListener("webglcontextlost", lost);
      dispose = () => {
        renderer.domElement.removeEventListener("webglcontextlost", lost);
        cancelAnimationFrame(raf);
        geometries.forEach((g) => g.dispose());
        materials.forEach((m) => m.dispose());
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
      };
      render();
      setReady(true);
    };
    initialize().catch(() => {
      if (!stopped) setFallback(true);
      dispose();
    });
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      dispose();
    };
  }, [exerciseId]);
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        ref={host}
        style={{
          position: "absolute",
          inset: 0,
          display: fallback ? "none" : "block",
        }}
        data-3d-ready={ready && !fallback}
      />
      {(!ready || fallback) && (
        <ExerciseFigure
          exerciseId={exerciseId}
          progress={progress}
          view={view}
        />
      )}
      {fallback && (
        <span
          style={{
            position: "absolute",
            right: 16,
            bottom: 13,
            fontSize: 8,
            color: "#9ba6ae",
          }}
        >
          Modo ilustrado compatível
        </span>
      )}
    </div>
  );
}
