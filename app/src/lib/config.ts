export const EIGEN_PLOEGID = 152;
export const EIGEN_NAAM = "Steca Juniors";

export const FUNCTIES = ["speler", "spelercoach", "coach", "verantwoordelijke", "supporter"] as const;
export type Functie = (typeof FUNCTIES)[number];

export const FUNCTIE_LABEL: Record<Functie, string> = {
  speler: "Speler",
  spelercoach: "Speler-coach",
  coach: "Coach",
  verantwoordelijke: "Verantwoordelijke",
  supporter: "Supporter",
};

/** Functies die telefoon, geboortedatum en adres verplicht moeten invullen. */
export const GEGEVENS_VERPLICHT: Functie[] = ["speler", "spelercoach", "coach", "verantwoordelijke"];
