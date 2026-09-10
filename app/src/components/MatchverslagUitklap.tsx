import { useState } from "react";
import { CaretDown } from "@phosphor-icons/react/dist/csr/CaretDown";
import { CaretUp } from "@phosphor-icons/react/dist/csr/CaretUp";
import { samenvatting, type Verslag } from "../lib/matchverslag";
import type { Match, MatchStat } from "../lib/types";
import { VerslagInvoer, VerslagTijdlijn } from "../pages/MatchVerslag";

type Props = {
  match: Match;
  verslag?: Verslag;
  stats: MatchStat[];
  spelers: { id: string; naam: string }[];
  isStaf: boolean;
  onGewijzigd: () => Promise<void> | void;
};

/** Matchverslag in de kalenderkaart: een ronde knop met pijltje klapt het verslag uit en weer in. */
export function MatchverslagUitklap({ match, verslag, stats, spelers, isStaf, onGewijzigd }: Props) {
  const [open, setOpen] = useState(false);
  const [bewerk, setBewerk] = useState(false);
  const totalen = samenvatting(stats, match.match_key, new Map(spelers.map((p) => [p.id, p.naam])));
  const id = `verslag-${match.match_key}`;
  return (
    <div className="verslag-uitklap">
      <div className="verslag-uitklap-kop">
        <button type="button" className="knop-rond" aria-expanded={open} aria-controls={id} aria-label={open ? "Matchverslag dichtklappen" : "Matchverslag openklappen"} onClick={() => setOpen(!open)}>
          {open ? <CaretUp size={20} weight="bold" aria-hidden="true" /> : <CaretDown size={20} weight="bold" aria-hidden="true" />}
        </button>
      </div>
      {open && (
        <div id={id} className="verslag-uitklap-inhoud">
          <VerslagTijdlijn match={match} verslag={verslag} totalen={totalen} />
          {isStaf && (
            <>
              <button type="button" className="knop licht klein" aria-expanded={bewerk} onClick={() => setBewerk(!bewerk)}>{bewerk ? "Invoer sluiten" : "Uitslag en matchverslag invullen"}</button>
              {bewerk && <VerslagInvoer key={verslag?.updated_at ?? match.match_key} match={match} verslag={verslag} namen={spelers.map((p) => p.naam)} klaar={async () => { await onGewijzigd(); setBewerk(false); }} />}
            </>
          )}
        </div>
      )}
    </div>
  );
}
