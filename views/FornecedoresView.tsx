import React, { useState, useMemo } from 'react';
import { Plus, Trash, PencilSimple, X, Basket, AddressBook, MagnifyingGlass, User, ArrowClockwise, ShoppingBag } from '@phosphor-icons/react';
import { SupplierDetailModal } from '../components/SupplierDetailModal';
import { Purchase, Sale, Customer, Supplier, Category } from '../types';
import { Contacts } from '@capacitor-community/contacts';
import { Field } from '../components/ui/Field';
import { IconButton } from '../components/ui/IconButton';

// Lucide compat aliases
const Trash2 = Trash;
const Pencil = PencilSimple;
const Contact = AddressBook;

interface FornecedoresViewProps {
  suppliers: Supplier[];
  purchases: Purchase[];
  sales: Sale[];
  customers: Customer[];
  onAddOrUpdate: (supplier: Omit<Supplier, 'id' | 'balance'> | Supplier) => void;
  onDelete: (id: string) => void;
  onAddPayment?: (purchaseId: string) => void;
  initialData?: { name: string; phone: string };
  onLinkToCustomer?: (data: { name: string; phone: string }) => void;
  categories?: Category[];
}

export const FornecedoresView = ({ suppliers, purchases, sales, customers, onAddOrUpdate, onDelete, onAddPayment, initialData, onLinkToCustomer, categories = [] }: FornecedoresViewProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [listSearch, setListSearch] = useState('');
  const [currentSupplier, setCurrentSupplier] = useState<any>(null);
  const [form, setForm] = useState<any>({ name: '', contact: '', type: 'Estoque', phone: '', email: '', categoryId: '' });

  React.useEffect(() => {
    if (initialData) {
      setForm({
        ...form,
        name: initialData.name,
        phone: initialData.phone,
      });
      setIsModalOpen(true);
    }
  }, [initialData]);

  const handleOpenModal = (supplier?: Supplier) => {
    if (supplier) {
      setCurrentSupplier(supplier);
      setForm({
        name: supplier.name,
        contact: supplier.contact,
        type: supplier.type,
        phone: supplier.phone || '',
        email: supplier.email || '',
        categoryId: supplier.categoryId || ''
      });
    } else {
      setCurrentSupplier(null);
      setForm({ name: '', contact: '', type: 'Estoque', phone: '', email: '', categoryId: '' });
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!form.name) return alert("O nome é obrigatório.");

    if (currentSupplier) {
      onAddOrUpdate({ ...currentSupplier, ...form, categoryId: form.type === 'Geral' ? form.categoryId : undefined });
    } else {
      onAddOrUpdate({ ...form, categoryId: form.type === 'Geral' ? form.categoryId : undefined });
    }

    setIsModalOpen(false);
  };

  const handleImportContact = async () => {
    try {
      const permission = await Contacts.requestPermissions();
      if (permission.contacts !== 'granted') {
        alert("Permissão para acessar a agenda foi negada.");
        return;
      }
      
      const result = await Contacts.pickContact({
        projection: { name: true, phones: true, emails: true }
      });
      
      if (result.contact) {
        setForm({
          ...form,
          name: result.contact.name?.display || form.name,
          phone: result.contact.phones?.[0]?.number || form.phone,
          email: result.contact.emails?.[0]?.address || form.email
        });
      }
    } catch (e: any) {
      console.error(e);
      alert("Não foi possível importar o contato: " + (e.message || "Erro desconhecido"));
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4 animate-fadeIn">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight">Central de Fornecedores</h2>
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none">Gestão de Parceiros & Histórico de Compras</p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Buscar por nome ou ID de compra..."
              value={listSearch}
              onChange={e => setListSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-xl text-xs font-bold outline-none focus:ring-2 ring-blue-500/10 transition-all"
            />
          </div>
          <button onClick={() => handleOpenModal()} className="bg-blue-600 text-white h-9 px-4 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-95 transition-all shrink-0">
            <Plus size={14} weight="bold" /> Novo
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {suppliers.filter(s => {
          const search = listSearch.toLowerCase();
          const matchesName = s.name.toLowerCase().includes(search);
          const relatedPurchases = purchases.filter(p => p.supplierId === s.id);
          const matchesPurchase = relatedPurchases.some(p => p.purchaseNumber.toLowerCase().includes(search));
          return matchesName || matchesPurchase;
        }).map(s => (
          <div key={s.id} onClick={() => setSelectedSupplier(s)} className="bg-white dark:bg-slate-900 border dark:border-slate-800 p-4 rounded-2xl flex items-center justify-between group shadow-sm hover:border-blue-500 transition-all cursor-pointer">
            <div className="min-w-0 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 flex items-center justify-center shrink-0 transition-colors">
                <User size={18} weight="duotone" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase truncate dark:text-white leading-tight">{s.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded-md ${s.type === 'Estoque' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>
                    {s.type}
                  </span>
                  <p className="text-[8px] font-bold text-slate-400 truncate uppercase">{s.phone || 'S/ Tel'}</p>
                </div>
              </div>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 items-center">
              <IconButton icon={<ArrowClockwise size={12} weight="bold" />} color="indigo" onClick={(e) => { e.stopPropagation(); onLinkToCustomer?.({ name: s.name, phone: s.phone || '' }); }} title="Vincular como Cliente" />
              <IconButton icon={<Trash2 size={12} />} color="rose" onClick={(e) => { e.stopPropagation(); confirm("Apagar fornecedor?") && onDelete(s.id); }} title="Excluir" />
            </div>
          </div>
        ))}
        {suppliers.length === 0 && (
          <div className="col-span-full py-20 text-center opacity-30">
            <ShoppingBag size={40} className="mx-auto mb-2" />
            <p className="text-[10px] font-black uppercase tracking-[5px]">Nenhum Fornecedor</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl flex flex-col animate-slideUp overflow-hidden">
            <div className="p-4 border-b dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h4 className="text-xs font-black uppercase dark:text-white">
                {currentSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}
              </h4>
              <button onClick={() => setIsModalOpen(false)} aria-label="Fechar" title="Fechar" className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <button
                onClick={handleImportContact}
                className="w-full py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 text-blue-600 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
              >
                <Contact size={16} /> Importar da Agenda
              </button>

              <Field label="Nome da Empresa / Fantasia" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Ex: Tecidos Ltda" />
              <Field label="Responsável / Contato" value={form.contact} onChange={(v) => setForm({ ...form, contact: v })} placeholder="Nome da pessoa" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Telefone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="(00) 0000-0000" />
                <div className="flex flex-col gap-1 w-full">
                  <label className="text-[8px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Tipo</label>
                  <select
                    value={form.type}
                    onChange={e => setForm({ ...form, type: e.target.value, categoryId: e.target.value === 'Estoque' ? '' : form.categoryId })}
                    aria-label="Tipo de fornecedor"
                    title="Tipo de fornecedor"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-[11px] font-semibold outline-none focus:border-blue-500 transition-all dark:text-white shadow-sm"
                  >
                    <option value="Estoque">Estoque (Peças)</option>
                    <option value="Geral">Geral (Serviços/Insumos)</option>
                  </select>
                </div>
              </div>

              {form.type === 'Geral' && (
                <div className="flex flex-col gap-1">
                  <label className="text-[8px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Categoria (Opcional)</label>
                  <select
                    value={form.categoryId || ''}
                    onChange={e => setForm({ ...form, categoryId: e.target.value })}
                    aria-label="Categoria do Fornecedor"
                    title="Categoria do Fornecedor"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs font-semibold outline-none focus:border-blue-500 transition-all dark:text-white"
                  >
                    <option value="">Sem Categoria Específica</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <Field label="E-mail" value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="email@exemplo.com" />
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t dark:border-slate-800 flex gap-3">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSave} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all">
                {currentSupplier ? 'Atualizar Dados' : 'Cadastrar Fornecedor'}
              </button>
            </div>
          </div>
        </div>
      )}
      {selectedSupplier && (
        <SupplierDetailModal
          supplier={selectedSupplier}
          purchases={purchases.filter(p => p.supplierId === selectedSupplier.id)}
          sales={sales}
          customers={customers}
          categories={categories}
          onClose={() => setSelectedSupplier(null)}
          onUpdate={(updated) => { onAddOrUpdate(updated); setSelectedSupplier(null); }}
          onAddPayment={onAddPayment}
        />
      )}
    </div>
  );
};
