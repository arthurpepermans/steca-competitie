import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { Registreer } from "../pages/Auth";
import { Supporters } from "../pages/Supporters";
import { haalSupportersData, haalOpenbareOpstellingen } from "./supporters";

const { rpc, toestand } = vi.hoisted(() => ({ rpc: vi.fn(), toestand: { laden: false, fout: null, data: {
  matches: [{ match_key: "test", datum: "2026-09-12", uur: "15:00", seizoen: "2026-2027", reeks: "Testreeks", thuis_id: 152, uit_id: 99, thuis: "Steca Juniors", uit: "Testploeg", status: "gepland", terrein: "Teststraat 1, Brussel", thuis_score: null, uit_score: null, opmerking: null }],
  klassement: [], ploegen: [],
} } }));
vi.mock("./supabase", () => ({ supabase: { rpc }, configOk: true }));
const loader = vi.hoisted(() => vi.fn());
vi.mock("./useAsync", () => ({ useAsync: loader }));
beforeEach(() => { loader.mockReset(); loader.mockReturnValue(toestand); });
vi.mock("../components/InstallatieHulp", () => ({ InstallatieHulp: () => null }));

describe("openbare supporterstoegang", () => {
  it("toont wedstrijd en route zonder leden- of opstellingsbediening", () => {
    const html = renderToStaticMarkup(<MemoryRouter initialEntries={["/supporters?tab=Kalender"]}><Supporters /></MemoryRouter>);
    expect(html).toContain("Testploeg");
    expect(html).toContain("query=Teststraat%201%2C%20Brussel");
    expect(html).not.toContain("/leden");
    expect(html).not.toContain("/opstelling");
    expect(html).not.toContain("Sfeerbeelden");
  });
  it("toont dezelfde homepage zonder aanwezigheidsbediening", () => {
    loader.mockReturnValueOnce(toestand)
      .mockReturnValueOnce({ ...toestand, data: toestand.data.matches })
      .mockReturnValueOnce({ ...toestand, data: [] })
      .mockReturnValueOnce({ ...toestand, data: [] })
      .mockReturnValueOnce({ ...toestand, data: [] });
    const html = renderToStaticMarkup(<MemoryRouter><Supporters /></MemoryRouter>);
    expect(html).toContain("BACOTIME.");
    expect(html).toContain("Matchdag");
    expect(html).toContain("/supporters?tab=Kalender");
    expect(html).not.toContain("Wie is erbij?");
    expect(html).not.toContain("Ben je erbij?");
  });
  it("toont namen op het veld zonder rad of bewerkknoppen", () => {
    loader.mockReturnValueOnce(toestand).mockReturnValueOnce({ ...toestand, data: [{ match_key: "test", formatie: "4-3-3", spelers: [{ positie: "GK", naam: "Testspeler" }] }] });
    const html = renderToStaticMarkup(<MemoryRouter initialEntries={["/supporters?tab=Opstelling"]}><Supporters /></MemoryRouter>);
    expect(html).toContain("Testspeler");
    expect(html).toContain("voetbalveld");
    expect(html).not.toContain("Bewerken");
    expect(html).not.toContain("HET RAD");
    expect(html).not.toContain("Opslaan");
  });
  it("laadt opstellingen via de beperkte openbare functie", async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });
    expect(await haalOpenbareOpstellingen()).toEqual([]);
    expect(rpc).toHaveBeenLastCalledWith("openbare_opstellingen");
  });
  it("houdt clubregistratie apart van openbare toegang", () => {
    const html = renderToStaticMarkup(<MemoryRouter><Registreer /></MemoryRouter>);
    expect(html).not.toContain('value="supporter"');
    expect(html).toContain('value="speler"');
    expect(html).toContain("Doorgaan zonder account");
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
