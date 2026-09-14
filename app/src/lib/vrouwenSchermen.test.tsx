import {VrouwenProfielBadges} from '../components/VrouwenProfielBadges';
import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {Tactiekbord} from '../components/Veld';
import {VrouwenKalender,VrouwenTicket,supporterCijfers,vrouwenSupporters} from '../pages/VrouwenSchermen';
import {clubStatistieken,type ClubData} from './club';
const match={match_key:'afgelopen',seizoen:'2026-2027',aftrap:'2026-08-01T18:00:00Z',thuis:'STECA VROUWEN',uit:'Tegenstander',thuis_score:2,uit_score:0,is_test:true};
const data={leden:[{id:'veld',user_id:'speler',speelt:true,functie:'speler'}],pronoleden:[{user_id:'speler',naam:'Speelster'},{user_id:'fan',naam:'Supporter'}],matches:[match,{...match,match_key:'oud',seizoen:'2025-2026'}],opstellingen:[{match_key:'afgelopen',keuze:{GK:'veld',BANK5:'bank'}}],verslagen:[],aanwezigheden:[{match_key:'afgelopen',user_id:'fan',speler:false,status:'aanwezig'},{match_key:'afgelopen',user_id:'speler',speler:true,status:'aanwezig'}]} as unknown as ClubData;
it('gebruikt dezelfde veldtekening met vijf vrouwenbankplaatsen en vier mannenbankplaatsen',()=>{
 const vrouwen=renderToStaticMarkup(<Tactiekbord formatie="4-3-3" namen={{BANK5:'Vijfde reserve'}} zaal/>);
 expect(vrouwen).toContain('5 plaatsen');expect(vrouwen).toContain('Vijfde reserve');expect(vrouwen).not.toContain('Bank 6');
 const mannen=renderToStaticMarkup(<Tactiekbord formatie="4-3-3" namen={{}}/>);
 expect(mannen).toContain('4 plaatsen');expect(mannen).toContain('STECA JUNIORS');expect(mannen).not.toContain('STECA VROUWEN');
});
it('toont het ticket met vrouwenlogo, aftrap en de juiste route',()=>{
 const html=renderToStaticMarkup(<MemoryRouter><VrouwenTicket match={{...match,locaties:[{zaal:'Sporthal',adres:'Voorbeeldstraat 1'}]}}/></MemoryRouter>);
 expect(html).toContain('WEDSTRIJDTICKET');expect(html).toContain('logo-vrouwen-transparant.png');expect(html).toContain('Voorbeeldstraat');expect(html).toContain('Tegenstander');
});
it('telt de vijfde bankplaats mee en beperkt cijfers tot het gekozen seizoen',()=>{
 expect(clubStatistieken(data,'bank','2026-2027').gespeeld).toBe(1);
 expect(clubStatistieken(data,'bank','2025-2026').gespeeld).toBe(0);
 expect(clubStatistieken(data,'veld','2026-2027').cleansheets).toBe(1);
});
it('houdt supporters en speelsters gescheiden en telt alleen bijgewoonde gespeelde matchen',()=>{
 expect(vrouwenSupporters(data).map(p=>p.user_id)).toEqual(['fan']);
 expect(supporterCijfers(data,'fan','2026-2027').matches).toHaveLength(1);
 expect(supporterCijfers(data,'speler').matches).toHaveLength(0);
 expect(supporterCijfers(data,'fan','2025-2026').matches).toHaveLength(0);
});


it('gebruikt de kalenderindeling met drie tabs, scorekaart en gespeelde matchen',()=>{
 const html=renderToStaticMarkup(<MemoryRouter><VrouwenKalender data={data}/></MemoryRouter>);
 for(const tekst of ['Steca Vrouwen','Hele reeks','Ploegen','gespeelde matchen tonen','uitslag','score gespeeld','2 - 0'])expect(html).toContain(tekst);
});

it('toont een gespeelde bronmatch ook wanneer die nog niet in clubgegevens staat',()=>{
 const html=renderToStaticMarkup(<MemoryRouter><VrouwenKalender data={{...data,matches:[]}} bron={{seizoen:'2026-2027',klassementen:[],wedstrijden:[{id:1,thuis:'VEDETJES',uit:'STECA VROUWEN',aftrap:'2026-09-09T19:00:00+02:00',score:[21,0],locaties:[],reeks:'Dames Zele'}]}}/></MemoryRouter>);
 expect(html).toContain('ticket-scheur');expect(html).toContain('21 - 0');expect(html).toContain('VEDETJES');expect(html).toContain('verlies');
});

it('tekent zaalformaties met vier veldspeelsters, doelvrouw en vijf reserves',()=>{
 for(const formatie of ['2-2','3-1','1-2-1'] as const){
 const html=renderToStaticMarkup(<Tactiekbord formatie="4-3-3" zaal zaalOpstelling={formatie} namen={{LB:'Anna',RB:'Bente',LW:'Cato',RW:'Dina'}}/>);
 expect(html.match(/class="veldspeler"/g)).toHaveLength(5);
 expect(html.match(/class="bankspeler"/g)).toHaveLength(5);
 expect(html).toContain(formatie);expect(html).toContain('fill="#fff"');expect(html).toContain('stroke="#f5b5d1"');
 for(const naam of ['Anna','Bente','Cato','Dina'])expect(html).toContain(naam);
 if(formatie==='3-1')expect(html).toContain('Centrale verdediger');
 if(formatie==='1-2-1')expect(html).toContain('Linksmidden');
 }
});

it('berekent profielbadges alleen uit de meegestuurde vrouwenresultaten',()=>{
 const basis={...data,user_id:'speler',wasmand:[],stempunten:[],leden:[{id:'veld',user_id:'speler',speelt:true,naam:'Speelster',functie:'speler',status:'actief'}],matches:[match],verslagen:[],aanwezigheden:[]} as unknown as ClubData;
 const leeg=renderToStaticMarkup(<VrouwenProfielBadges data={{...basis,matches:[],opstellingen:[]}} id="veld"/>);
 expect(leeg).toContain('Nog geen badges behaald');expect(leeg).not.toContain('Gouden panter');
 const goal=renderToStaticMarkup(<VrouwenProfielBadges data={{...basis,verslagen:[{match_key:match.match_key,verslag:'',statistieken:[{id:'veld',goals:1,assists:0,geel:0,rood:0}]}]}} id="veld"/>);
 expect(goal).toContain('Gouden panter');expect(goal).toContain('Eentje is geentje');expect(goal).not.toContain('Dubbele Cijfers');
});
