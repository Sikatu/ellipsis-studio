insert into storage.buckets (id, name, public)
values ('brand-deliverables', 'brand-deliverables', false)
on conflict (id) do update
set name = excluded.name,
    public = false;