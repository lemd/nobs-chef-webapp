import { z } from "npm:zod";

export const ConversionSchema = z.object({
  quantity: z.string().describe("Converted amount, e.g. '680'"),
  unit: z.string().describe("Converted unit, e.g. 'g', 'ml'"),
});

export type Conversion = z.infer<typeof ConversionSchema>;

export const IngredientSchema = z.object({
  quantity: z.string().optional().describe("Numeric amount, e.g. '1', '1/2', '2-3'"),
  unit: z.string().optional().describe("Measurement unit, e.g. 'cup', 'tbsp', 'g'"),
  name: z.string().describe("Ingredient name, e.g. 'all-purpose flour'"),
  notes: z.string().optional().describe("Preparation notes, e.g. 'finely chopped', 'room temperature'"),
  conversion: ConversionSchema.optional(),
  hint: z.string().optional(),
});

export type Ingredient = z.infer<typeof IngredientSchema>;

export const IngredientGroupSchema = z.object({
  group: z.string().optional(),
  items: z.array(IngredientSchema),
});

export type IngredientGroup = z.infer<typeof IngredientGroupSchema>;

export const StepSchema = z.object({
  stepNumber: z.number().int().positive(),
  instruction: z.string(),
  timingInterval: z.string().optional(),
  temperatureConversion: z.string().optional(),
});

export type Step = z.infer<typeof StepSchema>;

export const RecipeSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  sourceUrl: z.string().optional(),
  prepTime: z.string().optional(),
  cookTime: z.string().optional(),
  totalTime: z.string().optional(),
  servings: z.string().optional(),
  ingredientGroups: z.array(IngredientGroupSchema),
  steps: z.array(StepSchema),
});

export type Recipe = z.infer<typeof RecipeSchema>;
