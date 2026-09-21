import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { snapshotSchema, type Offer, type Snapshot } from "../src/domain/schema";

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

const root = resolve(import.meta.dirname, "..");
const catalog = JSON.parse(await readFile(resolve(root, "data/catalog.json"), "utf8")) as Catalog;
const current = JSON.parse(await readFile(resolve(root, "src/data/snapshot.json"), "utf8")) as Pick<
  Snapshot,
  "benchmarkSource" | "models"
>;
const benchmarkByModel = new Map(current.models.map((model) => [model.id, model.benchmark]));

const snapshot = snapshotSchema.parse({
  generatedAt: new Date().toISOString(),
  benchmarkSource: current.benchmarkSource,
  exchangeRate: catalog.exchangeRate,
  models: catalog.models
    .map(({ aaSlug: _aaSlug, benchmark, ...model }) => ({
      ...model,
      benchmark: benchmarkByModel.get(model.id) ?? benchmark ?? null,
    }))
    .sort((left, right) => left.id.localeCompare(right.id)),
  offers: catalog.offers
    .map(({ verifyAaPricing: _verifyAaPricing, ...offer }) => offer)
    .sort((left, right) => left.id.localeCompare(right.id)),
});

await writeFile(resolve(root, "src/data/snapshot.json"), `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Wrote ${snapshot.models.length} models and ${snapshot.offers.length} offers from the local catalog`);
