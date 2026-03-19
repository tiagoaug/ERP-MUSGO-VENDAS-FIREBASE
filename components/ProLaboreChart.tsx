import React from 'react';
import { CaretUp, CaretDown, Minus, EyeSlash } from '@phosphor-icons/react';
import { formatMoney } from '../lib/utils';

interface ProLaboreChartProps {
    withdrawals: number;
    companyCash: number;
    prevWithdrawals: number;
    title?: string;
    onHide?: () => void;
    isBlurred?: boolean;
}

export const ProLaboreChart = ({
    withdrawals,
    companyCash,
    prevWithdrawals,
    title = "Pró-labore vs Caixa",
    onHide,
    isBlurred = false
}: ProLaboreChartProps) => {

    const diff = withdrawals - prevWithdrawals;
    const percent = prevWithdrawals > 0 ? (diff / prevWithdrawals) * 100 : (withdrawals > 0 ? 100 : 0);
    const isIncrease = diff > 0;

    // Total reference to calculate the bar percentage. We use cash + withdrawals to show the proportion.
    const totalRef = Math.max(companyCash + withdrawals, 1);
    const withdrawalPercent = (withdrawals / totalRef) * 100;
    const cashPercent = (companyCash / totalRef) * 100;

    return (
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-[2rem] border dark:border-slate-800 shadow-sm flex flex-col justify-center h-full transition-all hover:border-blue-200 dark:hover:border-blue-900/50 relative group">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xs font-black uppercase text-blue-600 dark:text-blue-400 tracking-widest">{title}</h3>
                {onHide && (
                    <button
                        onClick={onHide}
                        className="text-slate-400 hover:text-slate-600 transition-colors relative z-20"
                        title="Ocultar Gráfico"
                    >
                        <EyeSlash size={18} />
                    </button>
                )}
            </div>

            <div className={`space-y-4 relative z-20 transition-all duration-300 ${isBlurred ? 'blur-md select-none opacity-50' : ''}`}>
                <div className="flex justify-between items-end">
                    <span className="text-[10px] font-black uppercase text-slate-400">Total Retirado</span>
                    <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-black flex items-center gap-0.5 ${diff === 0 ? 'text-slate-400' : isIncrease ? 'text-rose-500' : 'text-emerald-500'}`}>
                            {diff === 0 ? <Minus size={10} /> : isIncrease ? <CaretUp size={10} weight="fill" /> : <CaretDown size={10} weight="fill" />}
                            {diff !== 0 && `${Math.abs(percent).toFixed(1)}%`}
                        </span>
                        <span className="text-sm font-black dark:text-white">R$ {formatMoney(withdrawals)}</span>
                    </div>
                </div>

                <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-full flex overflow-hidden">
                    <div
                        className="bg-blue-500 transition-all dynamic-width relative group/tooltip"
                        style={{ '--progress': `${Math.max(0, Math.min(100, cashPercent))}%` } as React.CSSProperties & { '--progress': string }}
                    />
                    <div
                        className="bg-rose-500 transition-all dynamic-width relative group/tooltip"
                        style={{ '--progress': `${Math.max(0, Math.min(100, withdrawalPercent))}%` } as React.CSSProperties & { '--progress': string }}
                    />
                </div>

                <div className="flex justify-between pt-1">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black uppercase text-slate-400">Caixa Atual ({Math.round(cashPercent)}%)</span>
                            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">R$ {formatMoney(companyCash)}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-rose-500 rounded-sm"></div>
                        <div className="flex flex-col items-end">
                            <span className="text-[9px] font-black uppercase text-slate-400">Retiradas ({Math.round(withdrawalPercent)}%)</span>
                            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">R$ {formatMoney(withdrawals)}</span>
                        </div>
                    </div>
                </div>

                <div className="flex justify-between text-[8px] font-bold text-slate-400 uppercase pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span>Período Anter.: R$ {formatMoney(prevWithdrawals)}</span>
                    <span>Diferença: R$ {formatMoney(diff)}</span>
                </div>
            </div>
        </div>
    );
};
