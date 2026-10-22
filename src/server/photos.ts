import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { randomUUID, randomBytes } from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import { Actor, admin, scoped, one } from "./db";
import { digest } from "./auth";
import { AppError } from "./config";
const directory = path.resolve(
  /* turbopackIgnore: true */
  process.env.PRIVATE_STORAGE_DIR || ".local/photos",
);
export async function sanitizeImage(bytes: Buffer) {
  if (bytes.length > 5 * 1024 * 1024)
    throw new AppError(
      413,
      "image_too_large",
      "A foto deve ter no máximo 5 MB.",
    );
  const png = bytes
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (!png && !jpeg)
    throw new AppError(
      422,
      "invalid_image",
      "Use uma imagem JPEG ou PNG válida.",
    );
  try {
    const image = sharp(bytes, { limitInputPixels: 20000000, failOn: "error" });
    const meta = await image.metadata();
    if (!meta.width || !meta.height) throw Error();
    return await image
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch {
    throw new AppError(
      422,
      "invalid_image",
      "Não foi possível decodificar esta imagem. Use um JPEG ou PNG válido.",
    );
  }
}
export async function consent(a: Actor, studentId: string, granted: boolean) {
  if (a.role !== "student" || a.studentId !== studentId)
    throw new AppError(
      403,
      "consent_owner",
      "Somente o próprio aluno pode conceder ou revogar o consentimento para fotos.",
    );
  return scoped(a, async (db) => {
    await one(db, "select id from app.students where id=$1 for update", [
      studentId,
    ]);
    const row = await one(
      db,
      "insert into app.student_consents(tenant_id,student_id,purpose,granted,version) values($1,$2,'progress_photos',$3,'1') returning *",
      [a.tenantId, studentId, granted],
    );
    if (!granted) {
      const photos = (
        await db.query(
          "select id,storage_key from app.progress_photos where student_id=$1",
          [studentId],
        )
      ).rows;
      for (const photo of photos) {
        await unlink(
          /* turbopackIgnore: true */ path.join(
            /* turbopackIgnore: true */ directory,
            photo.storage_key,
          ),
        ).catch((e) => {
          if (e.code !== "ENOENT") throw e;
        });
        await db.query("delete from app.progress_photos where id=$1", [
          photo.id,
        ]);
      }
    }
    return row;
  });
}
export async function upload(
  a: Actor,
  studentId: string,
  category: string,
  measuredOn: string,
  bytes: Buffer,
) {
  const clean = await sanitizeImage(bytes),
    key = `${randomUUID()}.jpg`;
  return scoped(a, async (db) => {
    await one(db, "select id from app.students where id=$1 for update", [
      studentId,
    ]);
    const granted = (
      await db.query(
        "select granted from app.student_consents where student_id=$1 and purpose='progress_photos' order by created_at desc,id desc limit 1",
        [studentId],
      )
    ).rows[0]?.granted;
    if (!granted)
      throw new AppError(
        403,
        "consent_required",
        "O aluno ainda não autorizou o armazenamento de fotos.",
      );
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(
      path.join(/* turbopackIgnore: true */ directory, key),
      clean,
      {
        mode: 0o600,
        flag: "wx",
      },
    );
    try {
      return await one(
        db,
        "insert into app.progress_photos(tenant_id,student_id,author_id,category,measured_on,storage_key,byte_size) values($1,$2,$3,$4,$5,$6,$7) returning id,student_id,category,measured_on,created_at",
        [
          a.tenantId,
          studentId,
          a.userId,
          category,
          measuredOn,
          key,
          clean.length,
        ],
      );
    } catch (e) {
      await unlink(
        /* turbopackIgnore: true */ path.join(
          /* turbopackIgnore: true */ directory,
          key,
        ),
      );
      throw e;
    }
  });
}
export async function photoLink(a: Actor, photoId: string) {
  await scoped(a, (db) =>
    one(db, "select id from app.progress_photos where id=$1", [photoId]),
  );
  const token = randomBytes(32).toString("hex");
  await admin.query(
    "insert into identity.photo_tokens values($1,$2,$3,now()+interval '60 seconds')",
    [digest(token), photoId, a.userId],
  );
  return {
    url: `/api/photos/view?token=${token}&tenant=${a.tenantId}`,
    expiresIn: 60,
  };
}
export async function view(a: Actor, token: string) {
  const t = (
    await admin.query(
      "select photo_id from identity.photo_tokens where token_hash=$1 and user_id=$2 and expires_at>now()",
      [digest(token), a.userId],
    )
  ).rows[0];
  if (!t)
    throw new AppError(403, "expired_link", "Link expirado ou não autorizado.");
  const p = await scoped(a, (db) =>
    one(db, "select storage_key from app.progress_photos where id=$1", [
      t.photo_id,
    ]),
  );
  await admin.query(
    "insert into app.audit_logs(tenant_id,actor_id,action,resource_id) values($1,$2,$3,$4)",
    [a.tenantId, a.userId, "photo.accessed", t.photo_id],
  );
  return readFile(
    /* turbopackIgnore: true */ path.join(
      /* turbopackIgnore: true */ directory,
      p.storage_key,
    ),
  );
}
export async function removePhoto(a: Actor, id: string) {
  return scoped(a, async (db) => {
    const p = await one(db, "select * from app.progress_photos where id=$1", [
      id,
    ]);
    await unlink(
      /* turbopackIgnore: true */ path.join(
        /* turbopackIgnore: true */ directory,
        p.storage_key,
      ),
    ).catch((e) => {
      if (e.code !== "ENOENT") throw e;
    });
    await db.query("delete from app.progress_photos where id=$1", [id]);
    return {
      message:
        "Foto excluída do armazenamento ativo. Backups seguem a política operacional.",
    };
  });
}
