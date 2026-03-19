
import React, { useState, useMemo } from 'react';
import { Customer, Sale, Purchase, Supplier } from '../types';
import { Field } from '../components/ui/Field';
import { IconButton } from '../components/ui/IconButton';
import { Plus, Trash, X, PencilSimple, User, ClockCounterClockwise, MapPin, MagnifyingGlass, AddressBook, CurrencyDollar, ArrowClockwise } from '@phosphor-icons/react';
import { CustomerDetailModal } from '../components/CustomerDetailModal';
import { formatMoney } from '../lib/utils';

// Lucide compat aliases
const Trash2 = Trash;
const Pencil = PencilSimple;
const History = ClockCounterClockwise;
const Search = MagnifyingGlass;
const Contact = AddressBook;

interface ClientesViewProps {
  customers: Customer[];
  sales: Sale[];
  onAdd: (customer: Omit<Customer, 'id' | 'balance'>) => void;
  onDelete: (id: string) => void;
  onUpdate: (customer: Customer) => void;
  onReceivePayment?: (saleId: string) => void;
  initialData?: { name: string; phone: string; address: string };
  onLinkToSupplier?: (data: { name: string; phone: string }) => void;
  purchases: Purchase[];
  suppliers: Supplier[];
}

// Helper para abrir Google Maps
const handleOpenMaps = (address: string) => {
  if (address) {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
  } else {
    window.open('https://www.google.com/maps', '_blank');
  }
};

export const ClientesView = ({ customers, sales, purchases, suppliers, onAdd, onDelete, onUpdate, onReceivePayment, initialData, onLinkToSupplier }: ClientesViewProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', address: '' });
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [listSearch, setListSearch] = useState('');

  React.useEffect(() => {
    if (initialData) {
      setForm(initialData);
      setIsAdding(true);
    }
  }, [initialData]);

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const search = listSearch.toLowerCase();
      const matchesName = c.name.toLowerCase().includes(search);
      const matchesPhone = c.phone && c.phone.includes(search);
      const relatedSales = sales.filter(s => s.customerId === c.id);
      const matchesOrder = relatedSales.some(s => s.saleNumber.toLowerCase().includes(search));
      return matchesName || matchesPhone || matchesOrder;
    });
  }, [customers, sales, listSearch]);

  const handleImportContact = async () => {
    // Verificação de segurança: API de contatos não funciona em iframes
    if (window.self !== window.top) {
      alert("A importação de contatos nativa não funciona no modo de pré-visualização (iframe). Por favor, abra o aplicativo em uma nova aba ou no seu dispositivo móvel para usar esta função.");
      return;
    }

    try {
      // @ts-ignore
      if ('contacts' in navigator && 'ContactsManager' in window) {
        const props = ['name', 'tel', 'address'];
        const opts = { multiple: false };
        // @ts-ignore
        const contacts = await navigator.contacts.select(props, opts);
        if (contacts.length) {
          const c = contacts[0];
          setForm({
            ...form,
            name: c.name?.[0] || form.name,
            phone: c.tel?.[0] || form.phone,
            // Address mapping can be tricky as it returns object, sticking to name/tel for MVP
          });
        }
      } else {
        alert("Importação não suportada neste navegador. Tente usar Chrome no Android ou Safari no iOS.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4 animate-fadeIn">
      {selectedCustomer && (
        <CustomerDetailModal
          customer={selectedCustomer}
          sales={sales.filter(s => s.customerId === selectedCustomer.id)}
          purchases={purchases}
          suppliers={suppliers}
          receipts={[]} // ClientesView não escopa receipts no momento ou passaríamos das props
          onClose={() => setSelectedCustomer(null)}
          onUpdate={onUpdate}
        />
      )}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-black uppercase">Clientes</h2>
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Base de Dados</p>
        </div>
        <button onClick={() => setIsAdding(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase flex items-center gap-2 shadow-md hover:bg-blue-700 transition-all">
          <Plus size={14} /> Novo Cliente
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" size={16} />
        <input
          type="text"
          placeholder="Pesquisar cliente por nome ou telefone..."
          value={listSearch}
          onChange={e => setListSearch(e.target.value)}
          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 pl-10 pr-4 py-3 rounded-xl text-xs font-bold outline-none focus:ring-2 ring-blue-500/10 shadow-sm"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {filteredCustomers.map(c => (
          <div key={c.id} onClick={() => setSelectedCustomer(c)} className="bg-white dark:bg-slate-900 border dark:border-slate-800 p-4 rounded-xl flex items-center justify-between group shadow-sm cursor-pointer hover:border-blue-500 transition-all">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-[10px] font-black text-blue-600 uppercase shrink-0">
                {c.name.charAt(0)}
              </div>
              <div className="min-w-0 leading-tight">
                <p className="text-[10px] font-black uppercase truncate dark:text-white">{c.name}</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase">{c.phone || 'S/ Telefone'}</p>
              </div>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 items-center">
              <IconButton icon={<ArrowClockwise size={12} weight="bold" />} color="indigo" onClick={(e) => { e.stopPropagation(); onLinkToSupplier?.({ name: c.name, phone: c.phone }); }} title="Vincular como Fornecedor" />
              <IconButton icon={<Pencil size={12} />} color="amber" onClick={(e) => { e.stopPropagation(); setSelectedCustomer(c); }} title="Editar" />
              <IconButton icon={<Trash2 size={12} />} color="rose" onClick={(e) => { e.stopPropagation(); confirm("Apagar cliente?") && onDelete(c.id); }} title="Excluir" />
            </div>
          </div>
        ))}
        {filteredCustomers.length === 0 && (
          <div className="col-span-full py-20 text-center opacity-30">
            <Search size={40} className="mx-auto mb-2" />
            <p className="text-[10px] font-black uppercase tracking-[5px]">Nenhum cliente encontrado</p>
          </div>
        )}
      </div>

      {isAdding && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl p-6 shadow-2xl relative animate-slideUp overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="absolute top-0 left-0 w-full h-1 bg-blue-600"></div>
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-xs font-black uppercase dark:text-white">Novo Cliente</h4>
              <button onClick={() => setIsAdding(false)} aria-label="Fechar" title="Fechar" className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <button
                onClick={handleImportContact}
                className="w-full py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 text-blue-600 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
              >
                <Contact size={16} /> Importar da Agenda
              </button>

              <Field label="Nome Completo" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Nome do cliente" />
              <Field label="Telefone / WhatsApp" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="(00) 00000-0000" />

              <div>
                <Field
                  label="Endereço Completo"
                  value={form.address}
                  onChange={(v) => setForm({ ...form, address: v })}
                  placeholder="Rua, Número, Bairro - Cidade/UF"
                  suffixIcon={
                    <button
                      onClick={() => handleOpenMaps(form.address)}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-blue-600 transition-colors"
                      title="Ver no Google Maps"
                    >
                      <MapPin size={16} />
                    </button>
                  }
                />
                <p className="text-[9px] text-slate-400 font-bold mt-1.5 px-1">
                  * Use o ícone do mapa para localizar no Google.
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-6 border-t dark:border-slate-800 mt-4">
              <button onClick={() => setIsAdding(false)} className="flex-1 py-2.5 text-[9px] font-black uppercase text-slate-400 hover:text-slate-600 transition-colors">Cancelar</button>
              <button onClick={() => { if (!form.name) return alert("Nome é obrigatório"); onAdd(form); setIsAdding(false); setForm({ name: '', phone: '', address: '' }); }} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all">Salvar Cadastro</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
