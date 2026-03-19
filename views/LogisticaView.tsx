
import React, { useState, useMemo } from 'react';
import { Sale, Customer, SaleStatus } from '../types';
import { MapPin, NavigationArrow, CheckCircle, Truck, Package, X, PencilSimple, MagnifyingGlass, Clock, Warning } from '@phosphor-icons/react';

// Lucide compat aliases
const Navigation = NavigationArrow;
const Edit2 = PencilSimple;
const Search = MagnifyingGlass;
const AlertTriangle = Warning;
import { Field } from '../components/ui/Field';
import { IconButton } from '../components/ui/IconButton';

interface LogisticaViewProps {
  sales: Sale[];
  customers: Customer[];
  onUpdate: (sale: Sale) => void;
}

export const LogisticaView = ({ sales, customers, onUpdate }: LogisticaViewProps) => {
  const [selectedSales, setSelectedSales] = useState<string[]>([]);
  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [startAddress, setStartAddress] = useState('');

  const deliveries = useMemo(() => sales.filter(s => s.deliveryMethod === 'delivery' && s.status !== 'Entregue' && s.status !== 'Cancelada'), [sales]);

  // Fix: Reference 'saleId' instead of the undefined 'id' in the toggle logic
  const toggleSelection = (saleId: string) => {
    setSelectedSales(prev => prev.includes(saleId) ? prev.filter(id => id !== saleId) : [...prev, saleId]);
  };

  const generateMapsUrl = () => {
    if (selectedSales.length === 0 || !startAddress) {
      alert("Defina um ponto de partida e selecione ao menos uma entrega.");
      return;
    }
    const baseUrl = 'https://www.google.com/maps/dir/';
    const addresses = selectedSales.map(id => {
      const sale = deliveries.find(s => s.id === id);
      const customer = customers.find(c => c.id === sale?.customerId);
      return sale?.deliveryAddress || customer?.address || '';
    }).filter(Boolean);

    const waypoints = [startAddress, ...addresses].map(addr => encodeURIComponent(addr)).join('/');
    window.open(baseUrl + waypoints, '_blank');

    selectedSales.forEach(id => {
      const sale = sales.find(s => s.id === id);
      // Status 'A caminho' removido conforme solicitação
    });

    setSelectedSales([]);
    setIsRouteModalOpen(false);
  };

  const handleSaveAddress = (sale: Sale, newAddress: string) => {
    onUpdate({ ...sale, deliveryAddress: newAddress });
    setEditingSale(null);
  };

  const renderGroup = (title: string, groupSales: Sale[]) => (
    <div className="space-y-3">
      <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest">{title} ({groupSales.length})</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {groupSales.map(s => {
          const c = customers.find(cu => cu.id === s.customerId);
          return <DeliveryCard key={s.id} sale={s} customer={c} onUpdateStatus={(status: SaleStatus) => onUpdate({ ...s, status })} isSelected={selectedSales.includes(s.id)} onSelect={toggleSelection} onEditAddress={() => setEditingSale(s)} />
        })}
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fadeIn">
      {isRouteModalOpen && <RoutePlannerModal onGenerate={generateMapsUrl} onClose={() => setIsRouteModalOpen(false)} startAddress={startAddress} setStartAddress={setStartAddress} selectedCount={selectedSales.length} />}
      {editingSale && <AddressEditModal sale={editingSale} customer={customers.find(c => c.id === editingSale.customerId)} onClose={() => setEditingSale(null)} onSave={handleSaveAddress} />}

      <div className="flex justify-between items-center">
        <h2 className="text-lg font-black uppercase">Controle de Entregas</h2>
        <button disabled={selectedSales.length < 1} onClick={() => setIsRouteModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase flex items-center gap-2 shadow-md disabled:bg-slate-400 disabled:cursor-not-allowed">
          <Navigation size={12} /> Planejar Rota ({selectedSales.length})
        </button>
      </div>
      {renderGroup('Aguardando Rota', deliveries.filter(s => s.status === 'Aguardando Rota' || s.status === 'Pendente' || s.status === 'Aguardando Aprovação'))}

      {deliveries.length === 0 && <div className="col-span-full py-20 text-center opacity-30 text-[9px] font-black uppercase tracking-[5px]">Nenhuma entrega pendente</div>}
    </div>
  );
};

const DeliveryCard = ({ sale, customer, onUpdateStatus, isSelected, onSelect, onEditAddress }: any) => {
  const address = sale.deliveryAddress || customer?.address || 'Endereço não informado';

  const openMaps = () => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
  };

  return (
    <div className={`bg-white dark:bg-slate-900 border ${isSelected ? 'border-blue-500 shadow-lg' : 'dark:border-slate-800 shadow-sm'} rounded-xl p-4 space-y-3 transition-all`}>
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <input type="checkbox" checked={isSelected} onChange={() => onSelect(sale.id)} aria-label={`Selecionar entrega ${sale.saleNumber}`} title="Selecionar entrega" className="w-5 h-5 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0 cursor-pointer" />
          <div>
            <p className="text-[10px] font-black text-blue-600 uppercase">{sale.saleNumber}</p>
            <p className="text-xs font-black uppercase dark:text-white truncate max-w-[120px]">{customer?.name || 'Cliente N/A'}</p>
          </div>
        </div>
        <StatusDropdown sale={sale} onUpdateStatus={onUpdateStatus} />
      </div>
      <div className="group relative bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border dark:border-slate-800 transition-all hover:border-blue-400">
        <div className="flex items-start gap-2">
          <MapPin size={14} className="text-rose-500 shrink-0 mt-0.5" />
          <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 leading-tight flex-1">{address}</p>
        </div>
        <div className="flex justify-end gap-2 mt-2 pt-2 border-t dark:border-slate-700/50">
          <IconButton icon={<Search size={12} />} onClick={openMaps} title="Ver no Maps" color="blue" />
          <IconButton icon={<Edit2 size={12} />} onClick={onEditAddress} title="Alterar Endereço de Entrega" color="amber" />
        </div>
      </div>
    </div>
  )
};

const StatusDropdown = ({ sale, onUpdateStatus }: { sale: Sale, onUpdateStatus: (status: SaleStatus) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const statuses: SaleStatus[] = ['Aguardando Rota', 'Entregue'];


  const statusInfo: Record<SaleStatus, { label: string, icon: React.ReactNode, color: string }> = {
    'Aguardando Aprovação': { label: 'Aprovação', icon: <Clock size={12} />, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' },
    'Aguardando Estoque': { label: 'Sem Estoque', icon: <AlertTriangle size={12} />, color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20' },
    'Aguardando Rota': { label: 'Aguardando', icon: <Package size={12} />, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' },

    'Entregue': { label: 'Entregue', icon: <CheckCircle size={12} />, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' },
    'Pendente': { label: 'Pendente', icon: <Package size={12} />, color: 'text-slate-500 bg-slate-100' },
    'Em produção': { label: 'Produção', icon: <Package size={12} />, color: 'text-blue-400 bg-blue-50' },

    'Coletado': { label: 'Coletado', icon: <CheckCircle size={12} />, color: 'text-emerald-400 bg-emerald-50' },
    'Cancelada': { label: 'Cancelada', icon: <X size={12} />, color: 'text-rose-500 bg-rose-50' }
  }

  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)} className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px] font-black uppercase ${statusInfo[sale.status]?.color}`}>
        {statusInfo[sale.status]?.icon} {statusInfo[sale.status]?.label}
      </button>
      {isOpen && (
        <div className="absolute top-full right-0 mt-1 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg shadow-xl w-36 z-50 overflow-hidden">
          {statuses.map(s => (
            <button key={s} onClick={() => { onUpdateStatus(s); setIsOpen(false); }} className="w-full text-left px-3 py-2 text-[10px] font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">{statusInfo[s].label}</button>
          ))}
        </div>
      )}
    </div>
  )
}

const RoutePlannerModal = ({ onGenerate, onClose, startAddress, setStartAddress, selectedCount }: any) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl animate-slideUp overflow-hidden">
      <div className="p-4 border-b dark:border-slate-800 flex justify-between items-center bg-blue-600 text-white"><h3 className="text-sm font-black uppercase">Planejar Rota</h3><button onClick={onClose} aria-label="Fechar" title="Fechar"><X size={16} /></button></div>
      <div className="p-6 space-y-4"><p className="text-xs text-slate-500 font-semibold">Você selecionou <b className="text-blue-600">{selectedCount}</b> entregas. Defina o ponto de partida.</p><Field label="Endereço de Partida" placeholder="Ex: Rua da Empresa, 123, Cidade" value={startAddress} onChange={setStartAddress} /></div>
      <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl"><button onClick={onGenerate} className="w-full py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"><Navigation size={14} /> Gerar Rota no Google Maps</button></div>
    </div>
  </div>
);

const AddressEditModal = ({ sale, customer, onClose, onSave }: { sale: Sale, customer?: Customer, onClose: () => void, onSave: (sale: Sale, address: string) => void }) => {
  const [address, setAddress] = useState(sale.deliveryAddress || customer?.address || '');

  const openMaps = () => {
    if (!address) return alert("Endereço vazio.");
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl animate-slideUp">
        <div className="p-4 border-b dark:border-slate-800 flex justify-between items-center"><h3 className="text-sm font-black uppercase">Alterar Destino da Entrega</h3><button onClick={onClose} aria-label="Fechar" title="Fechar"><X size={16} /></button></div>
        <div className="p-6 space-y-4">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/10 rounded-lg text-[9px] font-bold text-blue-600 uppercase mb-2">Pedido: {sale.saleNumber} | Cliente: {customer?.name}</div>
          <Field
            label="Endereço Específico para esta Entrega"
            value={address}
            onChange={setAddress}
            placeholder="Digite o endereço completo ou ponto de referência"
            suffixIcon={<IconButton icon={<MapPin size={14} />} onClick={openMaps} color="blue" title="Validar no Maps" />}
          />
          <p className="text-[8px] text-slate-400 font-bold uppercase">* Alterar este endereço não mudará o cadastro fixo do cliente.</p>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl flex justify-end gap-2">
          <button onClick={onClose} className="px-6 py-2 text-[9px] font-bold uppercase text-slate-400">Cancelar</button>
          <button onClick={() => onSave(sale, address)} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-[9px] font-black uppercase shadow-md">Confirmar Novo Endereço</button>
        </div>
      </div>
    </div>
  )
}
