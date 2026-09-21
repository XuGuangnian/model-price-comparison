import { calculateApiCost, calculateSubscriptionCost, type ComparisonScenario, type SubscriptionMode } from "./pricing";
import type { ApiOffer, ModelRecord, Offer, Snapshot, SubscriptionOffer } from "./schema";

export type ComparisonPoint = {
  id: string;
  model: ModelRecord;
  offer: Offer;
  costUsd: number;
  referenceApiOffer: ApiOffer;
  apiCost: ReturnType<typeof calculateApiCost>;
  subscriptionCost: ReturnType<typeof calculateSubscriptionCost> | null;
};

export function buildComparisonPoints(
  snapshot: Snapshot,
  scenario: ComparisonScenario,
  subscriptionMode: SubscriptionMode,
) {
  const modelById = new Map(snapshot.models.map((model) => [model.id, model]));
  const apiOffers = snapshot.offers.filter((offer): offer is ApiOffer => offer.kind === "api");
  const apiResults = new Map(apiOffers.map((offer) => [offer.id, calculateApiCost(offer, scenario)]));
  const cheapestApiByModel = new Map<string, ApiOffer>();

  for (const offer of apiOffers) {
    const current = cheapestApiByModel.get(offer.modelId);
    if (!current || (apiResults.get(offer.id)?.totalUsd ?? Infinity) < (apiResults.get(current.id)?.totalUsd ?? Infinity)) {
      cheapestApiByModel.set(offer.modelId, offer);
    }
  }

  return snapshot.offers.flatMap((offer): ComparisonPoint[] => {
    const model = modelById.get(offer.modelId);
    const referenceApiOffer = offer.kind === "api" ? offer : cheapestApiByModel.get(offer.modelId);
    if (!model || !referenceApiOffer) return [];
    const apiCost = apiResults.get(referenceApiOffer.id) as ReturnType<typeof calculateApiCost>;

    if (offer.kind === "api") {
      return [{ id: offer.id, model, offer, costUsd: apiCost.totalUsd, referenceApiOffer, apiCost, subscriptionCost: null }];
    }

    const subscriptionCost = calculateSubscriptionCost(offer, subscriptionMode, apiCost.totalUsd);
    if (!subscriptionCost) return [];
    return [
      {
        id: offer.id,
        model,
        offer,
        costUsd: subscriptionCost.totalUsd,
        referenceApiOffer,
        apiCost,
        subscriptionCost,
      },
    ];
  });
}

export function getParetoPointIds(points: ComparisonPoint[]) {
  const ids = new Set<string>();
  for (const point of points) {
    const dominated = points.some(
      (candidate) =>
        candidate.id !== point.id &&
        candidate.costUsd <= point.costUsd &&
        (candidate.model.benchmark?.intelligenceIndex ?? -Infinity) >=
          (point.model.benchmark?.intelligenceIndex ?? -Infinity) &&
        (candidate.costUsd < point.costUsd ||
          (candidate.model.benchmark?.intelligenceIndex ?? -Infinity) >
            (point.model.benchmark?.intelligenceIndex ?? -Infinity)),
    );
    if (!dominated) ids.add(point.id);
  }
  return ids;
}

export function isSubscriptionOffer(offer: Offer): offer is SubscriptionOffer {
  return offer.kind === "subscription";
}
