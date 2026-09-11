import { Shirt } from "./Shirt";
import { TruitjeBadges } from "./TruitjeBadges";
import { useBadges } from "../lib/badges";
import { truitjeBadges } from "../lib/badgeCatalogus";
import { LockSimple } from "@phosphor-icons/react/dist/csr/LockSimple";
import { BANK, FORMATIES, positieKort, positieLabel } from "../lib/formaties";
import type { Formatie } from "../lib/types";

type Props = { formatie: Formatie; namen: Record<string, string | null | undefined>; compact?: boolean; slotjes?: string[]; memberIds?: Record<string, string | null | undefined> };
export function Veld({ formatie, namen, compact = false, slotjes = [], memberIds = {} }: Props) {
  const badges = useBadges();
  const icoontjes = (pos: string) => memberIds[pos] ? <TruitjeBadges memberId={memberIds[pos]!} badges={truitjeBadges(badges.data ?? [], memberIds[pos]!)} /> : null;
  const plekken = FORMATIES[formatie].flatMap((rij, r) => rij.map((pos, i) => ({ pos, x:100*(i+1)/(rij.length+1), y:[85,65,43,20][r] })));
  return <section className={"tactiekbord" + (compact ? " compact" : "")} aria-label={`Opstelling ${formatie}`}>
    {badges.fout && Object.keys(memberIds).length > 0 && <p className="klein" role="status">Badges konden niet geladen worden. <button type="button" onClick={badges.herlaad}>Opnieuw</button></p>}
    <div className="tactiek-kop"><strong>STECA JUNIORS</strong><span>{formatie}</span></div>
    <div className="voetbalveld">
      <svg className="veldlijnen" viewBox="0 0 600 740" preserveAspectRatio="none" aria-hidden="true"><g fill="none" stroke="#f0ead0" strokeWidth="2" opacity=".65"><rect x="18" y="18" width="564" height="704"/><path d="M18 370h564M180 18v105h240V18M240 18v40h120V18M180 722V617h240v105M240 722v-40h120v40"/><circle cx="300" cy="370" r="72"/><path d="M250 123q50 48 100 0M250 617q50-48 100 0"/></g><g fill="#f0ead0"><circle cx="300" cy="370" r="3"/><circle cx="300" cy="95" r="3"/><circle cx="300" cy="645" r="3"/></g></svg>
      {plekken.map(({pos,x,y}) => <div key={pos} className="veldspeler" style={{left:x+"%",top:y+"%"}} aria-label={`${positieLabel(pos)}: ${namen[pos] ?? "Nog niet ingevuld"}`}><Shirt label={positieKort(pos)} />{slotjes.includes(pos) && <i className="veld-slot" aria-label="Vergrendeld"><LockSimple size={14} weight="fill" /></i>}<div className="speler-naamblok">{icoontjes(pos)}<span title={namen[pos] ?? positieLabel(pos)}>{namen[pos] ?? positieLabel(pos)}</span></div></div>)}
    </div>
    <div className="reserve-kop"><h3>De bank</h3><span>4 plaatsen</span></div>
    <div className="reserve-scene">
      <svg className="bank-tekening" viewBox="0 0 600 240" preserveAspectRatio="none" aria-hidden="true"><g stroke="#332e24" strokeWidth="3"><path d="M40 130v64M560 130v64"/><path d="M25 86h550v15H25zM25 110h550v15H25z" fill="#a37d4c"/><path d="M20 144h560v17H20z" fill="#c29b60"/><path d="M55 162v28M545 162v28"/></g><path d="M8 209q100-16 200 0t190 0t190 0" fill="none" stroke="#c8bea3"/></svg>
      <div className="vuurwerktas" role="img" aria-label="Tas met vuurwerk links van de eerste bankspeler"><svg viewBox="0 0 70 110"><g stroke="#292e24" strokeWidth="2"><path d="M18 62 12 15l12-3 10 50M36 62l4-48 12 1-2 48" fill="#b75238"/><path d="m10 16 7-12 9 9M38 15l10-12 6 14" fill="#e8bf53"/><path d="m21 58 2-13h25l4 13" fill="none"/><path d="M7 57h55l5 43H3Z" fill="#b08b52"/></g><text x="35" y="85" textAnchor="middle" fontSize="20" fill="#332e24">✦</text></svg></div>
      {BANK.map((pos,i)=><div key={pos} className="bankspeler" style={{left:[23,40,57,87][i]+"%"}}><Shirt label={String(i+1)} />{slotjes.includes(pos) && <i className="veld-slot" aria-label="Vergrendeld"><LockSimple size={14} weight="fill" /></i>}<div className="speler-naamblok">{icoontjes(pos)}<span>{namen[pos] ?? `Bank ${i+1}`}</span></div></div>)}
      <div className="bierbak" role="img" aria-label="Bak bier tussen de derde en vierde bankspeler"><svg viewBox="0 0 70 80"><g fill="#4d5b31" stroke="#283423" strokeWidth="2">{[12,28,44,60].map(x=><path key={x} d={`M${x-3} 5h6v10l3 5v30H${x-6}V20l3-5Z`}/>)}</g><path d="M2 35h66v38H2Z" fill="#d4ae42" stroke="#333424" strokeWidth="3"/><path d="M8 42h54v8H8z" fill="#544a27"/></svg></div>
      <div className="bank-ballen" aria-label="Voetballen voor de bank">{[0,1,2].map(i => <svg key={i} viewBox="0 0 40 40" aria-hidden="true" style={{transform:`rotate(${i*27-12}deg)`}}><circle cx="20" cy="20" r="17" fill="#f5efdb" stroke="#332e24" strokeWidth="2"/><path d="m20 12 8 6-3 9H15l-3-9Z" fill="#332e24"/><g fill="none" stroke="#332e24" strokeWidth="1.5"><path d="M20 12V3M28 18l8-4M25 27l5 7M15 27l-5 7M12 18l-8-4"/></g><path d="m15 4 5 3 5-3M35 11l-1 7 3 4M34 30l-7 1-2 5M15 36l-2-5-7-1M3 22l3-4-1-7" fill="#332e24"/></svg>)}</div>
    </div>
  </section>;
}
