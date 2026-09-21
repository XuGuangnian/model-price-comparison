import { describe, expect, it } from "vitest";
import snapshotJson from "../data/snapshot.json";
import { buildComparisonPoints, getParetoPointIds } from "./comparison";
import { snapshotSchema } from "./schema";

const snapshot = snapshotSchema.parse(snapshotJson);
const scenario = { inputShare: 0.8, cacheReadRate: 0.5, cacheWriteRate: 0 };

describe("comparison points", () => {
  it("builds every offer in both subscription modes", () => {
    expect(buildComparisonPoints(snapshot, scenario, "multiplier")).toHaveLength(38);
    expect(buildComparisonPoints(snapshot, scenario, "quota")).toHaveLength(38);
  });

  it("uses the cheapest API offer as the subscription reference", () => {
    const point = buildComparisonPoints(snapshot, scenario, "multiplier").find(
      (candidate) => candidate.id === "command-goat-deepseek",
    );
    expect(point?.referenceApiOffer.id).toBe("deepseek-api-flash-offpeak");
  });

  it("identifies only non-dominated points as Pareto points", () => {
    const points = buildComparisonPoints(snapshot, scenario, "multiplier").filter(
      (point) => point.model.benchmark && point.model.benchmark.intelligenceIndex >= 37.3,
    );
    const paretoIds = getParetoPointIds(points);
    expect(paretoIds.has("command-goat-deepseek")).toBe(true);
    expect(paretoIds.has("openai-api-astra")).toBe(false);
  });
});
