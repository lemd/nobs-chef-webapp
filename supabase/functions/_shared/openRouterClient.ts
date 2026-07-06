import OpenAI from "npm:openai";
import { RecipeSchema, type Recipe } from "./recipe.ts";

const MODEL = "anthropic/claude-sonnet-4-5";

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
    tags: {
      type: "object",
      additionalProperties: false,
      properties: {
        mealType: { type: "string" },
        dietary: { type: "array", items: { type: "string" } },
        season: { type: "array", items: { type: "string" } },
        timeOfDay: { type: "array", items: { type: "string", enum: ["morning", "noon", "evening"] } },
      },
    },
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

const SYSTEM_PROMPT = `You are a precise recipe extraction assistant.
Given raw HTML or JSON-LD from a recipe web page, extract and return ONLY valid JSON that strictly conforms to the provided schema.

Rules:
- Write the title in neutral form: strip personal names/possessives (e.g. "JB's", "Grandma's", "Jamie's") and remove parenthetical subtitles (e.g. "(Creamy Peppercorn Sauce)"), keeping only the core dish name (e.g. "Chicken au Poivre").
- Split ingredients into groups if the source has sections (e.g. "For the sauce", "For the crust"). Otherwise use a single group with no "group" key.
- For each step, include "timingInterval" only when a specific duration is mentioned. Use a single human-readable duration string (e.g. "5 minutes", "2–3 hours", "30 seconds"). If a step covers multiple timed phases, use only the longest duration as a simple value (e.g. "20–30 minutes"). Never combine multiple timings with commas or semicolons into one timingInterval.
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
- Within each step's "instruction" field, split distinct actions onto separate lines using the JSON escape sequence \\n (e.g. "Heat the pan over medium-high heat.\\nAdd the oil and swirl to coat.\\nCook until shimmering."). Each \\n-separated item must be one concise imperative sentence. Do NOT merge multiple actions into one sentence — keep them on separate lines. Single-action steps do not need \\n.

Unit conversion rules ("conversion" field on ingredients):
- Provide ONLY for weight conversions: lb→g, oz→g (imperial→metric) and g→oz or g→lb (metric→imperial).
- OMIT conversion for: volume units (tbsp, tsp, cup, ml, fl oz) — these are universally understood in cooking and do not need conversion.
- OMIT conversion for: count-based amounts ("2 eggs", "3 cloves"), unitless items ("salt and pepper"), or very small herb/spice amounts below ~10g where an oz conversion would be meaningless.
- Common weight conversions: 1 oz=28g, 1 lb=454g.
- Round conversions to the nearest sensible value (e.g. 285g → "10 oz", not "10.05 oz").

Temperature conversion rules ("temperatureConversion" field on steps):
- If a step mentions a temperature in °F, provide the °C equivalent (e.g. "200°C").
- If a step mentions a temperature in °C, provide the °F equivalent (e.g. "400°F").
- Omit if no temperature is mentioned.

Ingredient hint rules ("hint" field on ingredients):
- Provide a colloquial real-world equivalent ONLY when the original measurement is in grams or ounces and a plain-English description helps a home cook visualise the amount. Examples: "~½ small onion", "~1 medium clove", "~4 cups loosely packed", "~¾ cup or ~12 tomatoes", "~2 tbsp".
- Prefer count descriptions for produce (e.g. "~2 medium carrots") and volume for loose/leafy items (e.g. "~3 cups baby spinach").
- Omit for: items already expressed as a count or volume, seasonings/spices where grams is standard (flour, sugar, salt), or items where no intuitive equivalent exists.
- Keep hints to ≤5 words and always prefix with "~" to signal approximation.

Tags rules ("tags" object):
- "mealType": a single lowercase string. You MUST pick from this exact list: "salad", "soup", "pasta", "rice", "noodles", "pizza", "bread", "sandwich", "burger", "taco", "curry", "stew", "roast", "steak", "chicken", "fish", "seafood", "eggs", "breakfast", "dessert", "cake", "cookies", "snack", "side dish", "sauce", "dip", "drink". Do NOT invent new values outside this list. If a vegetarian main course doesn't fit another category, use the most relevant protein/dish type (e.g. "roast", "steak", "eggs") or "side dish".
- "dietary": an array of applicable labels. Choose from: "vegetarian", "vegan", "pescatarian", "gluten-free", "dairy-free", "nut-free", "low-carb", "keto". Only include labels that are clearly true for the whole dish. Omit if none apply — do NOT include an empty array.
- "season": an array of seasons this dish is best suited to. Choose from: "spring", "summer", "autumn", "winter". Use ["all year"] if genuinely seasonal-neutral. Err toward the seasons where the dish's main ingredients are most available or where the dish is most appealing (e.g. hot soups → winter, cold salads → summer).
- "timeOfDay": an array of when this dish is typically eaten. Choose from: "morning" (breakfast/brunch), "noon" (lunch), "evening" (dinner/supper). Include ALL that genuinely apply — e.g. pancakes → ["morning"], quiche → ["morning", "noon"], roast chicken → ["evening"], soup could be ["noon", "evening"]. Omit if unclear.`;

function buildClient(): OpenAI {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set.");
  }
  return new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "https://nobs.mcdon.co",
      "X-Title": "Nobs",
    },
  });
}

export async function parseRecipeWithClaude(rawContent: string): Promise<Recipe> {
  const client = buildClient();

  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 4096,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
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

  const rawText = response.choices[0]?.message?.content;
  if (!rawText) {
    throw new Error("OpenRouter returned an empty response.");
  }

  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Claude returned invalid JSON:\n${cleaned}`);
  }

  const result = RecipeSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Claude returned invalid recipe structure:\n${JSON.stringify(result.error.format(), null, 2)}`);
  }

  return result.data;
}
