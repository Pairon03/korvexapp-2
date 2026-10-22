import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import pg from "pg";
import { createHash } from "node:crypto";
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await db.connect();
  await db.query("select pg_advisory_lock(812412)");
  await db.query(
    "create table if not exists public.fitcore_migrations(name text primary key,sha256 text not null,applied_at timestamptz not null default now())",
  );
  for (const file of (await readdir("migrations"))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    const sql = await readFile(`migrations/${file}`, "utf8"),
      hash = createHash("sha256").update(sql).digest("hex");
    const applied = await db.query(
      "select sha256 from public.fitcore_migrations where name=$1",
      [file],
    );
    if (applied.rows[0]) {
      if (applied.rows[0].sha256 !== hash)
        throw new Error(`Applied migration modified: ${file}`);
      continue;
    }
    await db.query("begin");
    try {
      await db.query(sql);
      await db.query(
        "insert into public.fitcore_migrations(name,sha256) values($1,$2)",
        [file, hash],
      );
      await db.query("commit");
      console.log(`Applied ${file}`);
    } catch (e) {
      await db.query("rollback");
      throw e;
    }
  }
} finally {
  await db.end();
}
