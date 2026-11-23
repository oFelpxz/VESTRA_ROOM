import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { parseReportRange } from "@/lib/reports";
import { buildReportCsv, REPORT_KINDS, type ReportKind } from "@/lib/report-data";

/** GET /admin/relatorios/csv?relatorio=vendas|produtos|estoque&de=…&ate=… */
export async function GET(request: Request) {
  // O proxy já barra quem não é Admin em /admin; conferimos de novo aqui
  // porque a resposta é um arquivo com dados de vendas.
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const kind = params.get("relatorio");
  if (!REPORT_KINDS.includes(kind as ReportKind)) {
    return NextResponse.json({ error: "Relatório inválido." }, { status: 400 });
  }

  const range = parseReportRange(
    params.get("de") ?? undefined,
    params.get("ate") ?? undefined,
    new Date(),
  );
  const { filename, csv } = await buildReportCsv(kind as ReportKind, range);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
