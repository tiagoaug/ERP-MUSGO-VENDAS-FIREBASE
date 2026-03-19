-- =============================================================
-- SCRIPT DE CORREÇÃO: Permissões RLS para Financeiro Pessoal e Bancário
-- =============================================================

-- Habilitar RLS e criar políticas que permitem acesso tanto para 'anon' quanto 'authenticated'
-- Isso garante que o app funcione mesmo sem um sistema de login implementado.

CREATE OR REPLACE FUNCTION apply_personal_finance_permissions(t_name TEXT) RETURNS VOID AS $$
BEGIN
    -- Habilitar RLS
    EXECUTE format('ALTER TABLE IF EXISTS public.%I ENABLE ROW LEVEL SECURITY', t_name);
    
    -- Remover políticas restritivas antigas
    EXECUTE format('DROP POLICY IF EXISTS "Permitir tudo para autenticados" ON public.%I', t_name);
    EXECUTE format('DROP POLICY IF EXISTS "allow_all_%s" ON public.%I', t_name, t_name);
    
    -- Criar nova política permissiva para anon e authenticated
    EXECUTE format('CREATE POLICY "allow_all_%s" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t_name, t_name);
    
    -- Garantir privilégios para as roles
    EXECUTE format('GRANT ALL ON TABLE public.%I TO anon, authenticated, service_role', t_name);
END;
$$ LANGUAGE plpgsql;

-- Aplicar nas tabelas do Financeiro Pessoal
SELECT apply_personal_finance_permissions('family_members');
SELECT apply_personal_finance_permissions('personal_categories');
SELECT apply_personal_finance_permissions('personal_budgets');
SELECT apply_personal_finance_permissions('personal_transactions');

-- Aplicar nas tabelas de Contas Bancárias (se existirem)
SELECT apply_personal_finance_permissions('bank_accounts');
SELECT apply_personal_finance_permissions('account_transfers');

-- Limpeza
DROP FUNCTION apply_personal_finance_permissions(TEXT);

SELECT 'Permissões de Financeiro Pessoal e Bancário configuradas!' as resultado;
