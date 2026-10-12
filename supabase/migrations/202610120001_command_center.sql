-- Run in a Supabase project. No service-role key is used by the application.
create table public.businesses (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
  name text not null check (length(name) between 2 and 150), timezone text not null default 'America/Jamaica' check (timezone = 'America/Jamaica'),
  revision integer not null default 0 check (revision >= 0), created_at timestamptz not null default now()
);
create table public.business_memberships (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','editor','reviewer','viewer')),
  primary key (business_id, user_id), created_at timestamptz not null default now()
);
create table public.products (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (length(name) between 2 and 150), description text not null default '' check(length(description) <= 5000),
  "priceCents" integer check ("priceCents" between 0 and 100000000), currency text not null check(currency ~ '^[A-Z]{3}$'),
  url text not null check (url ~ '^https://' and length(url) <= 2048), audience text not null default '' check(length(audience) <= 2000),
  benefits text[] not null default '{}' check(cardinality(benefits) <= 20), images text[] not null default '{}' check(cardinality(images) <= 8),
  keywords text[] not null default '{}' check(cardinality(keywords) <= 40), status text not null default 'draft' check(status in ('draft','active','archived')),
  "createdAt" timestamptz not null default now(), "updatedAt" timestamptz not null default now(), unique(id,business_id)
);
create table public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check(length(name) between 2 and 150), "productId" uuid not null, objective text not null check(length(objective) between 2 and 500),
  platforms text[] not null check(cardinality(platforms) between 1 and 4 and platforms <@ array['pinterest','instagram','facebook_page','facebook_group']::text[]),
  "createdAt" timestamptz not null default now(), unique(id,business_id),
  foreign key("productId",business_id) references public.products(id,business_id)
);
create table public.content_drafts (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  "productId" uuid not null, "campaignId" uuid, platform text not null check(platform in ('pinterest','instagram','facebook_page','facebook_group')),
  objective text not null check(objective in ('awareness','traffic','engagement','conversion')), tone text not null check(tone in ('professional','friendly','confident','educational')),
  title text not null check(length(title) <= 150), body text not null check(length(body) between 1 and 5000),
  hashtags text[] not null default '{}' check(cardinality(hashtags) <= 30), cta text not null default '' check(length(cta) <= 500),
  ideas text[] not null default '{}' check(cardinality(ideas) <= 10), source text not null check(source in ('openai','template','manual')),
  status text not null default 'draft' check(status in ('draft','pending_approval','approved','scheduled','published','rejected','failed','cancelled')),
  version integer not null default 1 check(version > 0), "approvedVersion" integer, "scheduledAt" timestamptz, "publishedAt" timestamptz, "publishedUrl" text,
  "createdAt" timestamptz not null default now(), "updatedAt" timestamptz not null default now(), unique(id,business_id),
  foreign key("productId",business_id) references public.products(id,business_id),
  foreign key("campaignId",business_id) references public.marketing_campaigns(id,business_id),
  check("approvedVersion" is null or "approvedVersion" = version),
  check(status not in ('approved','scheduled','published','failed') or ("approvedVersion" is not null and "approvedVersion" = version)),
  check(status <> 'scheduled' or "scheduledAt" is not null),
  check(status <> 'published' or ("publishedAt" is not null and "publishedUrl" ~ '^https://'))
);
create table public.content_approvals (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  "contentId" uuid not null, "actorId" uuid not null references auth.users(id), "actorName" text not null,
  decision text not null check(decision in ('approved','rejected','invalidated')), version integer not null check(version > 0),
  reason text not null default '' check(length(reason) <= 2000), "createdAt" timestamptz not null default now(),
  foreign key("contentId",business_id) references public.content_drafts(id,business_id)
);
create table public.scheduled_posts (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  "contentId" uuid not null, "scheduledAt" timestamptz not null,
  status text not null check(status in ('scheduled','completed','cancelled')), "createdAt" timestamptz not null default now(),
  unique("contentId",business_id), foreign key("contentId",business_id) references public.content_drafts(id,business_id)
);
create table public.platform_connections (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  platform text not null check(platform in ('pinterest','instagram','facebook_page','facebook_group')),
  status text not null default 'manual' check(status in ('manual','disconnected')), label text not null,
  unique(business_id,platform)
);
create table public.sales_transactions (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  "purchaseId" text not null check(length("purchaseId") between 1 and 200), "productName" text not null check(length("productName") between 1 and 300),
  "productId" uuid, "grossCents" integer not null check("grossCents" between 0 and 100000000),
  "refundCents" integer not null default 0 check("refundCents" between 0 and "grossCents"), currency text not null check(currency ~ '^[A-Z]{3}$'),
  "purchasedAt" timestamptz not null, "importedAt" timestamptz not null default now(),
  unique(business_id,"purchaseId"), foreign key("productId",business_id) references public.products(id,business_id)
);
create table public.automation_jobs (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  kind text not null check(kind in ('daily_suggestions','daily_drafts','approval_reminders','marketing_summary','publishing_review')),
  status text not null check(status in ('queued','running','completed','failed')), result text not null default '',
  "createdAt" timestamptz not null default now(), "finishedAt" timestamptz,
  -- Authenticated background workers claim a five-minute lease. No external publisher is registered.
  idempotency_key text, "leaseUntil" timestamptz, attempts integer not null default 0 check(attempts >= 0),
  unique(business_id,idempotency_key)
);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  "actorId" uuid not null references auth.users(id), "actorName" text not null, action text not null,
  "entityId" uuid, detail text not null, "createdAt" timestamptz not null default now()
);

create index memberships_user_idx on public.business_memberships(user_id);
create index products_business_idx on public.products(business_id,status);
create index campaigns_business_idx on public.marketing_campaigns(business_id,"productId");
create index content_queue_idx on public.content_drafts(business_id,status,"createdAt" desc);
create index content_product_idx on public.content_drafts(business_id,"productId");
create index content_campaign_idx on public.content_drafts(business_id,"campaignId");
create index approvals_history_idx on public.content_approvals(business_id,"contentId","createdAt" desc);
create index schedule_due_idx on public.scheduled_posts(business_id,status,"scheduledAt");
create index sales_date_idx on public.sales_transactions(business_id,currency,"purchasedAt");
create index sales_product_idx on public.sales_transactions(business_id,"productId");
create index jobs_queue_idx on public.automation_jobs(business_id,status,"createdAt");
create index audits_business_idx on public.audit_logs(business_id,"createdAt" desc);

create function public.cc_role(p_business_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select role from public.business_memberships where business_id=p_business_id and user_id=auth.uid();
$$;
create function public.cc_strings(p_value jsonb) returns text[]
language sql immutable set search_path = '' as $$
  select coalesce(array_agg(value), '{}'::text[]) from jsonb_array_elements_text(coalesce(p_value,'[]'::jsonb));
$$;
do $$ declare t text; begin
  foreach t in array array['businesses','business_memberships','products','marketing_campaigns','content_drafts','content_approvals','scheduled_posts','platform_connections','sales_transactions','automation_jobs','audit_logs'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    if t='businesses' then
      execute format('create policy tenant_read on public.%I for select to authenticated using (public.cc_role(id) is not null)',t);
    else
      execute format('create policy tenant_read on public.%I for select to authenticated using (public.cc_role(business_id) is not null)',t);
    end if;
  end loop;
end $$;

-- Provision an authenticated user's first business. Locked to avoid duplicate initial workspaces.
create function public.command_center_workspace() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare bid uuid; uid uuid := auth.uid(); member_role text; output jsonb;
begin
  if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  select business_id,role into bid,member_role from public.business_memberships where user_id=uid order by created_at,business_id limit 1;
  if bid is null then
    insert into public.businesses(owner_id,name) values(uid,'Action Systems') returning id into bid;
    insert into public.business_memberships(business_id,user_id,role) values(bid,uid,'owner'); member_role := 'owner';
    insert into public.products(business_id,name,description,"priceCents",currency,url,audience,status) values(bid,'Service Profit OS','',null,'USD','https://actionsystem.gumroad.com/l/serviceprofit-os','','draft');
    insert into public.platform_connections(business_id,platform,label)
      select bid,p,case when p='facebook_group' then 'Discussion assistance only' else 'Manual publishing' end
      from unnest(array['pinterest','instagram','facebook_page','facebook_group']) as p;
  end if;
  select jsonb_build_object('business',jsonb_build_object('id',b.id,'name',b.name,'timezone',b.timezone),'revision',b.revision) into output from public.businesses b where id=bid;
  output := output || jsonb_build_object(
    'products',(select coalesce(jsonb_agg(to_jsonb(p)-'business_id' order by "createdAt"),'[]'::jsonb) from public.products p where business_id=bid),
    'campaigns',(select coalesce(jsonb_agg(to_jsonb(p)-'business_id' order by "createdAt"),'[]'::jsonb) from public.marketing_campaigns p where business_id=bid),
    'content',(select coalesce(jsonb_agg(to_jsonb(p)-'business_id' order by "createdAt"),'[]'::jsonb) from public.content_drafts p where business_id=bid),
    'approvals',(select coalesce(jsonb_agg(to_jsonb(p)-'business_id' order by "createdAt"),'[]'::jsonb) from public.content_approvals p where business_id=bid),
    'scheduled',(select coalesce(jsonb_agg(to_jsonb(p)-'business_id' order by "createdAt"),'[]'::jsonb) from public.scheduled_posts p where business_id=bid),
    'sales',(select coalesce(jsonb_agg(to_jsonb(p)-'business_id' order by "purchasedAt"),'[]'::jsonb) from public.sales_transactions p where business_id=bid),
    'jobs',(select coalesce(jsonb_agg(to_jsonb(p)-'business_id'-'idempotency_key' order by "createdAt"),'[]'::jsonb) from public.automation_jobs p where business_id=bid),
    'audit',(select coalesce(jsonb_agg(to_jsonb(p)-'business_id' order by "createdAt"),'[]'::jsonb) from public.audit_logs p where business_id=bid),
    'connections',(select coalesce(jsonb_agg(to_jsonb(p)-'business_id'),'[]'::jsonb) from public.platform_connections p where business_id=bid));
  return jsonb_build_object('workspace',output,'role',member_role);
end $$;

-- The only mutation boundary: role checking + optimistic locking + an atomic audit entry.
create function public.command_center_operation(p_business_id uuid,p_revision integer,p_operation jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); member_role text; actor_name text; current_revision integer;
  op text := p_operation->>'type'; payload jsonb; entity uuid; d public.content_drafts%rowtype;
  dest text; reason text; publish_url text; date_value timestamptz; detail_value text := '';
  sale jsonb; existing public.sales_transactions%rowtype; added integer := 0; updated integer := 0; result_value text; j public.automation_jobs%rowtype;
begin
  member_role := public.cc_role(p_business_id);
  if uid is null or member_role is null or member_role='viewer' then raise exception 'Permission denied' using errcode='42501'; end if;
  if op <> 'content.transition' and member_role not in ('owner','editor') then raise exception 'Permission denied' using errcode='42501'; end if;
  select revision into current_revision from public.businesses where id=p_business_id for update;
  if p_revision is null or current_revision <> p_revision then raise exception 'Workspace changed' using errcode='40001'; end if;
  select left(coalesce(raw_user_meta_data->>'full_name',email,'Team member'),100) into actor_name from auth.users where id=uid;
  actor_name := coalesce(actor_name,'Team member');
  if op='product.save' then
    payload := p_operation->'product'; entity := coalesce((payload->>'id')::uuid,gen_random_uuid());
    if payload ? 'id' and payload->>'id' is not null and not exists(select 1 from public.products where id=entity and business_id=p_business_id) then raise exception 'Product not found'; end if;
    insert into public.products(id,business_id,name,description,"priceCents",currency,url,audience,benefits,images,keywords,status)
      values(entity,p_business_id,payload->>'name',payload->>'description',(payload->>'priceCents')::integer,payload->>'currency',payload->>'url',payload->>'audience',public.cc_strings(payload->'benefits'),public.cc_strings(payload->'images'),public.cc_strings(payload->'keywords'),payload->>'status')
      on conflict(id) do update set name=excluded.name,description=excluded.description,"priceCents"=excluded."priceCents",currency=excluded.currency,url=excluded.url,audience=excluded.audience,benefits=excluded.benefits,images=excluded.images,keywords=excluded.keywords,status=excluded.status,"updatedAt"=now();
    detail_value := 'Saved product ' || (payload->>'name');
  elsif op='product.archive' then
    entity := (p_operation->>'id')::uuid;
    update public.products set status='archived',"updatedAt"=now() where id=entity and business_id=p_business_id;
    if not found then raise exception 'Product not found'; end if; detail_value := 'Archived product';
  elsif op='campaign.create' then
    entity := gen_random_uuid();
    if not exists(select 1 from public.products where id=(p_operation->>'productId')::uuid and business_id=p_business_id and status<>'archived') then raise exception 'Product not available'; end if;
    insert into public.marketing_campaigns(id,business_id,name,"productId",objective,platforms) values(entity,p_business_id,p_operation->>'name',(p_operation->>'productId')::uuid,p_operation->>'objective',public.cc_strings(p_operation->'platforms'));
    detail_value := 'Created campaign ' || (p_operation->>'name');
  elsif op='content.create' then
    payload := p_operation->'content'; entity := (payload->>'id')::uuid;
    if not exists(select 1 from public.products where id=(payload->>'productId')::uuid and business_id=p_business_id and status<>'archived') then raise exception 'Product not available'; end if;
    if payload->>'campaignId' is not null and not exists(select 1 from public.marketing_campaigns where id=(payload->>'campaignId')::uuid and business_id=p_business_id and "productId"=(payload->>'productId')::uuid and payload->>'platform'=any(platforms)) then raise exception 'Campaign mismatch'; end if;
    insert into public.content_drafts(id,business_id,"productId","campaignId",platform,objective,tone,title,body,hashtags,cta,ideas,source)
      values(entity,p_business_id,(payload->>'productId')::uuid,(payload->>'campaignId')::uuid,payload->>'platform',payload->>'objective',payload->>'tone',payload->>'title',payload->>'body',public.cc_strings(payload->'hashtags'),payload->>'cta',public.cc_strings(payload->'ideas'),payload->>'source');
    detail_value := 'Created unapproved content draft';
  elsif op in ('content.edit','content.transition') then
    entity := (p_operation->>'id')::uuid;
    select * into d from public.content_drafts where id=entity and business_id=p_business_id for update;
    if not found then raise exception 'Content not found'; end if;
    if (p_operation->>'version')::integer is distinct from d.version then raise exception 'Content changed' using errcode='40001'; end if;
    if op='content.edit' then
      if d.status='published' then raise exception 'Published content cannot be edited'; end if;
      payload := p_operation->'fields';
      if d."approvedVersion" is not null then insert into public.content_approvals(business_id,"contentId","actorId","actorName",decision,version,reason) values(p_business_id,entity,uid,actor_name,'invalidated',d.version,'Content edited; approval must be requested again.'); end if;
      update public.content_drafts set title=payload->>'title',body=payload->>'body',hashtags=public.cc_strings(payload->'hashtags'),cta=payload->>'cta',ideas=public.cc_strings(payload->'ideas'),version=version+1,"approvedVersion"=null,"scheduledAt"=null,status='draft',"updatedAt"=now() where id=entity;
      update public.scheduled_posts set status='cancelled' where "contentId"=entity and business_id=p_business_id and status='scheduled';
      detail_value := 'Edited content and reset approval';
    else
      dest := p_operation->>'to'; reason := coalesce(p_operation->>'reason','');
      if not ((d.status='draft' and dest in ('pending_approval','cancelled')) or (d.status='pending_approval' and dest in ('approved','rejected','draft','cancelled')) or (d.status='approved' and dest in ('scheduled','published','draft','cancelled')) or (d.status='scheduled' and dest in ('scheduled','published','failed','draft','cancelled')) or (d.status='rejected' and dest in ('draft','cancelled')) or (d.status='failed' and dest in ('draft','scheduled','published','cancelled')) or (d.status='cancelled' and dest='draft')) then raise exception 'Invalid approval transition'; end if;
      if dest in ('approved','rejected','scheduled','published') and member_role not in ('owner','reviewer') then raise exception 'Reviewer permission required' using errcode='42501'; end if;
      if member_role='reviewer' and dest not in ('approved','rejected','scheduled','published') then raise exception 'Editor permission required' using errcode='42501'; end if;
      if dest in ('rejected','failed') and length(reason)<3 then raise exception 'Reason required'; end if;
      if length(reason)>2000 then raise exception 'Reason too long'; end if;
      if dest in ('approved','rejected') then
        insert into public.content_approvals(business_id,"contentId","actorId","actorName",decision,version,reason) values(p_business_id,entity,uid,actor_name,dest,d.version,reason);
        d."approvedVersion" := case when dest='approved' then d.version else null end;
      end if;
      if dest in ('scheduled','published') and (d."approvedVersion" is distinct from d.version or not exists(select 1 from public.content_approvals where business_id=p_business_id and "contentId"=entity and decision='approved' and version=d.version)) then raise exception 'Current content requires human approval'; end if;
      if dest='scheduled' then
        date_value := (p_operation->>'scheduledAt')::timestamptz;
        if date_value is null or date_value<=now() then raise exception 'Future schedule required'; end if;
        d."scheduledAt" := date_value;
        insert into public.scheduled_posts(business_id,"contentId","scheduledAt",status) values(p_business_id,entity,date_value,'scheduled') on conflict("contentId",business_id) do update set "scheduledAt"=excluded."scheduledAt",status='scheduled';
      end if;
      if dest='published' then
        publish_url := p_operation->>'publishedUrl';
        if (p_operation->>'confirmed')::boolean is distinct from true or publish_url is null or publish_url !~ '^https://' or length(publish_url)>2048 then raise exception 'Explicit confirmation and published URL required'; end if;
        d."publishedAt" := now(); d."publishedUrl" := publish_url;
        update public.scheduled_posts set status='completed' where "contentId"=entity and business_id=p_business_id;
      end if;
      if dest in ('cancelled','draft') then
        if d."approvedVersion" is not null then insert into public.content_approvals(business_id,"contentId","actorId","actorName",decision,version,reason) values(p_business_id,entity,uid,actor_name,'invalidated',d.version,'Approval withdrawn'); end if;
        d."approvedVersion" := null; d."scheduledAt" := null;
        update public.scheduled_posts set status='cancelled' where "contentId"=entity and business_id=p_business_id and status='scheduled';
      end if;
      update public.content_drafts set status=dest,"approvedVersion"=d."approvedVersion","scheduledAt"=d."scheduledAt","publishedAt"=d."publishedAt","publishedUrl"=d."publishedUrl","updatedAt"=now() where id=entity;
      detail_value := dest || case when reason<>'' then ': '||reason else '' end;
    end if;
  elsif op='sales.import' then
    if jsonb_typeof(p_operation->'sales') <> 'array' or jsonb_array_length(p_operation->'sales') not between 1 and 10000 then raise exception 'Invalid import size'; end if;
    for sale in select value from jsonb_array_elements(p_operation->'sales') loop
      select * into existing from public.sales_transactions where business_id=p_business_id and "purchaseId"=sale->>'purchaseId';
      if found then
        if existing."grossCents" is distinct from (sale->>'grossCents')::integer or existing.currency is distinct from sale->>'currency' or existing."productName" is distinct from sale->>'productName' or existing."purchasedAt" is distinct from (sale->>'purchasedAt')::timestamptz then raise exception 'Conflicting purchase ID'; end if;
        if (sale->>'refundCents')::integer>existing."refundCents" then
          update public.sales_transactions set "refundCents"=(sale->>'refundCents')::integer where id=existing.id; updated := updated+1;
        end if;
      else
        insert into public.sales_transactions(business_id,"purchaseId","productName","productId","grossCents","refundCents",currency,"purchasedAt") values(p_business_id,sale->>'purchaseId',sale->>'productName',(sale->>'productId')::uuid,(sale->>'grossCents')::integer,(sale->>'refundCents')::integer,sale->>'currency',(sale->>'purchasedAt')::timestamptz); added := added+1;
      end if;
    end loop;
    detail_value := format('Imported %s purchases; updated %s refunds; skipped %s duplicates',added,updated,jsonb_array_length(p_operation->'sales')-added-updated);
  elsif op in ('automation.enqueue','automation.claim','automation.retry','automation.fail') then
    entity := (p_operation->>'jobId')::uuid;
    if op='automation.enqueue' then
      insert into public.automation_jobs(id,business_id,kind,status,result,idempotency_key) values(entity,p_business_id,p_operation->>'kind','queued','Waiting for the authenticated worker.',p_business_id::text||':'||p_revision::text);
      detail_value := 'Queued internal workflow';
    else
      select * into j from public.automation_jobs where id=entity and business_id=p_business_id for update;
      if not found then raise exception 'Job not found'; end if;
      if op='automation.claim' then
        if j.status<>'queued' then raise exception 'Job already claimed' using errcode='40001'; end if;
        update public.automation_jobs set status='running',attempts=attempts+1,"leaseUntil"=now()+interval '5 minutes',result='Preparing internal workflow.' where id=entity;
        detail_value := j.kind||': running';
      elsif op='automation.retry' then
        if j.status='completed' or (j.status='running' and j."leaseUntil">now()) then raise exception 'Job is completed or still running' using errcode='40001'; end if;
        update public.automation_jobs set status='queued',"finishedAt"=null,"leaseUntil"=null,result='Queued for retry.' where id=entity;
        detail_value := j.kind||': queued';
      else
        if j.status='completed' then raise exception 'Completed job cannot fail'; end if;
        update public.automation_jobs set status='failed',"finishedAt"=now(),"leaseUntil"=null,result=left(coalesce(p_operation->>'reason','Workflow failed.'),2000) where id=entity;
        detail_value := j.kind||': failed';
      end if;
    end if;
  elsif op in ('automation.run','automation.execute') then
    if op='automation.execute' then
      entity := (p_operation->>'jobId')::uuid;
      select * into j from public.automation_jobs where id=entity and business_id=p_business_id for update;
      if not found or j.status<>'running' or j."leaseUntil" is null or j."leaseUntil"<=now() then raise exception 'Job is not running or lease expired' using errcode='40001'; end if;
      p_operation := p_operation || jsonb_build_object('kind',j.kind);
    else entity := gen_random_uuid(); end if;
    if p_operation->>'kind'='daily_suggestions' then
      select coalesce(string_agg('Prepare a product introduction for '||name||'; confirm product details, create a draft in the studio, then request approval.',E'\n'),'Add a product before preparing suggestions.') into result_value from public.products where business_id=p_business_id and status<>'archived';
    elsif p_operation->>'kind'='daily_drafts' then
      result_value := coalesce(p_operation->>'result','Enqueue this workflow to prepare drafts in the background.');
      if length(result_value)>5000 then raise exception 'Workflow result too long'; end if;
    elsif p_operation->>'kind'='approval_reminders' then
      select count(*)||' items await review. Reminder recorded here; no external message sent.' into result_value from public.content_drafts where business_id=p_business_id and status='pending_approval';
    elsif p_operation->>'kind'='marketing_summary' then
      select format('%s manually confirmed publications; %s scheduled; %s failed. Review the queue and sales import for the latest results.',count(*) filter(where status='published'),count(*) filter(where status='scheduled'),count(*) filter(where status='failed')) into result_value from public.content_drafts where business_id=p_business_id;
    elsif p_operation->>'kind'='publishing_review' then
      select count(*)||' approved posts are due. Publish manually, then record each published URL. No automatic publisher is connected.' into result_value from public.content_drafts where business_id=p_business_id and status='scheduled' and "scheduledAt"<=now();
    else raise exception 'Unknown workflow'; end if;
    if op='automation.execute' then
      update public.automation_jobs set status='completed',result=result_value,"finishedAt"=now(),"leaseUntil"=null where id=entity;
    else
      insert into public.automation_jobs(id,business_id,kind,status,result,"finishedAt",idempotency_key,attempts) values(entity,p_business_id,p_operation->>'kind','completed',result_value,now(),p_business_id::text||':'||p_revision::text,1);
    end if;
    detail_value := result_value;
  else raise exception 'Unknown operation'; end if;
  update public.businesses set revision=revision+1 where id=p_business_id;
  insert into public.audit_logs(business_id,"actorId","actorName",action,"entityId",detail) values(p_business_id,uid,actor_name,op,entity,detail_value);
end $$;

revoke all on function public.cc_role(uuid),public.cc_strings(jsonb),public.command_center_workspace(),public.command_center_operation(uuid,integer,jsonb) from public,anon;
grant execute on function public.cc_role(uuid),public.command_center_workspace(),public.command_center_operation(uuid,integer,jsonb) to authenticated;
-- Membership changes and connection credentials are deliberately not exposed through client writes.
