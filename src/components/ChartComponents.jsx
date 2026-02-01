import React from 'react';

export const CustomTooltip = ({ active, payload, label, highContrast }) => {
    if (active && payload && payload.length) {
        return (
            <div className={`
        border rounded-lg shadow-xl p-4 backdrop-blur-md
        ${highContrast
                    ? 'bg-black border-white text-white'
                    : 'bg-zinc-900/90 border-zinc-700 text-zinc-100'}
      `}>
                <p className={`font-bold mb-2 ${highContrast ? 'text-yellow-400' : 'text-zinc-400'}`}>
                    {label}
                </p>
                {payload.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                        <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: highContrast ? '#FFFF00' : entry.color }}
                        />
                        <span className="font-mono font-bold">
                            {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};
