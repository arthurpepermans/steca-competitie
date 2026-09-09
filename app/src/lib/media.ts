import { supabase } from "./supabase";

export const MEDIA_BUCKET = "match-sfeerbeelden";
export const MAX_MEDIA_BYTES = 50 * 1024 * 1024;
export const MEDIA_TYPES: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "image/heic": "heic", "image/heif": "heif", "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
};
export type Sfeerbeeld = { name: string; path: string; url: string; video: boolean; createdAt: string | null; eigenaar: string };

// Hex houdt wedstrijdsleutels met slashes, spaties en accenten veilig in één map.
export function mediaMap(matchKey: string): string {
  return Array.from(new TextEncoder().encode(matchKey), (b) => b.toString(16).padStart(2, "0")).join("");
}
export function mediaType(file: Pick<File, "name" | "type">): string {
  if (file.type) return file.type.toLowerCase();
  const ext = file.name.split(".").pop()?.toLowerCase();
  return Object.entries(MEDIA_TYPES).find(([, e]) => e === (ext === "jpeg" ? "jpg" : ext))?.[0] ?? "";
}
export function controleerMedia(file: Pick<File, "name" | "type" | "size">): string | null {
  if (!MEDIA_TYPES[mediaType(file)]) return "Kies een foto (JPG, PNG, WebP, GIF, HEIC) of video (MP4, MOV, WebM).";
  if (file.size === 0) return "Dit bestand is leeg.";
  if (file.size > MAX_MEDIA_BYTES) return "Dit bestand is groter dan 50 MB. Kies een kleinere foto of kortere video.";
  return null;
}

async function driveAanvraag(body: FormData | Record<string, unknown>) {
  const { data: session, error: authError } = await supabase.auth.getSession();
  if (authError) throw authError;
  if (!session.session) throw new Error("Log opnieuw in om sfeerbeelden te gebruiken.");
  const { data, error } = await supabase.functions.invoke("drive-media", { body });
  if (error) {
    const antwoord = await error.context?.json?.().catch(() => null);
    throw new Error(antwoord?.error ?? "Google Drive bereiken mislukt. Probeer opnieuw.");
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function haalSfeerbeelden(matchKey: string, offset = 0): Promise<{ beelden: Sfeerbeeld[]; meer: boolean }> {
  const drive = await driveAanvraag({ action: "list", matchKey, offset }) as { total: number; beelden: Sfeerbeeld[] };
  if (drive.beelden.length === 24) return { beelden: drive.beelden, meer: true };
  // Oudere beelden blijven in hun bestaande opslag. Paginering loopt door na de Drive-beelden.
  const ruimte = 24 - drive.beelden.length;
  const prefix = mediaMap(matchKey);
  const bucket = supabase.storage.from(MEDIA_BUCKET);
  const { data, error } = await bucket.list(prefix, { limit: ruimte, offset: Math.max(0, offset - drive.total), sortBy: { column: "created_at", order: "desc" } });
  if (error) throw error;
  const bestanden = (data ?? []).filter((f) => f.id);
  if (!bestanden.length) return { beelden: drive.beelden, meer: false };
  const paths = bestanden.map((f) => `${prefix}/${f.name}`);
  const signed = await bucket.createSignedUrls(paths, 3600);
  if (signed.error) throw signed.error;
  const urls = new Map(signed.data?.map((s) => [s.path, s.signedUrl]));
  if (paths.some((p) => !urls.get(p))) throw new Error("Niet alle beelden konden geladen worden. Probeer opnieuw.");
  return { beelden: [...drive.beelden, ...bestanden.map((f) => ({ name: f.name, path: `${prefix}/${f.name}`, url: urls.get(`${prefix}/${f.name}`)!, video: /\.(mp4|mov|webm)$/i.test(f.name), createdAt: f.created_at, eigenaar: f.name.split("_")[0] }))], meer: data?.length === ruimte };
}

export async function uploadSfeerbeeld(matchKey: string, file: File): Promise<void> {
  const fout = controleerMedia(file);
  if (fout) throw new Error(fout);
  const form = new FormData();
  form.append("matchKey", matchKey);
  form.append("file", new Blob([file], { type: mediaType(file) }), file.name);
  await driveAanvraag(form);
}

export async function verwijderSfeerbeeld(path: string): Promise<void> {
  if (path.startsWith("drive:")) {
    await driveAanvraag({ action: "delete", id: path.slice(6) });
    return;
  }
  const { data, error } = await supabase.storage.from(MEDIA_BUCKET).remove([path]);
  if (error) throw error;
  if (!data?.length) throw new Error("Dit beeld kon niet verwijderd worden. Vernieuw het album of controleer je rechten.");
}
