import { describe, expect, it } from "vitest";
import snapshotJson from "../data/snapshot.json";
import { applyCodexIntelligenceBonus, buildComparisonPoints, getParetoPointIds } from "./comparison";
import { snapshotSchema } from "./schema";

const snapshot = snapshotSchema.parse(snapshotJson);
const scenario = { inputShare: 0.9, cacheReadRate: 0.95, cacheWriteRate: 0 };

describe("comparison points", () => {
  it("builds every priced API and subscription offer", () => {
    expect(buildComparisonPoints(snapshot, scenario)).toHaveLength(52);
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

  it("applies a bounded Codex bonus only to ChatGPT subscriptions", () => {
    const points = applyCodexIntelligenceBonus(buildComparisonPoints(snapshot, scenario), 4);
    const chatgpt = points.find((point) => point.id === "chatgpt-pro20-astra");
    const api = points.find((point) => point.id === "openai-api-astra");
    const openCode = points.find((point) => point.id === "opencode-go-luna");
    expect(chatgpt?.intelligenceIndex).toBeCloseTo(55.7);
    expect(chatgpt?.intelligenceBonus).toBe(3);
    expect(api?.intelligenceIndex).toBeCloseTo(52.7);
    expect(openCode?.intelligenceIndex).toBeCloseTo(37.3);
  });

  it("converts MiMo Token Plan credits into model-specific API value", () => {
    const points = buildComparisonPoints(snapshot, scenario);
    const pro = points.find((point) => point.id === "mimo-token-max-pro");
    const flash = points.find((point) => point.id === "mimo-token-max-flash");
    expect(pro?.subscriptionCost?.monthlyApiValueUsd).toBeCloseTo(118.876827);
    expect(flash?.subscriptionCost?.monthlyApiValueUsd).toBeCloseTo(114.8);
    expect(pro?.subscriptionCost?.effectiveMultiplier).toBeCloseTo(1.3834117);
  });

  it("includes the OpenCode Go allowance for MiMo V2.6 Pro", () => {
    const point = buildComparisonPoints(snapshot, scenario).find(
      (candidate) => candidate.id === "opencode-go-mimo-pro",
    );
    expect(point?.subscriptionCost?.monthlyApiValueUsd).toBe(15);
    expect(point?.subscriptionCost?.effectiveMultiplier).toBe(1.5);
  });

  it("retains older models when they clear the Index threshold", () => {
    const modelIds = new Set(buildComparisonPoints(snapshot, scenario).map((point) => point.model.id));
    for (const modelId of ["gpt-5-5", "claude-fable-5", "muse-spark-1-2"]) {
      expect(modelIds.has(modelId)).toBe(true);
    }
  });

  it("does not invent a Claude Fable subscription allowance", () => {
    const points = buildComparisonPoints(snapshot, scenario);
    expect(points.filter((point) => point.model.id === "claude-fable-5-1" && point.offer.kind === "subscription")).toHaveLength(0);
    expect(points.filter((point) => point.model.id === "claude-opus-5" && point.offer.kind === "subscription")).toHaveLength(2);
    expect(points.filter((point) => point.model.id === "claude-sonnet-5" && point.offer.kind === "subscription")).toHaveLength(2);
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
