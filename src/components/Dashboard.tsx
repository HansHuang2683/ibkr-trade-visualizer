import { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { ClosedTrade } from '../types';
import { DailyStat, OverallStats } from '../utils/statistics';
import DailyPnLTable from './DailyPnLTable';
import DailyPnLCalendar from './DailyPnLCalendar';
import MetricTooltip from './MetricTooltip';
import {
    Activity, Target, ListTodo, Calendar as CalendarIcon, List as ListIcon,
    Scale, TrendingDown, Clock, Zap
} from 'lucide-react';
import { Translation } from '../i18n';

interface Props {
    closedTrades: ClosedTrade[];
    dailyStats: DailyStat[];
    overallStats: OverallStats;
    t: Translation;
}

const Dashboard: React.FC<Props> = ({ dailyStats, overallStats, t }) => {
    const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
    const [focusedDate, setFocusedDate] = useState<string | null>(null);
    const [focusRequestId, setFocusRequestId] = useState(0);
    const formatCurrency = (value: number) => `${value < 0 ? '-' : ''}$${Math.abs(value).toFixed(2)}`;
    const drawdownStartLabel = overallStats.maxDrawdownStartDate ?? t.startOfPeriod;
    const drawdownEndLabel = overallStats.maxDrawdownEndDate ?? t.drawdownNoRange;
    const winHoldTime = overallStats.holdTimeWinSamples > 0
        ? `${Math.round(overallStats.avgHoldTimeWin)}m`
        : t.unavailable;

    const dailyBarEvents = {
        click: (params: { name?: string }) => {
            if (!params.name) return;
            setFocusedDate(params.name);
            setFocusRequestId(id => id + 1);
            setViewMode('table');
        }
    };
    const lossHoldTime = overallStats.holdTimeLossSamples > 0
        ? `${Math.round(overallStats.avgHoldTimeLoss)}m`
        : t.unavailable;

    const equityChartOptions = useMemo(() => {
        // We want the equity curve to go forward in time. dailyStats is descending.
        // Let's build a chronological array
        const chronologicalStats = [...dailyStats].reverse();

        let cumulative = 0;
        const xAxisData: string[] = [];
        const seriesData: number[] = [];

        // Optionally include a starting point
        // xAxisData.push('Start');
        // seriesData.push(0);

        chronologicalStats.forEach(day => {
            cumulative += day.netPnL;
            xAxisData.push(day.dateStr);
            seriesData.push(cumulative);
        });

        return {
            tooltip: {
                trigger: 'axis',
                backgroundColor: 'rgba(19, 20, 24, 0.9)',
                borderColor: '#2962ff',
                textStyle: { color: '#f0f0f2' },
                axisPointer: { type: 'cross', label: { backgroundColor: '#2962ff' } },
                valueFormatter: (value: any) => `$${Number(value).toFixed(2)}`
            },
            dataZoom: [
                { type: 'inside', xAxisIndex: 0, filterMode: 'filter' },
                { type: 'slider', xAxisIndex: 0, filterMode: 'filter', bottom: 0, height: 20, textStyle: { color: '#a0a0ab' } }
            ],
            grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: xAxisData,
                axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.2)' } },
                splitLine: { show: false }
            },
            yAxis: {
                type: 'value',
                axisLine: { show: false },
                splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } },
            },
            series: [
                {
                    name: t.cumulativePnl,
                    type: 'line',
                    smooth: true,
                    symbol: 'none',
                    lineStyle: {
                        color: '#2962ff',
                        width: 2,
                        shadowColor: 'rgba(41, 98, 255, 0.5)',
                        shadowBlur: 10
                    },
                    areaStyle: {
                        color: {
                            type: 'linear',
                            x: 0, y: 0, x2: 0, y2: 1,
                            colorStops: [
                                { offset: 0, color: 'rgba(41, 98, 255, 0.4)' },
                                { offset: 1, color: 'rgba(41, 98, 255, 0)' }
                            ]
                        }
                    },
                    data: seriesData
                }
            ]
        };
    }, [dailyStats, t.cumulativePnl]);

    const dailyBarOptions = useMemo(() => {
        const chronologicalStats = [...dailyStats].reverse();
        const xAxisData = chronologicalStats.map(d => d.dateStr);
        const seriesData = chronologicalStats.map(d => ({
            value: d.netPnL,
            itemStyle: { color: d.netPnL >= 0 ? '#0ecb81' : '#f6465d' }
        }));

        return {
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                backgroundColor: 'rgba(19, 20, 24, 0.9)',
                textStyle: { color: '#f0f0f2' },
                borderWidth: 0,
                valueFormatter: (value: any) => `$${Number(value).toFixed(2)}`
            },
            dataZoom: [
                { type: 'inside', xAxisIndex: 0, filterMode: 'filter' },
                { type: 'slider', xAxisIndex: 0, filterMode: 'filter', bottom: 0, height: 20, textStyle: { color: '#a0a0ab' } }
            ],
            grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
            xAxis: {
                type: 'category',
                data: xAxisData,
                axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.2)' } },
            },
            yAxis: {
                type: 'value',
                splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } }
            },
            series: [
                {
                    name: t.dailyNetPnl,
                    type: 'bar',
                    data: seriesData,
                    barMaxWidth: 30,
                    itemStyle: { borderRadius: [4, 4, 0, 0] }
                }
            ]
        };
    }, [dailyStats, t.dailyNetPnl]);

    return (
        <div className="dashboard">
            <div className="kpi-grid">
                <MetricTooltip
                    title={t.winRate}
                    description={t.winRateDesc}
                    metrics={[
                        { label: t.good, value: t.excellentWinRate, color: 'green' },
                        { label: t.normal, value: t.neutralWinRate, color: 'yellow' },
                        { label: t.weak, value: t.poorWinRate, color: 'red' }
                    ]}
                >
                    <div className="kpi-card">
                        <div className="kpi-icon"><Activity size={24} color="#0ecb81" /></div>
                        <div className="kpi-info">
                            <span className="text-muted text-sm">{t.winRate}</span>
                            <h3>{overallStats.winRate.toFixed(1)}%</h3>
                        </div>
                    </div>
                </MetricTooltip>

                <MetricTooltip
                    title={t.profitFactor}
                    description={t.profitFactorDesc}
                    metrics={[
                        { label: t.good, value: t.excellentProfitFactor, color: 'green' },
                        { label: t.normal, value: t.neutralProfitFactor, color: 'yellow' },
                        { label: t.weak, value: t.poorProfitFactor, color: 'red' }
                    ]}
                >
                    <div className="kpi-card">
                        <div className="kpi-icon"><Target size={24} color="#2962ff" /></div>
                        <div className="kpi-info">
                            <span className="text-muted text-sm">{t.profitFactor}</span>
                            <h3>{overallStats.profitFactor === Infinity ? '∞' : overallStats.profitFactor.toFixed(2)}</h3>
                        </div>
                    </div>
                </MetricTooltip>

                <MetricTooltip
                    title={t.averageRR}
                    description={t.averageRRDesc}
                    metrics={[
                        { label: t.good, value: t.excellentRR, color: 'green' },
                        { label: t.normal, value: t.neutralRR, color: 'yellow' },
                        { label: t.weak, value: t.poorRR, color: 'red' }
                    ]}
                >
                    <div className="kpi-card">
                        <div className="kpi-icon"><Scale size={24} color="#f0bb33" /></div>
                        <div className="kpi-info">
                            <span className="text-muted text-sm">{t.averageRR}</span>
                            <h3>1 : {overallStats.averageRR === Infinity ? '∞' : overallStats.averageRR.toFixed(2)}</h3>
                        </div>
                    </div>
                </MetricTooltip>

                <MetricTooltip
                    title={t.maxDrawdown}
                    description={t.maxDrawdownDesc}
                    metrics={[
                        { label: t.good, value: t.excellentDrawdown, color: 'green' },
                        { label: t.normal, value: t.neutralDrawdown, color: 'yellow' },
                        { label: t.weak, value: t.poorDrawdown, color: 'red' }
                    ]}
                >
                    <div className="kpi-card">
                        <div className="kpi-icon"><TrendingDown size={24} color="#f6465d" /></div>
                        <div className="kpi-info">
                            <span className="text-muted text-sm">{t.maxDrawdown}</span>
                            <h3 className="text-loss">-${overallStats.maxDrawdown.toFixed(2)}</h3>
                        </div>
                    </div>
                </MetricTooltip>

                <MetricTooltip
                    title={t.avgHoldTime}
                    description={
                        overallStats.holdTimeWinSamples + overallStats.holdTimeLossSamples > 0
                            ? t.avgHoldTimeDesc
                            : t.unavailableHoldTimeDesc
                    }
                    metrics={[
                        { label: t.good, value: t.excellentHold, color: 'green' },
                        { label: t.normal, value: t.neutralHold, color: 'yellow' },
                        { label: t.weak, value: t.poorHold, color: 'red' }
                    ]}
                >
                    <div className="kpi-card">
                        <div className="kpi-icon"><Clock size={24} color="#a0a0ab" /></div>
                        <div className="kpi-info">
                            <span className="text-muted text-sm">{t.avgHoldTime}</span>
                            <h3 style={{ fontSize: '1.2rem', marginTop: '0.2rem' }}>
                                <span className="text-win">W: {winHoldTime}</span>
                                <span className="text-muted mx-2">-</span>
                                <span className="text-loss">L: {lossHoldTime}</span>
                            </h3>
                        </div>
                    </div>
                </MetricTooltip>

                <MetricTooltip
                    title={t.maxStreak}
                    description={t.maxStreakDesc}
                    metrics={[
                        { label: t.good, value: t.excellentStreak, color: 'green' },
                        { label: t.normal, value: t.neutralStreak, color: 'yellow' },
                        { label: t.weak, value: t.poorStreak, color: 'red' }
                    ]}
                >
                    <div className="kpi-card">
                        <div className="kpi-icon"><Zap size={24} color="#2962ff" /></div>
                        <div className="kpi-info">
                            <span className="text-muted text-sm">{t.maxStreak}</span>
                            <h3 style={{ fontSize: '1.2rem', marginTop: '0.2rem' }}>
                                <span className="text-win">W: {overallStats.maxConsecutiveWins}</span>
                                <span className="text-muted mx-2">-</span>
                                <span className="text-loss">L: {overallStats.maxConsecutiveLosses}</span>
                            </h3>
                        </div>
                    </div>
                </MetricTooltip>

                <MetricTooltip
                    title={t.profitPerDay}
                    description={t.profitPerDayDesc}
                    metrics={[
                        { label: t.good, value: t.excellentProfitDay, color: 'green' },
                        { label: t.normal, value: t.neutralProfitDay, color: 'yellow' },
                        { label: t.weak, value: t.poorProfitDay, color: 'red' }
                    ]}
                >
                    <div className="kpi-card">
                        <div className="kpi-icon"><CalendarIcon size={24} color="#0ecb81" /></div>
                        <div className="kpi-info">
                            <span className="text-muted text-sm">{t.profitPerDay}</span>
                            <h3>${overallStats.profitPerDay.toFixed(2)}</h3>
                        </div>
                    </div>
                </MetricTooltip>

                <MetricTooltip
                    title={t.totalTrades}
                    description={t.totalTradesDesc}
                    metrics={[
                        { label: t.good, value: t.excellentTrades, color: 'green' },
                        { label: t.normal, value: t.neutralTrades, color: 'yellow' },
                        { label: t.weak, value: t.poorTrades, color: 'red' }
                    ]}
                >
                    <div className="kpi-card">
                        <div className="kpi-icon"><ListTodo size={24} color="#f0f0f2" /></div>
                        <div className="kpi-info">
                            <span className="text-muted text-sm">{t.totalTrades}</span>
                            <h3>{overallStats.totalTrades}</h3>
                        </div>
                    </div>
                </MetricTooltip>
            </div>

            <div className="drawdown-panel mt-8">
                <div className="drawdown-panel-icon">
                    <TrendingDown size={22} />
                </div>
                <div className="drawdown-panel-main">
                    <div className="drawdown-panel-header">
                        <div>
                            <h3>{t.drawdownRange}</h3>
                            <p>{t.drawdownRangeDesc}</p>
                        </div>
                        <div className="drawdown-panel-loss">
                            -${overallStats.maxDrawdown.toFixed(2)}
                        </div>
                    </div>
                    <div className="drawdown-panel-grid">
                        <div>
                            <span>{t.drawdownPeak}</span>
                            <strong>{drawdownStartLabel}</strong>
                            <small>{formatCurrency(overallStats.maxDrawdownStartEquity)}</small>
                        </div>
                        <div>
                            <span>{t.drawdownTrough}</span>
                            <strong>{drawdownEndLabel}</strong>
                            <small>{formatCurrency(overallStats.maxDrawdownEndEquity)}</small>
                        </div>
                        <div>
                            <span>{t.drawdownTrades}</span>
                            <strong>{overallStats.maxDrawdownTradeCount}</strong>
                            <small>{t.trades}</small>
                        </div>
                    </div>
                </div>
            </div>

            <div className="charts-container flex flex-col gap-8 mt-8">
                <div className="chart-wrapper w-full">
                    <h3 className="mb-4 text-lg">{t.equityCurve}</h3>
                    <ReactECharts option={equityChartOptions} style={{ height: '500px', width: '100%' }} />
                </div>
                <div className="chart-wrapper w-full">
                    <h3 className="mb-4 text-lg">{t.dailyNetPnl}</h3>
                    <ReactECharts
                        option={dailyBarOptions}
                        onEvents={dailyBarEvents}
                        style={{ height: '400px', width: '100%' }}
                    />
                </div>
            </div>

            <div className="mt-8">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg">{t.dailyPerformance}</h3>
                    <div className="segment-control">
                        <button
                            className={`segment-btn ${viewMode === 'table' ? 'active' : ''}`}
                            onClick={() => setViewMode('table')}
                        >
                            <ListIcon size={16} /> {t.table}
                        </button>
                        <button
                            className={`segment-btn ${viewMode === 'calendar' ? 'active' : ''}`}
                            onClick={() => setViewMode('calendar')}
                        >
                            <CalendarIcon size={16} /> {t.calendar}
                        </button>
                    </div>
                </div>
                {viewMode === 'table' ? (
                    <DailyPnLTable
                        dailyStats={dailyStats}
                        t={t}
                        focusedDate={focusedDate}
                        focusRequestId={focusRequestId}
                        onFocusHandled={() => setFocusedDate(null)}
                    />
                ) : (
                    <DailyPnLCalendar dailyStats={dailyStats} t={t} />
                )}
            </div>
        </div>
    );
};

export default Dashboard;
