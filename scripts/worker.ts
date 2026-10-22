import "dotenv/config";
import { tick } from "../src/server/cycles";
import { admin, app } from "../src/server/db";
let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
try {
  do {
    console.log(JSON.stringify({ event: "worker_tick", count: await tick() }));
    if (process.argv.includes("--once")) break;
    await new Promise((resolve) =>
      setTimeout(resolve, Number(process.env.WORKER_INTERVAL_MS || 30000)),
    );
  } while (!stopping);
} finally {
  await Promise.all([admin.end(), app.end()]);
}
