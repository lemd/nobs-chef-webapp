import OpenAI from "openai";
import { RecipeSchema, type Recipe } from "../types/recipe.js";

const MODEL = "anthropic/claude-sonnet-4-5"; // OpenRouter model ID

// JSON Schema representation of RecipeSchema (passed to Claude as hard constraint)
const RECIPE_JSON_SCHEMA = {
  type: "object",
  required: ["title", "ingredientGroups", "steps"],
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    prepTime: { type: "string" },
    cookTime: { type: "string" },
    totalTime: { type: "string" },
    servings: { type: "string" },
    ingredientGroups: {
      type: "array",
      items: {
        type: "object",
        required: ["items"],
        additionalProperties: false,
        properties: {
          group: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              required: ["name"],
              additionalProperties: false,
              properties: {
                quantity: { type: "string" },
                unit: { type: "string" },
                name: { type: "string" },
                notes: { type: "string" },
                conversion: {
                  type: "object",
                  required: ["quantity", "unit"],
                  additionalProperties: false,
                  properties: {
                    quantity: { type: "string" },
                    unit: { type: "string" },
                  },
                },
                hint: { type: "string" },
              },
            },
          },
        },
      },
    },
    steps: {
      type: "array",
      items: {
        type: "object",
        required: ["stepNumber", "instruction"],
        additionalProperties: false,
        properties: {
          stepNumber: { type: "integer", minimum: 1 },
          instruction: { type: "string" },
          timingInterval: { type: "string" },
          temperatureConversion: { type: "string" },
        },
      },
    },
  },
};

function buildClient(): OpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Copy .env.example → .env and add your key."
    );
  }
  return new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "https://github.com/redipe",
      "X-Title": "Redipe",
    },
  });
}

const SYSTEM_PROMPT = `You are a precise recipe extraction assistant.
Given raw HTML or JSON-LD from a recipe web page, extract and return ONLY valid JSON that strictly conforms to the provided schema.

Rules:
- Split ingredients into groups if the source has sections (e.g. "For the sauce", "For the crust"). Otherwise use a single group with no "group" key.
- For each step, include "timingInterval" only when a specific duration is mentioned (e.g. "cook for 5 minutes"). Use human-readable strings like "5 minutes", "2–3 hours", "30 seconds".
- Normalise quantities to strings (e.g. "1/2", "2", "3–4").
- Do NOT wrap the JSON in markdown code fences.
- Respond with ONLY the JSON object, nothing else.

Description rules:
- Rewrite the description in a neutral, concise voice — 2–3 sentences max.
- Strip all marketing language ("you'll love", "perfect for weeknights", "family favourite", etc.).
- Do not reference the source website or brand.

Ingredient rules:
- Write ingredient names in lowercase (e.g. "beef steak", not "Beef Steak").
- Strip brand names from ingredient names unless the brand is essential to the recipe.
- If the source embeds preparation notes in the ingredient name (e.g. "onion, sliced", "garlic (minced)"), extract the preparation note into the "notes" field and keep the "name" field as just the ingredient (e.g. name: "onion", notes: "sliced").
- Garlic must always use cloves or bulbs as the unit. Convert any other measurement (e.g. tsp, tbsp, g, oz) to the nearest whole number of cloves (1 clove ≈ 1 tsp minced ≈ 3g). If the source specifies a whole head/bulb, use "bulb" as the unit. Never use volume or weight units for garlic.

Step rules:
- Rewrite steps in clean, direct imperative voice (e.g. "Add the onions..." not "Next, you'll want to add the onions...").
- Remove any cross-promotional copy, ads, or non-cooking content that may have been scraped alongside steps.
- Merge trivial micro-steps that are part of the same action into a single step.
- Within each step's "instruction" field, split distinct actions onto separate lines using the JSON escape sequence \n (e.g. "Heat the pan over medium-high heat.\nAdd the oil and swirl to coat.\nCook until shimmering."). Each \n-separated item must be one concise imperative sentence. Do NOT merge multiple actions into one sentence — keep them on separate lines. Single-action steps do not need \n.

Unit conversion rules ("conversion" field on ingredients):
- Provide ONLY for weight conversions: lb\u2192g, oz\u2192g (imperial\u2192metric) and g\u2192oz or g\u2192lb (metric\u2192imperial).
- OMIT conversion for: volume units (tbsp, tsp, cup, ml, fl oz) — these are universally understood in cooking and do not need conversion.
- OMIT conversion for: count-based amounts ("2 eggs", "3 cloves"), unitless items ("salt and pepper"), or very small herb/spice amounts below ~10g where an oz conversion would be meaningless.
- Common weight conversions: 1 oz=28g, 1 lb=454g.
- Round conversions to the nearest sensible value (e.g. 285g \u2192 "10 oz", not "10.05 oz").

Temperature conversion rules ("temperatureConversion" field on steps):
- If a step mentions a temperature in \u00b0F, provide the \u00b0C equivalent (e.g. "200\u00b0C").
- If a step mentions a temperature in \u00b0C, provide the \u00b0F equivalent (e.g. "400\u00b0F").
- Omit if no temperature is mentioned.

Ingredient hint rules ("hint" field on ingredients):
- Provide a colloquial real-world equivalent ONLY when the original measurement is in grams or ounces and a plain-English description helps a home cook visualise the amount. Examples: "~\u00bd small onion", "~1 medium clove", "~4 cups loosely packed", "~\u00be cup or ~12 tomatoes", "~2 tbsp".
- Prefer count descriptions for produce (e.g. "~2 medium carrots") and volume for loose/leafy items (e.g. "~3 cups baby spinach").
- Omit for: items already expressed as a count or volume, seasonings/spices where grams is standard (flour, sugar, salt), or items where no intuitive equivalent exists.
- Keep hints to \u22645 words and always prefix with "~" to signal approximation.`;

export async function parseRecipeWithClaude(rawContent: string): Promise<Recipe> {
  const client = buildClient();

  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 4096,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: [
          "Extract the recipe from the following source content.",
          "",
          "Enforce this exact JSON schema:",
          "```json",
          JSON.stringify(RECIPE_JSON_SCHEMA, null, 2),
          "```",
          "",
          "SOURCE CONTENT:",
          "---",
          rawContent,
        ].join("\n"),
      },
    ],
  });

  const rawContent2 = response.choices[0]?.message?.content;
  if (!rawContent2) {
    throw new Error("OpenRouter returned an empty response.");
  }

  // Strip markdown code fences if present (e.g. ```json ... ```)
  const raw = rawContent2
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  // Parse and validate with Zod
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Claude returned invalid JSON:\n${raw}`);
  }

  const result = RecipeSchema.safeParse(parsed);
  if (!result.success) {
    console.warn("⚠  Zod validation issues (returning best-effort data):");
    console.warn(result.error.format());
    // Return the raw parse as a best-effort fallback
    return parsed as Recipe;
  }

  return result.data;
}
