import snapshotJson from "../src/data/snapshot.json" with { type: "json" };
import catalogJson from "../data/catalog.json" with { type: "json" };
import { snapshotSchema } from "../src/domain/schema";

const snapshot = snapshotSchema.parse(snapshotJson);
const luna = snapshot.models.find((model) => model.id === "gpt-5-6-luna");

if (!luna?.benchmark) throw new Error("GPT-5.6 Luna must have an Artificial Analysis benchmark");
const currentIds = new Set(snapshot.models.map((model) => model.id));
const catalogOfferIds = [...catalogJson.offers].map((offer) => offer.id).sort();
const snapshotOfferIds = snapshot.offers.map((offer) => offer.id).sort();

if (JSON.stringify(catalogOfferIds) !== JSON.stringify(snapshotOfferIds)) {
  throw new Error("Snapshot offers are stale; run npm run data:build");
}
for (const model of snapshot.models) {
  if (model.supersedes.some((id) => currentIds.has(id))) {
    throw new Error(`${model.id} includes a superseded model that is still active in the snapshot`);
  }
}

console.log(
  `Validated ${snapshot.models.length} models, ${snapshot.offers.length} offers; Luna threshold ${luna.benchmark.intelligenceIndex}`,
);
