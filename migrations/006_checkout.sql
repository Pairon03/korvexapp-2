alter table app.subscriptions add column checkout_key uuid;
alter table app.subscriptions add column checkout_plan_id text references app.subscription_plans;
alter table app.subscriptions add column checkout_session_id text;
alter table app.subscriptions add column checkout_url text;
alter table app.subscriptions add column checkout_expires_at timestamptz;
