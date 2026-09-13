import {useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {supabase} from '../lib/supabase';
import {FUNCTIES,FUNCTIE_LABEL,type Functie} from '../lib/config';
import {useAsync,foutTekst} from '../lib/useAsync';
import {Fout,Laden} from './Layout';
export async function veranderAccountfunctie(id:string,functie:Functie):Promise<string>{
 const {data,error}=await supabase.rpc('admin_accountfunctie',{p_id:id,p_functie:functie});if(error)throw error;return data;
}
type Supporter={id:string;naam:string;actief:boolean;heeft_account:boolean};
export function SupporterBeheer(){
 const data=useAsync(async()=>{const {data,error}=await supabase.rpc('admin_supporters');if(error)throw error;return data as Supporter[]});
 const [zoek,setZoek]=useState('');
 return <><h2>Supporters beheren</h2><input aria-label="Supporter zoeken" placeholder="Supporter zoeken…" value={zoek} onChange={e=>setZoek(e.target.value)}/><Fout tekst={data.fout}/>{data.laden?<Laden/>:<ul className="lijst omrand">{data.data?.filter(s=>s.naam.toLowerCase().includes(zoek.toLowerCase())).map(s=><SupporterRij key={s.id} supporter={s}/>)}{!data.data?.length&&<li>Nog geen supporters.</li>}</ul>}</>;
}
function SupporterRij({supporter:s}:{supporter:Supporter}){
 return <li><Link to={'/supporter-profiel/'+s.id}><strong>{s.naam}</strong></Link><p className="klein zacht">Supporter{!s.actief?' · inactief':''}</p></li>;
}
export function SupporterFunctieBeheer({id,naam}:{id:string;naam:string}){
 const [functie,setFunctie]=useState<Functie>('supporter');const [bezig,setBezig]=useState(false);const [fout,setFout]=useState<string|null>(null);const navigate=useNavigate();
 return <section className="kaart"><h2>Functie aanpassen</h2><div className="knoppen"><select aria-label={'Functie van '+naam} value={functie} disabled={bezig} onChange={e=>setFunctie(e.target.value as Functie)}>{FUNCTIES.map(f=><option key={f} value={f}>{FUNCTIE_LABEL[f]}</option>)}</select><button className="knop klein" disabled={bezig||functie==='supporter'} onClick={async()=>{setBezig(true);setFout(null);try{const memberId=await veranderAccountfunctie(id,functie);navigate('/leden/'+memberId);}catch(e){setFout(foutTekst(e));}finally{setBezig(false)}}}>Functie opslaan</button></div><Fout tekst={fout}/></section>;
}
