import { haalSyncStatus } from "../lib/api";
import { fmtTijdstip } from "../lib/datum";
import { useAsync } from "../lib/useAsync";

export function LaatstBijgewerkt() {
  const { data } = useAsync(haalSyncStatus);
  if (!data) return null;
  if (data.status !== "ok") {
    return (
      <p className="voet" style={{ color: "var(--fout)" }}>
        Niet bijgewerkt sinds {fmtTijdstip(data.laatste_succes_at)} (probleem bij het ophalen van de federatiesite).
      </p>
    );
  }
  return <p className="voet">Laatst bijgewerkt op {fmtTijdstip(data.laatste_succes_at)} · bron kavvv-vb-ov.be</p>;
}
