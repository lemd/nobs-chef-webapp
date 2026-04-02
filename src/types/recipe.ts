import { z } from "zod";

// ── Unit Conversion ─────────────────────────────────────────────────────────
export const ConversionSchema = z.object({
  quantity: z.string().describe("Converted amount, e.g. '680'"),
  unit: z.string().describe("Converted unit, e.g. 'g', 'ml'"),
});

export type Conversion = z.infer<typeof ConversionSchema>;

// ── Ingredient ──────────────────────────────────────────────────────────────
export const IngredientSchema = z.object({
  quantity: z.string().optional().describe("Numeric amount, e.g. '1', '1/2', '2-3'"),
  unit: z.string().optional().describe("Measurement unit, e.g. 'cup', 'tbsp', 'g'"),
  name: z.string().describe("Ingredient name, e.g. 'all-purpose flour'"),
  notes: z.string().optional().describe("Preparation notes, e.g. 'finely chopped', 'room temperature'"),
  conversion: ConversionSchema.optional().describe(
    "Provide ONLY for weight conversions (lb→g, oz→g, g→oz, g→lb). Omit for volume units (tbsp, tsp, cup, ml, fl oz), count-based amounts (e.g. '2 eggs'), unitless items, or herb/spice amounts below ~10g."
  ),
  hint: z.string().optional().describe(
    "Colloquial real-world equivalent for weight-based amounts, e.g. '~½ small onion', '~12 tomatoes', '~4 cups loosely packed'. Only for items in grams or ounces where a practical equivalent adds clarity. Keep to ≤5 words with a ~ prefix."
  ),
});

export type Ingredient = z.infer<typeof IngredientSchema>;

// ── Ingredient Group ─────────────────────────────────────────────────────────
export const IngredientGroupSchema = z.object({
  group: z.string().optional().describe("Group label, e.g. 'For the sauce'. Omit if ungrouped."),
  items: z.array(IngredientSchema),
});

export type IngredientGroup = z.infer<typeof IngredientGroupSchema>;

// ── Step ─────────────────────────────────────────────────────────────────────
export const StepSchema = z.object({
  stepNumber: z.number().int().positive(),
  instruction: z.string().describe("Full instruction text for this step"),
  timingInterval: z
    .string()
    .optional()
    .describe("Duration for this step if mentioned, e.g. '5 minutes', '30 seconds', '2–3 hours'"),
  temperatureConversion: z
    .string()
    .optional()
    .describe(
      "If the step mentions a temperature, provide ONLY the converted value in the other system, e.g. if original is '400°F' emit '200°C', if original is '180°C' emit '350°F'. Omit if no temperature is mentioned."
    ),
});

export type Step = z.infer<typeof StepSchema>;

// ── Recipe ───────────────────────────────────────────────────────────────────
export const RecipeSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  sourceUrl: z.string().optional().describe("Original URL this recipe was scraped from (injected by the service, not by Claude)"),
  prepTime: z.string().optional().describe("e.g. '15 minutes'"),
  cookTime: z.string().optional().describe("e.g. '20 minutes'"),
  totalTime: z.string().optional().describe("e.g. '35 minutes'"),
  servings: z.string().optional().describe("e.g. '4 servings', 'Makes 12 cookies'"),
  ingredientGroups: z.array(IngredientGroupSchema).describe(
    "One entry per ingredient group. Use a single ungrouped entry if there are no sections."
  ),
  steps: z.array(StepSchema),
});

export type Recipe = z.infer<typeof RecipeSchema>;
