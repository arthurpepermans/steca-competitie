import {expect,it,vi} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {AuthContext} from "./auth";
import {Aanwezigheid} from "../components/Aanwezigheid";
import {SupporterAanwezigheidContext} from "../components/SupporterAanwezigheid";
import {JuniorStemming} from "../components/Junior";
import type {Match} from "./types";
const match:Match={match_key:"m",seizoen:"2026-2027",reeks:"Test",datum:"2099-09-01",uur:"15:00",thuis:"Steca",uit:"Test",thuis_id:152,uit_id:99,status:"gepland",thuis_score:null,uit_score:null,terrein:null,opmerking:null};
const antwoorden=[{match_key:"m",user_id:"fan",naam:"Supporter",status:"aanwezig" as const},{match_key:"m",user_id:"fan2",naam:"Andere supporter",status:"onzeker" as const}];
const info={data:antwoorden,laden:false,fout:null,herlaad:vi.fn()};
const spelers=[{id:"p",naam:"Speler"},{id:"p2",naam:"Tweede speler"}];
const aanw=[{match_key:"m",member_id:"p",status:"aanwezig" as const,gezet_door:null,updated_at:""}];
it("houdt supporters buiten de spelersaantallen en toont hun eigen keuze apart",()=>{
 const html=renderToStaticMarkup(<AuthContext.Provider value={{klaar:true,session:null,lid:null,supporter:{user_id:"fan",naam:"Supporter",actief:true},fout:null,herlaad:vi.fn()}}><SupporterAanwezigheidContext.Provider value={info}>
 <Aanwezigheid match={match} spelers={spelers} aanwezigheden={aanw} eigenLidId={null} isSpeler={false} isStaf={false} isAdmin={false} onGewijzigd={vi.fn()}/>
 </SupporterAanwezigheidContext.Provider></AuthContext.Provider>);
 const [ploeg,supporters]=html.split('<section class="supporter-aanwezigheid"');
 expect(ploeg).toContain("Aanwezig: 1 · Afwezig: 0 · Onzeker: 0 · nog niets: 1");
 expect(ploeg).not.toContain('aria-pressed=');
 expect(supporters).toContain("Aanwezig: 1");
 expect(supporters).not.toContain("Afwezig:");
 expect(supporters).not.toContain("Onzeker:");
 expect(supporters).toContain("Op deze ultras kunnen we rekenen.");
 expect(supporters).toContain("Je staat als supporter op aanwezig.");
 expect(supporters).toContain('aria-pressed="true"');
 expect(html).not.toContain("Aanwezigheden aanpassen");
});
it("geeft een supporter geen stemformulier ook als die aanwezig is",()=>{
 const html=renderToStaticMarkup(<JuniorStemming match={{...match,status:"gespeeld"}} spelers={spelers} aanwezigheden={aanw} punten={[]} stemmers={[]} mijnStem={null} eigenLidId={null} onGewijzigd={vi.fn()}/>);
 expect(html).not.toContain('<form');
});
