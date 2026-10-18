-- StudySeat migration 0006: starting cities and areas.
-- Only reference data. Admins can add more later from the Cities screen.
-- Safe to re-run: existing names are skipped.

insert into public.cities (name) values
  ('Lucknow'), ('Kanpur'), ('Imphal'), ('Delhi')
on conflict do nothing;

insert into public.areas (city_id, name)
select c.id, a.name
from (values
  ('Lucknow', 'Faizabad Road'), ('Lucknow', 'Aliganj'), ('Lucknow', 'Indira Nagar'),
  ('Lucknow', 'Krishna Nagar'), ('Lucknow', 'Gomti Nagar'),
  ('Kanpur', 'Swaroop Nagar'), ('Kanpur', 'Kakadeo'),
  ('Imphal', 'Singjamei'), ('Imphal', 'Thangmeiband'),
  ('Delhi', 'Mukherjee Nagar'), ('Delhi', 'Karol Bagh')
) as a(city_name, name)
join public.cities c on lower(c.name) = lower(a.city_name)
on conflict do nothing;
