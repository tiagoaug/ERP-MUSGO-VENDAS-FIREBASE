-- Migração para garantir RLS nas tabelas de Financeiro Pessoal

-- Habilitar RLS se não estiver
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_transactions ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem (para evitar duplicidade)
DROP POLICY IF EXISTS "Permitir tudo para autenticados" ON public.family_members;
DROP POLICY IF EXISTS "Permitir tudo para autenticados" ON public.personal_categories;
DROP POLICY IF EXISTS "Permitir tudo para autenticados" ON public.personal_budgets;
DROP POLICY IF EXISTS "Permitir tudo para autenticados" ON public.personal_transactions;

-- Criar políticas "FOR ALL" para usuários autenticados
CREATE POLICY "Permitir tudo para autenticados" ON public.family_members FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo para autenticados" ON public.personal_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo para autenticados" ON public.personal_budgets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo para autenticados" ON public.personal_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
