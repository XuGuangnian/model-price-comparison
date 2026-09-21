import { z } from "zod";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const urlSchema = z.string().url();

export const evidenceLevelSchema = z.enum(["official", "derived", "estimated"]);

export const evidenceSchema = z.object({
  level: evidenceLevelSchema,
  sourceUrl: urlSchema,
  asOf: dateSchema,
  note: z.string().min(1),
});

export const benchmarkSchema = z.object({
  artificialAnalysisId: z.string().uuid(),
  intelligenceIndex: z.number().nonnegative(),
  globalRank: z.number().int().positive(),
  indexVersion: z.string().min(1),
  fetchedAt: z.string().datetime(),
});

export const modelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  provider: z.string().min(1),
  family: z.string().min(1),
  version: z.string().min(1),
  releaseDate: dateSchema.nullable(),
  supersedes: z.array(z.string()).default([]),
  benchmark: benchmarkSchema.nullable(),
});

const offerBaseSchema = z.object({
  id: z.string().min(1),
  modelId: z.string().min(1),
  provider: z.string().min(1),
  label: z.string().min(1),
  evidence: evidenceSchema,
});

export const apiOfferSchema = offerBaseSchema.extend({
  kind: z.literal("api"),
  pricing: z.object({
    inputUsdPerMillion: z.number().nonnegative(),
    cacheReadUsdPerMillion: z.number().nonnegative().nullable(),
    cacheWriteUsdPerMillion: z.number().nonnegative().nullable(),
    outputUsdPerMillion: z.number().nonnegative(),
  }),
});

export const subscriptionOfferSchema = offerBaseSchema
  .extend({
    kind: z.literal("subscription"),
    monthlyFeeUsd: z.number().positive(),
    valueMultiplier: z.number().positive().optional(),
    monthlyTokenQuota: z.number().positive().optional(),
  })
  .refine((offer) => offer.valueMultiplier !== undefined || offer.monthlyTokenQuota !== undefined, {
    message: "A subscription needs a value multiplier or token quota",
  });

export const offerSchema = z.discriminatedUnion("kind", [apiOfferSchema, subscriptionOfferSchema]);

export const snapshotSchema = z
  .object({
    generatedAt: z.string().datetime(),
    benchmarkSource: urlSchema,
    exchangeRate: z.object({
      usdToCny: z.number().positive(),
      asOf: dateSchema,
      sourceUrl: urlSchema,
    }),
    models: z.array(modelSchema),
    offers: z.array(offerSchema),
  })
  .superRefine((snapshot, context) => {
    const modelIds = new Set<string>();
    const offerIds = new Set<string>();

    for (const model of snapshot.models) {
      if (modelIds.has(model.id)) {
        context.addIssue({ code: "custom", message: `Duplicate model id: ${model.id}` });
      }
      modelIds.add(model.id);
    }

    for (const offer of snapshot.offers) {
      if (offerIds.has(offer.id)) {
        context.addIssue({ code: "custom", message: `Duplicate offer id: ${offer.id}` });
      }
      offerIds.add(offer.id);
      if (!modelIds.has(offer.modelId)) {
        context.addIssue({ code: "custom", message: `Unknown model id on offer ${offer.id}` });
      }
    }

    for (const model of snapshot.models) {
      for (const supersededId of model.supersedes) {
        if (!modelIds.has(supersededId)) {
          context.addIssue({ code: "custom", message: `Unknown superseded model: ${supersededId}` });
        }
      }
    }
  });

export type EvidenceLevel = z.infer<typeof evidenceLevelSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type BenchmarkRecord = z.infer<typeof benchmarkSchema>;
export type ModelRecord = z.infer<typeof modelSchema>;
export type ApiOffer = z.infer<typeof apiOfferSchema>;
export type SubscriptionOffer = z.infer<typeof subscriptionOfferSchema>;
export type Offer = z.infer<typeof offerSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
