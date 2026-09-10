import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
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
 const [functie,setFunctie]=useState<Functie>('supporter');const [bezig,setBezig]=useState(false);const [fout,setFout]=useState<string|null>(null);const navigate=useNavigate();
 return <li><strong>{s.naam}</strong><p className="klein zacht">{s.heeft_account?'Supporteraccount':'Zonder account'}{!s.actief?' · inactief':''}</p><div className="knoppen"><select aria-label={'Functie van '+s.naam} value={functie} disabled={bezig} onChange={e=>setFunctie(e.target.value as Functie)}>{FUNCTIES.map(f=><option key={f} value={f}>{FUNCTIE_LABEL[f]}</option>)}</select><button className="knop klein" disabled={bezig||functie==='supporter'} onClick={async()=>{setBezig(true);setFout(null);try{const id=await veranderAccountfunctie(s.id,functie);navigate('/leden/'+id);}catch(e){setFout(foutTekst(e));}finally{setBezig(false)}}}>Functie opslaan</button></div><Fout tekst={fout}/></li>;
}
