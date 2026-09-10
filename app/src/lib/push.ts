import { supabase } from './supabase';
export type PushStatus = { publicKey: string; enabled: boolean; jobs: { match_key: string; soort: string; status: string; sent_at: string | null; fout: string | null }[] };
export async function pushActie<T = Record<string, unknown>>(action: string, body = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('match-push', { body: { action, ...body } });
  if (error) {
    const detail = await error.context?.json?.().catch(() => null);
    throw new Error(detail?.error ?? error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
export function pushOndersteund() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
export async function zetMeldingenAan(publicKey: string) {
  if (!pushOndersteund()) throw new Error('Zet de app op je beginscherm en open ze via dat icoon om meldingen aan te zetten.');
  // Vraag toestemming tijdens de rechtstreekse klik, voor andere asynchrone handelingen.
  const toestemming = await Notification.requestPermission();
  if (toestemming!=='granted') throw new Error('Meldingen zijn niet toegestaan. Je kunt dit aanpassen in de instellingen van je toestel.');
  const reg = await navigator.serviceWorker.register(import.meta.env.BASE_URL + 'push-sw.js', { scope: import.meta.env.BASE_URL });
  await navigator.serviceWorker.ready;
  const bytes = Uint8Array.from(atob(publicKey.replaceAll('-','+').replaceAll('_','/')), c=>c.charCodeAt(0));
  const sub = await reg.pushManager.getSubscription() ?? await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
  await pushActie('subscribe',{subscription:sub.toJSON()});
  try { localStorage.removeItem('steca-meldingen-uit'); } catch { /* Optionele voorkeur. */ }
}
export async function zetMeldingenUit() {
  const reg = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
  const sub = await reg?.pushManager.getSubscription();
  if (sub) { await pushActie('unsubscribe',{endpoint:sub.endpoint}); await sub.unsubscribe(); }
  try { localStorage.setItem('steca-meldingen-uit','1'); } catch { /* Optionele voorkeur. */ }
}
