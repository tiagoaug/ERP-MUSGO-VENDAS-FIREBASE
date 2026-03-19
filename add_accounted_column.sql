-- Execute este script no SQL Editor do Supabase do projeto que você está usando (rlxmlurlutuzzekybvuk)

-- Adiciona a coluna 'accounted' na tabela 'purchases'
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS accounted BOOLEAN DEFAULT true;

-- Recarrega o cache do schema da API para garantir que as mudanças entrem em vigor imediatamente
NOTIFY pgrst, 'reload schema';
