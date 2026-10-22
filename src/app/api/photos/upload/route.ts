import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { actor } from "@/server/auth";
import { config, AppError } from "@/server/config";
import { upload } from "@/server/photos";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  try {
    if (config.preview)
      throw new AppError(
        503,
        "preview_only",
        "Uploads não estão habilitados na prévia pública.",
      );
    if (req.headers.get("origin") !== new URL(config.url).origin)
      throw new AppError(403, "invalid_origin", "Origem não autorizada.");
    const a = await actor(
      req.headers.get("x-tenant-id")
        ? z.uuid().parse(req.headers.get("x-tenant-id"))
        : undefined,
    );
    const reader = req.body?.getReader();
    if (!reader) throw new AppError(422, "invalid_upload", "Arquivo ausente.");
    let size = 0;
    const parts: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 5 * 1024 * 1024 + 32768) {
        await reader.cancel();
        throw new AppError(413, "image_too_large", "Upload excede 5 MB.");
      }
      parts.push(value);
    }
    const form = await new Response(Uint8Array.from(Buffer.concat(parts)), {
      headers: { "Content-Type": req.headers.get("content-type") || "" },
    }).formData();
    const studentId = z.uuid().parse(form.get("studentId")),
      category = z.enum(["front", "side", "back"]).parse(form.get("category")),
      measuredOn = z.iso.date().parse(form.get("measuredOn"));
    const file = form.get("file");
    if (!(file instanceof File))
      throw new AppError(422, "file_required", "Selecione uma foto.");
    return NextResponse.json(
      await upload(
        a,
        studentId,
        category,
        measuredOn,
        Buffer.from(await file.arrayBuffer()),
      ),
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      {
        message:
          e instanceof AppError
            ? e.message
            : "Upload inválido ou indisponível.",
      },
      {
        status: e instanceof AppError ? e.status : 422,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
