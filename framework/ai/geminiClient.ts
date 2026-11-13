import dotenv from "dotenv";

dotenv.config();

export interface GeminiOptions {
  temperature?: number;
  responseMimeType?: "application/json" | "text/plain";
}

function extractText(data: any): string {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .filter((part: any) => typeof part?.text === "string")
    .map((part: any) => part.text)
    .join("\n")
    .trim();
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function requestModel(
  model: string,
  apiKey: string,
  prompt: string,
  options: GeminiOptions,
  attempts: number
): Promise<string> {
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  let lastError = "Unknown Gemini error";

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: options.temperature ?? 0,
            ...(options.responseMimeType
              ? { responseMimeType: options.responseMimeType }
              : {})
          }
        })
      });

      if (!response.ok) {
        const detail = await response.text();
        lastError = `Gemini model ${model} failed (${response.status} ${response.statusText}): ${detail}`;

        if (!RETRYABLE_STATUS.has(response.status)) {
          throw new Error(lastError);
        }

        if (attempt < attempts) {
          const retryAfter = Number(response.headers.get("retry-after"));
          const delay = Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(retryAfter * 1000, 30000)
            : Math.min(2000 * 2 ** (attempt - 1), 15000);
          console.warn(`Gemini temporary error (${response.status}). Retry ${attempt + 1}/${attempts} in ${delay / 1000}s...`);
          await wait(delay);
          continue;
        }
        break;
      }

      const data: unknown = await response.json();
      const content = extractText(data);
      if (!content) throw new Error(`Gemini model ${model} returned no text content.`);
      return content;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Gemini model")) {
        throw error;
      }

      lastError = error instanceof Error ? error.message : String(error);
      if (attempt < attempts) {
        const delay = Math.min(2000 * 2 ** (attempt - 1), 15000);
        console.warn(`Gemini network error. Retry ${attempt + 1}/${attempts} in ${delay / 1000}s...`);
        await wait(delay);
      }
    }
  }

  throw new Error(lastError);
}

export async function generateWithGemini(
  prompt: string,
  options: GeminiOptions = {}
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  const primaryModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing. Add it to your local .env file.");
  }

  try {
    return await requestModel(primaryModel, apiKey, prompt, options, 3);
  } catch (primaryError) {
    if (!fallbackModel || fallbackModel === primaryModel) throw primaryError;

    console.warn(`Primary Gemini model ${primaryModel} unavailable after retries. Trying fallback model ${fallbackModel}...`);
    return requestModel(fallbackModel, apiKey, prompt, options, 2);
  }
}

export function parseJsonResponse<T>(content: string): T {
  const cleaned = content
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(`Gemini response was not valid JSON. Response begins: ${cleaned.slice(0, 300)}`);
  }
}
