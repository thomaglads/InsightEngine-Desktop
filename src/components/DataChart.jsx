import React from 'react';
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const DataChart = ({ data, type }) => {
    // 1. Safety Check
    if (!data || data.length === 0) {
        return <div style={{ padding: 20, color: '#ccc' }}>No data available to chart.</div>;
    }

    // 2. BRUTE FORCE CLEANING
    // We create a new dataset where every single value is checked.
    // If it looks like a number, it BECOMES a number.
    const cleanData = data.map(row => {
        const cleanRow = {};
        Object.keys(row).forEach(key => {
            const val = row[key];

            // Handle BigInt (DuckDB)
            if (typeof val === 'bigint') {
                cleanRow[key] = Number(val);
            }
            // Handle Strings that are actually numbers (e.g. "42")
            else if (typeof val === 'string' && !isNaN(val) && val.trim() !== '') {
                cleanRow[key] = parseFloat(val);
            }
            // Keep original if it's just text
            else {
                cleanRow[key] = val;
            }
        });
        return cleanRow;
    });

    // 3. Dumb Axis Detection (Fail-safe)
    const keys = Object.keys(cleanData[0]);

    // Find any column that is a String (for X-Axis)
    let xAxisKey = keys.find(k => typeof cleanData[0][k] === 'string');
    if (!xAxisKey) xAxisKey = keys[0]; // Fallback to first column

    // Find any column that is a Number (for Y-Axis)
    // We skip the xAxisKey so we don't chart the name against itself.
    let dataKey = keys.find(k => k !== xAxisKey && typeof cleanData[0][k] === 'number');

    // 4. Emergency Fallback
    // If we still didn't find a number column, force the 2nd column if it exists.
    if (!dataKey && keys.length > 1) {
        dataKey = keys[1];
    }

    // 5. Render Error if still failing
    if (!dataKey) {
        return (
            <div style={{ color: '#f38ba8', padding: '20px', border: '1px solid red', borderRadius: '8px', marginTop: '10px' }}>
                Error: Could not automatically detect a numeric column to chart.
                <br />
                Columns: {keys.join(', ')}
            </div>
        );
    }

    const ChartComponent = type === 'line' || type === 'LINE' ? LineChart : BarChart;
    const DataComponent = type === 'line' || type === 'LINE' ? Line : Bar;
    const color = type === 'line' || type === 'LINE' ? "#89b4fa" : "#a6e3a1"; // Blue or Green

    return (
        <div style={{ width: '100%', height: 350, marginTop: '20px', backgroundColor: '#1e1e2e', padding: '15px', borderRadius: '10px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#cdd6f4', fontSize: '14px', textAlign: 'center' }}>
                {xAxisKey} vs {dataKey}
            </h4>
            <ResponsiveContainer width="100%" height="100%">
                <ChartComponent data={cleanData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#45475a" />
                    <XAxis
                        dataKey={xAxisKey}
                        stroke="#cdd6f4"
                        tick={{ fill: '#cdd6f4', fontSize: 12 }}
                    />
                    <YAxis
                        stroke="#cdd6f4"
                        tick={{ fill: '#cdd6f4', fontSize: 12 }}
                    />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#1e1e2e', borderColor: '#45475a', color: '#cdd6f4' }}
                        itemStyle={{ color: '#cdd6f4' }}
                        cursor={{ fill: 'rgba(255, 255, 255, 0.1)' }}
                    />
                    <Legend />
                    <DataComponent
                        type="monotone"
                        dataKey={dataKey}
                        fill={color}
                        stroke={color}
                        strokeWidth={2}
                    />
                </ChartComponent>
            </ResponsiveContainer>
        </div>
    );
};

export default DataChart;
