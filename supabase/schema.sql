-- =========================================================
-- ESQUEMA SQL - PAINEL DE CONTROLE DE PRODUTOS E COLEÇÕES
-- Modelo A (Supabase)
-- =========================================================

-- 1. Tabela de Coleções
create table if not exists collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  image text,
  display_order integer not null default 0,
  is_featured_home boolean default false,
  created_at timestamptz default now()
);

-- 2. Tabela de Produtos
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  images text[] default '{}',
  price numeric(10,2) not null,
  old_price numeric(10,2),
  weight_grams numeric(10,2),
  sizes text[] default '{}',
  collection_id uuid references collections(id) on delete set null,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Tabela N:N (Muitos-para-Muitos) de Produtos e Coleções
create table if not exists product_collections (
  product_id uuid references products(id) on delete cascade,
  collection_id uuid references collections(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (product_id, collection_id)
);

-- 4. Tabela de Slides / Banners da Seção Hero da Vitrine
create table if not exists hero_slides (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  image text not null,
  button_text text default 'Ver Coleção',
  button_link text default '#products',
  display_order integer default 0,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 5. Tabela de Configurações da Loja
create table if not exists store_settings (
  id uuid primary key default gen_random_uuid(),
  stripe_publishable_key text,
  stripe_secret_key_encrypted text,
  mercadopago_public_key text,
  mercadopago_access_token_encrypted text,
  updated_at timestamptz default now()
);

-- 6. Tabela de Pedidos e Checkouts Abandonados
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  customer_cpf text,
  shipping_address jsonb default '{}'::jsonb,
  shipping_method text,
  shipping_cost numeric(10,2) default 0.00,
  items jsonb default '[]'::jsonb,
  total_amount numeric(10,2) not null,
  payment_method text,
  status text not null default 'abandoned',
  comments text,
  stripe_session_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 7. Tabela de Finanças (Lucros e Custos)
create table if not exists finances (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  amount numeric(10,2) not null,
  type text not null default 'expense',
  category text default 'Outros',
  date date default current_date,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 8. Tabela de Cupons de Desconto
create table if not exists coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null default 'percentage', -- 'percentage', 'fixed', 'free_shipping'
  value numeric(10,2) not null default 0,
  min_order_value numeric(10,2) default 0,
  max_uses integer default null,
  used_count integer not null default 0,
  active boolean not null default true,
  expires_at timestamptz default null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ROW LEVEL SECURITY (RLS)
alter table collections enable row level security;
alter table products enable row level security;
alter table product_collections enable row level security;
alter table hero_slides enable row level security;
alter table store_settings enable row level security;
alter table orders enable row level security;
alter table finances enable row level security;
alter table coupons enable row level security;

create policy "Permitir acesso total de coupons" on coupons for all using (true) with check (true);
create policy "Permitir acesso total de orders" on orders for all using (true) with check (true);
create policy "Permitir acesso total de finances" on finances for all using (true) with check (true);
create policy "Permitir acesso total de collections" on collections for all using (true) with check (true);
create policy "Permitir acesso total de products" on products for all using (true) with check (true);
create policy "Permitir acesso total de product_collections" on product_collections for all using (true) with check (true);
create policy "Permitir acesso total de store_settings" on store_settings for all using (true) with check (true);
create policy "admin_all_hero_slides" on hero_slides for all using (auth.role() = 'authenticated');
create policy "public_read_active_hero_slides" on hero_slides for select using (true);


