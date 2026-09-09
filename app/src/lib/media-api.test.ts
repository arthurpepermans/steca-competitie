import { beforeEach, describe, expect, it, vi } from "vitest";
const opslag = vi.hoisted(() => ({ list: vi.fn(), createSignedUrls: vi.fn(), upload: vi.fn(), remove: vi.fn(), getSession: vi.fn() }));
vi.mock("./supabase", () => ({ supabase: { storage: { from: () => opslag }, auth: { getSession: opslag.getSession } } }));
import { haalSfeerbeelden, mediaMap, uploadSfeerbeeld, verwijderSfeerbeeld } from "./media";

beforeEach(() => vi.resetAllMocks());
describe("media-opslag", () => {
  it("laadt alleen het wedstrijdalbum en gebruikt tijdelijke URLs", async () => {
    opslag.list.mockResolvedValue({ data: [{ id: "1", name: "gebruiker_clip.mp4", created_at: "2026-09-09" }], error: null });
    opslag.createSignedUrls.mockResolvedValue({ data: [{ path: `${mediaMap("match/a")}/gebruiker_clip.mp4`, signedUrl: "https://voorbeeld.invalid/tijdelijk" }], error: null });
    const data = await haalSfeerbeelden("match/a", 24);
    expect(opslag.list).toHaveBeenCalledWith(mediaMap("match/a"), expect.objectContaining({ offset: 24, limit: 24 }));
    expect(data.beelden[0]).toMatchObject({ video: true, eigenaar: "gebruiker", url: "https://voorbeeld.invalid/tijdelijk" });
    expect(opslag.createSignedUrls).toHaveBeenCalledWith([`${mediaMap("match/a")}/gebruiker_clip.mp4`], 3600);
  });
  it("toont een opslagfout niet als een leeg album", async () => {
    opslag.list.mockResolvedValue({ data: null, error: new Error("geen toegang") });
    await expect(haalSfeerbeelden("a")).rejects.toThrow("geen toegang");
  });
  it("weigert uploaden zonder sessie en overschrijft bestaande bestanden niet", async () => {
    const file = new File(["test"], "foto.jpg", { type: "image/jpeg" });
    opslag.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(uploadSfeerbeeld("a", file)).rejects.toThrow(/Log opnieuw/);
    expect(opslag.upload).not.toHaveBeenCalled();
    opslag.getSession.mockResolvedValue({ data: { session: { user: { id: "user" } } }, error: null });
    opslag.upload.mockResolvedValue({ error: null });
    await uploadSfeerbeeld("a", file);
    expect(opslag.upload).toHaveBeenCalledWith(expect.stringMatching(/^61\/user_.+\.jpg$/), file, { contentType: "image/jpeg", upsert: false });
  });
  it("meldt verwijderen zonder rechten niet als geslaagd", async () => {
    opslag.remove.mockResolvedValue({ data: [], error: null });
    await expect(verwijderSfeerbeeld("a/b.jpg")).rejects.toThrow(/niet verwijderd/);
  });
});
