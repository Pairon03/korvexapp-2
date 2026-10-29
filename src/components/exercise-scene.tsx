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
import { createHumanModel, loadHumanAsset } from "./human-model";

/** Locally rendered continuous CC0 human mesh; no third-party model requests. */
export function ExerciseScene({
  exerciseId,
  progress,
  view,
  onUnavailable,
}: {
  exerciseId: string;
  progress: number;
  view: ExerciseView;
  onUnavailable?: () => void;
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
      const [T, humanAsset] = await Promise.all([
        import("three"),
        loadHumanAsset(),
      ]);
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
      renderer.toneMappingExposure = 0.96;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = T.PCFSoftShadowMap;
      renderer.domElement.setAttribute(
        "aria-label",
        `Demonstração 3D de ${exercise.name}`,
      );
      renderer.domElement.setAttribute("role", "img");
      renderer.domElement.setAttribute("data-human-mesh", "continuous");
      renderer.domElement.setAttribute(
        "data-human-vertices",
        String(humanAsset.positions.length / 3),
      );
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
      const equipmentMat = material("#343e49"),
        steel = material("#929fac");
      const yAxis = new T.Vector3(0, 1, 0);
      const vector = (p: Vec3) => new T.Vector3(...p);
      const model = createHumanModel(T, humanAsset, exercise);
      scene.add(model.group);
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
      scene.add(new T.HemisphereLight("#e7edf4", "#24262c", 1.3));
      const keyLight = new T.DirectionalLight("#f0f4ff", 2.7);
      keyLight.position.set(-3, 5, 4);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.left = -3;
      keyLight.shadow.camera.right = 3;
      keyLight.shadow.camera.top = 4;
      keyLight.shadow.camera.bottom = -3;
      keyLight.shadow.normalBias = 0.018;
      scene.add(keyLight);
      const rim = new T.DirectionalLight("#82d7e5", 1.1);
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
            size.y * 0.53,
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
          for (const marker of markers) {
            marker.mesh.position.set(...f.body[marker.key]);
            marker.mesh.quaternion.copy(camera.quaternion);
          }
          renderer.render(scene, camera);
          lastProgress = state.current.progress;
        }
        raf = requestAnimationFrame(render);
      };
      const lost = (event: Event) => {
        event.preventDefault();
        setFallback(true);
        onUnavailable?.();
      };
      renderer.domElement.addEventListener("webglcontextlost", lost);
      dispose = () => {
        renderer.domElement.removeEventListener("webglcontextlost", lost);
        cancelAnimationFrame(raf);
        geometries.forEach((g) => g.dispose());
        materials.forEach((m) => m.dispose());
        model.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
      };
      render();
      setReady(true);
    };
    initialize().catch(() => {
      if (!stopped) {
        setFallback(true);
        onUnavailable?.();
      }
      dispose();
    });
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      dispose();
    };
  }, [exerciseId, onUnavailable]);
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
          Prévia estática · 3D indisponível neste navegador
        </span>
      )}
    </div>
  );
}
