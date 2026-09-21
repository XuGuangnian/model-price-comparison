import { describe, expect, it } from "vitest";
import snapshotJson from "../data/snapshot.json";
import { snapshotSchema } from "./schema";

describe("data snapshot", () => {
  it("matches the public data contract", () => {
    expect(() => snapshotSchema.parse(snapshotJson)).not.toThrow();
  });

  it("has a scored Luna reference model", () => {
    const snapshot = snapshotSchema.parse(snapshotJson);
    const luna = snapshot.models.find((model) => model.id === "gpt-5-6-luna");
    expect(luna?.benchmark?.intelligenceIndex).toBeGreaterThan(0);
  });

  it("keeps source metadata on every offer", () => {
    const snapshot = snapshotSchema.parse(snapshotJson);
    for (const offer of snapshot.offers) {
      expect(offer.evidence.sourceUrl).toMatch(/^https:\/\//);
      expect(offer.evidence.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(offer.evidence.note.length).toBeGreaterThan(0);
    }
  });
});
