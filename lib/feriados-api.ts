const BASE = "https://feriadosapi.com/api/v1";

export type FeriadoAPI = {
  data: string;
  nome: string;
  tipo: string;
};

async function buscar(caminho: string): Promise<FeriadoAPI[]> {
  const chave = process.env.FERIADOS_API_KEY;
  if (!chave) throw new Error("FERIADOS_API_KEY não configurada");

  const resposta = await fetch(`${BASE}${caminho}`, {
    headers: { "X-API-Key": chave },
  });

  if (!resposta.ok) {
    throw new Error(`Feriados API respondeu ${resposta.status} em ${caminho}`);
  }

  const json = await resposta.json();
  return json.feriados ?? [];
}

export function feriadosNacionais(ano: number) {
  return buscar(`/feriados/nacionais?ano=${ano}`);
}

export function feriadosEstaduais(uf: string, ano: number) {
  return buscar(`/feriados/estado/${uf}?ano=${ano}`);
}

export function feriadosCidade(ibge: string, ano: number) {
  return buscar(`/feriados/cidade/${ibge}?ano=${ano}`);
}

export const CAPITAIS: { uf: string; ibge: string; nome: string }[] = [
  { uf: "AC", ibge: "1200401", nome: "Rio Branco" },
  { uf: "AL", ibge: "2704302", nome: "Maceió" },
  { uf: "AM", ibge: "1302603", nome: "Manaus" },
  { uf: "AP", ibge: "1600303", nome: "Macapá" },
  { uf: "BA", ibge: "2927408", nome: "Salvador" },
  { uf: "CE", ibge: "2304400", nome: "Fortaleza" },
  { uf: "DF", ibge: "5300108", nome: "Brasília" },
  { uf: "ES", ibge: "3205309", nome: "Vitória" },
  { uf: "GO", ibge: "5208707", nome: "Goiânia" },
  { uf: "MA", ibge: "2111300", nome: "São Luís" },
  { uf: "MG", ibge: "3106200", nome: "Belo Horizonte" },
  { uf: "MS", ibge: "5002704", nome: "Campo Grande" },
  { uf: "MT", ibge: "5103403", nome: "Cuiabá" },
  { uf: "PA", ibge: "1501402", nome: "Belém" },
  { uf: "PB", ibge: "2507507", nome: "João Pessoa" },
  { uf: "PE", ibge: "2611606", nome: "Recife" },
  { uf: "PI", ibge: "2211001", nome: "Teresina" },
  { uf: "PR", ibge: "4106902", nome: "Curitiba" },
  { uf: "RJ", ibge: "3304557", nome: "Rio de Janeiro" },
  { uf: "RN", ibge: "2408102", nome: "Natal" },
  { uf: "RO", ibge: "1100205", nome: "Porto Velho" },
  { uf: "RR", ibge: "1400100", nome: "Boa Vista" },
  { uf: "RS", ibge: "4314902", nome: "Porto Alegre" },
  { uf: "SC", ibge: "4205407", nome: "Florianópolis" },
  { uf: "SE", ibge: "2800308", nome: "Aracaju" },
  { uf: "SP", ibge: "3550308", nome: "São Paulo" },
  { uf: "TO", ibge: "1721000", nome: "Palmas" },
];