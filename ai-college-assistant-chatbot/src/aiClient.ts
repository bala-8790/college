import { SYSTEM_PROMPT } from "./knowledge";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type AIConfig = {
  apiKey: string;
  baseUrl: string; // e.g. https://api.openai.com/v1
  model: string; // e.g. gpt-4o-mini
};

const STORAGE_KEY = "kucet_ai_config";

export function loadConfig(): AIConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { apiKey: "", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" };
}

export function saveConfig(cfg: AIConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    /* ignore */
  }
}

export function hasAI(cfg: AIConfig) {
  return Boolean(cfg.apiKey && cfg.baseUrl && cfg.model);
}

/**
 * Calls an OpenAI-compatible /chat/completions endpoint.
 * `history` should be the prior conversation turns (excluding the new user message).
 */
export async function askAI(
  cfg: AIConfig,
  history: ChatTurn[],
  userMessage: string
): Promise<string> {
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.slice(-10),
    { role: "user", content: userMessage },
  ];

  const res = await fetch(`${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      temperature: 0.4,
      max_tokens: 700,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`AI request failed (${res.status}). ${errText.slice(0, 160)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response from AI.");
  return content.trim();
}
