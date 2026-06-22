'use client';

import { useStore } from '@/lib/store';
import { BarChart, Bar, Cell, ResponsiveContainer, Tooltip, PieChart, Pie, Legend } from 'recharts';

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEK_DATA = [2, 4, 1, 6, 3, 0, 2];
const PEAK = Math.max(...WEEK_DATA);

const STATUS_PIE = [
  { name: 'Applied',   value: 18, color: '#3b82f6' },
  { name: 'Interview', value: 8,  color: '#f59e0b' },
  { name: 'Offer',     value: 2,  color: '#059669' },
  { name: 'Rejected',  value: 12, color: '#ef4444' },
  { name: 'Saved',     value: 6,  color: '#9ca3af' },
];

const FUNNEL = [
  { label: 'Applied',   count: 46, pct: 100, color: '#3b82f6' },
  { label: 'Response',  count: 18, pct: 39,  color: '#8b5cf6' },
  { label: 'Interview', count: 8,  pct: 17,  color: '#f59e0b' },
  { label: 'Offer',     count: 2,  pct: 4,   color: '#059669' },
];

export default function Analytics() {
  const { applications, darkMode } = useStore();

  const t = {
    p: darkMode ? '#f0ede9' : '#1a1917',
    s: darkMode ? '#b4bac4' : '#4b5563',
    m: darkMode ? '#8a8784' : '#9ca3af',
    d: darkMode ? 'rgba(255,255,255,0.09)' : '#ede9e4',
    card: darkMode ? '#1c1b19' : '#ffffff',
    inner: darkMode ? '#151413' : '#f9f7f5',
  };
  const cardStyle = { background: t.card, borderRadius: 14, padding: '20px 22px', border: `1px solid ${t.d}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' };

  const totalSent = applications.filter(a => a.status !== 'saved').length;
  const responded = applications.filter(a => ['interview', 'offer', 'rejected'].includes(a.status)).length;
  const responseRate = totalSent ? Math.round((responded / totalSent) * 100) : 0;
  const avgMatch = applications.length ? Math.round(applications.reduce((s, a) => s + a.match, 0) / applications.length) : 0;

  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeUp 0.25s ease' }}>
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: t.p, letterSpacing: '-0.7px', margin: 0 }}>Analytics</h1>
        <p style={{ fontSize: 14, color: t.s, margin: '6px 0 0' }}>Your job search performance at a glance.</p>
      </div>

      {/* 3 stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        <AnalyticCard label="Total Sent" value={totalSent} trend="+3 this week" trendUp darkMode={darkMode} pct={Math.min(100, totalSent * 2)} />
        <AnalyticCard label="Response Rate" value={`${responseRate}%`} trend={responseRate > 30 ? '↑ Above avg' : '↓ Keep applying'} trendUp={responseRate > 30} darkMode={darkMode} pct={responseRate} />
        <AnalyticCard label="Avg Match Score" value={`${avgMatch}%`} trend="Across all apps" trendUp={avgMatch >= 70} darkMode={darkMode} pct={avgMatch} />
      </div>

      {/* Charts grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Weekly bar chart */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: t.p, margin: '0 0 18px' }}>Applications This Week</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={WEEK_DAYS.map((day, i) => ({ day, count: WEEK_DATA[i] }))} barSize={28}>
              <Tooltip
                contentStyle={{ background: t.card, border: `1px solid ${t.d}`, borderRadius: 8, fontSize: 12, color: t.p }}
                cursor={{ fill: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {WEEK_DAYS.map((_, i) => (
                  <Cell key={i} fill={WEEK_DATA[i] === PEAK ? '#ec4899' : '#fce7f3'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Donut chart */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: t.p, margin: '0 0 18px' }}>Status Breakdown</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <PieChart width={140} height={140}>
              <Pie data={STATUS_PIE} cx={65} cy={65} innerRadius={42} outerRadius={64} dataKey="value" strokeWidth={2} stroke={t.card}>
                {STATUS_PIE.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
            </PieChart>
            <div style={{ flex: 1 }}>
              {STATUS_PIE.map(s => (
                <div key={s.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                    <span style={{ fontSize: 12, color: t.s }}>{s.name}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: t.p }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Funnel */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: t.p, margin: '0 0 18px' }}>Application Funnel</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {FUNNEL.map(row => (
            <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 80, fontSize: 12, fontWeight: 600, color: t.s }}>{row.label}</div>
              <div style={{ flex: 1, height: 24, background: t.inner, borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${row.pct}%`, background: row.color, borderRadius: 6, transition: 'width 0.8s ease', display: 'flex', alignItems: 'center', paddingLeft: 10 }}>
                  {row.pct > 15 && <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{row.count}</span>}
                </div>
              </div>
              <div style={{ width: 40, fontSize: 12, fontWeight: 700, color: t.p, textAlign: 'right' }}>{row.pct}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AnalyticCard({ label, value, trend, trendUp, darkMode, pct }: {
  label: string; value: string | number; trend: string; trendUp: boolean; darkMode: boolean; pct: number;
}) {
  const card = darkMode ? '#1c1b19' : '#ffffff';
  const border = darkMode ? 'rgba(255,255,255,0.09)' : '#ede9e4';
  const inner = darkMode ? '#151413' : '#f9f7f5';
  const textP = darkMode ? '#f0ede9' : '#1a1917';
  const textM = darkMode ? '#8a8784' : '#9ca3af';

  return (
    <div style={{ background: card, borderRadius: 14, padding: '20px 22px', border: `1px solid ${border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: textM, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 36, fontWeight: 800, color: textP, letterSpacing: '-1px', marginBottom: 8 }}>{value}</div>
      <div style={{ height: 4, background: inner, borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: '#ec4899', borderRadius: 2 }} />
      </div>
      <div style={{ fontSize: 12, fontWeight: 500, color: trendUp ? '#059669' : '#f59e0b' }}>{trend}</div>
    </div>
  );
}
