import Image from "next/image";
import { getCatalogExercise } from "@/domain/exercise-catalog";
export type ExerciseView = "perspective" | "front" | "side" | "back" | "upper";
/** Pre-render of the same continuous human mesh used by the interactive scene. */
export function ExerciseFigure({
  exerciseId,
  decorative = false,
}: {
  exerciseId: string;
  progress?: number;
  view?: ExerciseView;
  decorative?: boolean;
}) {
  const exercise = getCatalogExercise(exerciseId);
  if (!exercise) return null;
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Image
        src={`/exercise-posters/${exerciseId}.webp`}
        alt={decorative ? "" : `Prévia do modelo humano: ${exercise.name}`}
        fill
        unoptimized
        sizes="(max-width:720px) 100vw, 50vw"
        style={{ objectFit: "contain" }}
      />
    </div>
  );
}
