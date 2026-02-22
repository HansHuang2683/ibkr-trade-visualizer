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

interface Props {
    closedTrades: ClosedTrade[];
    dailyStats: DailyStat[];
    overallStats: OverallStats;
}

const Dashboard: React.FC<Props> = ({ dailyStats, overallStats }) => {
    const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');

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
                    name: 'Cumulative PnL',
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
    }, [dailyStats]);

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
                    name: 'Daily PnL',
                    type: 'bar',
                    data: seriesData,
                    barMaxWidth: 30,
                    itemStyle: { borderRadius: [4, 4, 0, 0] }
                }
            ]
        };
    }, [dailyStats]);

    return (
        <div className="dashboard">
            <div className="kpi-grid">
                <MetricTooltip
                    title="Win Rate (胜率)"
                    description="盈利交易笔数占总交易笔数的百分比。反映策略的准确度。"
                    metrics={[
                        { label: '优', value: '> 55%', color: 'green' },
                        { label: '平', value: '40% - 55%', color: 'yellow' },
                        { label: '劣', value: '< 40%', color: 'red' }
                    ]}
                >
                    <div className="kpi-card">
                        <div className="kpi-icon"><Activity size={24} color="#0ecb81" /></div>
                        <div className="kpi-info">
                            <span className="text-muted text-sm">Win Rate</span>
                            <h3>{overallStats.winRate.toFixed(1)}%</h3>
                        </div>
                    </div>
                </MetricTooltip>

                <MetricTooltip
                    title="Profit Factor (盈亏因数)"
                    description="总毛利润除以总毛亏损的绝对值。衡量总体盈利效率。"
                    metrics={[
                        { label: '优', value: '> 1.5 (印钞机)', color: 'green' },
                        { label: '平', value: '1.0 - 1.5 (微利或盈亏平衡)', color: 'yellow' },
                        { label: '劣', value: '< 1.0 (亏损策略)', color: 'red' }
                    ]}
                >
                    <div className="kpi-card">
                        <div className="kpi-icon"><Target size={24} color="#2962ff" /></div>
                        <div className="kpi-info">
                            <span className="text-muted text-sm">Profit Factor</span>
                            <h3>{overallStats.profitFactor === Infinity ? '∞' : overallStats.profitFactor.toFixed(2)}</h3>
                        </div>
                    </div>
                </MetricTooltip>

                <MetricTooltip
                    title="Average RR (平均盈亏比)"
                    description="平均单笔盈利除以平均单笔亏损。反映持仓的回报潜力。"
                    metrics={[
                        { label: '优', value: '> 1.5 (以小博大)', color: 'green' },
                        { label: '平', value: '1.0 - 1.5 (正常水平)', color: 'yellow' },
                        { label: '劣', value: '< 1.0 (赚小亏大)', color: 'red' }
                    ]}
                >
                    <div className="kpi-card">
                        <div className="kpi-icon"><Scale size={24} color="#f0bb33" /></div>
                        <div className="kpi-info">
                            <span className="text-muted text-sm">Average RR</span>
                            <h3>1 : {overallStats.averageRR === Infinity ? '∞' : overallStats.averageRR.toFixed(2)}</h3>
                        </div>
                    </div>
                </MetricTooltip>

                <MetricTooltip
                    title="Max Drawdown (最大回撤)"
                    description="资金曲线从历史最高点到最低点的最大跌幅。衡量极值风险。"
                    metrics={[
                        { label: '优', value: '回撤极小，曲线平滑上升', color: 'green' },
                        { label: '平', value: '可控的正常波动回撤', color: 'yellow' },
                        { label: '劣', value: '巨大回撤，伤及本金或心态', color: 'red' }
                    ]}
                >
                    <div className="kpi-card">
                        <div className="kpi-icon"><TrendingDown size={24} color="#f6465d" /></div>
                        <div className="kpi-info">
                            <span className="text-muted text-sm">Max Drawdown</span>
                            <h3 className="text-loss">-${overallStats.maxDrawdown.toFixed(2)}</h3>
                        </div>
                    </div>
                </MetricTooltip>

                <MetricTooltip
                    title="Avg Hold Time (平均持仓时间)"
                    description="盈利单(W)与亏损单(L)的平均持仓时间比对。"
                    metrics={[
                        { label: '优', value: '盈利单持仓 > 亏损单持仓 (截断短亏，让利润奔跑)', color: 'green' },
                        { label: '平', value: '持仓时间相近', color: 'yellow' },
                        { label: '劣', value: '盈利单持仓 < 亏损单持仓 (拿不住盈利单，死扛亏损单)', color: 'red' }
                    ]}
                >
                    <div className="kpi-card">
                        <div className="kpi-icon"><Clock size={24} color="#a0a0ab" /></div>
                        <div className="kpi-info">
                            <span className="text-muted text-sm">Avg Hold Time</span>
                            <h3 style={{ fontSize: '1.2rem', marginTop: '0.2rem' }}>
                                <span className="text-win">W: {Math.round(overallStats.avgHoldTimeWin)}m</span>
                                <span className="text-muted mx-2">-</span>
                                <span className="text-loss">L: {Math.round(overallStats.avgHoldTimeLoss)}m</span>
                            </h3>
                        </div>
                    </div>
                </MetricTooltip>

                <MetricTooltip
                    title="Max Streak (极限连胜/连亏)"
                    description="历史上发生过的最长连续盈利与连续亏损次数。"
                    metrics={[
                        { label: '优', value: '连胜次数显著大于连亏', color: 'green' },
                        { label: '平', value: '连胜与连亏次数相近', color: 'yellow' },
                        { label: '劣', value: '高密度的连续亏损，存在暴跌失控的扛单风险', color: 'red' }
                    ]}
                >
                    <div className="kpi-card">
                        <div className="kpi-icon"><Zap size={24} color="#2962ff" /></div>
                        <div className="kpi-info">
                            <span className="text-muted text-sm">Max Streak</span>
                            <h3 style={{ fontSize: '1.2rem', marginTop: '0.2rem' }}>
                                <span className="text-win">W: {overallStats.maxConsecutiveWins}</span>
                                <span className="text-muted mx-2">-</span>
                                <span className="text-loss">L: {overallStats.maxConsecutiveLosses}</span>
                            </h3>
                        </div>
                    </div>
                </MetricTooltip>

                <MetricTooltip
                    title="Profit per Day (日均利润)"
                    description="总净利润除以发生过交易的实际天数。"
                    metrics={[
                        { label: '优', value: '稳定且丰厚的日均产出', color: 'green' },
                        { label: '平', value: '盈利能覆盖生活/交易摩擦成本', color: 'yellow' },
                        { label: '劣', value: '日均为负且波动剧烈', color: 'red' }
                    ]}
                >
                    <div className="kpi-card">
                        <div className="kpi-icon"><CalendarIcon size={24} color="#0ecb81" /></div>
                        <div className="kpi-info">
                            <span className="text-muted text-sm">Profit / Day</span>
                            <h3>${overallStats.profitPerDay.toFixed(2)}</h3>
                        </div>
                    </div>
                </MetricTooltip>

                <MetricTooltip
                    title="Total Trades (总交易笔数)"
                    description="统计周期内所有的平仓交易总数。频繁交易通常会导致高昂的手续费摩擦。"
                    metrics={[
                        { label: '优', value: '符合个人策略预期的交易频率', color: 'green' },
                        { label: '平', value: '偶尔克制不住的过度交易', color: 'yellow' },
                        { label: '劣', value: '陷入非理性的高频刷单交易', color: 'red' }
                    ]}
                >
                    <div className="kpi-card">
                        <div className="kpi-icon"><ListTodo size={24} color="#f0f0f2" /></div>
                        <div className="kpi-info">
                            <span className="text-muted text-sm">Total Trades</span>
                            <h3>{overallStats.totalTrades}</h3>
                        </div>
                    </div>
                </MetricTooltip>            </div>

            <div className="charts-container flex flex-col gap-8 mt-8">
                <div className="chart-wrapper w-full">
                    <h3 className="mb-4 text-lg">Equity Curve</h3>
                    <ReactECharts option={equityChartOptions} style={{ height: '500px', width: '100%' }} />
                </div>
                <div className="chart-wrapper w-full">
                    <h3 className="mb-4 text-lg">Daily Net PnL</h3>
                    <ReactECharts option={dailyBarOptions} style={{ height: '400px', width: '100%' }} />
                </div>
            </div>

            <div className="mt-8">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg">Daily Performance & Trade Log</h3>
                    <div className="segment-control">
                        <button
                            className={`segment-btn ${viewMode === 'table' ? 'active' : ''}`}
                            onClick={() => setViewMode('table')}
                        >
                            <ListIcon size={16} /> Table
                        </button>
                        <button
                            className={`segment-btn ${viewMode === 'calendar' ? 'active' : ''}`}
                            onClick={() => setViewMode('calendar')}
                        >
                            <CalendarIcon size={16} /> Calendar
                        </button>
                    </div>
                </div>
                {viewMode === 'table' ? (
                    <DailyPnLTable dailyStats={dailyStats} />
                ) : (
                    <DailyPnLCalendar dailyStats={dailyStats} />
                )}
            </div>
        </div>
    );
};

export default Dashboard;
