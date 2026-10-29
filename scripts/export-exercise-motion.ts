/** Exports original motion data for the offline Blender pipeline. */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import {
  exerciseCatalog,
  getCatalogExercise,
} from "../src/domain/exercise-catalog";
import * as motion from "../src/domain/exercise-motion";
const argv = process.argv.slice(2);
const value = (name: string, fallback: string) => {
  const i = argv.indexOf(name);
  return i < 0 ? fallback : argv[i + 1] || fallback;
};
const requested = value("--exercise", "agachamento-goblet");
const selected =
  requested === "all" ? exerciseCatalog : [getCatalogExercise(requested)];
if (selected.some((x) => !x))
  throw Error("Exercise ID must belong to the canonical catalog.");
const fps = Number(value("--fps", "60"));
if (!Number.isInteger(fps) || fps < 1 || fps > 120)
  throw Error("FPS must be an integer from 1 to 120.");
const output = resolve(value("--out", ".local/3d/motions"));
await mkdir(output, { recursive: true });
for (const ex of selected) {
  if (!ex) continue;
  const seconds = Number(
    value(
      "--seconds",
      String(motion.motionPresentation[ex.id].durationSeconds),
    ),
  );
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 30)
    throw Error("Duration must be between 0 and 30 seconds.");
  const count = Math.max(2, Math.round(seconds * fps));
  const getFrame = motion.getTimedExerciseMotion;
  const data = {
    schema: 1,
    exercise: ex,
    presentation: motion.motionPresentation[ex.id],
    fps,
    durationSeconds: count / fps,
    frameCount: count,
    frames: Array.from({ length: count }, (_, n) => getFrame(ex.id, n / count)),
  };
  const file = resolve(output, `${ex.id}.json`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data));
  console.log(`${ex.id}: ${count} frames at ${fps} FPS -> ${file}`);
}
