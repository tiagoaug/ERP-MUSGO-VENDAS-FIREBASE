import React from 'react';
import { formatMoney } from '../lib/utils';

interface CategoryData {
    category: string;
    value: number;
    color: string;
}

interface CategoryPieChartProps {
    data: CategoryData[];
    title: string;
}

export const CategoryPieChart = ({ data, title }: CategoryPieChartProps) => {
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

    let cumulativeAngle = 0;
    const radius = 70;
    const centerX = 100;
    const centerY = 100;

    const slices = sortedData.map((item, index) => {
        const percentage = (item.value / total) * 100;
        const angle = (item.value / total) * 360;

        // Cálculo das coordenadas SVG para o arco
        const startAngle = cumulativeAngle;
        const endAngle = cumulativeAngle + angle;

        // Converter graus para radianos
        const startRad = (startAngle - 90) * (Math.PI / 180);
        const endRad = (endAngle - 90) * (Math.PI / 180);

        const x1 = centerX + radius * Math.cos(startRad);
        const y1 = centerY + radius * Math.sin(startRad);
        const x2 = centerX + radius * Math.cos(endRad);
        const y2 = centerY + radius * Math.sin(endRad);

        const largeArcFlag = angle > 180 ? 1 : 0;

        const pathData = [
            `M ${centerX} ${centerY}`,
            `L ${x1} ${y1}`,
            `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
            'Z'
        ].join(' ');

        cumulativeAngle += angle;

        return {
            pathData,
            color: item.color,
            category: item.category,
            percentage: percentage.toFixed(1),
            value: item.value
        };
    });

    return (
        <div className="flex flex-col sm:flex-row items-center gap-8">
            {/* SVG do Gráfico */}
            <div className="relative w-40 h-40 sm:w-48 sm:h-48 shrink-0">
                <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-2xl">
                    {slices.map((slice, i) => (
                        <path
                            key={i}
                            d={slice.pathData}
                            fill={slice.color}
                            className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                        >
                            <title>{`${slice.category}: R$ ${formatMoney(slice.value)} (${slice.percentage}%)`}</title>
                        </path>
                    ))}
                    {/* Círculo central para efeito de Donut (opcional, mas premium) */}
                    <circle cx="100" cy="100" r="40" className="fill-white dark:fill-slate-900" />
                    <text
                        x="100"
                        y="105"
                        textAnchor="middle"
                        className="fill-slate-400 font-black text-[12px] uppercase"
                    >
                        Total
                    </text>
                </svg>
            </div>

            {/* Legenda */}
            <div className="flex-1 space-y-2 w-full">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">{title}</h4>
                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {slices.map((slice, i) => (
                        <div key={i} className="flex items-center justify-between group">
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full dynamic-bg" style={{ '--bg-color': slice.color } as any}></div>
                                <span className="text-[9px] font-black uppercase text-slate-600 dark:text-slate-300 truncate max-w-[120px]">
                                    {slice.category}
                                </span>
                            </div>
                            <div className="text-right">
                                <span className="text-[9px] font-black text-slate-400 group-hover:text-blue-500 transition-colors">
                                    {slice.percentage}%
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
