alter table identity.tokens drop constraint tokens_purpose_check;
alter table identity.tokens add constraint tokens_purpose_check check(purpose in ('verify','reset','invite','staff_invite'));
create table identity.operations(id uuid primary key default gen_random_uuid(),operator text not null default current_user,action text not null,metadata jsonb not null,created_at timestamptz not null default now());
