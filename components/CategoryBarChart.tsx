import React from 'react';
import { formatMoney } from '../lib/utils';

interface CategoryData {
    category: string;
    value: number;
    color: string;
}

interface CategoryBarChartProps {
    data: CategoryData[];
    title: string;
}

export const CategoryBarChart = ({ data, title }: CategoryBarChartProps) => {
    const total = data.reduce((acc, item) => acc + item.value, 0);

    if (total === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center opacity-40">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sem dados para exibir</p>
            </div>
        );
    }

    // Ordenar por valor para melhor visualização
    const sortedData = [...data].sort((a, b) => b.value - a.value);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-2">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{title}</h4>
                <span className="text-xs font-black text-slate-900 dark:text-white">R$ {formatMoney(total)}</span>
            </div>

            <div className="grid grid-cols-1 gap-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {sortedData.map((item, i) => {
                    const percentage = (item.value / total) * 100;

                    return (
                        <div key={i} className="group">
                            <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-2 h-2 rounded-full dynamic-bg"
                                        style={{ '--bg-color': item.color } as React.CSSProperties & { '--bg-color': string }}
                                    ></div>
                                    <span
                                        className="text-[10px] font-black uppercase"
                                        style={{ color: item.color }}
                                    >
                                        {item.category}
                                    </span>
                                </div>
                                <span className="text-[10px] font-black text-slate-900 dark:text-white">
                                    R$ {formatMoney(item.value)}
                                </span>
                            </div>

                            <div className="relative h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className="absolute inset-y-0 left-0 transition-all duration-1000 ease-out rounded-full dynamic-width dynamic-bg dynamic-shadow"
                                    style={{
                                        '--progress': `${percentage}%`,
                                        '--bg-color': item.color,
                                        '--shadow-color': `${item.color}40`
                                    } as React.CSSProperties & { '--progress': string, '--bg-color': string, '--shadow-color': string }}
                                ></div>
                            </div>

                            <div className="flex justify-end mt-1">
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">
                                    {percentage.toFixed(1)}% do total
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
