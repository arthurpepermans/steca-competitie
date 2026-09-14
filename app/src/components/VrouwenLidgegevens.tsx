import {clubRpc} from '../lib/club';
import {useAsync} from '../lib/useAsync';

type Gegevens={naam:string;email:string|null;telefoon:string|null;geboortedatum:string|null;adres:string|null;account_gekoppeld:boolean;email_bevestigd:boolean;status:string};
export function VrouwenLidgegevens({id}:{id:string}){
 const info=useAsync(()=>clubRpc<Gegevens>('club_lidgegevens',{p_lid:id}),[id]);
 const g=info.data;
 return <section className="kaart"><h2>Gegevens</h2>
 {info.laden?<p role="status">Gegevens laden…</p>:info.fout?<p role="alert">{info.fout}</p>:g&&<dl>
 {([['Naam',g.naam],['E-mailadres',g.email?<a href={'mailto:'+g.email}>{g.email}</a>:null],['Telefoon',g.telefoon?<a href={'tel:'+g.telefoon}>{g.telefoon}</a>:null],['Geboortedatum',g.geboortedatum],['Adres',g.adres],['Account',g.account_gekoppeld?'Gekoppeld':'Nog geen account gekoppeld'],['E-mail bevestigd',g.account_gekoppeld?(g.email_bevestigd?'Ja':'Nog niet'):'Nog geen account']] as const).map(([label,waarde])=><div key={label}><dt className="klein zacht">{label}</dt><dd style={{margin:'0 0 12px'}}>{waarde||'Niet ingevuld'}</dd></div>)}
 </dl>}</section>;
}
