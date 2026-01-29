import React from 'react';
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';

const DataChart = ({ data }) => {
    if (!data || data.length === 0) return (
        <div className="h-full flex items-center justify-center text-zinc-500 tracking-widest text-xs uppercase">
            No Data Available
        </div>
    );

    // 1. DYNAMIC KEYS
    const keys = Object.keys(data[0]);
    if (keys.length < 2) return <div className="text-red-500">Data must have at least 2 columns</div>;

    const nameKey = keys[0];
    const rawValueKey = keys[1];

    // 2. DATA SANITIZER (The Fix)
    // DuckDB returns "BigInt" (huge numbers) that break charts. We force them to standard Numbers.
    const cleanData = data.map(item => {
        const val = item[rawValueKey];
        return {
            ...item,
            [rawValueKey]: typeof val === 'bigint' ? Number(val) : Number(val) // Force Number
        };
    });

    // 3. AUTO-CHART TYPE
    // If we have > 15 points, use a Line Chart. Otherwise, Bar Chart.
    const ChartComponent = cleanData.length > 15 ? LineChart : BarChart;

    return (
        <ResponsiveContainer width="100%" height="100%">
            <ChartComponent
                data={cleanData}
                // Big margins for labels
                margin={{ top: 40, right: 30, left: 20, bottom: 100 }}
            >
                <CartesianGrid strokeDasharray="3 3" stroke="#333333" vertical={false} />

                <XAxis
                    dataKey={nameKey}
                    stroke="#888888"
                    tick={{ fill: '#e4e4e7', fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    angle={-45}
                    textAnchor="end"
                    interval={0}
                />

                <YAxis
                    stroke="#888888"
                    tick={{ fill: '#e4e4e7', fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}`}
                />

                <Tooltip
                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                    cursor={{ fill: 'rgba(255, 255, 255, 0.1)' }}
                />

                <Legend
                    verticalAlign="top"
                    align="center"
                    height={36}
                    iconType="circle"
                />

                {ChartComponent === BarChart ? (
                    <Bar dataKey={rawValueKey} fill="#EAB308" radius={[4, 4, 0, 0]} barSize={50}>
                        {cleanData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#EAB308' : '#CA8A04'} />
                        ))}
                    </Bar>
                ) : (
                    <Line
                        type="monotone"
                        dataKey={rawValueKey}
                        stroke="#EAB308"
                        strokeWidth={3}
                        dot={{ r: 4, fill: '#EAB308', strokeWidth: 2 }}
                        activeDot={{ r: 8 }}
                    />
                )}
            </ChartComponent>
        </ResponsiveContainer>
    );
};

export default DataChart;
