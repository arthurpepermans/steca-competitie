import { describe, expect, it, vi } from "vitest";
vi.mock("./supabase", () => ({ supabase: {} }));
import { controleerMedia, MAX_MEDIA_BYTES, mediaMap, mediaType } from "./media";

describe("wedstrijdmedia", () => {
  it("maakt aparte veilige mappen voor wedstrijdsleutels met slashes en accenten", () => {
    expect(mediaMap("a/b")).toBe("612f62");
    expect(mediaMap("a/b")).not.toBe(mediaMap("ab"));
    expect(mediaMap("é")).toBe("c3a9");
  });
  it("weigert lege, te grote en ongeschikte bestanden", () => {
    expect(controleerMedia({ name: "foto.jpg", type: "image/jpeg", size: 0 })).toMatch(/leeg/);
    expect(controleerMedia({ name: "video.mp4", type: "video/mp4", size: MAX_MEDIA_BYTES + 1 })).toMatch(/50 MB/);
    expect(controleerMedia({ name: "pagina.svg", type: "image/svg+xml", size: 100 })).toMatch(/Kies/);
    expect(controleerMedia({ name: "foto.jpg", type: "text/html", size: 100 })).toMatch(/Kies/);
  });
  it("accepteert foto's en telefoonvideo's tot de limiet", () => {
    expect(controleerMedia({ name: "clip.MOV", type: "video/quicktime", size: MAX_MEDIA_BYTES })).toBeNull();
    expect(mediaType({ name: "foto.HEIC", type: "" })).toBe("image/heic");
    expect(mediaType({ name: "foto.jpeg", type: "" })).toBe("image/jpeg");
  });
});
