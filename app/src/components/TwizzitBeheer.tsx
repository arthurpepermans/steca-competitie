import {useEffect,useState} from 'react';
import {clubRpc} from '../lib/club';
type Status={laatste_succes:string|null;wacht:boolean;bezig:boolean;fout:string|null};
export function TwizzitBeheer(){
 const [status,setStatus]=useState<Status|null>(null),[fout,setFout]=useState(''),[bezig,setBezig]=useState(false);
 async function laad(start=false){try{setStatus(await clubRpc<Status>('club_twizzit',{p_start:start}));setFout('');}catch(e){setFout((e as Error).message);}}
 useEffect(()=>{void laad();const t=setInterval(()=>void laad(),15000);return()=>clearInterval(t);},[]);
 return <section className="kaart"><h2>Twizzit bijwerken</h2><p className="klein zacht">{status?.laatste_succes?'Laatste update: '+new Date(status.laatste_succes).toLocaleString('nl-BE'):'Nog geen automatische update.'}</p><button className="knop licht" disabled={bezig||status?.wacht||status?.bezig} onClick={async()=>{setBezig(true);await laad(true);setBezig(false);}}>{status?.bezig?'Bezig met ophalen…':status?.wacht?'Update aangevraagd':'Nu bijwerken'}</button><p className="klein zacht">De update wordt rechtstreeks gestart. GitHub kan nog even nodig hebben om te beginnen. Heropen daarna de kalender voor de nieuwste gegevens.</p>{(fout||status?.fout)&&<p role="alert">{fout||status?.fout}</p>}</section>;
}
