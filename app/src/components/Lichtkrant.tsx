import { haalBoetes, haalLedenBasis, haalMatches, haalStats, haalStemPunten, haalWasbeurten } from "../lib/api";
import { useAuth } from "../lib/auth";
import { boeteItems, boeteTotalen, fmtEuro, potTotaal } from "../lib/boetes";
import { fmtDatum, isEigen, isThuis, laatsteUitslag, sorteerOpDatum, tegenstander, volgendeMatch } from "../lib/datum";
import { juniorVanDeMatch } from "../lib/stemmen";
import { useAsync } from "../lib/useAsync";

/** Lichtkrant onder de kop: laatste uitslag, volgende match, Junior van de match, boetepot en wasmand.
 *  De tekst loopt traag door; wie 'verminder beweging' aan heeft, ziet hem stilstaan. */
export function Lichtkrant() {
  const { lid } = useAuth();
  const data = useAsync(async () => {
    if (!lid) return null;
    const [matches, punten, boetes, leden, stats, wasbeurten] = await Promise.all([
      haalMatches(), haalStemPunten(), haalBoetes().catch(() => []), haalLedenBasis(), haalStats(), haalWasbeurten().catch(() => []),
    ]);
    return { matches, punten, boetes, leden, stats, wasbeurten };
  }, [lid?.id]);

  if (!lid || data.laden || data.fout || !data.data) return null;
  const { matches, punten, boetes, leden, stats, wasbeurten } = data.data;
  const namen = new Map(leden.map((m) => [m.id, m.naam]));
  const eigen = sorteerOpDatum(matches.filter(isEigen));
  const items: string[] = [];

  const laatste = laatsteUitslag(eigen);
  if (laatste) items.push(`Laatste uitslag: ${laatste.thuis} ${laatste.thuis_score} - ${laatste.uit_score} ${laatste.uit}`);

  const volgende = volgendeMatch(eigen);
  if (volgende) items.push(`Volgende: ${tegenstander(volgende)} (${isThuis(volgende) ? "thuis" : "uit"}), ${fmtDatum(volgende.datum)}${volgende.uur ? ` om ${volgende.uur}` : ""}`);

  const metStemmen = [...eigen].reverse().find((m) => m.status === "gespeeld" && punten.some((p) => p.match_key === m.match_key));
  if (metStemmen) {
    const winnaars = juniorVanDeMatch(punten, metStemmen.match_key).map((w) => namen.get(w.member_id)).filter(Boolean);
    if (winnaars.length) items.push(`Junior van de match tegen ${tegenstander(metStemmen)}: ${winnaars.join(" en ")}`);
  }

  const pot = potTotaal(boeteTotalen(boeteItems(boetes, stats, eigen)));
  if (pot.cent > 0 || pot.bakBier > 0) items.push(`Boetepot: ${fmtEuro(pot.cent)}${pot.bakBier ? ` en ${pot.bakBier} bak${pot.bakBier === 1 ? "" : "ken"} bier` : ""}`);

  const wasbeurt = volgende ? wasbeurten.find((w) => w.match_key === volgende.match_key) : undefined;
  if (wasbeurt && namen.get(wasbeurt.member_id)) items.push(`Wasmand: ${namen.get(wasbeurt.member_id)}`);

  if (items.length === 0) return null;
  // Elke helft van de band begint met een schermbrede lege ruimte: de tekst komt van rechts binnen,
  // loopt volledig voorbij en komt na de lege ruimte opnieuw. De twee helften maken de herhaling naadloos.
  const tekst = items.map((t) => `★ ${t}`).join("    ");
  return (
    <div className="lichtkrant" role="marquee" aria-label="Clubnieuws">
      <div className="lichtkrant-band">
        <span>{tekst}</span>
        <span aria-hidden="true">{tekst}</span>
      </div>
    </div>
  );
}
