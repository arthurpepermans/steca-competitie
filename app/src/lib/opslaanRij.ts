export type OpslagStatus = "bewaard" | "opslaan" | "fout";

// Hoogstens één aanvraag tegelijk. Tijdens opslaan telt alleen de nieuwste wijziging.
export function maakOpslaanRij<T>(bewaar: (waarde: T) => Promise<void>, meld: (status: OpslagStatus, fout?: unknown) => void) {
  let volgende: { waarde: T } | null = null;
  let bezig = false;
  async function verwerk() {
    if (bezig || !volgende) return;
    bezig = true;
    meld("opslaan");
    while (volgende) {
      const aanvraag = volgende;
      volgende = null;
      try { await bewaar(aanvraag.waarde); }
      catch (e) {
        volgende ??= aanvraag;
        bezig = false;
        meld("fout", e);
        return;
      }
    }
    bezig = false;
    meld("bewaard");
  }
  return {
    wijzig(waarde: T) { volgende = { waarde }; void verwerk(); },
    opnieuw() { void verwerk(); },
  };
}
