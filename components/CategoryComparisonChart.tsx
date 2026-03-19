
import React from 'react';
import { CaretUp, CaretDown, Minus } from '@phosphor-icons/react';
import { formatMoney } from '../lib/utils';

interface CategoryComparisonData {
    category: string;
    value: number;
    prevValue: number;
    color: string;
}

interface CategoryComparisonChartProps {
    data: CategoryComparisonData[];
    title: string;
    onHide?: () => void;
}

export const CategoryComparisonChart = ({ data, title, onHide }: CategoryComparisonChartProps) => {
    return (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-black uppercase dark:text-white tracking-tight">{title}</h3>
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

            <div className="space-y-4">
                {data.filter(d => d.value > 0 || d.prevValue > 0).sort((a, b) => b.value - a.value).map((item, idx) => {
                    const diff = item.value - item.prevValue;
                    const percent = item.prevValue > 0 ? (diff / item.prevValue) * 100 : 100;
                    const isIncrease = diff > 0;

                    return (
                        <div key={idx} className="space-y-1.5">
                            <div className="flex justify-between items-end">
                                <span
                                    className="text-[10px] font-black uppercase truncate max-w-[150px]"
                                    style={{ color: item.color }}
                                >
                                    {item.category}
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className={`text-[9px] font-black flex items-center gap-0.5 ${diff === 0 ? 'text-slate-400' : isIncrease ? 'text-rose-500' : 'text-emerald-500'}`}>
                                        {diff === 0 ? <Minus size={10} /> : isIncrease ? <CaretUp size={10} weight="fill" /> : <CaretDown size={10} weight="fill" />}
                                        {diff !== 0 && `${Math.abs(percent).toFixed(1)}%`}
                                    </span>
                                    <span className="text-[11px] font-black dark:text-white">R$ {formatMoney(item.value)}</span>
                                </div>
                            </div>
                            <div className="relative h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className="absolute h-full rounded-full transition-all duration-1000 dynamic-width dynamic-bg"
                                    style={{
                                        '--bg-color': item.color,
                                        '--progress': `${Math.min(100, (item.value / Math.max(...data.map(d => d.value))) * 100)}%`
                                    } as React.CSSProperties & { '--progress': string, '--bg-color': string }}
                                />
                            </div>
                            <div className="flex justify-between text-[8px] font-bold text-slate-400 uppercase">
                                <span>Anterior: R$ {formatMoney(item.prevValue)}</span>
                                <span>Dif: R$ {formatMoney(diff)}</span>
                            </div>
                        </div>
                    );
                })}
                {data.length === 0 && (
                    <div className="py-12 text-center text-[10px] font-black uppercase text-slate-400 italic">
                        Nenhuma despesa registrada no período.
                    </div>
                )}
            </div>
        </div>
    );
};
