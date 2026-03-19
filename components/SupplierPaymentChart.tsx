
import React from 'react';
import { Truck, Minus } from '@phosphor-icons/react';
import { formatMoney } from '../lib/utils';

interface SupplierPaymentData {
    supplierName: string;
    paid: number;
    pending: number;
}

interface SupplierPaymentChartProps {
    data: SupplierPaymentData[];
    title: string;
    onHide?: () => void;
}

export const SupplierPaymentChart = ({ data, title, onHide }: SupplierPaymentChartProps) => {
    return (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                    <Truck size={18} className="text-slate-400" />
                    <h3 className="text-sm font-black uppercase dark:text-white tracking-tight">{title}</h3>
                </div>
                {onHide && (
                    <button
                        onClick={onHide}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-all"
                        title="Ocultar Gráfico"
                    >
                        <Minus size={20} />
                    </button>
                )}
            </div>

            <div className="space-y-5">
                {data.sort((a, b) => (b.paid + b.pending) - (a.paid + a.pending)).slice(0, 10).map((item, idx) => {
                    const total = item.paid + item.pending;
                    const paidPercent = total > 0 ? (item.paid / total) * 100 : 0;

                    return (
                        <div key={idx} className="space-y-1.5">
                            <div className="flex justify-between items-end">
                                <span className="text-[10px] font-black uppercase dark:text-white truncate max-w-[180px]">{item.supplierName}</span>
                                <span className="text-[11px] font-black text-slate-500">R$ {formatMoney(total)}</span>
                            </div>
                            <div className="relative h-3 w-full bg-rose-100 dark:bg-rose-950/20 rounded-full overflow-hidden">
                                <div
                                    className="absolute h-full bg-emerald-500 transition-all duration-1000 dynamic-width"
                                    style={{ '--progress': `${paidPercent}%` } as any}
                                />
                            </div>
                            <div className="flex justify-between text-[8px] font-black uppercase">
                                <span className="text-emerald-600">Pago: R$ {formatMoney(item.paid)}</span>
                                <span className="text-rose-600">Pendente: R$ {formatMoney(item.pending)}</span>
                            </div>
                        </div>
                    );
                })}
                {data.length === 0 && (
                    <div className="py-12 text-center text-[10px] font-black uppercase text-slate-400 italic">
                        Nenhum pagamento registrado no período.
                    </div>
                )}
            </div>
        </div>
    );
};
