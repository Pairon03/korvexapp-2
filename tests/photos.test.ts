import "dotenv/config";
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { admin, app, scoped, Actor } from "../src/server/db";
import {
  consent,
  upload,
  photoLink,
  view,
  removePhoto,
  sanitizeImage,
} from "../src/server/photos";
const seed = randomUUID();
test("private photo workflow: consent, metadata stripping, authorization, expiry and deletion", async () => {
  const userId = randomUUID(),
    otherUser = randomUUID(),
    tenantId = randomUUID(),
    studentId = randomUUID();
  await admin.query(
    "insert into identity.users(id,email,name,password_hash,verified_at) values($1,$2,$3,$4,now()),($5,$6,$3,$4,now())",
    [
      userId,
      `${seed}@example.test`,
      "Synthetic photo test",
      "test-only-not-a-login-hash",
      otherUser,
      `other-${seed}@example.test`,
    ],
  );
  await admin.query("insert into app.tenants(id,name) values($1,$2)", [
    tenantId,
    `photo-test-${seed}`,
  ]);
  await admin.query(
    "insert into app.students(id,tenant_id,user_id,name,email,goal,experience,days_per_week) values($1,$2,$3,'Synthetic student',$4,'maintenance','beginner',3)",
    [studentId, tenantId, userId, `${seed}@example.test`],
  );
  const student: Actor = {
    userId,
    tenantId,
    studentId,
    role: "student",
    name: "Synthetic student",
    email: `${seed}@example.test`,
  };
  const owner: Actor = { ...student, role: "owner" };
  const image = await sharp({
    create: { width: 32, height: 32, channels: 3, background: "#b8ff3b" },
  })
    .jpeg()
    .toBuffer();
  await assert.rejects(
    upload(student, studentId, "front", "2026-10-21", image),
    /autorizou/,
  );
  await assert.rejects(consent(owner, studentId, true), /próprio aluno/);
  await consent(student, studentId, true);
  const p = await upload(student, studentId, "front", "2026-10-21", image);
  const link = await photoLink(student, p.id),
    token = new URL(link.url, "http://localhost").searchParams.get("token")!;
  const binary = await view(student, token);
  assert.equal((await sharp(binary).metadata()).format, "jpeg");
  assert.equal((await sharp(binary).metadata()).exif, undefined);
  await assert.rejects(
    view({ ...student, userId: otherUser }, token),
    /expirado|autorizado/,
  );
  await admin.query(
    "update identity.photo_tokens set expires_at=now()-interval '1 minute' where photo_id=$1",
    [p.id],
  );
  await assert.rejects(view(student, token), /expirado/);
  await assert.rejects(
    sanitizeImage(Buffer.from("<svg><script>alert(1)</script></svg>")),
    /JPEG ou PNG/,
  );
  await assert.rejects(
    sanitizeImage(Buffer.from([255, 216, 255, 0, 1])),
    /decodificar/,
  );
  await removePhoto(student, p.id);
  assert.equal(
    (
      await scoped(student, (db) =>
        db.query("select id from app.progress_photos"),
      )
    ).rowCount,
    0,
  );
  const second = await upload(student, studentId, "side", "2026-10-21", image);
  assert.ok(second.id);
  await consent(student, studentId, false);
  assert.equal(
    (
      await scoped(student, (db) =>
        db.query("select id from app.progress_photos"),
      )
    ).rowCount,
    0,
  );
  await assert.rejects(
    upload(student, studentId, "back", "2026-10-21", image),
    /autorizou/,
  );
});
after(async () => {
  await Promise.all([admin.end(), app.end()]);
});
