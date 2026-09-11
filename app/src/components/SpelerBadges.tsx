import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { haalMatches } from '../lib/api';
import { foutTekst, useAsync } from '../lib/useAsync';
import { Link } from 'react-router-dom';
import { BADGES, seizoenNu, sorteerBadges } from '../lib/badgeCatalogus';
import { useBadges, bewaarBadgeVolgorde } from '../lib/badges';
import { BadgeIcoon } from './BadgeIcoon';
import { Fout } from './Layout';

export function SpelerBadges({memberId}:{memberId:string}) {
  const info = useBadges();
  const matches = useAsync(haalMatches);
  const eigen = (info.data ?? []).filter(b => b.member_id === memberId);
  const seizoen = seizoenNu();
  const {lid}=useAuth();
  const isEigen=lid?.id===memberId;
  const [bezig,zetBezig]=useState(false);
  const [melding,zetMelding]=useState('');
  const [fout,zetFout]=useState('');
  const geordend=sorteerBadges(BADGES.filter(b=>eigen.some(t=>t.badge_id===b.id)),eigen);
  async function verplaats(id:string,buur:string) {
    const ids=geordend.map(b=>b.id),a=ids.indexOf(id),b=ids.indexOf(buur);
    if(a<0 || b<0 || bezig) return;
    [ids[a],ids[b]]=[ids[b],ids[a]];
    zetBezig(true);zetFout('');zetMelding('');
    try {await bewaarBadgeVolgorde(ids);await info.herlaad();zetMelding('Volgorde opgeslagen.');}
    catch(e){zetFout(foutTekst(e));}
    finally {zetBezig(false);}
  }
  return <section className="kaart speler-badges"><h2>Badges</h2>
    {isEigen && eigen.length>1 && <p className="klein zacht">Kies met de pijltjes welke badges eerst komen. De eerste drie actieve titels verschijnen bij je naam in de opstelling.</p>}
    <Fout tekst={info.fout || fout}/><p role="status" className="klein">{bezig?'Volgorde opslaan…':melding}</p>
    {info.fout && <button className="knop licht" onClick={info.herlaad}>Opnieuw laden</button>}
    {!info.data && info.laden && <p>Badges laden…</p>}
    {info.data && !eigen.length && <p className="zacht">Nog geen badges verzameld.</p>}
    {(['Actieve titels','Verzameling','Vorige seizoenen'] as const).map(groep => {
      const records = eigen.filter(t => {
        const b=BADGES.find(b=>b.id===t.badge_id);
        return groep==='Verzameling' ? b?.soort==='verzameling' : groep==='Vorige seizoenen'
          ? b?.soort==='seizoen' && t.seizoen!==seizoen : b?.soort==='alltime' || (b?.soort==='seizoen' && t.seizoen===seizoen);
      });
      const groepBadges=geordend.filter(b=>records.some(t=>t.badge_id===b.id));
      return records.length>0 && <div key={groep}><h3>{groep}</h3><div className="badge-profiel-grid">
        {groepBadges.map((b,index) => {
          const lijst=records.filter(t=>t.badge_id===b.id);
          return <div className="badge-profiel-kaart" key={b.id}><details className="badge-profiel"><summary><BadgeIcoon id={b.id}/><strong>{b.titel}</strong>{lijst.length>1 && <small>{lijst.length}×</small>}{b.soort==='seizoen' && <small>{[...new Set(lijst.map(t=>t.seizoen?.replace('-','/')))].join(', ')}</small>}</summary>
            <p>{b.uitleg}</p>{lijst.map(t => <div key={t.id}>{t.match_key && <Link to={`/match/${encodeURIComponent(t.match_key)}`}>{(() => {const m=matches.data?.find(m=>m.match_key===t.match_key);return m ? `${m.datum} · ${m.thuis} - ${m.uit}` : 'Bekijk matchverslag';})()}</Link>}</div>)}
          </details>{isEigen && groepBadges.length>1 && <div className="badge-volgorde-knoppen">
            <button type="button" disabled={bezig || index===0} aria-label={`${b.titel} eerder tonen`} onClick={()=>void verplaats(b.id,groepBadges[index-1].id)}>←</button>
            <button type="button" disabled={bezig || index===groepBadges.length-1} aria-label={`${b.titel} later tonen`} onClick={()=>void verplaats(b.id,groepBadges[index+1].id)}>→</button>
          </div>}</div>;
        })}
      </div></div>;
    })}
  </section>;
}
