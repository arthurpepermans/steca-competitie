import { createClient } from "npm:@supabase/supabase-js@2";

const base = Deno.env.get("SUPABASE_URL")!;
const secret = Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET")!;
const origin = "https://stecajuniors.app";
const db = createClient(base, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const MAX = 50 * 1024 * 1024;
const types = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif", "video/mp4", "video/quicktime", "video/webm"];
const cors = { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, range", "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Cache-Control": "private, no-store", "Vary": "Origin" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const enc = new TextEncoder();
const encode = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
const decode = (s: string) => Uint8Array.from(atob(s.replaceAll("-", "+").replaceAll("_", "/")), c => c.charCodeAt(0));
class Fout extends Error { constructor(message: string, public status = 400) { super(message); } }
const signKey = () => crypto.subtle.importKey("raw", enc.encode(`steca-media-v1:${secret}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
const bewijs = (id: string, user: string, expires: string) => enc.encode(`${id}\n${user}\n${expires}`);
async function member(user: string) {
  const { data, error } = await db.from("members").select("is_admin").eq("user_id", user).eq("status", "actief").maybeSingle();
  if (error) throw new Fout("Lidmaatschap controleren mislukt.", 503);
  if (!data) throw new Fout("Alleen actieve leden hebben toegang tot sfeerbeelden.", 403);
  return data;
}
async function drive() {
  const { data, error } = await db.from("drive_connection").select("folder_id,refresh_token_cipher").eq("id", 1).maybeSingle();
  if (error || !data) throw new Fout("De clubbeheerder moet Google Drive eerst koppelen.", 503);
  const [iv, cipher] = data.refresh_token_cipher.split(".");
  const key = await crypto.subtle.importKey("raw", await crypto.subtle.digest("SHA-256", enc.encode(secret)), "AES-GCM", false, ["decrypt"]);
  const refresh = new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(iv) }, key, decode(cipher)));
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh, client_id: Deno.env.get("GOOGLE_DRIVE_CLIENT_ID")!, client_secret: secret }) });
  const token = await response.json();
  if (!response.ok || !token.access_token) throw new Fout("De Google Drive-koppeling is verlopen. Vraag een admin om opnieuw te verbinden.", 503);
  return { folder: data.folder_id, auth: { Authorization: `Bearer ${token.access_token}` } };
}
async function googleError(response: Response): Promise<never> {
  const body = await response.json().catch(() => ({}));
  const reasons = body?.error?.errors?.map((e: { reason: string }) => e.reason) ?? [];
  if (reasons.includes("storageQuotaExceeded")) throw new Fout("De Google Drive van de club is vol. Vraag een admin om ruimte vrij te maken.", 507);
  throw new Fout("Google Drive kon dit bestand niet verwerken. Probeer opnieuw.", 502);
}
async function signed(id: string, user: string) {
  const expires = String(Math.floor(Date.now() / 1000) + 3600);
  const sig = encode(new Uint8Array(await crypto.subtle.sign("HMAC", await signKey(), bewijs(id, user, expires))));
  return `${base}/functions/v1/drive-media?${new URLSearchParams({ id, user, expires, sig })}`;
}
async function serveMedia(req: Request) {
  const q = new URL(req.url).searchParams;
  const id = q.get("id") ?? "", user = q.get("user") ?? "", expires = q.get("expires") ?? "", sig = q.get("sig") ?? "";
  if (!/^[\da-f-]{36}$/.test(id) || !/^[\da-f-]{36}$/.test(user) || !/^\d{10}$/.test(expires) || sig.length !== 43 || Number(expires) < Date.now() / 1000 || Number(expires) > Date.now() / 1000 + 3610) throw new Fout("Deze link is verlopen. Vernieuw het album.", 403);
  if (!await crypto.subtle.verify("HMAC", await signKey(), decode(sig), bewijs(id, user, expires))) throw new Fout("Ongeldige beeldlink.", 403);
  await member(user);
  const { data: row, error } = await db.from("drive_media").select("drive_id,mime_type").eq("id", id).eq("status", "ready").maybeSingle();
  if (error || !row) throw new Fout("Dit beeld is niet meer beschikbaar.", 404);
  const range = req.headers.get("range");
  if (range && !/^bytes=\d*-\d*$/.test(range)) throw new Fout("Ongeldig videobereik.", 416);
  const { auth } = await drive();
  const result = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(row.drive_id)}?alt=media`, { headers: { ...auth, ...(range ? { Range: range } : {}) } });
  if (result.status === 416) return new Response(null, { status: 416, headers: cors });
  if (!result.ok) return await googleError(result);
  const headers = new Headers({ ...cors, "Content-Type": row.mime_type, "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline", "Accept-Ranges": "bytes" });
  for (const name of ["content-length", "content-range"]) if (result.headers.has(name)) headers.set(name, result.headers.get(name)!);
  return new Response(result.body, { status: result.status, headers });
}
async function body(req: Request) {
  // Begrens ook uploads zonder Content-Length voordat formData het bestand inleest.
  let size = 0;
  const stream = req.body?.pipeThrough(new TransformStream({ transform(chunk, controller) { size += chunk.byteLength; if (size > MAX + 65536) throw new Fout("Maximaal 50 MB per bestand.", 413); controller.enqueue(chunk); } }));
  if (!stream) throw new Fout("Geen bestand ontvangen.");
  return await new Response(stream, { headers: { "Content-Type": req.headers.get("content-type")! } }).formData();
}

Deno.serve(async (req) => {
  if (base !== "https://odgrmhcmkvbdadjhphiz.supabase.co") return json({ error: "Onjuiste omgeving." }, 503);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    if (req.method === "GET") return await serveMedia(req);
    if (req.method !== "POST") throw new Fout("Niet ondersteund.", 405);
    if (req.headers.get("origin") !== origin) throw new Fout("Ongeldige oorsprong.", 403);
    const jwt = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
    if (!jwt) throw new Fout("Log eerst in.", 401);
    const { data: { user }, error } = await db.auth.getUser(jwt);
    if (error || !user) throw new Fout("Log opnieuw in.", 401);
    const lid = await member(user.id);
    const multipart = req.headers.get("content-type")?.startsWith("multipart/form-data");
    if (Number(req.headers.get("content-length")) > (multipart ? MAX + 65536 : 4096)) throw new Fout("Aanvraag te groot.", 413);
    const form = multipart ? await body(req) : null;
    const input = form ? { action: "upload", matchKey: form.get("matchKey") } : await req.json();
    if (input.action === "delete") {
      const { data: row, error } = await db.from("drive_media").select("id,drive_id,owner_id,status").eq("id", input.id).maybeSingle();
      if (error || !row) throw new Fout("Beeld niet gevonden.", 404);
      if (!lid.is_admin && row.owner_id !== user.id) throw new Fout("Alleen de uploader of een admin kan dit beeld verwijderen.", 403);
      if (row.status === "deleted") return json({ ok: true });
      const { auth } = await drive();
      const removed = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(row.drive_id)}`, { method: "PATCH", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ trashed: true }) });
      if (!removed.ok && removed.status !== 404) return await googleError(removed);
      const saved = await db.from("drive_media").update({ status: "deleted" }).eq("id", row.id);
      if (saved.error) throw new Fout("Bijwerken van het album mislukt. Probeer verwijderen opnieuw.", 503);
      return json({ ok: true });
    }
    if (typeof input.matchKey !== "string" || input.matchKey.length > 1000) throw new Fout("Ongeldige wedstrijd.");
    const { data: match } = await db.from("matches").select("match_key,thuis,uit,datum").eq("match_key", input.matchKey).or("thuis_id.eq.152,uit_id.eq.152").maybeSingle();
    if (!match) throw new Fout("Wedstrijd niet gevonden.", 404);
    if (input.action === "list") {
      const offset = input.offset ?? 0;
      if (!Number.isSafeInteger(offset) || offset < 0) throw new Fout("Ongeldige pagina.");
      const counted = await db.from("drive_media").select("id", { count: "exact", head: true }).eq("match_key", input.matchKey).eq("status", "ready");
      if (counted.error) throw new Fout("Album laden mislukt.", 503);
      const count = counted.count ?? 0;
      if (offset >= count) return json({ total: count, beelden: [] });
      const { data, error } = await db.from("drive_media").select("id,name,mime_type,owner_id,created_at").eq("match_key", input.matchKey).eq("status", "ready").order("created_at", { ascending: false }).order("id").range(offset, offset + 23);
      if (error) throw new Fout("Album laden mislukt.", 503);
      return json({ total: count ?? 0, beelden: await Promise.all((data ?? []).map(async row => ({ name: row.name, path: `drive:${row.id}`, url: await signed(row.id, user.id), video: row.mime_type.startsWith("video/"), createdAt: row.created_at, eigenaar: row.owner_id }))) });
    }
    if (input.action !== "upload" || !form) throw new Fout("Onbekende actie.");
    const file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > MAX || !types.includes(file.type)) throw new Fout("Kies een foto of video van maximaal 50 MB.");
    const { folder, auth } = await drive();
    const id = crypto.randomUUID();
    const name = file.name.replace(/[\x00-\x1f/\\]/g, "_").slice(0, 180) || "sfeerbeeld";
    // Reserveer metadata eerst. Mislukte uploads blijven verborgen en zijn traceerbaar.
    const saved = await db.from("drive_media").insert({ id, match_key: input.matchKey, owner_id: user.id, name, mime_type: file.type, bytes: file.size, status: "pending" });
    if (saved.error) throw new Fout("Upload voorbereiden mislukt.", 503);
    const boundary = `steca_${id}`;
    const metadata = { name: `${match.datum ?? ""} ${match.thuis} - ${match.uit} - ${name}`, parents: [folder], appProperties: { stecaMediaId: id } };
    const upload = new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${file.type}\r\n\r\n`, file, `\r\n--${boundary}--`]);
    const uploaded = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", { method: "POST", headers: { ...auth, "Content-Type": `multipart/related; boundary=${boundary}` }, body: upload });
    if (!uploaded.ok) return await googleError(uploaded);
    const driveId = (await uploaded.json()).id;
    if (!driveId) throw new Fout("Google gaf geen bestandsnummer terug.", 502);
    const ready = await db.from("drive_media").update({ drive_id: driveId, status: "ready" }).eq("id", id);
    if (ready.error) {
      await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveId)}`, { method: "PATCH", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ trashed: true }) });
      throw new Fout("Upload kon niet aan het album toegevoegd worden. Probeer opnieuw.", 503);
    }
    return json({ ok: true });
  } catch (e) {
    // Verstuur nooit Google-antwoorden of credentials naar de browser.
    return json({ error: e instanceof Fout ? e.message : "Verwerken mislukt. Probeer opnieuw." }, e instanceof Fout ? e.status : 500);
  }
});
