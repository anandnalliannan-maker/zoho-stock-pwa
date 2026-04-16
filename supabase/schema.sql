create table if not exists public.balu_honda_live_stock_cache (
  cache_name text not null default 'balu_honda_live_stock',
  sync_batch_id text not null,
  frame_number text not null,
  model_name text,
  model_variant text,
  color text,
  location text,
  executive_name text,
  source_document_id text not null,
  source_worksheet_name text not null,
  synced_at timestamptz not null default timezone('utc', now()),
  primary key (sync_batch_id, frame_number)
);

create index if not exists balu_honda_live_stock_cache_lookup_idx
  on public.balu_honda_live_stock_cache (cache_name, sync_batch_id, color, frame_number);

create table if not exists public.balu_honda_live_stock_sync_state (
  cache_name text primary key,
  active_batch_id text not null,
  last_synced_at timestamptz not null default timezone('utc', now()),
  source_document_id text not null,
  source_worksheet_name text not null,
  row_count integer not null default 0
);
