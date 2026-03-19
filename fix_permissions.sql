-- =============================================================
-- SCRIPT DE CORREÇÃO: Permissões RLS para todas as tabelas
-- Execute este script no SQL Editor do Supabase Dashboard
-- URL: https://supabase.com/dashboard/project/rlxmlurlutuzzekybvuk/editor
-- =============================================================

-- 1. ADICIONAR COLUNA FALTANTE (Se não existir)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_records' AND column_name='receipt_id') THEN
        ALTER TABLE payment_records ADD COLUMN receipt_id UUID REFERENCES receipts(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 2. FUNÇÃO AUXILIAR PARA APLICAR PERMISSÕES TOTAIS
-- Esta função habilita RLS, remove políticas antigas e cria uma nova "allow_all"
CREATE OR REPLACE FUNCTION apply_full_permissions(t_name TEXT) RETURNS VOID AS $$
BEGIN
    EXECUTE format('ALTER TABLE IF EXISTS %I ENABLE ROW LEVEL SECURITY', t_name);
    EXECUTE format('DROP POLICY IF EXISTS "Allow all" ON %I', t_name);
    EXECUTE format('DROP POLICY IF EXISTS "Enable all for anon" ON %I', t_name);
    EXECUTE format('DROP POLICY IF EXISTS "allow_all_%s" ON %I', t_name, t_name);
    EXECUTE format('CREATE POLICY "allow_all_%s" ON %I FOR ALL USING (true) WITH CHECK (true)', t_name, t_name);
    EXECUTE format('GRANT ALL ON TABLE %I TO anon, authenticated, service_role', t_name);
END;
$$ LANGUAGE plpgsql;

-- 3. APLICAR EM TODAS AS TABELAS
SELECT apply_full_permissions('colors');
SELECT apply_full_permissions('units');
SELECT apply_full_permissions('grids');
SELECT apply_full_permissions('grid_distributions');
SELECT apply_full_permissions('products');
SELECT apply_full_permissions('variations');
SELECT apply_full_permissions('wholesale_stock_items');
SELECT apply_full_permissions('customers');
SELECT apply_full_permissions('suppliers');
SELECT apply_full_permissions('sales');
SELECT apply_full_permissions('sale_items');
SELECT apply_full_permissions('purchases');
SELECT apply_full_permissions('purchase_items');
SELECT apply_full_permissions('expense_items');
SELECT apply_full_permissions('payment_records');
SELECT apply_full_permissions('transactions');
SELECT apply_full_permissions('agenda_tasks');
SELECT apply_full_permissions('app_notes');
SELECT apply_full_permissions('receipts');
SELECT apply_full_permissions('receipt_items');
SELECT apply_full_permissions('receipt_expense_items');

-- 4. LIMPEZA
DROP FUNCTION apply_full_permissions(TEXT);

-- Confirmação
SELECT 'Permissões SUPERTOTAIS configuradas com sucesso!' as resultado;
