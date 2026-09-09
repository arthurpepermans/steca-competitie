import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { Registreer } from "../pages/Auth";
import { Supporters } from "../pages/Supporters";
import { haalSupportersData } from "./supporters";

const { rpc, toestand } = vi.hoisted(() => ({ rpc: vi.fn(), toestand: { laden: false, fout: null, data: {
  matches: [{ match_key: "test", datum: "2026-09-12", uur: "15:00", seizoen: "2026-2027", reeks: "Testreeks", thuis_id: 152, uit_id: 99, thuis: "Steca Juniors", uit: "Testploeg", status: "gepland", terrein: "Teststraat 1, Brussel", thuis_score: null, uit_score: null, opmerking: null }],
  klassement: [], ploegen: [],
} } }));
vi.mock("./supabase", () => ({ supabase: { rpc }, configOk: true }));
vi.mock("./useAsync", () => ({ useAsync: () => toestand }));
vi.mock("../components/InstallatieHulp", () => ({ InstallatieHulp: () => null }));

describe("openbare supporterstoegang", () => {
  it("toont wedstrijd en route zonder leden- of opstellingsbediening", () => {
    const html = renderToStaticMarkup(<MemoryRouter><Supporters /></MemoryRouter>);
    expect(html).toContain("Testploeg");
    expect(html).toContain("query=Teststraat%201%2C%20Brussel");
    expect(html).not.toContain("/leden");
    expect(html).not.toContain("/opstelling");
    expect(html).not.toContain("Sfeerbeelden");
  });
  it("biedt openbare toegang in plaats van registratie als supporter", () => {
    const html = renderToStaticMarkup(<MemoryRouter><Registreer /></MemoryRouter>);
    expect(html).not.toContain('value="supporter"');
    expect(html).toContain('value="speler"');
    expect(html).toContain("Verder als supporter");
  });
  it("gebruikt uitsluitend de openbare databasefunctie", async () => {
    rpc.mockResolvedValueOnce({ data: toestand.data, error: null });
    expect(await haalSupportersData()).toEqual(toestand.data);
    expect(rpc).toHaveBeenCalledWith("openbare_clubinfo");
  });
  it("toont een begrijpelijke fout als de openbare gegevens ontbreken", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "permission denied" } });
    await expect(haalSupportersData()).rejects.toThrow("Probeer opnieuw");
  });
});
