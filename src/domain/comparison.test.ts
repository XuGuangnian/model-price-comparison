import { describe, expect, it } from "vitest";
import snapshotJson from "../data/snapshot.json";
import { buildComparisonPoints, getParetoPointIds } from "./comparison";
import { snapshotSchema } from "./schema";

const snapshot = snapshotSchema.parse(snapshotJson);
const scenario = { inputShare: 0.9, cacheReadRate: 0.95, cacheWriteRate: 0 };

describe("comparison points", () => {
  it("builds every priced API and subscription offer", () => {
    expect(buildComparisonPoints(snapshot, scenario)).toHaveLength(34);
  });

  it("uses the cheapest API offer as the subscription reference", () => {
    const point = buildComparisonPoints(snapshot, scenario).find(
      (candidate) => candidate.id === "command-goat-deepseek",
    );
    expect(point?.referenceApiOffer.id).toBe("deepseek-api-flash-offpeak");
  });

  it("derives Codex Pro 20x multipliers from weekly API value", () => {
    const points = buildComparisonPoints(snapshot, scenario);
    expect(points.find((point) => point.id === "chatgpt-pro20-luna")?.subscriptionCost?.effectiveMultiplier).toBeCloseTo(22.902);
    expect(points.find((point) => point.id === "chatgpt-pro20-sol")?.subscriptionCost?.effectiveMultiplier).toBeCloseTo(38.3966);
    expect(points.find((point) => point.id === "chatgpt-pro20-astra")?.subscriptionCost?.effectiveMultiplier).toBeCloseTo(29.26);
  });

  it("prices Pro 5x at twice the equivalent cost of Pro 20x", () => {
    const points = buildComparisonPoints(snapshot, scenario);
    for (const model of ["luna", "sol", "astra"]) {
      const pro5 = points.find((point) => point.id === `chatgpt-pro5-${model}`);
      const pro20 = points.find((point) => point.id === `chatgpt-pro20-${model}`);
      expect(pro5?.costUsd).toBeCloseTo((pro20?.costUsd ?? 0) * 2);
      expect(pro5?.subscriptionCost?.effectiveMultiplier).toBeCloseTo(
        (pro20?.subscriptionCost?.effectiveMultiplier ?? 0) / 2,
      );
    }
  });

  it("retains older models when they clear the Index threshold", () => {
    const modelIds = new Set(buildComparisonPoints(snapshot, scenario).map((point) => point.model.id));
    for (const modelId of ["gpt-5-5", "claude-fable-5", "muse-spark-1-2"]) {
      expect(modelIds.has(modelId)).toBe(true);
    }
  });

  it("identifies only non-dominated points as Pareto points", () => {
    const points = buildComparisonPoints(snapshot, scenario).filter(
      (point) => point.model.benchmark && point.model.benchmark.intelligenceIndex >= 37.3,
    );
    const paretoIds = getParetoPointIds(points);
    expect(paretoIds.has("command-goat-deepseek")).toBe(true);
    expect(paretoIds.has("openai-api-astra")).toBe(false);
  });
});
