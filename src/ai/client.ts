import Anthropic from "@anthropic-ai/sdk";

export const AI_MODEL = "claude-opus-4-8";

const STORAGE_KEY = "pb_anthropic_key";

function resolveKey(): string | undefined {
  // localStorage takes precedence so users can override without restarting the server
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && stored.length > 10) return stored;
  const env = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;
  if (env && env.length > 10) return env;
  return undefined;
}

export function hasApiKey(): boolean {
  return !!resolveKey();
}

export function saveApiKey(key: string): void {
  localStorage.setItem(STORAGE_KEY, key.trim());
}

export function clearApiKey(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getClient(): Anthropic {
  const apiKey = resolveKey();
  if (!apiKey) {
    throw new Error("No Anthropic API key configured. Open ✨ AI Design to add your key.");
  }
  // dangerouslyAllowBrowser is required for browser clients — acceptable here
  // because this is a local-only app and the key never leaves the user's machine.
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}
