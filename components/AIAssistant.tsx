
import React, { useState, useEffect, useRef } from 'react';
import { Lightbulb, X, PaperPlaneRight, Sparkle, CircleNotch, ChatText, BookOpen, Question, CaretRight } from '@phosphor-icons/react';
const Send = PaperPlaneRight;
const Sparkles = Sparkle;
const Loader2 = ({ size, className }: { size?: number; className?: string }) => <CircleNotch size={size} className={`animate-spin ${className || ''}`} />;
const MessageSquare = ChatText;
const HelpCircle = Question;
const ChevronRight = CaretRight;
import { GoogleGenAI } from "@google/genai";
import { ViewType } from '../types';

interface AIAssistantProps {
  currentView: ViewType;
  isOpen: boolean;
  onClose: () => void;
}

export const AIAssistant = ({ currentView, isOpen, onClose }: AIAssistantProps) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', text: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'ai' | 'guide'>('guide');
  const scrollRef = useRef<HTMLDivElement>(null);

  const hasApiKey = !!process.env.API_KEY && process.env.API_KEY !== "";

  useEffect(() => {
    setMode(hasApiKey ? 'ai' : 'guide');
  }, [hasApiKey]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const viewGuides: Record<ViewType, { steps: string[], tips: string[] }> = {
    dashboard: {
      steps: ["Veja o saldo em caixa", "Confira o valor total em estoque", "Observe o ranking de vendas"],
      tips: ["Clique nos cards coloridos para atalhos rápidos", "O gráfico mostra o lucro líquido final"]
    },
    vender: {
      steps: ["Escolha o cliente", "Selecione produtos na lista esquerda", "Defina se é Entrega ou Retirada", "Confirme o valor pago"],
      tips: ["O endereço do cliente carrega sozinho se estiver cadastrado", "Você pode dar descontos no final"]
    },
    agenda: {
      steps: ["Escolha uma data no calendário", "Clique no '+' para criar tarefa", "Use notas para lembretes coloridos"],
      tips: ["Notas amarelas são ótimas para recados rápidos", "Marque o check ao concluir uma tarefa"]
    },
    estoque: {
      steps: ["Busque pelo nome ou cor", "Verifique os itens em vermelho (baixo estoque)", "Analise o preço de venda sugerido"],
      tips: ["O saldo atualiza automaticamente após cada venda", "Use o filtro para buscas rápidas"]
    },
    produtos: {
      steps: ["Cadastre a Referência (SKU)", "Selecione o Fornecedor", "Adicione a Grade (cores e tamanhos)", "Defina preços de custo e venda"],
      tips: ["A referência é o nome principal do modelo", "Sempre adicione pelo menos uma variação"]
    },
    compras: {
      steps: ["Escolha se é estoque ou despesa", "Selecione o fornecedor", "Preencha valores e vencimento"],
      tips: ["Compras de estoque aumentam o saldo dos produtos", "Compras diversas entram no seu financeiro como 'A Pagar'"]
    },
    vendas: {
      steps: ["Localize o pedido pelo número", "Verifique se está Pago ou Pendente", "Acesse as configurações para mudar status"],
      tips: ["Pedidos cancelados devolvem os itens ao estoque", "Use o filtro para achar vendas de meses anteriores"]
    },
    cadastros: {
      steps: ["Use as abas para alternar entre Clientes e Fornecedores", "Cadastre nomes, telefones e endereços", "Gerencie cores e unidades de medida"],
      tips: ["Mantenha o cadastro de clientes atualizado para facilitar entregas", "Cadastre fornecedores para agilizar compras"]
    },
    // Logistica removed from navigation
    relatorios: {
      steps: ["Escolha o tipo de relatório", "Defina o período (mês, semana)", "Clique em Exportar PDF"],
      tips: ["Relatórios de 'Melhores Clientes' ajudam em promoções"]
    },
    backup: {
      steps: ["Conecte sua conta Google", "Clique em Salvar na Nuvem", "Ou exporte um arquivo JSON local"],
      tips: ["Faça backup toda semana para segurança total"]
    },
    // Fix: Adding missing 'relacionamento' entry to viewGuides to satisfy the Record type requirement.
    relacionamento: {
      steps: ["Analise o total a receber", "Identifique clientes inadimplentes", "Verifique o ticket médio"],
      tips: ["Clientes com dívidas altas aparecem com destaque", "Utilize o atalho do WhatsApp para cobranças"]
    },
    relacionamento_fornecedores: {
      steps: ["Veja o saldo devedor por fornecedor", "Lance pagamentos parciais", "Quite compras pendentes"],
      tips: ["A barra de progresso mostra o quanto já foi pago", "A exportação para PDF gera o histórico do fornecedor"]
    },
    recebimentos: {
      steps: ["Cadastre entradas manuais", "Gerencie saldo de clientes", "Confirme recebimentos de títulos"],
      tips: ["Recebimentos manuais ajudam no controle de entradas avulsas"]
    },
    clientes: {
      steps: ["Cadastre novos clientes", "Veja o histórico de fornecedores", "Importe contatos"],
      tips: ["Clientes bem cadastrados aparecem melhor nos relatórios"]
    },
    fornecedores: {
      steps: ["Cadastre fornecedores de estoque e despesas", "Gerencie o saldo devedor", "Vincule fornecedores a clientes"],
      tips: ["Fornecedores de estoque alimentam automaticamente o sistema de compras"]
    },
    financeiro: {
      steps: ["Verifique o fluxo de caixa", "Veja contas a pagar hoje", "Confirme recebimentos de vendas"],
      tips: ["O sistema soma automaticamente todas as suas dívidas e lucros"]
    },
    financeiro_pessoal: {
      steps: [
        'Acompanhe seus gastos pessoais, receitas (incluindo Pró-labore da empresa).',
        'Cadastre membros da família e defina metas (orçamentos) por categoria.',
      ],
      tips: [
        'Transações sinalizadas como "Pró-labore" no financeiro da empresa entram aqui como receita!',
        'Crie categorias detalhadas para saber exatamente onde seu dinheiro está indo.'
      ]
    },
    financeiro_pessoal_relatorios: {
      steps: [
        'Veja seus resumos por períodos',
        'Avalie metas e limites de gastos pessoais'
      ],
      tips: [
        'Acompanhe mensalmente se você poupou o valor planejado'
      ]
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    if (mode === 'guide') {
      setMessages(prev => [...prev,
      { role: 'user', text: input },
      { role: 'assistant', text: "No momento estou no Modo Guia (Gratuito). Para conversas inteligentes, a chave API do Gemini precisa estar disponível no sistema." }
      ]);
      setInput('');
      return;
    }

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      // Create a new GoogleGenAI instance right before making an API call to ensure it uses the latest key.
      const ai = new GoogleGenAI({ apiKey: (process.env.API_KEY as string) });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: userMsg,
        config: {
          systemInstruction: `Você é o Lampy do sistema MUSGO ERP. O usuário está na tela ${currentView}. Responda de forma curta e prática.`,
        },
      });

      // response.text is a getter property, used directly without parentheses.
      setMessages(prev => [...prev, { role: 'assistant', text: response.text || "Desculpe, não consegui processar sua mensagem." }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'assistant', text: "Houve um problema de conexão com a inteligência artificial." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const currentGuide = viewGuides[currentView];

  if (!isOpen) return null;

  return (
    <div className="fixed top-12 right-6 z-[200] w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl border dark:border-slate-800 flex flex-col overflow-hidden animate-slideUp">
      <div className={`p-3 bg-gradient-to-r ${mode === 'ai' ? 'from-blue-600 to-indigo-600' : 'from-yellow-400 to-amber-500'} text-white flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <div className="bg-white/20 p-1 rounded-lg">
            {mode === 'ai' ? <Sparkles size={12} /> : <BookOpen size={12} className="text-slate-900" />}
          </div>
          <div>
            <h4 className={`text-[9px] font-black uppercase tracking-widest ${mode === 'guide' ? 'text-slate-900' : ''}`}>
              Lampy: {mode === 'ai' ? 'IA' : 'Guia'}
            </h4>
          </div>
        </div>
        <button onClick={onClose} aria-label="Fechar assistente" title="Fechar" className={`p-1 hover:bg-black/10 rounded-md ${mode === 'guide' ? 'text-slate-900' : 'text-white'}`}>
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 p-4 space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar bg-slate-50/50 dark:bg-slate-950/50">
        {mode === 'guide' ? (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border dark:border-slate-700 shadow-sm">
              <h5 className="text-[8px] font-black uppercase text-blue-600 mb-2 flex items-center gap-1.5">
                <HelpCircle size={12} /> Passo a passo:
              </h5>
              <div className="space-y-2">
                {currentGuide?.steps.map((step, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <span className="w-4 h-4 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center text-[9px] font-black shrink-0">{i + 1}</span>
                    <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/10 p-3 rounded-2xl border border-amber-200 dark:border-amber-800">
              <h5 className="text-[8px] font-black uppercase text-amber-600 mb-1">Dicas:</h5>
              <ul className="space-y-1">
                {currentGuide?.tips.map((tip, i) => (
                  <li key={i} className="text-[9px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <ChevronRight size={10} className="text-amber-400" /> {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.length === 0 && (
              <p className="text-center py-6 text-[9px] font-bold text-slate-400 uppercase">Tire suas dúvidas sobre {currentView}</p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-xl text-[10px] font-medium leading-relaxed ${m.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 dark:text-slate-200 rounded-tl-none border dark:border-slate-700 shadow-sm'}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {isLoading && <Loader2 size={16} className="animate-spin text-blue-500 mx-auto" />}
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      <div className="p-3 bg-white dark:bg-slate-900 border-t dark:border-slate-800 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={mode === 'guide' ? "Modo Guia Ativo" : "Pergunte algo..."}
          className="flex-1 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-lg px-3 py-1.5 text-[10px] font-semibold outline-none dark:text-white"
        />
        <button
          onClick={handleSend}
          disabled={isLoading}
          aria-label="Enviar mensagem"
          title="Enviar"
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-90 ${mode === 'ai' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-slate-100 text-slate-400'}`}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
};
