import { NextResponse } from "next/server";
import { apiUnauthorized, getUid } from "@/lib/api-response";
import { requireAccess } from "@/lib/access";
import { buildCsv } from "@/lib/import/csv";
import { buildTemplateRows, getImportSpec } from "@/lib/import/specs";

// GET /api/import/[module]/template — unduh template CSV modul
export async function GET(
  request: Request,
  { params }: { params: Promise<{ module: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const { module } = await params;
    const spec = getImportSpec(module);
    if (!spec) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "BAD_REQUEST", message: "Modul impor tidak dikenal." },
        },
        { status: 400 }
      );
    }

    const forbidden = requireAccess(
      request.headers.get("x-user-role"),
      spec.accessModule,
      "create"
    );
    if (forbidden) return forbidden;

    const headers = spec.fields.map((field) => field.header);
    const csv = buildCsv(headers, buildTemplateRows(spec));

    return new NextResponse("﻿" + csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${spec.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Gagal membuat template CSV." },
      },
      { status: 500 }
    );
  }
}