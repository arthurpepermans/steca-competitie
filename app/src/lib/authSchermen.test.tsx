import {it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {Login,Registreer,WachtwoordVergeten, NieuwWachtwoord} from '../pages/Auth';
vi.mock('../components/InstallatieHulp',()=>({InstallatieHulp:({vrouwenPloeg}:{vrouwenPloeg:boolean})=><p>{vrouwenPloeg?'Installatie vrouwen':'Installatie mannen'}</p>}));
const render=(path:string,element:React.ReactNode)=>renderToStaticMarkup(<MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>);
it('houdt alle inloglinks en installatiehulp bij de juiste ploeg',()=>{
 for(const [prefix,naam] of [['','Steca Juniors Clubapp'],['/vrouwen','Steca Vrouwen Clubapp']]){
  const html=render(prefix+'/login',<Login/>);
  expect(html).toContain(naam);
  for(const route of ['/registreer','/wachtwoord-vergeten','/supporters'])expect(html).toContain('href="'+prefix+route+'"');
  expect(html).toContain('Doorgaan zonder account');
  expect(html).toContain(prefix?'Installatie vrouwen':'Installatie mannen');
 }
});
it('gebruikt dezelfde registratievelden en houdt vrouwenregistratie en herstel binnen de ploeg',()=>{
 const html=render('/vrouwen/registreer',<Registreer/>);
 for(const tekst of ['Voornaam','Achternaam','E-mailadres','Wachtwoord herhalen','Speelster / clublid','Supporter'])expect(html).toContain(tekst);
 expect(html).toContain('href="/vrouwen/login"');
 expect(render('/vrouwen/wachtwoord-vergeten',<WachtwoordVergeten/>)).toContain('href="/vrouwen/login"');
 expect(render('/vrouwen/nieuw-wachtwoord',<NieuwWachtwoord/>)).toContain('Herhaal nieuw wachtwoord');
});
