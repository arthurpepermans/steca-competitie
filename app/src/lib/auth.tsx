import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { mijnLid } from "./api";
import { GEGEVENS_VERPLICHT } from "./config";
import type { Member } from "./types";

type AuthState = {
  klaar: boolean;
  session: Session | null;
  lid: Member | null;
  fout: string | null;
  herlaad: () => Promise<void>;
};

export const AuthContext = createContext<AuthState>({ klaar: false, session: null, lid: null, fout: null, herlaad: async () => {} });
const Ctx = AuthContext;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessieKlaar, setSessieKlaar] = useState(false);
  const [lid, setLid] = useState<Member | null>(null);
  const [lidKlaar, setLidKlaar] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessieKlaar(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") window.location.hash = "#/nieuw-wachtwoord";
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const herlaad = useCallback(async () => {
    if (!session) {
      setLid(null);
      setLidKlaar(true);
      return;
    }
    try {
      setLid(await mijnLid());
      setFout(null);
    } catch (e) {
      setFout(e instanceof Error ? e.message : String(e));
      setLid(null);
    }
    setLidKlaar(true);
  }, [session]);

  useEffect(() => {
    if (sessieKlaar) void herlaad();
  }, [sessieKlaar, herlaad]);

  return <Ctx.Provider value={{ klaar: sessieKlaar && lidKlaar, session, lid, fout, herlaad }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  return useContext(Ctx);
}

export type Rechten = {
  isAdmin: boolean;
  isHoofdadmin: boolean;
  /** coach, spelercoach, verantwoordelijke of admin */
  isStaf: boolean;
  /** speler, spelercoach of verantwoordelijke: telt mee voor aanwezigheid, opstelling en statistieken */
  isSpeler: boolean;
  isSupporter: boolean;
  /** mag telefoon, adres, geboortedatum en e-mail van leden zien */
  zietGegevens: boolean;
  gegevensVolledig: boolean;
};

export function rechten(lid: Member | null): Rechten {
  const actief = lid?.status === "actief";
  const isAdmin = Boolean(actief && lid?.is_admin);
  const functie = lid?.functie;
  const isSupporter = Boolean(actief && functie === "supporter");
  return {
    isAdmin,
    isHoofdadmin: Boolean(actief && lid?.is_hoofdadmin),
    isStaf: isAdmin || Boolean(actief && (functie === "coach" || functie === "spelercoach" || functie === "verantwoordelijke")),
    isSpeler: Boolean(actief && lid?.speelt),
    isSupporter,
    zietGegevens: Boolean(actief && !isSupporter),
    gegevensVolledig: !lid || !GEGEVENS_VERPLICHT.includes(lid.functie) || Boolean(lid.telefoon && lid.geboortedatum && lid.adres),
  };
}

/** Telt mee als speler in de app (aanwezigheid, opstelling, statistieken). */
export function isSpelerLid(m: { speelt: boolean; status: string }): boolean {
  return m.status === "actief" && m.speelt;
}
