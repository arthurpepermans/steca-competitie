import { useCallback, useEffect, useState, type DependencyList } from "react";

export type AsyncState<T> = {
  data: T | null;
  fout: string | null;
  laden: boolean;
  herlaad: () => Promise<void>;
};

/** Laadt data bij het tonen van een pagina; `herlaad` na een wijziging. */
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [laden, setLaden] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const herlaad = useCallback(async () => {
    try {
      setFout(null);
      setData(await fn());
    } catch (e) {
      setFout(e instanceof Error ? e.message : String(e));
    } finally {
      setLaden(false);
    }
  }, deps);

  useEffect(() => {
    void herlaad();
  }, [herlaad]);

  return { data, fout, laden, herlaad };
}

export function foutTekst(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
