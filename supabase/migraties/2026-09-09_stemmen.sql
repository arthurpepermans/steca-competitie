-- Migratie 2026-09-09: Junior van de match (stemming per match) en Junior d'or (seizoen).
-- Wie op een gespeelde match als aanwezig stond, kiest de beste drie spelers van die match:
-- 3, 2 en 1 punt. Je kunt niet op jezelf stemmen en alleen op spelers die aanwezig waren.
-- Eigen stem is alleen zichtbaar voor de stemmer (en admins); iedereen ziet de opgetelde punten.
-- Plakken in de Supabase SQL Editor en op Run klikken; veilig om te herhalen.

create table if not exists match_votes (
  match_key  text not null references matches (match_key) on delete cascade,
  voter_id   uuid not null references members (id) on delete cascade,
  eerste     uuid not null references members (id) on delete cascade,
  tweede     uuid not null references members (id) on delete cascade,
  derde      uuid not null references members (id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (match_key, voter_id),
  check (eerste <> tweede and eerste <> derde and tweede <> derde),
  check (voter_id <> eerste and voter_id <> tweede and voter_id <> derde)
);

-- Geldigheid van een stembrief: match gespeeld en hoogstens 7 dagen geleden, stemmer aanwezig,
-- alle drie de gekozen spelers aanwezig, niet op jezelf.
create or replace function stem_geldig(p_match_key text, p_eerste uuid, p_tweede uuid, p_derde uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_actief()
    and exists (select 1 from matches m where m.match_key = p_match_key and m.status = 'gespeeld'
                  and m.datum is not null and current_date <= m.datum + 7)
    and exists (select 1 from attendance a where a.match_key = p_match_key and a.member_id = my_member_id() and a.status = 'aanwezig')
    and (select count(*) from attendance a where a.match_key = p_match_key and a.status = 'aanwezig'
           and a.member_id in (p_eerste, p_tweede, p_derde)) = 3
    and my_member_id() not in (p_eerste, p_tweede, p_derde)
    and p_eerste <> p_tweede and p_eerste <> p_derde and p_tweede <> p_derde;
$$;
revoke all on function stem_geldig(text, uuid, uuid, uuid) from public, anon;
grant execute on function stem_geldig(text, uuid, uuid, uuid) to authenticated;

create or replace function match_votes_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists match_votes_stamp on match_votes;
create trigger match_votes_stamp before insert or update on match_votes
  for each row execute function match_votes_stamp();
drop trigger if exists match_votes_log on match_votes;
create trigger match_votes_log after insert or update or delete on match_votes
  for each row execute function log_wijziging();

alter table match_votes enable row level security;
drop policy if exists "eigen stem lezen" on match_votes;
create policy "eigen stem lezen" on match_votes for select to authenticated
  using (voter_id = my_member_id() or is_admin());
drop policy if exists "stem uitbrengen" on match_votes;
create policy "stem uitbrengen" on match_votes for insert to authenticated
  with check (voter_id = my_member_id() and stem_geldig(match_key, eerste, tweede, derde));
drop policy if exists "stem wijzigen" on match_votes;
create policy "stem wijzigen" on match_votes for update to authenticated
  using (voter_id = my_member_id())
  with check (voter_id = my_member_id() and stem_geldig(match_key, eerste, tweede, derde));
drop policy if exists "stem intrekken" on match_votes;
create policy "stem intrekken" on match_votes for delete to authenticated
  using (voter_id = my_member_id());

-- Opgetelde punten per match en speler, zonder te tonen wie op wie stemde.
-- 'stemmen' = aantal stembrieven waarop de speler voorkomt.
create or replace view match_vote_points as
  select s.match_key, s.member_id, sum(s.punten)::int as punten, count(*)::int as stemmen
  from (
    select match_key, eerste as member_id, 3 as punten from match_votes
    union all select match_key, tweede, 2 from match_votes
    union all select match_key, derde, 1 from match_votes
  ) s
  where is_actief()
  group by s.match_key, s.member_id;
revoke all on match_vote_points from anon;
grant select on match_vote_points to authenticated;

-- Aantal stemmers per match.
create or replace view match_vote_counts as
  select match_key, count(*)::int as stemmers
  from match_votes
  where is_actief()
  group by match_key;
revoke all on match_vote_counts from anon;
grant select on match_vote_counts to authenticated;

-- Controle: moet true tonen.
select to_regclass('public.match_votes') is not null and to_regclass('public.match_vote_points') is not null as stemmen_aanwezig;
