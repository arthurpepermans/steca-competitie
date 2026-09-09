import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";
import source from "../../../supabase/functions/drive-media/index.ts?raw";

const origin = "https://stecajuniors.app";
const user = "11111111-1111-4111-8111-111111111111";
const imageId = "22222222-2222-4222-8222-222222222222";
const endpoint = "https://odgrmhcmkvbdadjhphiz.supabase.co/functions/v1/drive-media";
let handler: (req: Request) => Promise<Response>;
let admin: boolean, active: boolean, readyFails: boolean, cipher: string;
const calls: { url: string; method: string; body: unknown }[] = [];
const row = { id: imageId, drive_id: "google-test-file", owner_id: user, status: "ready", mime_type: "image/jpeg", name: "test.jpg", created_at: "2026-09-10" };
const encode = (a: Uint8Array) => btoa(String.fromCharCode(...a)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
const response = (data: unknown, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...headers } });
const post = (data: unknown) => new Request(endpoint, { method: "POST", headers: { origin, Authorization: "Bearer fake-user-jwt", "Content-Type": "application/json" }, body: JSON.stringify(data) });

beforeEach(async () => {
  admin = false; active = true; readyFails = false; calls.length = 0;
  const key = await crypto.subtle.importKey("raw", await crypto.subtle.digest("SHA-256", new TextEncoder().encode("test-secret")), "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  cipher = `${encode(iv)}.${encode(new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode("test-refresh"))))}`;
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input), method = init?.method ?? "GET";
    calls.push({ url, method, body: init?.body });
    if (url.includes("/auth/v1/user")) return response({ id: user });
    if (url.includes("/rest/v1/members")) return response(active ? { is_admin: admin } : null);
    if (url.includes("/rest/v1/matches")) return response({ match_key: "wedstrijd", thuis: "Steca", uit: "Test", datum: "2026-09-10" });
    if (url.includes("/rest/v1/drive_connection")) return response({ folder_id: "club-folder", refresh_token_cipher: cipher });
    if (url.includes("/rest/v1/drive_media")) {
      if (method === "HEAD") return new Response(null, { headers: { "Content-Range": "0-0/1" } });
      if (method === "POST") return new Response(null, { status: 201 });
      if (method === "PATCH") return readyFails ? response({ message: "testfout" }, 400) : new Response(null, { status: 204 });
      if (url.includes("limit=") || url.includes("offset=")) return response([row], 200, { "Content-Range": "0-0/1" });
      return response(row);
    }
    if (url === "https://oauth2.googleapis.com/token") return response({ access_token: "fake-google-token" });
    if (url.includes("/upload/drive/")) return response({ id: "nieuw-google-bestand" });
    if (url.includes("googleapis.com/drive/v3/files/")) return method === "PATCH" ? response({}) : new Response("foto", { headers: { "Content-Type": "image/jpeg" } });
    throw new Error(`Onverwachte testaanvraag: ${url}`);
  }));
  const env: Record<string, string> = { SUPABASE_URL: "https://odgrmhcmkvbdadjhphiz.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "test-service", GOOGLE_DRIVE_CLIENT_SECRET: "test-secret", GOOGLE_DRIVE_CLIENT_ID: "test-client" };
  const javascript = ts.transpileModule(source.replace(/^import .*;\r?\n/, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  new Function("createClient", "Deno", javascript)(createClient, { env: { get: (name: string) => env[name] }, serve: (fn: typeof handler) => { handler = fn; } });
});
afterEach(() => vi.unstubAllGlobals());

describe("Drive-backend rechten en upload", () => {
  it("weigert anonieme aanvragen en verzoeken uit de testapp", async () => {
    expect((await handler(new Request(endpoint, { method: "POST", headers: { origin } }))).status).toBe(401);
    expect((await handler(new Request(endpoint, { method: "POST", headers: { origin: "https://test.stecajuniors.app" } }))).status).toBe(403);
    expect(calls).toHaveLength(0);
  });
  it("weigert niet-actieve leden", async () => {
    active = false;
    expect((await handler(post({ action: "list", matchKey: "wedstrijd" }))).status).toBe(403);
    expect(calls.some(c => c.url.includes("googleapis"))).toBe(false);
  });
  it("weigert verwijderen van iemand anders zonder adminrechten", async () => {
    row.owner_id = "33333333-3333-4333-8333-333333333333";
    expect((await handler(post({ action: "delete", id: imageId }))).status).toBe(403);
    expect(calls.some(c => c.url.includes("googleapis"))).toBe(false);
    row.owner_id = user;
  });
  it("laat admins andermans beeld naar de prullenbak verplaatsen", async () => {
    admin = true; row.owner_id = "ander";
    expect((await handler(post({ action: "delete", id: imageId }))).status).toBe(200);
    expect(calls.some(c => c.url.includes("googleapis.com/drive/") && c.body === '{"trashed":true}')).toBe(true);
    row.owner_id = user;
  });
  it("uploadt naar de clubmap en bewaart de eigenaar op de server", async () => {
    const form = new FormData(); form.append("matchKey", "wedstrijd"); form.append("file", new File(["foto"], "foto.jpg", { type: "image/jpeg" }));
    const result = await handler(new Request(endpoint, { method: "POST", headers: { origin, Authorization: "Bearer fake-user-jwt" }, body: form }));
    expect(await result.json()).toEqual({ ok: true });
    const upload = calls.find(c => c.url.includes("/upload/drive/"));
    expect(await (upload!.body as Blob).text()).toContain('"parents":["club-folder"]');
    const saved = calls.find(c => c.url.includes("/rest/v1/drive_media") && c.method === "POST");
    expect(JSON.parse(saved!.body as string).owner_id).toBe(user);
  });
  it("ruimt het nieuwe Drive-bestand op als albumregistratie faalt", async () => {
    readyFails = true;
    const form = new FormData(); form.append("matchKey", "wedstrijd"); form.append("file", new File(["foto"], "foto.jpg", { type: "image/jpeg" }));
    expect((await handler(new Request(endpoint, { method: "POST", headers: { origin, Authorization: "Bearer fake-user-jwt" }, body: form }))).status).toBe(503);
    expect(calls.some(c => c.url.endsWith("/nieuw-google-bestand") && c.body === '{"trashed":true}')).toBe(true);
  });
  it("weigert verzonnen beeldlinks zonder Google aan te roepen", async () => {
    expect((await handler(new Request(`${endpoint}?id=${imageId}&user=${user}&expires=9999999999&sig=nep`))).status).toBe(403);
    expect(calls).toHaveLength(0);
  });
  it("ondertekent beeldlinks en weigert wijzigingen aan de bestandskeuze", async () => {
    const result = await handler(post({ action: "list", matchKey: "wedstrijd" }));
    const album = await result.json();
    expect(album.total).toBe(1);
    expect((await handler(new Request(album.beelden[0].url))).status).toBe(200);
    const vervalst = new URL(album.beelden[0].url);
    vervalst.searchParams.set("id", "33333333-3333-4333-8333-333333333333");
    expect((await handler(new Request(vervalst))).status).toBe(403);
    active = false;
    expect((await handler(new Request(album.beelden[0].url))).status).toBe(403);
  });
  it("geeft een lege Drive-pagina terug als de oude opslag aan de beurt is", async () => {
    const result = await handler(post({ action: "list", matchKey: "wedstrijd", offset: 24 }));
    expect(await result.json()).toEqual({ total: 1, beelden: [] });
  });
});
