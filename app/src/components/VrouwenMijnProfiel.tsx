import {useState} from 'react';
import {useAuth} from '../lib/auth';
import {supabase} from '../lib/supabase';
import {clubStatistieken,type ClubData} from '../lib/club';
import {VrouwenLichtkrantBeheer} from './VrouwenLichtkrantBeheer';
import {VrouwenMeldingen} from '../pages/VrouwenMeldingen';
import {VrouwenProfielBadges} from './VrouwenProfielBadges';
export function VrouwenMijnProfiel({data}:{data:ClubData}){
 const {session,lid,supporter}=useAuth();const ik=data.leden.find(l=>l.user_id===data.user_id);
 const [alles,setAlles]=useState(false),[ww,setWw]=useState(''),[herhaal,setHerhaal]=useState(''),[bezig,setBezig]=useState(false),[fout,setFout]=useState(''),[melding,setMelding]=useState('');
 const now=new Date(),jaar=now.getMonth()<6?now.getFullYear()-1:now.getFullYear(),seizoen=jaar+'-'+(jaar+1),stats=ik?.speelt?clubStatistieken(data,ik.id,alles?undefined:seizoen):null;
 const aantal=(alle:boolean)=>data.matches.filter(m=>m.thuis_score!==null&&Date.parse(m.aftrap)+80*60000<=Date.now()&&(alle||m.seizoen===seizoen)&&data.aanwezigheden.some(a=>a.user_id===data.user_id&&a.match_key===m.match_key&&a.status==='aanwezig')).length;
 return <><h1>Mijn profiel</h1><section className="kaart"><h2>Mijn gegevens</h2><dl>{[['Naam',ik?.naam??lid?.naam??supporter?.naam??session?.user.user_metadata?.naam],['E-mailadres',session?.user.email],['Functie',data.rol],['Beheerder',data.admin?'Ja':'Nee'],['Telefoon',lid?.telefoon],['Geboortedatum',lid?.geboortedatum],['Adres',lid?.adres]].map(([label,waarde])=><div key={label}><dt className="klein zacht">{label}</dt><dd style={{margin:'0 0 12px'}}>{waarde||'Niet ingevuld'}</dd></div>)}</dl></section>
 <VrouwenProfielBadges data={data} id={ik?.id}/>
 <section className="kaart"><div className="rij"><h2>Mijn statistieken</h2><button className="knop licht klein" onClick={()=>setAlles(!alles)}>{alles?'Dit seizoen':'All time'}</button></div><p className="zacht">{alles?'Alle seizoenen':seizoen}</p><div className="stand-statistieken speler-cijfers">{(stats?Object.entries(stats):[['Bijgewoonde matchen',aantal(alles)]]).map(([k,v])=><div key={k}><strong>{v}</strong><span>{({goals:'Goals',assists:'Assists',geel:'Gele kaarten',rood:'Rode kaarten',cleansheets:'Clean sheets',gespeeld:'Gespeeld'} as Record<string,string>)[k]??k}</span></div>)}</div></section>
 {data.staf&&<VrouwenLichtkrantBeheer/>}{data.rol!=='supporter'&&<VrouwenMeldingen/>}
 <section className="kaart"><h2>Wachtwoord wijzigen</h2><form onSubmit={async e=>{e.preventDefault();setFout('');setMelding('');if(ww!==herhaal){setFout('De wachtwoorden komen niet overeen.');return;}setBezig(true);try{const {error}=await supabase.auth.updateUser({password:ww});if(error)throw error;setWw('');setHerhaal('');setMelding('Wachtwoord gewijzigd.');}catch(e){setFout((e as Error).message);}finally{setBezig(false);}}}><label>Nieuw wachtwoord (minstens 8 tekens)<input required minLength={8} type="password" autoComplete="new-password" value={ww} onChange={e=>setWw(e.target.value)}/></label><label>Herhaal nieuw wachtwoord<input required minLength={8} type="password" autoComplete="new-password" value={herhaal} onChange={e=>setHerhaal(e.target.value)}/></label><button className="knop licht" disabled={bezig}>{bezig?'Opslaan…':'Wachtwoord wijzigen'}</button></form>{fout&&<p role="alert">{fout}</p>}{melding&&<p role="status">{melding}</p>}</section><button className="knop licht" onClick={()=>supabase.auth.signOut()}>Uitloggen</button></>;
}
