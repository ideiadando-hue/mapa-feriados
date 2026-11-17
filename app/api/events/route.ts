import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type EventoComFontes = Awaited<
  ReturnType<typeof prisma.calendarEvent.findMany<{ include: { sources: true } }>>
>[number];

function normalizar(titulo: string) {
  return titulo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function deduplicar(eventos: EventoComFontes[]) {
  const mapa = new Map<string, EventoComFontes>();

  for (const e of eventos) {
    const dia = new Date(e.date).toISOString().slice(0, 10);
    const chave = `${normalizar(e.title)}|${dia}|${e.eventType}`;

    const atual = mapa.get(chave);
    if (!atual || e.sourceWeight > atual.sourceWeight) {
      mapa.set(chave, e);
    }
  }

  return [...mapa.values()];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const de = searchParams.get("de");
  const ate = searchParams.get("ate");
  const uf = searchParams.get("uf");
  const cidade = searchParams.get("cidade");
  const tipo = searchParams.get("tipo");

  const where: Record<string, unknown> = { published: true };

  if (de || ate) {
    where.date = {
      ...(de ? { gte: new Date(de) } : {}),
      ...(ate ? { lte: new Date(ate) } : {}),
    };
  }

  if (uf) where.state = uf.toUpperCase();
  if (cidade) where.city = { contains: cidade, mode: "insensitive" };
  if (tipo) where.eventType = tipo.toUpperCase();

  try {
    const eventos = await prisma.calendarEvent.findMany({
      where,
      orderBy: { date: "asc" },
      include: { sources: true },
      take: 5000,
    });

    const unicos = deduplicar(eventos).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return NextResponse.json({ total: unicos.length, eventos: unicos });
  } catch (erro) {
    console.error("Erro ao buscar eventos:", erro);
    return NextResponse.json(
      { erro: "Falha ao consultar eventos" },
      { status: 500 }
    );
  }
}