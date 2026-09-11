import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useAsync } from './useAsync';
import type { BadgeToewijzing } from './badgeCatalogus';

export async function haalBadges(): Promise<BadgeToewijzing[]> {
  const badges: BadgeToewijzing[]=[];
  for(let vanaf=0;;vanaf+=1000) {
    const {data,error}=await supabase.from('badges_met_volgorde').select('id,badge_id,member_id,seizoen,match_key,aangemaakt_op,volgorde,automatisch').order('id').range(vanaf,vanaf+999);
    if(error) throw new Error('De badges konden niet geladen worden. Probeer opnieuw.');
    badges.push(...(data ?? []));
    if(!data || data.length<1000) return badges;
  }
}
export function useBadges() {
  const [versie,zetVersie] = useState(0);
  useEffect(() => {
    const ververs = () => {if(document.visibilityState === 'visible') zetVersie(v => v+1);};
    window.addEventListener('steca-badges',ververs);
    window.addEventListener('focus',ververs);
    document.addEventListener('visibilitychange',ververs);
    // Ook wijzigingen vanaf een tweede toestel worden zichtbaar, zonder realtime-configuratie.
    const timer = window.setInterval(ververs,30000);
    return () => {window.removeEventListener('steca-badges',ververs);window.removeEventListener('focus',ververs);document.removeEventListener('visibilitychange',ververs);window.clearInterval(timer);};
  },[]);
  return useAsync(haalBadges,[versie]);
}
export async function bewaarBadgeVolgorde(ids:string[]) {
  const {error}=await supabase.rpc('bewaar_badgevolgorde',{p_badges:ids});
  if(error) throw error;
  window.dispatchEvent(new Event('steca-badges'));
}
