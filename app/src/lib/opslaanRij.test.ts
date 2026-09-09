import { describe, expect, it, vi } from "vitest";
import { maakOpslaanRij } from "./opslaanRij";
const wacht = () => { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; };

describe("automatisch opslaan", () => {
  it("bewaart direct en voorkomt gelijktijdige, verkeerd geordende writes", async () => {
    const eerste = wacht();
    const bewaar = vi.fn().mockImplementationOnce(() => eerste.promise).mockResolvedValue(undefined);
    const meld = vi.fn();
    const rij = maakOpslaanRij(bewaar, meld);
    rij.wijzig("eerste"); rij.wijzig("tussenstap"); rij.wijzig("laatste");
    expect(bewaar.mock.calls).toEqual([["eerste"]]);
    eerste.resolve();
    await vi.waitFor(() => expect(meld).toHaveBeenLastCalledWith("bewaard"));
    expect(bewaar.mock.calls).toEqual([["eerste"], ["laatste"]]);
  });
  it("toont een mislukking en houdt de wijziging vast voor opnieuw proberen", async () => {
    const error = new Error("offline");
    const bewaar = vi.fn().mockRejectedValueOnce(error).mockResolvedValue(undefined);
    const meld = vi.fn();
    const rij = maakOpslaanRij(bewaar, meld);
    rij.wijzig({ GK: "speler", slot: true });
    await vi.waitFor(() => expect(meld).toHaveBeenLastCalledWith("fout", error));
    expect(meld).not.toHaveBeenCalledWith("bewaard");
    rij.opnieuw();
    await vi.waitFor(() => expect(meld).toHaveBeenLastCalledWith("bewaard"));
    expect(bewaar).toHaveBeenCalledTimes(2);
    expect(bewaar.mock.calls[1][0]).toEqual({ GK: "speler", slot: true });
  });
  it("verliest de nieuwste wijziging niet als een eerdere aanvraag faalt", async () => {
    const eerste = wacht();
    const error = new Error("conflict");
    const bewaar = vi.fn().mockImplementationOnce(async () => { await eerste.promise; throw error; }).mockResolvedValue(undefined);
    const meld = vi.fn();
    const rij = maakOpslaanRij(bewaar, meld);
    rij.wijzig("oud"); rij.wijzig("nieuw"); eerste.resolve();
    await vi.waitFor(() => expect(meld).toHaveBeenLastCalledWith("fout", error));
    rij.opnieuw();
    await vi.waitFor(() => expect(meld).toHaveBeenLastCalledWith("bewaard"));
    expect(bewaar).toHaveBeenLastCalledWith("nieuw");
  });
});
