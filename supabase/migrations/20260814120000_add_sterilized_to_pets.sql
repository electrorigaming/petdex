alter table public.pets
  add column sterilized boolean not null default false;

create or replace view public.pets_overview as
select id,
    slug,
    name,
    nicknames,
    photo_url,
    zone,
    status,
    registered_on,
    (exists ( select 1
           from sightings s
          where s.pet_id = p.id and s.seen_on = current_date and s.seen)) as seen_today,
    ( select count(*) as count
           from sightings s
          where s.pet_id = p.id and s.seen) as total_sightings,
    ( select max(s.seen_on) as max
           from sightings s
          where s.pet_id = p.id and s.seen) as last_seen_on,
    ( select count(*) as count
           from milestones m
          where m.pet_id = p.id) as milestone_count,
    sterilized
   from pets p;
