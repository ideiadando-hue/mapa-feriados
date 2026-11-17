import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "../lib/prisma";
import { LoteSchema, EventoExtraido } from "../lib/validators";
import { FONTES } from "../lib/fontes";
import { calcularConfianca } from "../lib/precedencia";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const modelo = genAI.getGenerativeModel({
  model: "gemini-3.5-flash-lite",
  generationConfig: {
    responseMimeType: "application/json",
    temperature: 0.1,
  },
});

const PAUSA_MS = 4500;

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
        console.warn(`  JSON inválido de ${fonte.nome}, ignorando`);
        return [];
      }

      const parsed = LoteSchema.safeParse(json);
      if (!parsed.success) {
        console.warn(`  Validação falhou em ${fonte.nome}:`, parsed.error.issues[0]?.message);
        return [];
      }

      return parsed.data.eventos;
    } catch (erro) {
      ultimoErro = erro;
      const status = (erro as { status?: number }).status;

      const transitorio = status === 503 || status === 429 || status === 500;

      if (!transitorio || tentativa === MAX_TENTATIVAS) {
        throw erro;
      }

      const espera = tentativa * 5000;
      console.warn(`  ${status} do Gemini, tentando de novo em ${espera / 1000}s (${tentativa}/${MAX_TENTATIVAS})`);
      await dormir(espera);
    }
  }

  throw ultimoErro;
}

async function coletarFonte(fonte: (typeof FONTES)[number]) {
  console.log(`\n→ ${fonte.nome}`);

  let html: string;
  try {
    const resposta = await fetch(fonte.url, {
      headers: { "User-Agent": "MapaDeFeriados/1.0 (+https://mapadeferiados.com.br)" },
    });
    if (!resposta.ok) {
      console.warn(`  HTTP ${resposta.status}, pulando`);
      return;
    }
    html = await resposta.text();
  } catch (erro) {
    console.warn(`  Erro ao baixar: ${(erro as Error).message}`);
    return;
  }

  const texto = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (texto.length < 200) {
    console.warn("  Texto muito curto, pulando");
    return;
  }

  const eventos = await extrairEventos(texto, fonte);
  console.log(`  ${eventos.length} evento(s) extraído(s)`);

  for (const evento of eventos) {
    const confianca = calcularConfianca(evento, fonte);

    await prisma.calendarEvent.upsert({
      where: {
        id: `${fonte.id}-${evento.date}-${evento.eventType}`,
      },
      create: {
        id: `${fonte.id}-${evento.date}-${evento.eventType}`,
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
        confidence: confianca,
        published: confianca === "CONFIRMED",
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
        confidence: confianca,
        published: confianca === "CONFIRMED",
        updatedAt: new Date(),
      },
    });
  }
}

async function main() {
  console.log(`Coleta iniciada: ${FONTES.length} fonte(s)`);

  for (let i = 0; i < FONTES.length; i++) {
    await coletarFonte(FONTES[i]);

    if (i < FONTES.length - 1) {
      await dormir(PAUSA_MS);
    }
  }

  console.log("\nColeta finalizada.");
  await prisma.$disconnect();
}

main().catch(async (erro) => {
  console.error("Erro fatal:", erro);
  await prisma.$disconnect();
  process.exit(1);
});