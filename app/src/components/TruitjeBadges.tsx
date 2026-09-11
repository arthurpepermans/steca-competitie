import { Link } from 'react-router-dom';
import { useState } from 'react';
import { BadgeIcoon } from './BadgeIcoon';
import type { Badge } from '../lib/badgeCatalogus';

export function TruitjeBadges({badges,memberId}:{badges:Badge[];memberId:string}) {
  const [open,zetOpen]=useState(false);
  if(!badges.length) return null;
  return <div className="truitje-badges">
    <button type="button" className="truitje-badges-knop" aria-label={`Badges: ${badges.map(b=>b.titel).join(', ')}`} aria-expanded={open} onClick={()=>zetOpen(!open)}>
      {badges.slice(0,3).map(b=><BadgeIcoon key={b.id} id={b.id}/>)}{badges.length>3 && <b aria-label={`${badges.length-3} extra badges`}>{badges.length-3}+</b>}
    </button>
    {open && <div className="truitje-badge-detail"><button type="button" className="knop licht klein" onClick={()=>zetOpen(false)} aria-label="Badges sluiten">Sluiten</button>{badges.map(b=><div key={b.id}><BadgeIcoon id={b.id}/>{b.titel}</div>)}<Link to={`/leden/${memberId}`}>Spelersprofiel</Link></div>}
  </div>;
}
