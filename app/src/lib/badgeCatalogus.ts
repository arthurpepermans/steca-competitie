export type Badge = { id: string; titel: string; uitleg: string; soort: 'seizoen' | 'alltime' | 'verzameling'; herhaalbaar?: boolean };
export const BADGES: Badge[] = [
  {id:'gouden_stier',titel:'Gouden Stier',uitleg:'Meeste goals dit seizoen.',soort:'seizoen'},
  {id:'het_kanon',titel:'Het Kanon',uitleg:'Meeste goals aller tijden.',soort:'alltime'},
  {id:'assistenkoning',titel:'Assistenkoning',uitleg:'Meeste assists dit seizoen.',soort:'seizoen'},
  {id:'maestro',titel:'Maestro',uitleg:'Meeste assists aller tijden.',soort:'alltime'},
  {id:'de_muur',titel:'De Muur',uitleg:'Meeste clean sheets dit seizoen.',soort:'seizoen'},
  {id:'betonblok',titel:'Betonblok',uitleg:'Meeste clean sheets aller tijden.',soort:'alltime'},
  {id:'beenhouwer',titel:'Beenhouwer',uitleg:'Meeste gele en rode kaarten samen dit seizoen.',soort:'seizoen'},
  {id:'rosse_furie',titel:'Rosse Furie',uitleg:'Meeste rode kaarten dit seizoen.',soort:'seizoen'},
  {id:'fundering',titel:'Fundering',uitleg:'Vaakst op aanwezig dit seizoen, ook zonder selectie.',soort:'seizoen'},
  {id:'vaste_waarde',titel:'Vaste Waarde',uitleg:'Meeste wedstrijden gespeeld dit seizoen.',soort:'seizoen'},
  {id:'clubmeubilair',titel:'Clubmeubilair',uitleg:'Meeste wedstrijden gespeeld aller tijden.',soort:'alltime'},
  {id:'star_boy',titel:'Star Boy',uitleg:'Vaakst Junior van de Match dit seizoen.',soort:'seizoen'},
  {id:'goat',titel:'GOAT',uitleg:'Meeste stempunten voor Junior van de Match aller tijden.',soort:'alltime'},
  {id:'kuisvrouw',titel:'Kuisvrouw',uitleg:'Vaakst de wasmand meegenomen dit seizoen.',soort:'seizoen'},
  {id:'junior_dor',titel:'Junior d’Or',uitleg:'Leider in het Junior d’Or-klassement: meeste stempunten dit seizoen.',soort:'seizoen'},
  {id:'eentje_is_geentje',titel:'Eentje is geentje',uitleg:'Je eerste goal voor Steca.',soort:'verzameling'},
  {id:'dubbele_cijfers',titel:'Dubbele Cijfers',uitleg:'10 goals voor Steca.',soort:'verzameling'},
  {id:'goalgetter',titel:'Goalgetter',uitleg:'25 goals voor Steca.',soort:'verzameling'},
  {id:'sluipschutter',titel:'Sluipschutter',uitleg:'50 goals voor Steca.',soort:'verzameling'},
  {id:'67',titel:'67',uitleg:'67 goals voor Steca.',soort:'verzameling'},
  {id:'triple_digits',titel:'Triple Digits',uitleg:'100 goals voor Steca.',soort:'verzameling'},
  {id:'wingman',titel:'Wingman',uitleg:'Je eerste assist voor Steca.',soort:'verzameling'},
  {id:'facteur',titel:'Facteur',uitleg:'10 assists voor Steca.',soort:'verzameling'},
  {id:'de_architect',titel:'De Architect',uitleg:'25 assists voor Steca.',soort:'verzameling'},
  {id:'kdb_der_juniors',titel:'KDB der Juniors',uitleg:'50 assists voor Steca.',soort:'verzameling'},
  {id:'muur_van_dendermonde',titel:'Muur van Dendermonde',uitleg:'Je eerste clean sheet.',soort:'verzameling'},
  {id:'veilige_handen',titel:'Veilige Handen',uitleg:'5 clean sheets.',soort:'verzameling'},
  {id:'opgewarmd_door_georgie',titel:'Opgewarmd door Georgie',uitleg:'10 clean sheets.',soort:'verzameling'},
  {id:'golden_glove',titel:'Golden Glove',uitleg:'25 clean sheets.',soort:'verzameling'},
  {id:'official_junior',titel:'Official Junior',uitleg:'Je eerste gespeelde wedstrijd.',soort:'verzameling'},
  {id:'toogplekker',titel:'Toogplekker',uitleg:'10 wedstrijden gespeeld.',soort:'verzameling'},
  {id:'sterkhouder',titel:'Sterkhouder',uitleg:'25 wedstrijden gespeeld.',soort:'verzameling'},
  {id:'georgies_favoriet',titel:'Georgies Favoriet',uitleg:'50 wedstrijden gespeeld.',soort:'verzameling'},
  {id:'steca_legend',titel:'Steca Legend',uitleg:'100 wedstrijden gespeeld.',soort:'verzameling'},
  {id:'hattrick',titel:'Hattrick',uitleg:'Minstens 3 goals in één wedstrijd. Elke hattrick wordt apart bewaard bij de match.',soort:'verzameling',herhaalbaar:true},
  {id:'vijf_op_een_rij',titel:'Vijf op een Rij',uitleg:'5 opeenvolgende clubwedstrijden gespeeld.',soort:'verzameling'},
  {id:'rots_in_de_branding',titel:'Rots in de Branding',uitleg:'10 opeenvolgende clubwedstrijden op aanwezig.',soort:'verzameling'},
  {id:'junior_van_de_match',titel:'Junior van de Match',uitleg:'Verkozen tot Junior van de Match. Elke overwinning wordt bij de wedstrijd bewaard.',soort:'verzameling',herhaalbaar:true},
  {id:'laat_je_ploeg',titel:'Laat je ploeg maar in de steek',uitleg:'Een rode kaart gekregen.',soort:'verzameling'},
  {id:'getikte_zot',titel:'Getikte Zot',uitleg:'Geel of rood in 2 opeenvolgende wedstrijden die je zelf speelde. Gemiste wedstrijden tellen niet mee.',soort:'verzameling'},
];

export type BadgeToewijzing = { id: string; badge_id: string; member_id: string; seizoen: string | null; match_key: string | null; aangemaakt_op: string; automatisch?: boolean; volgorde?: number | null };
export const badgeVoor = (id: string) => BADGES.find(b => b.id === id);
export function seizoenNu(datum = new Date()): string {
  const jaar = datum.getMonth() >= 6 ? datum.getFullYear() : datum.getFullYear() - 1;
  return `${jaar}-${jaar+1}`;
}
export function truitjeBadges(toewijzingen: BadgeToewijzing[], memberId: string, seizoen = seizoenNu()): Badge[] {
  const ids = new Set(toewijzingen.filter(t => t.member_id === memberId &&
    (badgeVoor(t.badge_id)?.soort === 'alltime' || (badgeVoor(t.badge_id)?.soort === 'seizoen' && t.seizoen === seizoen))).map(t => t.badge_id));
  return sorteerBadges(BADGES.filter(b => ids.has(b.id)), toewijzingen.filter(t=>t.member_id===memberId));
}

/** Nieuwe badges zonder voorkeur komen na de gekozen badges, in catalogusvolgorde. */
export function sorteerBadges(badges: Badge[], toewijzingen: BadgeToewijzing[]): Badge[] {
  const rang=new Map(toewijzingen.map(t=>[t.badge_id,t.volgorde ?? Number.MAX_SAFE_INTEGER]));
  return [...badges].sort((a,b)=>(rang.get(a.id) ?? Number.MAX_SAFE_INTEGER)-(rang.get(b.id) ?? Number.MAX_SAFE_INTEGER) || BADGES.indexOf(a)-BADGES.indexOf(b));
}
