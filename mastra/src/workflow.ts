import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { naturalistAgent } from "./agent.js";
import { checkNote, cleanNote, safeNote, trimToWords } from "./validate.js";

const observationSchema = z.object({
  species_name: z.string(),
  scientific_name: z.string().default(""),
  confidence: z.number().min(0).max(1),
  habitat: z.string().default(""),
  fun_fact: z.string().default(""),
  look_tip: z.string().default(""),
  source: z.string(),
});

export const inputSchema = z.object({
  observation: observationSchema,
  streak_days: z.number().int().min(1),
  local_hour: z.number().int().min(0).max(23),
});

const outputSchema = z.object({
  spoken_text: z.string(),
  badge_id: z.string(),
  badge_title: z.string(),
  source: z.string(),
});

const badgeOutput = z.object({
  observation: observationSchema,
  badge_id: z.string(),
  badge_title: z.string(),
});

const draftOutput = badgeOutput.extend({ draft: z.string() });

export function pickBadge(streakDays: number, localHour: number): { id: string; title: string } {
  if (localHour < 7) return { id: "BADGE_DAWN_CHORUS", title: "Dawn Chorus Pioneer" };
  if (localHour >= 20) return { id: "BADGE_NIGHT_OWL", title: "Nocturnal Tracker" };
  if (streakDays >= 5) return { id: "BADGE_SCREEN_MINIMAL", title: "Eyes on the Trail" };
  return { id: "BADGE_NATURE_STEP", title: "Trail Tracker" };
}

const badgeStep = createStep({
  id: "quiet-badge-evaluator",
  inputSchema,
  outputSchema: badgeOutput,
  execute: async ({ inputData }) => {
    const { observation, streak_days, local_hour } = inputData;
    const badge = pickBadge(streak_days, local_hour);
    return { observation, badge_id: badge.id, badge_title: badge.title };
  },
});

function prompt(obs: z.infer<typeof observationSchema>, feedback?: string): string {
  const payload = JSON.stringify({
    species_name: obs.species_name,
    scientific_name: obs.scientific_name,
    habitat: obs.habitat,
    fun_fact: obs.fun_fact,
    look_tip: obs.look_tip,
  });
  return [
    "Create the final spoken field note from this observation. Return only the narration.",
    payload,
    feedback ? `Your previous attempt was rejected: ${feedback}. Fix this.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

const draftStep = createStep({
  id: "gemma-draft-field-note",
  inputSchema: badgeOutput,
  outputSchema: draftOutput,
  execute: async ({ inputData }) => {
    const result = await naturalistAgent.generate(prompt(inputData.observation));
    return { ...inputData, draft: cleanNote(result.text) };
  },
});

// Verification: the classifier owns the species claim, Gemma only narrates it.
// Check the note against the silence-first contract, retry once with feedback,
// then fall back to a note built purely from supplied data.
const verifyStep = createStep({
  id: "verify-field-note",
  inputSchema: draftOutput,
  outputSchema,
  execute: async ({ inputData }) => {
    const { observation, badge_id, badge_title } = inputData;
    const done = (spoken_text: string, source: string) => ({ spoken_text, badge_id, badge_title, source });

    let note = trimToWords(inputData.draft);
    let check = checkNote(note, observation.species_name);
    if (check.ok) return done(note, "mastra+gemma3n");

    const retry = await naturalistAgent.generate(prompt(observation, check.issues.join("; ")));
    note = trimToWords(cleanNote(retry.text));
    check = checkNote(note, observation.species_name);
    if (check.ok) return done(note, "mastra+gemma3n:retry");

    return done(safeNote(observation.species_name, observation.look_tip || observation.fun_fact), "mastra:safe-fallback");
  },
});

export const forestEchoWorkflow = createWorkflow({
  id: "forest-echo-observation",
  inputSchema,
  outputSchema,
})
  .then(badgeStep)
  .then(draftStep)
  .then(verifyStep)
  .commit();
