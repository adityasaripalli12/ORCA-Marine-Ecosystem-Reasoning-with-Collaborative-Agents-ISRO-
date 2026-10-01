import React, { useState } from 'react';
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, 
  Tooltip, CartesianGrid, ReferenceLine 
} from 'recharts';
import { Thermometer, Droplets, Wind, Sparkles, Activity } from 'lucide-react';

interface DepthRecord {
  depth_m: number;
  temperature_c: number | null;
  salinity_psu: number | null;
  oxygen_umol_kg: number | null;
  nitrate_umol_kg?: number | null;
  phosphate_umol_kg?: number | null;
  silicate_umol_kg?: number | null;
  ph?: number | null;
}

interface DepthProfileChartProps {
  data: DepthRecord[];
  seafloorDepthM: number;
  sourceLabel?: string;
  dataTypeLabel?: string;
}

type MetricType = 'temperature' | 'salinity' | 'oxygen' | 'nutrients';

export const DepthProfileChart: React.FC<DepthProfileChartProps> = ({
  data,
  seafloorDepthM,
  sourceLabel = 'NOAA World Ocean Atlas / Argo Climatology',
  dataTypeLabel = 'Gridded Hydrographic Profile'
}) => {
  const [metric, setMetric] = useState<MetricType>('temperature');

  if (!data || data.length === 0) {
    return (
      <div className="h-56 flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-center">
        <Activity className="w-8 h-8 text-slate-600 mb-2 animate-pulse" />
        <p className="text-xs font-semibold text-slate-400">Depth Profile Data Unavailable</p>
        <p className="text-[11px] text-slate-500 mt-1">Select an open ocean coordinate to view hydrographic profiles.</p>
      </div>
    );
  }

  // Format data for inverted Y-axis (surface 0m at top -> deep seafloor at bottom)
  const chartData = data.map((d) => ({
    ...d,
    invertedDepth: -d.depth_m,
    depthDisplay: `${d.depth_m} m`
  }));

  const getMetricConfig = () => {
    switch (metric) {
      case 'temperature':
        return {
          key: 'temperature_c',
          name: 'Temperature',
          unit: '°C',
          stroke: '#38bdf8',
          domain: ['dataMin - 1', 'dataMax + 1'],
          icon: Thermometer
        };
      case 'salinity':
        return {
          key: 'salinity_psu',
          name: 'Salinity',
          unit: 'PSU',
          stroke: '#34d399',
          domain: ['dataMin - 0.5', 'dataMax + 0.5'],
          icon: Droplets
        };
      case 'oxygen':
        return {
          key: 'oxygen_umol_kg',
          name: 'Dissolved Oxygen',
          unit: 'µmol/kg',
          stroke: '#f43f5e',
          domain: ['dataMin - 10', 'dataMax + 10'],
          icon: Wind
        };
      case 'nutrients':
        return {
          key: 'nitrate_umol_kg',
          name: 'Nitrate (NO₃)',
          unit: 'µmol/kg',
          stroke: '#a855f7',
          domain: [0, 'dataMax + 5'],
          icon: Sparkles
        };
    }
  };

  const config = getMetricConfig();

  return (
    <div className="space-y-3">
      {/* Metric Selector Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-900/80 border border-slate-800">
        <button
          onClick={() => setMetric('temperature')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
            metric === 'temperature'
              ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Thermometer className="w-3 h-3" /> Temp (°C)
        </button>

        <button
          onClick={() => setMetric('salinity')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
            metric === 'salinity'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Droplets className="w-3 h-3" /> Salinity (PSU)
        </button>

        <button
          onClick={() => setMetric('oxygen')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
            metric === 'oxygen'
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Wind className="w-3 h-3" /> Oxygen (µmol)
        </button>

        <button
          onClick={() => setMetric('nutrients')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
            metric === 'nutrients'
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Sparkles className="w-3 h-3" /> Nitrate (NO₃)
        </button>
      </div>

      {/* Chart Canvas */}
      <div className="h-60 w-full p-2 rounded-2xl bg-slate-950/70 border border-slate-800/80 relative">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            layout="vertical"
            margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={true} vertical={true} />
            <XAxis
              type="number"
              stroke="#64748b"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              domain={config.domain as any}
              unit={` ${config.unit}`}
            />
            <YAxis
              type="number"
              dataKey="invertedDepth"
              stroke="#64748b"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickFormatter={(val) => `${Math.abs(val)}m`}
              domain={[-seafloorDepthM, 0]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                borderColor: '#38bdf8',
                borderRadius: '12px',
                fontSize: '11px',
                color: '#f8fafc'
              }}
              formatter={(value: any) => [`${value} ${config.unit}`, config.name]}
              labelFormatter={(val) => `Depth: ${Math.abs(Number(val))} meters`}
            />
            <ReferenceLine y={-seafloorDepthM} stroke="#e11d48" strokeDasharray="4 4" label={{ value: 'Seafloor', fill: '#f43f5e', fontSize: 10, position: 'insideBottomRight' }} />
            <Line
              type="monotone"
              dataKey={config.key}
              stroke={config.stroke}
              strokeWidth={2.5}
              dot={{ r: 3, fill: config.stroke, strokeWidth: 1, stroke: '#0f172a' }}
              activeDot={{ r: 5, stroke: '#ffffff', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Scientific Metadata footer */}
      <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
        <span>Source: <strong className="text-slate-300">{sourceLabel}</strong></span>
        <span className="font-mono text-cyan-400 bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800/40">
          Type: {dataTypeLabel}
        </span>
      </div>
    </div>
  );
};
