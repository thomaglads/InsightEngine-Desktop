import React, { useRef } from 'react';
import { X, Download, Share2, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

export const ExecutiveReport = ({ isOpen, onClose, data, file }) => {
    const reportRef = useRef(null);

    if (!isOpen || !data) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-8">
            {/* HEADER - No Print */}
            <style>{`
                  @media print {
                    @page { margin: 0; size: auto; }
                    body { visibility: hidden; }
                    .print-content { 
                      visibility: visible; 
                      position: absolute; 
                      left: 0; 
                      top: 0; 
                      width: 100%; 
                      height: 100%; 
                      overflow: visible !important;
                      margin: 0 !important;
                      padding: 20px !important;
                      background: white !important;
                      color: black !important;
                      z-index: 9999;
                    }
                    .no-print { display: none !important; }
                    /* Hide everything else */
                    div:not(.print-content):not(.print-content *) {
                      display: none;
                    }
                    /* Restore flex/grid inside print content */
                    .print-content div { display: block; }
                    .print-content .grid { display: grid; }
                    .print-content .flex { display: flex; }
                  }
                `}</style>
            <div className="flex items-center justify-between p-6 border-b border-zinc-200 no-print">
                <div>
                    <h2 className="text-2xl font-serif font-bold tracking-tight text-zinc-900">Executive Briefing</h2>
                    <p className="text-sm text-zinc-500 uppercas tracking-wider font-bold">Confidential • {new Date().toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => window.print()} className="px-4 py-2 text-sm font-bold bg-zinc-900 text-white rounded hover:bg-zinc-800 flex items-center gap-2">
                        <Download size={16} /> Print / PDF
                    </button>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>
            </div>

            {/* REPORT CONTENT (Printable Area) */}
            <div ref={reportRef} className="p-10 space-y-10 print:p-0 print:pt-4 print-content">

                {/* 1. TITLE SECTION */}
                <div className="border-b-4 border-black pb-6">
                    <h1 className="text-5xl font-serif font-black mb-2">{file.replace('.csv', '').toUpperCase()}</h1>
                    <p className="text-xl text-zinc-600 font-serif italic">Automated Strategic Analysis</p>
                </div>

                {/* 2. KPI CARDS */}
                <div className="grid grid-cols-3 gap-8">
                    {data.kpis.map((kpi, i) => (
                        <div key={i} className="p-6 bg-zinc-50 border border-zinc-200 rounded-lg print:border-black">
                            <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">{kpi.label}</span>
                            <div className="text-4xl font-bold mt-2 font-mono tracking-tighter">{kpi.value}</div>
                            <div className={`text-sm font-bold mt-2 flex items-center gap-1 ${kpi.trend === 'up' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {kpi.trend === 'up' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                {kpi.delta} vs Avg
                            </div>
                        </div>
                    ))}
                </div>

                {/* 3. EXECUTIVE SUMMARY (AI Text) */}
                <div className="prose prose-lg max-w-none">
                    <h3 className="text-xl font-bold uppercase tracking-widest border-b border-zinc-200 pb-2 mb-4">Strategic Assessment</h3>
                    <p className="text-zinc-700 leading-relaxed font-serif text-lg text-justify">
                        {data.summary}
                    </p>
                </div>

                {/* 4. KEY CHARTS */}
                <div className="grid grid-cols-2 gap-8 h-64 print:h-64 break-inside-avoid">
                    <div className="border border-zinc-200 p-4 rounded bg-white">
                        <h4 className="text-xs font-bold uppercase mb-4 text-zinc-500">Performance Trend</h4>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data.chartData}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#000" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#000" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                                <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                <Area type="monotone" dataKey="value" stroke="#000" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {/* 5. TOP PERFORMERS LIST */}
                    <div className="border border-zinc-200 p-6 rounded bg-zinc-900 text-white">
                        <h4 className="text-xs font-bold uppercase mb-6 text-zinc-400">Top Drivers</h4>
                        <ul className="space-y-4">
                            {data.topDrivers.map((item, i) => (
                                <li key={i} className="flex justify-between items-center bg-white/5 p-3 rounded">
                                    <span className="font-bold">{item.name}</span>
                                    <span className="font-mono text-emerald-400">{item.value}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* 6. DISCLAIMER */}
                <div className="pt-10 mt-10 border-t border-zinc-100 flex items-center gap-2 text-zinc-400 text-xs">
                    <AlertCircle size={12} />
                    Generated by InsightEngine Enterprise • AI Analysis may vary • {new Date().toISOString()}
                </div>

            </div>
        </div>
        </div >
    );
};
