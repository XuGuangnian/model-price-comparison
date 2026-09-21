import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { snapshotSchema, type ApiOffer, type Offer, type Snapshot } from "../src/domain/schema";

type CatalogModel = Omit<Snapshot["models"][number], "benchmark"> & {
  aaSlug: string;
  benchmark?: Snapshot["models"][number]["benchmark"];
};
type CatalogOffer = Offer & { verifyAaPricing?: boolean };
type Catalog = {
  exchangeRate: Snapshot["exchangeRate"];
  models: CatalogModel[];
  offers: CatalogOffer[];
};

type AaModel = {
  id: string;
  name: string;
  slug: string;
  release_date: string | null;
  evaluations: { artificial_analysis_intelligence_index: number | null };
  pricing: { price_1m_input_tokens: number | null; price_1m_output_tokens: number | null };
};

type AaResponse = {
  intelligence_index_version: number;
  pagination: { page: number; total_pages: number; has_more: boolean };
  data: AaModel[];
};

const root = resolve(import.meta.dirname, "..");
const catalogPath = resolve(root, "data/catalog.json");
const snapshotPath = resolve(root, "src/data/snapshot.json");

try {
  process.loadEnvFile(resolve(root, ".env"));
} catch {
  // CI and production refreshes can supply the key directly.
}

const apiKey = process.env.ARTIFICIAL_ANALYSIS_API_KEY;
if (!apiKey) {
  throw new Error("ARTIFICIAL_ANALYSIS_API_KEY is required; copy .env.example to .env first");
}

const catalog = JSON.parse(await readFile(catalogPath, "utf8")) as Catalog;

async function fetchPage(page: number) {
  const response = await fetch(`https://artificialanalysis.ai/api/v2/language/models/free?page=${page}`, {
    headers: { "x-api-key": apiKey as string },
  });
  if (!response.ok) throw new Error(`Artificial Analysis returned ${response.status} for page ${page}`);
  return (await response.json()) as AaResponse;
}

const firstPage = await fetchPage(1);
const remainingPages = await Promise.all(
  Array.from({ length: firstPage.pagination.total_pages - 1 }, (_, index) => fetchPage(index + 2)),
);
const aaModels = [firstPage, ...remainingPages].flatMap((page) => page.data);
const scoreRank = new Map<number, number>();
const scores = aaModels
  .map((model) => model.evaluations.artificial_analysis_intelligence_index)
  .filter((score): score is number => score !== null)
  .sort((left, right) => right - left);

for (const score of scores) {
  if (!scoreRank.has(score)) scoreRank.set(score, scores.findIndex((candidate) => candidate === score) + 1);
}

const models = catalog.models.map(({ aaSlug, benchmark: catalogBenchmark, ...model }) => {
  const aaModel = aaModels.find((candidate) => candidate.slug === aaSlug);
  if (!aaModel) {
    return { ...model, benchmark: catalogBenchmark ?? null };
  }
  const score = aaModel.evaluations.artificial_analysis_intelligence_index;
  return {
    ...model,
    releaseDate: aaModel.release_date ?? model.releaseDate,
    benchmark:
      score === null
        ? null
        : {
            artificialAnalysisId: aaModel.id,
            intelligenceIndex: score,
            globalRank: scoreRank.get(score) as number,
            indexVersion: String(firstPage.intelligence_index_version),
            fetchedAt: new Date().toISOString(),
          },
  };
});

for (const offer of catalog.offers) {
  if (offer.kind !== "api" || !offer.verifyAaPricing) continue;
  const model = catalog.models.find((candidate) => candidate.id === offer.modelId);
  const aaModel = aaModels.find((candidate) => candidate.slug === model?.aaSlug);
  if (!aaModel) throw new Error(`Cannot verify ${offer.id}: AA model not found`);
  const pairs: Array<[string, number, number | null]> = [
    ["input", offer.pricing.inputUsdPerMillion, aaModel.pricing.price_1m_input_tokens],
    ["output", offer.pricing.outputUsdPerMillion, aaModel.pricing.price_1m_output_tokens],
  ];
  for (const [field, manual, aa] of pairs) {
    if (aa !== null && Math.abs(manual - aa) > 0.000_001) {
      throw new Error(`${offer.id} ${field} price conflicts with AA: catalog=${manual}, aa=${aa}`);
    }
  }
}

const snapshot = snapshotSchema.parse({
  generatedAt: new Date().toISOString(),
  benchmarkSource: "https://artificialanalysis.ai/api/v2/language/models/free",
  exchangeRate: catalog.exchangeRate,
  models: models.sort((left, right) => left.id.localeCompare(right.id)),
  offers: catalog.offers
    .map(({ verifyAaPricing: _verifyAaPricing, ...offer }) => offer)
    .sort((left, right) => left.id.localeCompare(right.id)),
});

await mkdir(resolve(root, "src/data"), { recursive: true });
await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Wrote ${snapshot.models.length} models and ${snapshot.offers.length} offers to src/data/snapshot.json`);
