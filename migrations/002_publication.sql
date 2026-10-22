alter table app.proposals add column published_version_id uuid;
alter table app.proposals add foreign key(published_version_id,tenant_id) references app.workout_plan_versions(id,tenant_id);
do $$ declare t text; begin
 foreach t in array array['workout_plans','workout_plan_versions','training_cycles','proposals'] loop
  execute format('drop policy tenant_scope on app.%I',t);
  execute format('create policy read_scope on app.%I for select using(tenant_id=app.tenant() and (app.is_staff() or student_id=app.student()))',t);
  execute format('create policy staff_writes on app.%I for all using(tenant_id=app.tenant() and app.is_staff()) with check(tenant_id=app.tenant() and app.is_staff())',t);
 end loop;
end $$;
