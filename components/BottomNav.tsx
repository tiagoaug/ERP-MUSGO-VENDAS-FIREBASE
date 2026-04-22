import React, { useState, useEffect, useRef } from 'react';
import { ViewType } from '../types';
import {
    House, ClockCounterClockwise, ShoppingCart, ChartBar, Handshake, ShoppingBag,
    Users, AddressBook, Gear, Stack, Package, CurrencyDollar, ChartPie, CalendarBlank,
    ArrowsOutLineHorizontal, X, ListDashes, FloppyDisk, CaretRight, ShieldCheck
} from '@phosphor-icons/react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface BottomNavProps {
    currentView: ViewType;
    onNavigate: (view: ViewType) => void;
    onOpenMenu: () => void;
}

interface NavItemConfig {
    id: ViewType;
    icon: React.ElementType;
    label: string;
    colorClass: { text: string; bg: string; dot: string; };
}

const ALL_NAV_ITEMS: NavItemConfig[] = [
    { id: 'dashboard', icon: House, label: 'Início', colorClass: { text: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/30', dot: 'bg-indigo-600 dark:bg-indigo-400' } },
    { id: 'vendas', icon: ClockCounterClockwise, label: 'Vendas', colorClass: { text: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-900/30', dot: 'bg-cyan-600 dark:bg-cyan-400' } },
    { id: 'vender', icon: ShoppingCart, label: 'Vender', colorClass: { text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30', dot: 'bg-emerald-600 dark:bg-emerald-400' } },
    { id: 'financeiro', icon: ChartBar, label: 'Finan.', colorClass: { text: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/30', dot: 'bg-green-600 dark:bg-green-400' } },
    { id: 'compras', icon: ShoppingBag, label: 'Comp.', colorClass: { text: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-50 dark:bg-pink-900/30', dot: 'bg-pink-600 dark:bg-pink-400' } },
    { id: 'financeiro_pessoal', icon: ChartPie, label: 'Fin. Pes.', colorClass: { text: 'text-blue-500 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30', dot: 'bg-blue-500 dark:bg-blue-400' } },
    { id: 'cadastros', icon: Gear, label: 'Config.', colorClass: { text: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800', dot: 'bg-slate-600 dark:bg-slate-400' } },
    { id: 'produtos', icon: Stack, label: 'Produtos', colorClass: { text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/30', dot: 'bg-orange-600 dark:bg-orange-400' } },
    { id: 'estoque', icon: Package, label: 'Estoque', colorClass: { text: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/30', dot: 'bg-indigo-600 dark:bg-indigo-400' } },
    { id: 'recebimentos', icon: CurrencyDollar, label: 'Entradas', colorClass: { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/30', dot: 'bg-amber-600 dark:bg-amber-400' } },
    { id: 'clientes', icon: AddressBook, label: 'B.CLIENTES', colorClass: { text: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/30', dot: 'bg-red-600 dark:bg-red-400' } },
    { id: 'fornecedores', icon: AddressBook, label: 'B.FORN', colorClass: { text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30', dot: 'bg-emerald-600 dark:bg-emerald-400' } },
    { id: 'relacionamento', icon: Handshake, label: 'Hist. Cli.', colorClass: { text: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-900/30', dot: 'bg-rose-600 dark:bg-rose-400' } },
    { id: 'relacionamento_fornecedores', icon: Handshake, label: 'Hist. Forn.', colorClass: { text: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-900/30', dot: 'bg-teal-600 dark:bg-teal-400' } },
    { id: 'relatorios', icon: ChartPie, label: 'Relat.', colorClass: { text: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/30', dot: 'bg-purple-600 dark:bg-purple-400' } },
    { id: 'agenda', icon: CalendarBlank, label: 'Agenda', colorClass: { text: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-900/30', dot: 'bg-violet-600 dark:bg-violet-400' } },
    { id: 'backup', icon: ShieldCheck, label: 'Backup', colorClass: { text: 'text-cyan-700 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-900/30', dot: 'bg-cyan-600 dark:bg-cyan-400' } }
];

const DEFAULT_ORDER = ALL_NAV_ITEMS.map(i => i.id);

export const BottomNav = ({ currentView, onNavigate, onOpenMenu }: BottomNavProps) => {
    const [orderedItems, setOrderedItems] = useState<NavItemConfig[]>([]);
    const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [showRightGradient, setShowRightGradient] = useState(true);
    const [showLeftGradient, setShowLeftGradient] = useState(false);

    useEffect(() => {
        const savedOrder = localStorage.getItem('bottomNavOrder');
        if (savedOrder) {
            try {
                const orderIds: ViewType[] = JSON.parse(savedOrder);
                const sorted = [...ALL_NAV_ITEMS].sort((a, b) => {
                    let indexA = orderIds.indexOf(a.id);
                    let indexB = orderIds.indexOf(b.id);
                    if (indexA === -1) indexA = 999;
                    if (indexB === -1) indexB = 999;
                    return indexA - indexB;
                });
                setOrderedItems(sorted);
            } catch (e) {
                setOrderedItems(ALL_NAV_ITEMS);
            }
        } else {
            setOrderedItems(ALL_NAV_ITEMS);
        }
    }, []);

    const handleScroll = () => {
        if (!scrollContainerRef.current) return;
        const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
        setShowLeftGradient(scrollLeft > 10);
        setShowRightGradient(Math.ceil(scrollLeft + clientWidth) < scrollWidth - 10);
    };

    useEffect(() => {
        handleScroll();
        window.addEventListener('resize', handleScroll);
        return () => window.removeEventListener('resize', handleScroll);
    }, [orderedItems]);

    const handleDragEnd = (result: DropResult) => {
        if (!result.destination) return;
        const items = Array.from(orderedItems);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);
        setOrderedItems(items);
    };

    const saveOrder = () => {
        const ids = orderedItems.map(i => i.id);
        localStorage.setItem('bottomNavOrder', JSON.stringify(ids));
        setIsReorderModalOpen(false);
    };

    const isActive = (views: ViewType[]) => views.includes(currentView);

    return (
        <>
            <nav
                className="lg:hidden fixed bottom-6 left-6 right-6 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 flex items-center h-20 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] animate-slideUp overflow-hidden"
                aria-label="Navegação principal"
            >
                {/* Indicadores de Rolagem */}
                {showLeftGradient && (
                    <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white dark:from-slate-900 to-transparent z-10 pointer-events-none rounded-l-[2.5rem]" />
                )}
                {showRightGradient && (
                    <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-white dark:from-slate-900 to-transparent z-10 pointer-events-none rounded-r-[2.5rem] flex items-center justify-end pr-2">
                        <CaretRight size={16} weight="bold" className="text-slate-400/50 animate-pulse" />
                    </div>
                )}

                <div
                    ref={scrollContainerRef}
                    onScroll={handleScroll}
                    className="flex-1 flex items-center h-full overflow-x-auto custom-scrollbar-hide px-2 scroll-smooth"
                >
                    <div className="flex items-center h-full min-w-max">
                        {orderedItems.map((item) => {
                            const active = isActive([item.id]);
                            const Icon = item.icon;
                            return (
                                <button
                                    key={item.id}
                                    title={item.label}
                                    onClick={() => onNavigate(item.id)}
                                    className={`relative flex flex-col items-center justify-center w-[60px] sm:w-[64px] h-full gap-0.5 sm:gap-1 transition-all duration-200 active:scale-95 shrink-0 ${active ? item.colorClass.text : item.colorClass.text + ' opacity-70 hover:opacity-100'}`}
                                >
                                    <div className="relative">
                                        <div className={`p-2 rounded-2xl transition-all duration-300 ${active ? item.colorClass.bg + ' shadow-sm' : 'hover:bg-slate-50 dark:hover:bg-slate-800/20'}`}>
                                            <div className={`${active ? 'scale-110' : 'scale-100'} transition-transform duration-300`}>
                                                <Icon size={22} weight={active ? 'fill' : 'duotone'} />
                                            </div>
                                        </div>
                                    </div>
                                    <span className={`text-[8px] uppercase font-black tracking-widest leading-none transition-all duration-300 ${active ? item.colorClass.text + ' opacity-100' : item.colorClass.text + ' opacity-70'}`}>
                                        {item.label}
                                    </span>
                                    {active && (
                                        <div className={`absolute bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 ${item.colorClass.dot} rounded-full flex shrink-0`} />
                                    )}
                                </button>
                            );
                        })}
                        {/* Botão para organizar */}
                        <button
                            onClick={() => setIsReorderModalOpen(true)}
                            className="flex shrink-0 items-center justify-center w-12 h-12 mr-4 ml-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors z-20 shadow-sm border border-slate-200/50 dark:border-slate-700/50"
                            title="Organizar Menu"
                        >
                            <ArrowsOutLineHorizontal size={20} weight="duotone" />
                        </button>
                    </div>
                </div>
            </nav>

            {/* Modal de Reordenação */}
            {isReorderModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-fadeIn" onClick={() => setIsReorderModalOpen(false)}>
                    <div
                        className="bg-white dark:bg-slate-900 w-full sm:w-[400px] sm:rounded-[2rem] rounded-t-[2rem] flex flex-col max-h-[85vh] shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-slate-200 dark:border-slate-800 animate-slideUp"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">Organizar Menu</h3>
                                <p className="text-[11px] text-slate-500 mt-0.5">Arraste para definir a ordem dos ícones na barra.</p>
                            </div>
                            <button onClick={() => setIsReorderModalOpen(false)} title="Fechar" className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                <X size={20} weight="bold" />
                            </button>
                        </div>

                        <div className="p-4 overflow-y-auto flex-1 custom-scrollbar">
                            <DragDropContext onDragEnd={handleDragEnd}>
                                <Droppable droppableId="nav-items">
                                    {(provided) => (
                                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                                            {orderedItems.map((item, index) => {
                                                const Icon = item.icon;
                                                return (
                                                    <Draggable key={item.id} draggableId={item.id} index={index}>
                                                        {(provided, snapshot) => (
                                                            <div
                                                                ref={provided.innerRef}
                                                                title={item.label}
                                                                {...provided.draggableProps}
                                                                {...provided.dragHandleProps}
                                                                className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${snapshot.isDragging
                                                                    ? 'bg-blue-50 border-blue-200 shadow-xl scale-[1.02] dark:bg-blue-900/20 dark:border-blue-800/50'
                                                                    : 'bg-white border-slate-100 dark:bg-slate-800/50 dark:border-slate-700/50'
                                                                    }`}
                                                            >
                                                                <ListDashes size={20} className="text-slate-300 dark:text-slate-600 shrink-0 cursor-grab active:cursor-grabbing" weight="bold" />

                                                                <div className={`w-10 h-10 rounded-xl ${item.colorClass.bg} flex items-center justify-center shrink-0`}>
                                                                    <Icon size={20} weight="duotone" className={item.colorClass.text} />
                                                                </div>

                                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">{item.label}</span>
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                )
                                            })}
                                            {provided.placeholder}
                                        </div>
                                    )}
                                </Droppable>
                            </DragDropContext>
                        </div>

                        <div className="p-5 border-t border-slate-100 dark:border-slate-800 shrink-0">
                            <button
                                onClick={saveOrder}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest rounded-xl py-4 flex items-center justify-center gap-2 transition-colors active:scale-95 shadow-lg shadow-blue-600/20"
                            >
                                <FloppyDisk size={18} weight="fill" /> Salvar Ordem
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
