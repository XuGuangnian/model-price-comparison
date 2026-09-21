import { describe, expect, it } from "vitest";
import type { ApiOffer, SubscriptionOffer } from "./schema";
import {
  calculateApiCost,
  calculateSubscriptionCost,
  calculateTokenBreakdown,
  convertUsd,
} from "./pricing";

const apiOffer: ApiOffer = {
  id: "api-model-a",
  kind: "api",
  modelId: "model-a",
  provider: "Provider",
  label: "Standard API",
  evidence: {
    level: "official",
    sourceUrl: "https://example.com/pricing",
    asOf: "2026-09-21",
    note: "Test fixture",
  },
  pricing: {
    inputUsdPerMillion: 2,
    cacheReadUsdPerMillion: 0.2,
    cacheWriteUsdPerMillion: 2.5,
    outputUsdPerMillion: 10,
  },
};

describe("pricing calculator", () => {
  it("partitions 100M tokens into mutually exclusive categories", () => {
    expect(calculateTokenBreakdown({ inputShare: 0.8, cacheReadRate: 0.5, cacheWriteRate: 0.1 })).toEqual({
      regularInput: 32_000_000,
      cachedInput: 40_000_000,
      cacheWriteInput: 8_000_000,
      output: 20_000_000,
    });
  });

  it("calculates every API price component", () => {
    const result = calculateApiCost(apiOffer, { inputShare: 0.8, cacheReadRate: 0.5, cacheWriteRate: 0.1 });
    expect(result.regularInputCost).toBe(64);
    expect(result.cachedInputCost).toBe(8);
    expect(result.cacheWriteCost).toBe(20);
    expect(result.outputCost).toBe(200);
    expect(result.totalUsd).toBe(292);
  });

  it("falls back to regular input pricing when cache prices are unavailable", () => {
    const result = calculateApiCost(
      { ...apiOffer, pricing: { ...apiOffer.pricing, cacheReadUsdPerMillion: null, cacheWriteUsdPerMillion: null } },
      { inputShare: 1, cacheReadRate: 0.5, cacheWriteRate: 0.5 },
    );
    expect(result.totalUsd).toBe(200);
  });

  it("rejects invalid cache partitions", () => {
    expect(() => calculateTokenBreakdown({ inputShare: 0.8, cacheReadRate: 0.8, cacheWriteRate: 0.3 })).toThrow(
      RangeError,
    );
  });

  it("derives a multiplier from a periodic API credit", () => {
    const subscription: SubscriptionOffer = {
      id: "sub-model-a",
      kind: "subscription",
      modelId: "model-a",
      provider: "Provider",
      label: "Pro",
      monthlyFeeUsd: 100,
      valuation: {
        basis: "api-credit",
        apiCreditUsdPerPeriod: 100,
        periodsPerMonth: 4,
        periodLabel: "week",
      },
      evidence: apiOffer.evidence,
    };
    expect(calculateSubscriptionCost(subscription, apiOffer, { inputShare: 1, cacheReadRate: 0, cacheWriteRate: 0 })).toEqual({
      totalUsd: 50,
      monthlyApiValueUsd: 400,
      monthlyTokenQuota: null,
      referenceApiCostUsd: null,
      effectiveMultiplier: 4,
    });
  });

  it("derives a stable multiplier from token quota and its reference scenario", () => {
    const subscription: SubscriptionOffer = {
      id: "sub-model-a",
      kind: "subscription",
      modelId: "model-a",
      provider: "Provider",
      label: "Pro",
      monthlyFeeUsd: 100,
      valuation: {
        basis: "token-quota",
        tokensPerPeriod: 200_000_000,
        periodsPerMonth: 1,
        periodLabel: "month",
        referenceScenario: { inputShare: 1, cacheReadRate: 0, cacheWriteRate: 0 },
      },
      evidence: apiOffer.evidence,
    };
    const regular = calculateSubscriptionCost(subscription, apiOffer, {
      inputShare: 1,
      cacheReadRate: 0,
      cacheWriteRate: 0,
    });
    const cached = calculateSubscriptionCost(subscription, apiOffer, {
      inputShare: 0.8,
      cacheReadRate: 0.5,
      cacheWriteRate: 0.1,
    });
    expect(regular).toEqual({
      totalUsd: 50,
      monthlyApiValueUsd: 400,
      monthlyTokenQuota: 200_000_000,
      referenceApiCostUsd: 200,
      effectiveMultiplier: 4,
    });
    expect(cached.effectiveMultiplier).toBe(4);
    expect(cached.totalUsd).toBe(73);
  });

  it("converts USD to CNY", () => {
    expect(convertUsd(100, "USD", 7.1)).toBe(100);
    expect(convertUsd(100, "CNY", 7.1)).toBeCloseTo(710);
  });
});
