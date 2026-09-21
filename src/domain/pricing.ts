import type { ApiOffer, SubscriptionOffer } from "./schema";

export const COMPARISON_TOKEN_TOTAL = 100_000_000;
const TOKENS_PER_PRICE_UNIT = 1_000_000;

export type ComparisonScenario = {
  inputShare: number;
  cacheReadRate: number;
  cacheWriteRate: number;
};

export type TokenBreakdown = {
  regularInput: number;
  cachedInput: number;
  cacheWriteInput: number;
  output: number;
};

export type ApiCostBreakdown = TokenBreakdown & {
  regularInputCost: number;
  cachedInputCost: number;
  cacheWriteCost: number;
  outputCost: number;
  totalUsd: number;
};

function assertRate(name: string, value: number) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be between 0 and 1`);
  }
}

export function calculateTokenBreakdown(scenario: ComparisonScenario): TokenBreakdown {
  assertRate("inputShare", scenario.inputShare);
  assertRate("cacheReadRate", scenario.cacheReadRate);
  assertRate("cacheWriteRate", scenario.cacheWriteRate);

  if (scenario.cacheReadRate + scenario.cacheWriteRate > 1) {
    throw new RangeError("Cache read and write rates cannot exceed 1 in total");
  }

  const input = COMPARISON_TOKEN_TOTAL * scenario.inputShare;
  return {
    regularInput: input * (1 - scenario.cacheReadRate - scenario.cacheWriteRate),
    cachedInput: input * scenario.cacheReadRate,
    cacheWriteInput: input * scenario.cacheWriteRate,
    output: COMPARISON_TOKEN_TOTAL - input,
  };
}

export function calculateApiCost(offer: ApiOffer, scenario: ComparisonScenario): ApiCostBreakdown {
  const tokens = calculateTokenBreakdown(scenario);
  const readPrice = offer.pricing.cacheReadUsdPerMillion ?? offer.pricing.inputUsdPerMillion;
  const writePrice = offer.pricing.cacheWriteUsdPerMillion ?? offer.pricing.inputUsdPerMillion;
  const regularInputCost = (tokens.regularInput * offer.pricing.inputUsdPerMillion) / TOKENS_PER_PRICE_UNIT;
  const cachedInputCost = (tokens.cachedInput * readPrice) / TOKENS_PER_PRICE_UNIT;
  const cacheWriteCost = (tokens.cacheWriteInput * writePrice) / TOKENS_PER_PRICE_UNIT;
  const outputCost = (tokens.output * offer.pricing.outputUsdPerMillion) / TOKENS_PER_PRICE_UNIT;

  return {
    ...tokens,
    regularInputCost,
    cachedInputCost,
    cacheWriteCost,
    outputCost,
    totalUsd: regularInputCost + cachedInputCost + cacheWriteCost + outputCost,
  };
}

export function calculateSubscriptionCost(
  offer: SubscriptionOffer,
  apiOffer: ApiOffer,
  currentScenario: ComparisonScenario,
) {
  const currentApiCost = calculateApiCost(apiOffer, currentScenario);
  let monthlyApiValueUsd: number;
  let monthlyTokenQuota: number | null = null;
  let referenceApiCostUsd: number | null = null;

  if (offer.valuation.basis === "api-credit") {
    monthlyApiValueUsd = offer.valuation.apiCreditUsdPerPeriod * offer.valuation.periodsPerMonth;
  } else {
    monthlyTokenQuota = offer.valuation.tokensPerPeriod * offer.valuation.periodsPerMonth;
    referenceApiCostUsd = calculateApiCost(apiOffer, offer.valuation.referenceScenario).totalUsd;
    monthlyApiValueUsd = referenceApiCostUsd * (monthlyTokenQuota / COMPARISON_TOKEN_TOTAL);
  }

  const effectiveMultiplier = monthlyApiValueUsd / offer.monthlyFeeUsd;
  return {
    totalUsd: currentApiCost.totalUsd / effectiveMultiplier,
    monthlyApiValueUsd,
    monthlyTokenQuota,
    referenceApiCostUsd,
    effectiveMultiplier,
  };
}

export function convertUsd(amount: number, currency: "USD" | "CNY", usdToCny: number) {
  if (!Number.isFinite(amount) || amount < 0) throw new RangeError("Amount must be non-negative");
  if (!Number.isFinite(usdToCny) || usdToCny <= 0) throw new RangeError("USD/CNY rate must be positive");
  return currency === "CNY" ? amount * usdToCny : amount;
}
