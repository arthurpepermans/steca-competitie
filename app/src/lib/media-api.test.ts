import { beforeEach, describe, expect, it, vi } from "vitest";
const opslag = vi.hoisted(() => ({ list: vi.fn(), createSignedUrls: vi.fn(), upload: vi.fn(), remove: vi.fn(), getSession: vi.fn(), invoke: vi.fn() }));
vi.mock("./supabase", () => ({ supabase: { storage: { from: () => opslag }, auth: { getSession: opslag.getSession }, functions: { invoke: opslag.invoke } } }));
import { haalSfeerbeelden, mediaMap, uploadSfeerbeeld, verwijderSfeerbeeld } from "./media";

beforeEach(() => {
  vi.resetAllMocks();
  opslag.getSession.mockResolvedValue({ data: { session: { user: { id: "user" } } }, error: null });
  opslag.invoke.mockResolvedValue({ data: { beelden: [], total: 0 }, error: null });
});
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
  it("weigert uploaden zonder sessie en uploadt daarna via de clubfunctie", async () => {
    const file = new File(["test"], "foto.jpg", { type: "image/jpeg" });
    opslag.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(uploadSfeerbeeld("a", file)).rejects.toThrow(/Log opnieuw/);
    expect(opslag.upload).not.toHaveBeenCalled();
    opslag.getSession.mockResolvedValue({ data: { session: { user: { id: "user" } } }, error: null });
    opslag.upload.mockResolvedValue({ error: null });
    await uploadSfeerbeeld("a", file);
    expect(opslag.upload).not.toHaveBeenCalled();
    const [name, { body }] = opslag.invoke.mock.calls[0];
    expect(name).toBe("drive-media");
    expect(body.get("matchKey")).toBe("a");
    expect(body.get("file").name).toBe("foto.jpg");
    expect(body.get("file").type).toBe("image/jpeg");
  });
  it("pagineert over de grens tussen Drive en oude opslag", async () => {
    opslag.invoke.mockResolvedValue({ data: { total: 26, beelden: [{ path: "drive:a" }, { path: "drive:b" }] } });
    opslag.list.mockResolvedValue({ data: [], error: null });
    const data = await haalSfeerbeelden("a", 24);
    expect(opslag.list).toHaveBeenCalledWith(mediaMap("a"), expect.objectContaining({ offset: 0, limit: 22 }));
    expect(data.beelden).toHaveLength(2);
    opslag.invoke.mockResolvedValue({ data: { total: 26, beelden: [] } });
    await haalSfeerbeelden("a", 48);
    expect(opslag.list).toHaveBeenLastCalledWith(mediaMap("a"), expect.objectContaining({ offset: 22, limit: 24 }));
  });
  it("geeft de uitleg over een verlopen koppeling door", async () => {
    opslag.invoke.mockResolvedValue({ error: { context: { json: async () => ({ error: "Koppeling verlopen" }) } } });
    await expect(uploadSfeerbeeld("a", new File(["x"], "a.jpg", { type: "image/jpeg" }))).rejects.toThrow("Koppeling verlopen");
  });
  it("verwijdert Drive-beelden via de beveiligde functie", async () => {
    await verwijderSfeerbeeld("drive:abc");
    expect(opslag.invoke).toHaveBeenCalledWith("drive-media", { body: { action: "delete", id: "abc" } });
    expect(opslag.remove).not.toHaveBeenCalled();
  });
  it("meldt verwijderen zonder rechten niet als geslaagd", async () => {
    opslag.remove.mockResolvedValue({ data: [], error: null });
    await expect(verwijderSfeerbeeld("a/b.jpg")).rejects.toThrow(/niet verwijderd/);
  });
});
