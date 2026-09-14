import {useEffect,useRef,useState} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {CaretDown} from '@phosphor-icons/react/dist/csr/CaretDown';
import {Check} from '@phosphor-icons/react/dist/csr/Check';
import './Ploegkeuze.css';
const ploegen=[{id:'mannen',naam:'Steca Juniors',logo:'logo-retro.png',pad:'/'},{id:'vrouwen',naam:'Steca Vrouwen',logo:'logo-vrouwen-transparant.png',pad:'/vrouwen'}] as const;
export function Ploegkeuze({ploeg}:{ploeg:'mannen'|'vrouwen'}){
 const [open,setOpen]=useState(false),vak=useRef<HTMLDivElement>(null),knop=useRef<HTMLButtonElement>(null);
 const {pathname}=useLocation();const actief=ploegen.find(p=>p.id===ploeg)!;
 useEffect(()=>setOpen(false),[pathname]);
 useEffect(()=>{if(!open)return;
 const buiten=(e:PointerEvent)=>{if(!vak.current?.contains(e.target as Node))setOpen(false);};
 const toets=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);knop.current?.focus();}};
 document.addEventListener('pointerdown',buiten);document.addEventListener('keydown',toets);
 return()=>{document.removeEventListener('pointerdown',buiten);document.removeEventListener('keydown',toets);};
 },[open]);
 return <div className="ploegkeuze" ref={vak} onBlur={e=>{/* Safari geeft bij een tik soms geen nieuw focusdoel: laat de link eerst zijn klik verwerken. */if(e.relatedTarget&&!e.currentTarget.contains(e.relatedTarget as Node))setOpen(false);}}>
 <button ref={knop} type="button" className="clubmerk ploegkeuze-knop" aria-expanded={open} aria-controls="ploegkeuze-lijst" aria-label={'Ploeg kiezen: '+actief.naam} onClick={()=>setOpen(v=>!v)}>
 <img src={import.meta.env.BASE_URL+actief.logo} width="44" height="52" alt=""/><span>{actief.naam}<small>CLUBAPP</small></span><CaretDown className="ploegkeuze-pijl" size={14} aria-hidden="true"/>
 </button>
 {open&&<nav id="ploegkeuze-lijst" className="ploegkeuze-lijst" aria-label="Ploeg kiezen"><p>Kies je ploeg</p>{ploegen.map(p=><Link key={p.id} to={p.pad} aria-current={p.id===ploeg?'true':undefined} onClick={()=>setOpen(false)}><img src={import.meta.env.BASE_URL+p.logo} width="32" height="38" alt=""/><span>{p.naam}</span>{p.id===ploeg&&<Check size={19} aria-label="Actieve ploeg"/>}</Link>)}</nav>}
 </div>;
}
