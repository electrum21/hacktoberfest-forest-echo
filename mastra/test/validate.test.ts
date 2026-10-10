import { describe, expect, it } from "vitest";
import { article, checkNote, cleanNote, safeNote, trimToWords } from "../src/validate.js";

describe("checkNote", () => {
  it("accepts a clean note", () => {
    expect(checkNote("A American Robin sings before dawn from a high perch.", "American Robin").ok).toBe(true);
  });
  it("requires the species exactly once", () => {
    expect(checkNote("A robin sings early.", "American Robin").ok).toBe(false);
    expect(checkNote("American Robin. A American Robin dives.", "American Robin").ok).toBe(false);
  });
  it("rejects questions, badges and keep-going filler", () => {
    for (const t of [
      "Hear that American Robin? It sings.",
      "American Robin earns you a badge.",
      "American Robin sings loudly. Keep walking.",
    ]) expect(checkNote(t, "American Robin").ok).toBe(false);
  });
  it("rejects over-long notes", () => {
    expect(checkNote(`American Robin ${"word ".repeat(40)}`, "American Robin").ok).toBe(false);
  });
});

describe("trimToWords", () => {
  it("prefers sentence boundaries", () => {
    const text = `Short first sentence here. ${"filler ".repeat(40)}`.trim();
    expect(trimToWords(text, 35)).toBe("Short first sentence here.");
  });
  it("leaves short text alone", () => {
    expect(trimToWords("Fine as is.")).toBe("Fine as is.");
  });
});

describe("misc", () => {
  it("strips markdown and quotes", () => {
    expect(cleanNote('**"Hello"** there')).toBe("Hello there");
  });
  it("picks a or an by sound", () => {
    expect(article("American Robin")).toBe("an");
    expect(article("European Starling")).toBe("a");
    expect(article("Blue Jay")).toBe("a");
    expect(article("Eastern Phoebe")).toBe("an");
  });
  it("safeNote uses only supplied data", () => {
    expect(safeNote("Test Bird", "It sings at dawn.")).toBe("That’s a Test Bird. It sings at dawn.");
    expect(safeNote("Test Bird", "")).toBe("That’s a Test Bird.");
  });
});

describe("look tips", () => {
  it("a where-to-look note is valid: looking at the world is fine, the phone is not", () => {
    const note = "That’s a Northern Cardinal. Look low in dense shrubs, or high on a perch when it sings.";
    expect(checkNote(note, "Northern Cardinal").ok).toBe(true);
    expect(checkNote("That’s a Northern Cardinal. Check your phone for more.", "Northern Cardinal").ok).toBe(false);
  });
});
