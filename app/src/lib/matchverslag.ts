import { supabase } from './supabase';
import type { Match, MatchStat } from './types';

export type Moment = { minuut: number | null; soort: 'goal' | 'geel' | 'rood'; kant: 'thuis' | 'uit'; speler: string; assist: string };
export type Verslag = { match_key: string; thuis_score: number; uit_score: number; momenten: Moment[]; score_at: string; updated_at: string };
export async function haalVerslagen(): Promise<Verslag[]> {
  const { data, error } = await supabase.from('match_reports').select('match_key,thuis_score,uit_score,momenten,score_at,updated_at');
  if (error) throw error;
  return data ?? [];
}
export async function bewaarVerslag(matchKey: string, thuis: number, uit: number, momenten: Moment[], versie: string | null) {
  const { error } = await supabase.rpc('bewaar_matchverslag', { p_match_key: matchKey, p_thuis: thuis, p_uit: uit, p_momenten: momenten, p_versie: versie });
  if (error) throw error;
}
export function metVerslag(match: Match, verslag?: Verslag): Match {
  return verslag ? { ...match, status: 'gespeeld', thuis_score: verslag.thuis_score, uit_score: verslag.uit_score } : match;
}
export function sorteerMomenten(momenten: Moment[]) {
  return [...momenten].sort((a, b) => (b.minuut ?? -1) - (a.minuut ?? -1));
}
// Oude totalen hebben geen minuut of koppeling tussen goal en assist. Die verzinnen we niet.
export function samenvatting(stats: MatchStat[], matchKey: string, namen: Map<string, string>) {
  return stats.filter(s => s.match_key === matchKey && (s.goals || s.assists || s.geel || s.rood)).map(s => ({ ...s, naam: namen.get(s.member_id) ?? 'Speler' }));
}
