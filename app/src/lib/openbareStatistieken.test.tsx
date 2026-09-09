import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OpenbareStatistieken } from "../components/OpenbareStatistieken";
import type { Match } from "./types";

vi.mock("./useAsync", () => ({ useAsync: () => ({ laden: false, fout: null, herlaad: vi.fn(), data: {
  spelers: [{ id: "speler", naam: "Testspeler Een" }],
  stats: [{ member_id: "speler", match_key: "match", gespeeld: true, goals: 2, assists: 1, geel: 1, rood: 1 }],
  boetes: [{ id: "boete", member_id: "speler", match_key: "match", datum: "2026-09-01", soort: "bal_over_net", aantal: 1, bedrag_cent: 200, bak_bier: 0, opmerking: null }],
} }) }));
const match: Match = { match_key: "match", seizoen: "2026-2027", reeks: "Test", datum: "2026-09-01", uur: "15:00", thuis_id: 152, uit_id: 99, thuis: "Steca", uit: "Test", thuis_score: 2, uit_score: 0, status: "gespeeld", terrein: null, opmerking: null };

it("toont spelersnaam en wedstrijdcijfers zonder invoerfunctie", () => {
  const html = renderToStaticMarkup(<OpenbareStatistieken matches={[match]} />);
  expect(html).toContain("Testspeler Een");
  expect(html).toContain("<td>1</td><td>2</td><td>1</td><td>1</td><td>1</td><td>1</td>");
  expect(html).not.toContain("Invoeren per match");
});
it("telt kaartboetes mee maar biedt bezoekers geen bewerk- of verwijderknoppen", () => {
  const html = renderToStaticMarkup(<OpenbareStatistieken matches={[match]} boetepot />);
  expect(html).toContain("Testspeler Een");
  expect(html).toContain("€ 7,00");
  expect(html).toContain("1 bak bier");
  expect(html).not.toContain("Boete toevoegen");
  expect(html).not.toContain("Verwijder");
});
