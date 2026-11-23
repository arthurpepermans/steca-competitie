import { expect, it, vi } from "vitest";
import { haalMijnStemmen } from "./api";

const { eq, from } = vi.hoisted(() => {
  const eq = vi.fn().mockResolvedValue({ data: [], error: null });
  const from = vi.fn(() => ({ select: () => ({ eq }) }));
  return { eq, from };
});

vi.mock("./supabase", () => ({ supabase: { from } }));

it("vraagt alleen stemmen van het ingelogde lid op, ook voor een beheerder", async () => {
  await haalMijnStemmen("beheerder");
  expect(from).toHaveBeenCalledWith("match_votes");
  expect(eq).toHaveBeenCalledWith("voter_id", "beheerder");
});

it("vraagt zonder lid geen stembrieven op", async () => {
  from.mockClear();
  expect(await haalMijnStemmen(undefined)).toEqual([]);
  expect(from).not.toHaveBeenCalled();
});
