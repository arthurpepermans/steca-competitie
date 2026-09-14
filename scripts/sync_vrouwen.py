"""Openbare Twizzit-gegevens. Geen account, cookies of persoonsgegevens nodig."""
import json
import re
from pathlib import Path
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from concurrent.futures import ThreadPoolExecutor
import truststore
truststore.inject_into_ssl()
import requests
from bs4 import BeautifulSoup

TEAM = 'STECA VROUWEN'
SOURCE = 'https://app.twizzit.com/v2/ranking/widget/team?id=1342487&wsid=156007&lg=2'
ROOT = Path(__file__).resolve().parents[1]

def html(url, data=None):
    response = requests.post(url, data=data, timeout=40) if data else requests.get(url, timeout=40)
    response.raise_for_status()
    return BeautifulSoup(response.text, 'html.parser')

def rankings(soup):
    result = []
    for table in soup.select('table.ranking-table'):
        ident = table.parent.get('id')
        label = soup.select_one(f'a[href="#{ident}"]') if ident else None
        if not label:
            raise ValueError('Reeksnaam ontbreekt')
        rows = []
        for tr in table.select('tbody tr'):
            cells = [td.get_text(' ', strip=True) for td in tr.select('td')]
            if len(cells) != 10:
                raise ValueError('Twizzit heeft de tabelstructuur veranderd')
            nums = [int(cells[0]), *map(int, cells[2:])]
            rows.append(dict(zip(['positie','gespeeld','winst','verlies','gelijk','voor','tegen','saldo','punten'], nums)) | {'naam':cells[1]})
        if not any(row['naam'] == TEAM for row in rows):
            raise ValueError('Steca ontbreekt in de reeks')
        result.append({'id':ident, 'naam':label.get_text(' ',strip=True), 'rijen':rows})
    if not result:
        raise ValueError('Geen klassement gevonden; bestaande gegevens blijven behouden')
    return result

def score(soup):
    # Alleen de score van dit duel, niet die uit de lijst met overige wedstrijden.
    node = soup.select_one('.score-wrapper.d-flex .score')
    match = re.fullmatch(r'(\d+)\s*-\s*(\d+)', node.get_text(strip=True)) if node else None
    return [int(match[1]), int(match[2])] if match else None

def wedstrijd(event):
    ident = int(event['eventId'])
    url = f'https://app.twizzit.com/v2/ranking/widget/game?id={ident}&wsid=156007&lg=2'
    game = html(url)
    profile = html('https://static.twizzit.com/v2/ajax/activity/profile/public', {'activityId':ident,'languageId':2})
    title = profile.select_one('.activity-title')
    if not title or not all(t in title.get_text() for t in event['title'].split(' - ',1)):
        raise ValueError(f'Wedstrijd {ident} kon niet worden bevestigd')
    teams = event['title'].split(' - ', 1)
    if len(teams) != 2:
        raise ValueError('Onbekende teamindeling')
    resources = []
    for node in profile.select('.resource'):
        address = node.select_one('.address')
        name = node.select_one('.name')
        if address:
            resources.append({'zaal':name.get_text(' ',strip=True) if name else '', 'adres':address.get_text(' ',strip=True)})
    league = game.select_one('.header-description')
    return {'id':ident,'thuis':teams[0],'uit':teams[1],
            'aftrap':datetime.fromisoformat(event['start']).replace(tzinfo=ZoneInfo('Europe/Brussels')).isoformat(),
            'score':score(game),'locaties':resources,'reeks':league.get_text(' ',strip=True) if league else '', 'bron':url}

def main():
    now = datetime.now(ZoneInfo('Europe/Brussels'))
    year = now.year if now.month >= 7 else now.year-1
    r = requests.post('https://static.twizzit.com/v2/ajax/calendar/events', timeout=60, data={
        'languageId':2,'view':'website','widget-settings-id':232450,
        'fc-start':f'{year}-07-01 00:00','fc-end':f'{year+1}-07-01 00:00'})
    r.raise_for_status()
    standen = rankings(html(SOURCE))
    ploegen = {rij['naam'] for rij in standen[0]['rijen']}
    events = {int(e['eventId']):e for e in r.json() if e.get('active',True) and (TEAM in e['title'].split(' - ') or (len(e['title'].split(' - '))==2 and set(e['title'].split(' - '))<=ploegen))}
    if not events:
        raise ValueError('Geen wedstrijden gevonden; bestaande gegevens blijven behouden')
    with ThreadPoolExecutor(max_workers=3) as pool:
        matches = sorted(pool.map(wedstrijd, events.values()), key=lambda m:m['aftrap'])
    data = {'seizoen':f'{year}-{year+1}','bijgewerkt':datetime.now(timezone.utc).isoformat(),
            'bron':SOURCE, 'wedstrijden':[m for m in matches if TEAM in (m['thuis'],m['uit'])], 'reekswedstrijden':[m for m in matches if m['reeks']==standen[0]['naam']], 'klassementen':standen}
    dest = ROOT/'app/public/vrouwen-data.json'
    temp = dest.with_suffix('.tmp')
    temp.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    temp.replace(dest)
    print(f'{len(matches)} wedstrijden en {len(data["klassementen"])} klassementen opgehaald.')

if __name__ == '__main__':
    main()
