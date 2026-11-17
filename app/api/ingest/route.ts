import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LoteSchema, EventoExtraido } from "@/lib/validators";
import { FONTES } from "@/lib/fontes";
import { calcularConfianca } from "@/lib/precedencia";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const modelo = genAI.getGenerativeModel({
  model: process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite",
  generationConfig: {
    responseMimeType: "application/json",
    temperature: 0.1,
  },
});

function dormir(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function extrairEventos(
  texto: string,
  fonte: { nome: string; uf?: string; municipio?: string }
): Promise<EventoExtraido[]> {
  const prompt = `Você é um extrator de eventos de calendário oficial brasileiro.

Analise o texto abaixo, extraído de ${fonte.nome}${fonte.uf ? ` (UF: ${fonte.uf})` : ""}${fonte.municipio ? ` (Município: ${fonte.municipio})` : ""}.

Extraia APENAS eventos de calendário: feriados, pontos facultativos, luto oficial e suspensões de expediente.

Regras:
- Retorne um JSON com a chave "eventos", contendo um array.
- Cada evento deve ter: title (string), eventType (FERIADO | PONTO_FACULTATIVO | LUTO_OFICIAL | SUSPENSAO), scope (NATIONAL | STATE | MUNICIPAL), date (formato YYYY-MM-DD), endDate (YYYY-MM-DD ou null), suspendsWork (boolean), legalBasis (string ou null), excerpt (trecho literal do texto que comprova, string).
- Se não houver eventos no texto, retorne {"eventos": []}.
- Não invente eventos. Só extraia o que está explicitamente no texto.

Texto:
${texto.slice(0, 30000)}`;

  const MAX_TENTATIVAS = 4;
  let ultimoErro: unknown;

  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    try {
      const resultado = await modelo.generateContent(prompt);
      const resposta = resultado.response.text();

      let json: unknown;
      try {
        json = JSON.parse(resposta);
      } catch {
        return [];
      }

      const parsed = LoteSchema.safeParse(json);
      if (!parsed.success) return [];

      return parsed.data.eventos;
    } catch (erro) {
      ultimoErro = erro;
      const status = (erro as { status?: number }).status;
      const transitorio = status === 503 || status === 429 || status === 500;

      if (!transitorio || tentativa === MAX_TENTATIVAS) throw erro;

      await dormir(tentativa * 5000);
    }
  }

  throw ultimoErro;
}

export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");

  if (!token || token !== process.env.INGEST_TOKEN) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }

  const resumo: { fonte: string; eventos: number; erro?: string }[] = [];

  for (const fonte of FONTES) {
    try {
      const resposta = await fetch(fonte.url, {
        headers: {
          "User-Agent": "MapaDeFeriados/1.0 (+https://mapadeferiados.com.br)",
        },
      });

      if (!resposta.ok) {
        resumo.push({ fonte: fonte.nome, eventos: 0, erro: `HTTP ${resposta.status}` });
        continue;
      }

      const html = await resposta.text();
      const texto = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (texto.length < 200) {
        resumo.push({ fonte: fonte.nome, eventos: 0, erro: "Texto muito curto" });
        continue;
      }

      const eventos = await extrairEventos(texto, fonte);
      const confianca = eventos.map((e) => calcularConfianca(e, fonte));

      for (let i = 0; i < eventos.length; i++) {
        const evento = eventos[i];
        const id = `${fonte.id}-${evento.date}-${evento.eventType}`;

        await prisma.calendarEvent.upsert({
          where: { id },
          create: {
            id,
            title: evento.title,
            eventType: evento.eventType,
            scope: evento.scope,
            state: fonte.uf ?? null,
            city: fonte.municipio ?? null,
            date: new Date(evento.date),
            endDate: evento.endDate ? new Date(evento.endDate) : null,
            suspendsWork: evento.suspendsWork,
            isProjected: false,
            sourceWeight: fonte.peso,
            confidence: confianca[i],
            published: confianca[i] === "CONFIRMED",
            legalBasis: evento.legalBasis ?? null,
            sources: {
              create: {
                url: fonte.url,
                publisher: fonte.nome,
                sourceType: "official",
                weight: fonte.peso,
                excerpt: evento.excerpt,
              },
            },
          },
          update: {
            title: evento.title,
            confidence: confianca[i],
            published: confianca[i] === "CONFIRMED",
            updatedAt: new Date(),
          },
        });
      }

      resumo.push({ fonte: fonte.nome, eventos: eventos.length });
    } catch (erro) {
      resumo.push({
        fonte: fonte.nome,
        eventos: 0,
        erro: (erro as Error).message,
      });
    }

    await dormir(4500);
  }

  const total = resumo.reduce((soma, r) => soma + r.eventos, 0);

  return NextResponse.json({ total, fontes: resumo });
}