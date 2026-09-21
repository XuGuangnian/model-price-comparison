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

  it("calculates multiplier and quota subscriptions", () => {
    const subscription: SubscriptionOffer = {
      id: "sub-model-a",
      kind: "subscription",
      modelId: "model-a",
      provider: "Provider",
      label: "Pro",
      monthlyFeeUsd: 100,
      valueMultiplier: 5,
      monthlyTokenQuota: 200_000_000,
      evidence: apiOffer.evidence,
    };
    expect(calculateSubscriptionCost(subscription, "multiplier", 500)?.totalUsd).toBe(100);
    expect(calculateSubscriptionCost(subscription, "quota", 500)).toEqual({
      totalUsd: 50,
      apiEquivalentValueUsd: 1000,
      effectiveMultiplier: 10,
    });
  });

  it("keeps quota cost invariant when the API scenario changes", () => {
    const subscription: SubscriptionOffer = {
      id: "sub-model-a",
      kind: "subscription",
      modelId: "model-a",
      provider: "Provider",
      label: "Pro",
      monthlyFeeUsd: 100,
      monthlyTokenQuota: 200_000_000,
      evidence: apiOffer.evidence,
    };
    expect(calculateSubscriptionCost(subscription, "quota", 100)?.totalUsd).toBe(
      calculateSubscriptionCost(subscription, "quota", 900)?.totalUsd,
    );
  });

  it("converts USD to CNY", () => {
    expect(convertUsd(100, "USD", 7.1)).toBe(100);
    expect(convertUsd(100, "CNY", 7.1)).toBeCloseTo(710);
  });
});
