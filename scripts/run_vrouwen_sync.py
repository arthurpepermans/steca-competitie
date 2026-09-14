"""Controleert de planning; haalt Twizzit alleen op wanneer nodig."""
import json, os
from pathlib import Path
import requests
from sync_vrouwen import main
URL='https://odgrmhcmkvbdadjhphiz.supabase.co'
def rpc(action, ident=None, data=None):
    r=requests.post(URL+'/rest/v1/rpc/vrouwen_sync_worker',headers={'apikey':os.environ['SUPABASE_ANON_KEY']},json={'p_token':os.environ['TWIZZIT_WORKER_TOKEN'],'p_actie':action,'p_id':ident,'p_data':data},timeout=60)
    if not r.ok: raise RuntimeError('Twizzit worker database request failed: '+str(r.status_code))
    return r.json()
if __name__=='__main__':
    job=rpc('claim')
    if not job:
        print('Geen update nodig.')
    else:
        try:
            main()
            data=json.loads((Path(__file__).resolve().parents[1]/'app/public/vrouwen-data.json').read_text(encoding='utf-8'))
            rpc('klaar',job['id'],data)
            print('Twizzit-gegevens bijgewerkt.')
        except Exception:
            rpc('fout',job['id'])
            raise
