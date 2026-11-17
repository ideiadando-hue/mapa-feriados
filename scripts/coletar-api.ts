import { Scope } from "@prisma/client";
import "dotenv/config";
import { prisma } from "../lib/prisma";
import {
  feriadosNacionais,
  feriadosEstaduais,
  feriadosCidade,
  CAPITAIS,
  FeriadoAPI,
} from "../lib/feriados-api";

const ANO = Number(process.argv[2] ?? new Date().getFullYear());

function dormir(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function paraISO(dataBR: string) {
  const [d, m, a] = dataBR.split("/");
  return `${a}-${m}-${d}`;
}

async function gravar(
  lista: FeriadoAPI[],
  opts: { scope: Scope; uf?: string; cidade?: string; peso: number; fonte: string }
) {
  let gravados = 0;

  for (const f of lista) {
    const iso = paraISO(f.data);
    const tipo = "FERIADO";
    const id = `${opts.scope}-${opts.uf ?? "BR"}-${opts.cidade ?? ""}-${iso}-${f.nome}`
      .replace(/\s+/g, "-")
      .toLowerCase();

    await prisma.calendarEvent.upsert({
      where: { id },
      create: {
        id,
        title: f.nome,
        eventType: tipo,
        scope: opts.scope,
        state: opts.uf ?? null,
        city: opts.cidade ?? null,
        date: new Date(`${iso}T12:00:00Z`),
        suspendsWork: true,
        isProjected: false,
        sourceWeight: opts.peso,
        confidence: "CONFIRMED",
        published: true,
        legalBasis: null,
        sources: {
          create: {
            url: "https://feriadosapi.com",
            publisher: opts.fonte,
            sourceType: "official",
            weight: opts.peso,
            excerpt: `${f.nome} em ${f.data} (${f.tipo})`,
          },
        },
      },
      update: {
        title: f.nome,
        published: true,
        updatedAt: new Date(),
      },
    });

    gravados++;
  }

  return gravados;
}

async function main() {
  console.log(`Coletando feriados de ${ANO} via Feriados API\n`);

  const nacionais = await feriadosNacionais(ANO);
  const n = await gravar(nacionais, {
    scope: "NATIONAL",
    peso: 1.0,
    fonte: "Feriados API — nacional",
  });
  console.log(`Nacionais: ${n} eventos`);
  await dormir(1300);

  let totalEstaduais = 0;
  for (const cap of CAPITAIS) {
    try {
      const lista = await feriadosEstaduais(cap.uf, ANO);
      const g = await gravar(lista, {
        scope: "STATE",
        uf: cap.uf,
        peso: 0.95,
        fonte: `Feriados API — ${cap.uf}`,
      });
      totalEstaduais += g;
      console.log(`${cap.uf}: ${g} estaduais`);
    } catch (e) {
      console.log(`${cap.uf}: erro — ${(e as Error).message}`);
    }
    await dormir(1300);
  }

  let totalMunicipais = 0;
  for (const cap of CAPITAIS) {
    try {
      const lista = await feriadosCidade(cap.ibge, ANO);
      const g = await gravar(lista, {
        scope: "MUNICIPAL",
        uf: cap.uf,
        cidade: cap.nome,
        peso: 0.9,
        fonte: `Feriados API — ${cap.nome}`,
      });
      totalMunicipais += g;
      console.log(`${cap.nome}: ${g} municipais`);
    } catch (e) {
      console.log(`${cap.nome}: erro — ${(e as Error).message}`);
    }
    await dormir(1300);
  }

  console.log(`\nTotal: ${n + totalEstaduais + totalMunicipais} eventos`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));