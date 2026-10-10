// Pure helpers that check Gemma's field note against the silence-first contract.

export const MAX_WORDS = 35;

const BANNED = [
  /\blisten in\b/i,
  /\bcheck your (screen|phone)\b/i,
  /\bkeep (going|walking|exploring|listening)\b/i,
  /\bbadge\b/i,
  /\bconfidence\b/i,
  /\b(as an ai|language model)\b/i,
  /^\s*(hi|hello|hey|welcome)\b/i,
  /\?/,
];

export function cleanNote(text: string): string {
  return text
    .replace(/[*_#`>"“”]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function countOccurrences(text: string, needle: string): number {
  if (!needle) return 0;
  const hay = text.toLowerCase();
  const n = needle.toLowerCase();
  let count = 0;
  for (let i = hay.indexOf(n); i !== -1; i = hay.indexOf(n, i + n.length)) count++;
  return count;
}

/** Trim to at most `max` words, preferring to end on a sentence boundary. */
export function trimToWords(text: string, max = MAX_WORDS): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= max) return text;
  const clipped = words.slice(0, max).join(" ");
  const lastStop = Math.max(clipped.lastIndexOf(". "), clipped.lastIndexOf("! "));
  if (lastStop >= 15) return clipped.slice(0, lastStop + 1);
  return clipped.replace(/[,;:—-]\s*$/, "") + ".";
}

export interface NoteCheck {
  ok: boolean;
  issues: string[];
}

export function checkNote(text: string, speciesName: string): NoteCheck {
  const issues: string[] = [];
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words === 0) issues.push("empty");
  if (words > MAX_WORDS) issues.push(`too long (${words} words)`);
  const mentions = countOccurrences(text, speciesName);
  if (mentions !== 1) issues.push(`species name appears ${mentions} times, expected exactly 1`);
  for (const re of BANNED) if (re.test(text)) issues.push(`contains forbidden phrase ${re}`);
  return { ok: issues.length === 0, issues };
}

/** Last-resort note built only from supplied data, never from model output. */
export function article(name: string): string {
  const n = name.trim().toLowerCase();
  if (/^(eu|uni|use)/.test(n)) return "a";
  return /^[aeiou]/.test(n) ? "an" : "a";
}

export function safeNote(speciesName: string, detail: string): string {
  const base = `That’s ${article(speciesName)} ${speciesName}.`;
  return detail ? `${base} ${detail}` : base;
}
