create extension if not exists pgcrypto;

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  nickname text not null unique,
  avatar_url text,
  total_points integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists game_events (
  id uuid primary key default gen_random_uuid(),
  title text not null unique,
  points integer not null,
  category text not null default 'prova',
  is_legendary boolean not null default false,
  special_effect text,
  created_at timestamptz not null default now()
);

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  event_id uuid not null references game_events(id) on delete cascade,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  points_awarded integer,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

create table if not exists feed_reactions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique(submission_id, player_id, emoji)
);

insert into game_events (title, points, category, is_legendary, special_effect) values
('Cocktail', 5, 'consumazione', false, null),
('Shot', 2, 'consumazione', false, null),
('Tequila', 3, 'consumazione', false, null),
('Calice', 3, 'consumazione', false, null),
('Birra', 3, 'consumazione', false, null),
('Perdere l’ombrello', 40, 'speciale', false, null),
('Bagno senza costume', 25, 'speciale', false, null),
('Salire sul banco del Ketty', 15, 'speciale', false, null),
('Tamponamento', 50, 'speciale', false, null),
('Posto di blocco', 30, 'speciale', false, null),
('Ritiro patente per tasso alcolemico elevato', 0, 'leggendario', true, 'Vittoria a tavolino'),
('Bacio con Andrea Ketty', 30, 'speciale', false, null),
('Vomito alcolico appartato', 15, 'speciale', false, null),
('Vomito alcolico in pubblico davanti a 2 o più estranei', 30, 'speciale', false, null),
('Caduta alcolica', 10, 'speciale', false, null),
('Addormentarsi al Ketty', 10, 'speciale', false, null),
('Addormentarsi al locale (no Ketty)', 5, 'speciale', false, null),
('Passare dalla ZTL attiva', 38, 'speciale', false, null),
('Fare il barista al Ketty', 15, 'speciale', false, null),
('Morte', 5, 'leggendario', true, 'Funerale a carico dei partecipanti'),
('Sobrietà del sabato sera', -5, 'malus', false, null)
on conflict (title) do update set
  points = excluded.points,
  category = excluded.category,
  is_legendary = excluded.is_legendary,
  special_effect = excluded.special_effect;

alter table players enable row level security;
alter table game_events enable row level security;
alter table submissions enable row level security;
alter table feed_reactions enable row level security;

drop policy if exists "players_select_all" on players;
create policy "players_select_all" on players for select using (true);

drop policy if exists "players_insert_all" on players;
create policy "players_insert_all" on players for insert with check (true);

drop policy if exists "players_update_all" on players;
create policy "players_update_all" on players for update using (true) with check (true);

drop policy if exists "game_events_select_all" on game_events;
create policy "game_events_select_all" on game_events for select using (true);

drop policy if exists "submissions_select_all" on submissions;
create policy "submissions_select_all" on submissions for select using (true);

drop policy if exists "submissions_insert_all" on submissions;
create policy "submissions_insert_all" on submissions for insert with check (true);

drop policy if exists "submissions_update_all" on submissions;
create policy "submissions_update_all" on submissions for update using (true) with check (true);

drop policy if exists "feed_reactions_select_all" on feed_reactions;
create policy "feed_reactions_select_all" on feed_reactions for select using (true);

drop policy if exists "feed_reactions_insert_all" on feed_reactions;
create policy "feed_reactions_insert_all" on feed_reactions for insert with check (true);

create or replace function approve_submission(submission_uuid uuid)
returns void as $$
declare
  p_id uuid;
  pts integer;
begin
  select s.player_id, ge.points
  into p_id, pts
  from submissions s
  join game_events ge on ge.id = s.event_id
  where s.id = submission_uuid;

  update submissions
  set status = 'approved',
      points_awarded = pts,
      approved_at = now()
  where id = submission_uuid;

  update players
  set total_points = total_points + pts
  where id = p_id;
end;
$$ language plpgsql;
