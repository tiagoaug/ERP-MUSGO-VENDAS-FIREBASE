-- =============================================================
-- MÓDULO: FINANCEIRO PESSOAL
-- =============================================================

-- Membros da Família
CREATE TABLE IF NOT EXISTS family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Categorias Pessoais
CREATE TABLE IF NOT EXISTS personal_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'income' | 'expense' | 'reserve' | 'planning'
  parent_id UUID REFERENCES personal_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orçamentos Pessoais
CREATE TABLE IF NOT EXISTS personal_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES personal_categories(id) ON DELETE CASCADE,
  member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  month TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transações Pessoais
CREATE TABLE IF NOT EXISTS personal_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  type TEXT NOT NULL, -- 'income' | 'expense' | 'reserve' | 'planning'
  amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  category_id UUID REFERENCES personal_categories(id) ON DELETE SET NULL,
  member_id UUID REFERENCES family_members(id) ON DELETE SET NULL,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  business_transaction_id UUID,
  payment_method TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
