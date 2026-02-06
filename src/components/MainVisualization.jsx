import React, { memo } from 'react';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, AreaChart, Area } from 'recharts';

/**
 * MainVisualization - The "Soda" Upgrade
 * 
 * Uses React.memo() to prevent re-renders when the user types in the chat input.
 * Only re-renders when `chartData` or `highContrast` actually changes.
 */
const MainVisualization = memo(({ chartData, highContrast, onGenerateReport, isGeneratingReport }) => {
    console.log("MainVisualization Render Check: ", chartData ? "Data Present" : "No Data");

    if (!chartData) {
        return (
            <div className="flex-1 flex items-center justify-center text-gray-400 flex-col gap-4">
                <div className={`p-6 rounded-full ${highContrast ? 'bg-gray-800' : 'bg-gray-100'} animate-pulse`}>
                    <svg className="w-16 h-16 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                </div>
                <p className="font-medium">Ready to Visualize</p>
                <p className="text-sm opacity-70">Upload data to begin discovery</p>
            </div>
        );
    }

    // Determine chart type based on data shape
    const isTimeBased = chartData.data.some(d => {
        const key = Object.keys(d)[0];
        return key.toLowerCase().includes('date') || key.toLowerCase().includes('year') || key.toLowerCase().includes('month');
    });

    const ChartComponent = isTimeBased ? AreaChart : BarChart;
    const DataComponent = isTimeBased ? Area : Bar;

    // Dynamic color palette
    const colors = [
        highContrast ? '#FFD700' : '#8884d8', // Primary
        '#82ca9d',
        '#ffc658',
        '#ff7300'
    ];

    return (
        <div className="flex-1 p-6 overflow-hidden flex flex-col relative">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className={`text-2xl font-bold ${highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
                        {chartData.title || "Analysis Results"}
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">
                        {chartData.data.length} records analyzed • {isTimeBased ? 'Time Series' : 'Categorical'} Distribution
                    </p>
                </div>
                {onGenerateReport && (
                    <button
                        onClick={onGenerateReport}
                        disabled={isGeneratingReport}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${highContrast
                                ? 'bg-yellow-400 text-black hover:bg-yellow-300'
                                : 'bg-black text-white hover:bg-gray-800'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        {isGeneratingReport ? (
                            <>
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                <span>Generating...</span>
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span>Export Report</span>
                            </>
                        )}
                    </button>
                )}
            </div>

            <Card className={`flex-1 flex flex-col border-0 shadow-lg ${highContrast ? 'bg-gray-900' : 'bg-white'}`}>
                <CardContent className="flex-1 p-6 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <ChartComponent data={chartData.data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={highContrast ? '#374151' : '#E5E7EB'} vertical={false} />
                            <XAxis
                                dataKey={Object.keys(chartData.data[0])[0]}
                                stroke={highContrast ? '#9CA3AF' : '#6B7280'}
                                tick={{ fill: highContrast ? '#D1D5DB' : '#4B5563' }}
                                tickLine={false}
                                axisLine={false}
                                dy={10}
                                // Truncate long labels
                                tickFormatter={(value) => String(value).length > 15 ? String(value).substring(0, 12) + '...' : value}
                            />
                            <YAxis
                                stroke={highContrast ? '#9CA3AF' : '#6B7280'}
                                tick={{ fill: highContrast ? '#D1D5DB' : '#4B5563' }}
                                tickLine={false}
                                axisLine={false}
                                dx={-10}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: highContrast ? '#1F2937' : '#FFFFFF',
                                    borderColor: highContrast ? '#374151' : '#E5E7EB',
                                    borderRadius: '8px',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                    color: highContrast ? '#F3F4F6' : '#111827'
                                }}
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} />

                            {Object.keys(chartData.data[0]).slice(1).map((key, index) => (
                                <DataComponent
                                    key={key}
                                    type="monotone"
                                    dataKey={key}
                                    stroke={colors[index % colors.length]}
                                    fill={isTimeBased ? `url(#color${index})` : colors[index % colors.length]}
                                    strokeWidth={2}
                                    animationDuration={1500}
                                />
                            ))}

                            {/* Gradients for Area Charts */}
                            {isTimeBased && (
                                <defs>
                                    {Object.keys(chartData.data[0]).slice(1).map((key, index) => (
                                        <linearGradient key={`color${index}`} id={`color${index}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={colors[index % colors.length]} stopOpacity={0.3} />
                                            <stop offset="95%" stopColor={colors[index % colors.length]} stopOpacity={0} />
                                        </linearGradient>
                                    ))}
                                </defs>
                            )}
                        </ChartComponent>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Prediction Badge */}
            {chartData.isPrediction && (
                <div className="absolute top-8 right-8 pointer-events-none">
                    <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg flex items-center gap-2 ${highContrast ? 'bg-yellow-400 text-black' : 'bg-indigo-600 text-white'
                        }`}>
                        <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
                        AI Forecast
                    </div>
                </div>
            )}
        </div>
    );
});

export default MainVisualization;
