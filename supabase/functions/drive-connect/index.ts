import { createClient } from "npm:@supabase/supabase-js@2";

// Deze verbinding is uitsluitend voor de productieomgeving.
const base = Deno.env.get("SUPABASE_URL")!;
const origin = "https://stecajuniors.app";
const owner = "arthur.pepermanss@gmail.com";
const clientId = Deno.env.get("GOOGLE_DRIVE_CLIENT_ID")!;
const secret = Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET")!;
const callback = `${base}/functions/v1/drive-connect/callback`;
const db = createClient(base, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const headers = { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Cache-Control": "no-store", "Vary": "Origin" };
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
const random = () => encode(crypto.getRandomValues(new Uint8Array(32)));
const hash = async (s: string) => encode(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))));
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });

async function encrypt(token: string) {
  const key = await crypto.subtle.importKey("raw", await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)), "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(token));
  return `${encode(iv)}.${encode(new Uint8Array(ciphertext))}`;
}

async function complete(url: URL) {
  const state = url.searchParams.get("state");
  if (!state || state.length > 128) return json({ error: "Ongeldige koppelpoging." }, 400);
  // Verbruik het eenmalige bewijs atomair; een herhaalde callback wordt geweigerd.
  const { data: request, error } = await db.from("drive_oauth_states").delete().eq("state_hash", await hash(state)).gt("expires_at", new Date().toISOString()).select().maybeSingle();
  if (error || !request) return json({ error: "Deze koppelpoging is verlopen. Start opnieuw vanuit je profiel." }, 400);
  const { data: admin } = await db.from("members").select("id").eq("user_id", request.user_id).eq("status", "actief").eq("is_admin", true).maybeSingle();
  if (!admin) return json({ error: "Alleen actieve admins kunnen Drive koppelen." }, 403);
  if (url.searchParams.has("error")) return Response.redirect(`${origin}/#/drive?resultaat=geannuleerd`, 303);
  const code = url.searchParams.get("code");
  if (!code || code.length > 4096) return json({ error: "Google gaf geen geldige autorisatiecode terug." }, 400);
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ code, client_id: clientId, client_secret: secret, redirect_uri: callback, grant_type: "authorization_code", code_verifier: request.verifier }) });
  const token = await response.json();
  if (!response.ok || !token.access_token || !token.refresh_token) throw new Error("Google-koppeling mislukt. Start opnieuw en verleen toegang.");
  if (!String(token.scope).split(" ").includes("https://www.googleapis.com/auth/drive.file")) throw new Error("Toegang tot de clubbestanden is niet verleend.");
  const auth = { Authorization: `Bearer ${token.access_token}` };
  const identity = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: auth });
  const user = await identity.json();
  if (!identity.ok || !user.email_verified || user.email?.toLowerCase() !== owner) throw new Error(`Kies het afgesproken Drive-account ${owner}.`);
  const { data: existing, error: readError } = await db.from("drive_connection").select("folder_id,email").eq("id", 1).maybeSingle();
  if (readError) throw new Error("De koppeling kon niet worden gelezen.");
  let folderId = existing?.email === owner ? existing.folder_id : null;
  if (folderId) {
    const check = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,trashed`, { headers: auth });
    if (!check.ok || (await check.json()).trashed) throw new Error("De gekoppelde clubmap is niet bereikbaar. Laat de beheerder dit nakijken.");
  } else {
    const folder = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ name: "Steca Juniors - Sfeerbeelden", mimeType: "application/vnd.google-apps.folder", appProperties: { app: "steca-juniors-productie" } }) });
    if (!folder.ok) throw new Error("De clubmap kon niet in Drive worden aangemaakt.");
    folderId = (await folder.json()).id;
  }
  const saved = await db.from("drive_connection").upsert({ id: 1, email: owner, folder_id: folderId, refresh_token_cipher: await encrypt(token.refresh_token), connected_by: request.user_id, connected_at: new Date().toISOString() });
  if (saved.error) throw new Error("De verbinding kon niet worden opgeslagen. Probeer opnieuw.");
  return Response.redirect(`${origin}/#/drive?resultaat=gekoppeld`, 303);
}

Deno.serve(async (req) => {
  if (base !== "https://odgrmhcmkvbdadjhphiz.supabase.co") return json({ error: "Onjuiste omgeving." }, 503);
  if (req.method === "OPTIONS") return new Response(null, { headers });
  try {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname.endsWith("/callback")) return await complete(url);
    if (req.method !== "POST") return json({ error: "Niet ondersteund." }, 405);
    if (req.headers.get("origin") !== origin) return json({ error: "Ongeldige oorsprong." }, 403);
    const authorization = req.headers.get("authorization") ?? "";
    if (!authorization.startsWith("Bearer ")) return json({ error: "Log eerst in." }, 401);
    const { data: { user }, error } = await db.auth.getUser(authorization.slice(7));
    if (error || !user) return json({ error: "Log opnieuw in." }, 401);
    const { data: admin } = await db.from("members").select("id").eq("user_id", user.id).eq("status", "actief").eq("is_admin", true).maybeSingle();
    if (!admin) return json({ error: "Alleen admins kunnen Drive beheren." }, 403);
    const { action } = await req.json();
    if (action === "status") {
      const { data, error } = await db.from("drive_connection").select("email,folder_id,connected_at").eq("id", 1).maybeSingle();
      if (error) throw new Error("De verbindingsstatus kon niet worden geladen.");
      return json({ connected: !!data, connection: data });
    }
    if (action !== "start") return json({ error: "Onbekende actie." }, 400);
    // Houd slechts één lopende poging per admin bij.
    const removed = await db.from("drive_oauth_states").delete().eq("user_id", user.id);
    if (removed.error) throw new Error("Starten mislukt.");
    const state = random(), verifier = random();
    const saved = await db.from("drive_oauth_states").insert({ state_hash: await hash(state), user_id: user.id, verifier, expires_at: new Date(Date.now() + 10 * 60_000).toISOString() });
    if (saved.error) throw new Error("Starten mislukt.");
    const target = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    target.search = new URLSearchParams({ client_id: clientId, redirect_uri: callback, response_type: "code", scope: "openid email https://www.googleapis.com/auth/drive.file", access_type: "offline", prompt: "consent", login_hint: owner, state, code_challenge: await hash(verifier), code_challenge_method: "S256" }).toString();
    return json({ url: target.toString() });
  } catch (e) {
    // Geen Google-responses, tokens of codes in logs of foutmeldingen.
    const safe = e instanceof Error && !e.message.includes("fetch") ? e.message : "Koppelen is mislukt. Probeer opnieuw.";
    return json({ error: safe }, 400);
  }
});

