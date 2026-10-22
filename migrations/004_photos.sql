create table app.progress_photos(id uuid primary key default gen_random_uuid(),tenant_id uuid not null references app.tenants,student_id uuid not null,author_id uuid not null references identity.users,category text not null check(category in ('front','side','back')),measured_on date not null,storage_key text not null unique,byte_size integer not null check(byte_size>0),created_at timestamptz not null default now(), foreign key(student_id,tenant_id) references app.students(id,tenant_id),unique(id,tenant_id));
alter table app.progress_photos enable row level security;
alter table app.progress_photos force row level security;
create policy photo_scope on app.progress_photos using(tenant_id=app.tenant() and (app.is_staff() or student_id=app.student())) with check(tenant_id=app.tenant() and (app.is_staff() or student_id=app.student()));
grant select,insert,delete on app.progress_photos to fitcore_app;
create table identity.photo_tokens(token_hash text primary key,photo_id uuid not null references app.progress_photos on delete cascade,user_id uuid not null references identity.users,expires_at timestamptz not null);
revoke execute on function app.log_safety_alert() from public;
