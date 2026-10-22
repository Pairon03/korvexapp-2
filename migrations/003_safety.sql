create policy student_exercise_read on app.exercises for select using(tenant_id=app.tenant() and not app.is_staff() and exists(select 1 from app.workout_plan_versions v where v.student_id=app.student() and v.content::text like '%'||app.exercises.id::text||'%'));
alter table app.workout_logs add column author_id uuid references identity.users;
create function app.log_safety_alert() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.discomfort then
  update app.students set revision=revision+1 where id=new.student_id and tenant_id=new.tenant_id;
  update app.training_cycles set status='suspended',reason='Desconforto relatado na execução',lease_until=null where tenant_id=new.tenant_id and student_id=new.student_id and status not in ('published','canceled');
  insert into app.notifications(tenant_id,student_id,kind,message) values(new.tenant_id,new.student_id,'review_required','Um registro de execução requer revisão profissional.');
  insert into app.audit_logs(tenant_id,actor_id,action,resource_id) values(new.tenant_id,new.author_id,'workout.discomfort_reported',new.id);
 end if;
 return new;
end $$;
create trigger workout_safety after insert on app.workout_logs for each row execute function app.log_safety_alert();
