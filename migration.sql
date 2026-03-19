-- Migração para Sistema de Contas Bancárias

-- Tabela de Contas Bancárias
CREATE TABLE IF NOT EXISTS public.bank_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    balance DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Transferências entre Contas
CREATE TABLE IF NOT EXISTS public.account_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
    to_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
    amount DECIMAL(12,2) NOT NULL,
    description TEXT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Adicionar campo bankAccountId nas tabelas existentes (se não existirem)
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL;

-- Políticas de RLS (Básico para permitir funcionamento)
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir tudo para autenticados" ON public.bank_accounts;
CREATE POLICY "Permitir tudo para autenticados" ON public.bank_accounts FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Permitir tudo para autenticados" ON public.account_transfers;
CREATE POLICY "Permitir tudo para autenticados" ON public.account_transfers FOR ALL TO authenticated USING (true);

-- Adicionar vínculo de contas bancárias no financeiro pessoal
ALTER TABLE public.personal_transactions ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL;
