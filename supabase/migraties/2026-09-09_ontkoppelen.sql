-- Migratie 2026-09-09: 'Account verwijderen' bij een lid faalde met
-- 'de koppeling met het account kan niet gewijzigd worden'.
-- Oorzaak: het verwijderen van de auth-gebruiker zet members.user_id op null (on delete set null),
-- en die update liep tegen de trigger members_guard aan.
-- Oplossing: een admin mag een koppeling verwijderen (naar null), nooit leggen of verleggen;
-- daarnaast zet admin_ontkoppel_account een vlag voor de duur van de transactie.
-- Plakken in de Supabase SQL Editor en op Run klikken. Veilig om meerdere keren te draaien.
-- Onderaan verschijnt een controle: beide regels moeten fix_aanwezig = true tonen.

create or replace function members_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ik members;
begin
  if auth.uid() is null or current_setting('steca.ontkoppelen', true) = 'ja' then
    -- service-role, SQL Editor, of admin_ontkoppel_account dat een account loskoppelt: alles mag
    new.updated_at := now();
    return new;
  end if;
  select * into ik from members where user_id = auth.uid();
  if ik.id is null or ik.status <> 'actief' then
    if new.user_id is distinct from auth.uid() then
      raise exception 'niet toegestaan';
    end if;
  end if;
  if not coalesce(ik.is_admin, false) then
    if new.user_id is distinct from auth.uid() then
      raise exception 'je mag alleen je eigen gegevens wijzigen';
    end if;
    if new.functie <> old.functie or new.status <> old.status or new.is_admin <> old.is_admin
       or new.is_hoofdadmin <> old.is_hoofdadmin or new.email <> old.email
       or new.user_id is distinct from old.user_id then
      raise exception 'functie, status en rechten kunnen alleen door een admin gewijzigd worden';
    end if;
  else
    if old.is_hoofdadmin and not ik.is_hoofdadmin then
      raise exception 'de gegevens van de hoofdadmin kunnen alleen door de hoofdadmin zelf gewijzigd worden';
    end if;
    if new.is_hoofdadmin <> old.is_hoofdadmin then
      raise exception 'de hoofdadmin-vlag kan niet gewijzigd worden';
    end if;
    if new.user_id is distinct from old.user_id and new.user_id is not null then
      -- een admin mag een koppeling wel verwijderen (account weg), maar nooit zelf leggen of verleggen
      raise exception 'de koppeling met het account kan niet gewijzigd worden';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

create or replace function admin_ontkoppel_account(p_member_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_hoofd boolean;
  v_naam text;
begin
  if not is_admin() then
    raise exception 'alleen admins';
  end if;
  select user_id, is_hoofdadmin, naam into v_user, v_hoofd, v_naam from members where id = p_member_id;
  if v_hoofd then
    raise exception 'het account van de hoofdadmin kan niet verwijderd worden';
  end if;
  if v_user is null then
    raise exception 'dit lid heeft geen account';
  end if;
  insert into audit_log (tabel, rij_id, actie, oud, door, door_user)
  values ('members', p_member_id::text, 'ACCOUNT_VERWIJDERD', jsonb_build_object('naam', v_naam, 'user_id', v_user), my_member_id(), auth.uid());
  -- het verwijderen zet members.user_id op null (on delete set null); die update mag niet
  -- tegen members_guard aanlopen, dus zetten we een vlag voor de duur van deze transactie
  perform set_config('steca.ontkoppelen', 'ja', true);
  delete from auth.users where id = v_user;  -- members.user_id wordt automatisch null
end $$;

-- Controle: beide regels moeten true tonen.
select proname, prosrc like '%steca.ontkoppelen%' as fix_aanwezig
from pg_proc where proname in ('members_guard', 'admin_ontkoppel_account') order by 1;
