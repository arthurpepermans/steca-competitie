export type ZaalFormatie='2-2'|'3-1'|'1-2-1';
export const zaalFormatie=(waarde:unknown):ZaalFormatie=>waarde==='3-1'||waarde==='1-2-1'?waarde:'2-2';
// Vaste plaatscodes bewaren de speelsters en slotjes bij een formatiewissel.
export const zaalRijen:Record<ZaalFormatie,string[][]>={'2-2':[['GK'],['LB','RB'],[],['LW','RW']],'3-1':[['GK'],['LB','RB','LW'],[],['RW']],'1-2-1':[['GK'],['LB'],['RB','LW'],['RW']]};
export const zaalLabels:Record<ZaalFormatie,Record<string,string>>={'2-2':{GK:'Doelvrouw',LB:'Linksachter',RB:'Rechtsachter',LW:'Linksvoor',RW:'Rechtsvoor'},'3-1':{GK:'Doelvrouw',LB:'Linksachter',RB:'Centrale verdediger',LW:'Rechtsachter',RW:'Spits'},'1-2-1':{GK:'Doelvrouw',LB:'Verdediger',RB:'Linksmidden',LW:'Rechtsmidden',RW:'Spits'}};
export const zaalKort:Record<ZaalFormatie,Record<string,string>>={'2-2':{GK:'DV',LB:'LA',RB:'RA',LW:'LV',RW:'RV'},'3-1':{GK:'DV',LB:'LA',RB:'CA',LW:'RA',RW:'SP'},'1-2-1':{GK:'DV',LB:'CA',RB:'LM',LW:'RM',RW:'SP'}};
