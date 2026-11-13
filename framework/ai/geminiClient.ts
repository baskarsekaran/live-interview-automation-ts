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

export async function generateWithGemini(
  prompt: string,
  options: GeminiOptions = {}
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing. Add it to your local .env file.");
  }

  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

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
    throw new Error(`Gemini API failed (${response.status} ${response.statusText}): ${detail}`);
  }

  const data: unknown = await response.json();
  const content = extractText(data);

  if (!content) {
    throw new Error("Gemini returned no text content.");
  }

  return content;
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
