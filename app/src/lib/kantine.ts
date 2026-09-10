import { supabase } from './supabase';
import type { Formatie } from './types';
import type { OpstellingKeuze } from './formaties';
export type Dream = { formatie: Formatie; keuze: OpstellingKeuze; slotjes: string[]; updated_at: string | null };
export type Pronostiek = { match_key: string; thuis: number; uit: number };
export type Rang = { user_id: string; naam: string; punten: number; exact: number; verschil: number; winnaar: number; gespeeld: number };
export function pronostiekPunten(thuis: number, uit: number, resultaatThuis: number | null, resultaatUit: number | null): number {
 if (![thuis,uit,resultaatThuis,resultaatUit].every(n => n !== null && Number.isInteger(n) && n >= 0 && n <= 99)) return 0;
 if (thuis === resultaatThuis && uit === resultaatUit) return 10;
 if (thuis-uit === resultaatThuis!-resultaatUit!) return 5;
 return Math.sign(thuis-uit) === Math.sign(resultaatThuis!-resultaatUit!) ? 3 : 0;
}
export async function kantineSpelers(): Promise<{ id: string; naam: string }[]> {
 const { data,error }=await supabase.rpc('kantine_spelers'); if(error)throw error;return data ?? [];
}
export async function haalDream(): Promise<Dream | null> {
 const { data,error }=await supabase.from('dream_xi').select('formatie,keuze,slotjes,updated_at').maybeSingle();if(error)throw error;return data;
}
export async function bewaarDream(d: Dream, versie: string | null): Promise<string> {
 const {data,error}=await supabase.rpc('bewaar_dream_xi',{p_formatie:d.formatie,p_keuze:d.keuze,p_slotjes:d.slotjes,p_versie:versie});if(error)throw error;return data;
}
export async function haalPronostieken(): Promise<Pronostiek[]> {
 const {data,error}=await supabase.from('pronostieken').select('match_key,thuis,uit');if(error)throw error;return data ?? [];
}
export async function bewaarPronostiek(match: string, thuis: number, uit: number) {
 const {error}=await supabase.rpc('bewaar_pronostiek',{p_match:match,p_thuis:thuis,p_uit:uit});if(error)throw error;
}
export async function haalPronostiekKlassement(seizoen: string): Promise<Rang[]> {
 const {data,error}=await supabase.rpc('kantine_klassement',{p_seizoen:seizoen});if(error)throw error;return data ?? [];
}
