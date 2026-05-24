import { ClosedTrade } from '../types';
import { format } from 'date-fns';

export interface DailyStat {
    dateStr: string;
    unixTime: number;
    tradesCount: number;
    grossPnL: number;
    netPnL: number;
    commission: number;
    isWinDay: boolean;
    closedTrades: ClosedTrade[];
}

export interface OverallStats {
    totalNetPnL: number;
    totalGrossPnL: number;
    totalCommission: number;
    winRate: number;
    profitFactor: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    largestWin: number;
    largestLoss: number;
    avgWin: number;
    avgLoss: number;
    averageRR: number;
    maxDrawdown: number;
    avgHoldTimeWin: number; // in minutes
    avgHoldTimeLoss: number; // in minutes
    holdTimeWinSamples: number;
    holdTimeLossSamples: number;
    maxConsecutiveWins: number;
    maxConsecutiveLosses: number;
    profitPerDay: number;
}

export function aggregateDailyStats(trades: ClosedTrade[]): DailyStat[] {
    const map = new Map<string, DailyStat>();

    for (const t of trades) {
        // Group by exit date "yyyy-MM-dd"
        const dateStr = format(t.exitDate, 'yyyy-MM-dd');
        if (!map.has(dateStr)) {
            map.set(dateStr, {
                dateStr,
                unixTime: new Date(t.exitDate).setHours(0, 0, 0, 0),
                tradesCount: 0,
                grossPnL: 0,
                netPnL: 0,
                commission: 0,
                isWinDay: false,
                closedTrades: []
            });
        }

        const day = map.get(dateStr)!;
        day.tradesCount++;
        day.grossPnL += t.grossPnL;
        day.netPnL += t.netPnL;
        day.commission += t.commission;
        day.closedTrades.push(t);
    }

    // Determine win days and sort array
    const result = Array.from(map.values()).map(day => {
        day.isWinDay = day.netPnL > 0;
        // Sort day's trades by time descending
        day.closedTrades.sort((a, b) => b.exitDate.getTime() - a.exitDate.getTime());
        return day;
    });

    // Sort daily stats by date descending
    result.sort((a, b) => b.unixTime - a.unixTime);
    return result;
}

export function calculateOverallStats(trades: ClosedTrade[]): OverallStats {
    if (trades.length === 0) {
        return {
            totalNetPnL: 0, totalGrossPnL: 0, totalCommission: 0,
            winRate: 0, profitFactor: 0, totalTrades: 0,
            winningTrades: 0, losingTrades: 0,
            largestWin: 0, largestLoss: 0, avgWin: 0, avgLoss: 0,
            averageRR: 0, maxDrawdown: 0, avgHoldTimeWin: 0, avgHoldTimeLoss: 0,
            holdTimeWinSamples: 0, holdTimeLossSamples: 0,
            maxConsecutiveWins: 0, maxConsecutiveLosses: 0, profitPerDay: 0
        };
    }

    let totalGrossWin = 0;
    let totalGrossLoss = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let largestWin = -Infinity;
    let largestLoss = Infinity;
    let totalNetPnL = 0;
    let totalGrossPnL = 0;
    let totalCommission = 0;

    let peakEquity = 0;
    let currentEquity = 0;
    let maxDrawdown = 0;
    let totalHoldTimeWin = 0;
    let totalHoldTimeLoss = 0;
    let holdTimeWinSamples = 0;
    let holdTimeLossSamples = 0;
    const uniqueTradingDays = new Set<string>();

    let maxConsecutiveWins = 0;
    let maxConsecutiveLosses = 0;
    let currentConsecutiveWins = 0;
    let currentConsecutiveLosses = 0;

    // Sort chronologically for drawdown and streak calculations
    const chronologicalTrades = [...trades].sort((a, b) => a.exitDate.getTime() - b.exitDate.getTime());

    for (const t of chronologicalTrades) {
        totalNetPnL += t.netPnL;
        totalGrossPnL += t.grossPnL;
        totalCommission += t.commission;

        uniqueTradingDays.add(format(t.exitDate, 'yyyy-MM-dd'));

        currentEquity += t.netPnL;
        if (currentEquity > peakEquity) {
            peakEquity = currentEquity;
        }
        const drawdownCount = peakEquity - currentEquity;
        if (drawdownCount > maxDrawdown) {
            maxDrawdown = drawdownCount;
        }

        const holdTimeMinutes = Math.abs(t.exitDate.getTime() - t.entryDate.getTime()) / 60000;
        const hasHoldTime = holdTimeMinutes > 0;

        if (t.netPnL > 0) {
            winningTrades++;
            totalGrossWin += t.netPnL;
            if (hasHoldTime) {
                totalHoldTimeWin += holdTimeMinutes;
                holdTimeWinSamples++;
            }
            if (t.netPnL > largestWin) largestWin = t.netPnL;

            currentConsecutiveWins++;
            currentConsecutiveLosses = 0;
            if (currentConsecutiveWins > maxConsecutiveWins) maxConsecutiveWins = currentConsecutiveWins;

        } else if (t.netPnL < 0) {
            losingTrades++;
            totalGrossLoss += Math.abs(t.netPnL);
            if (hasHoldTime) {
                totalHoldTimeLoss += holdTimeMinutes;
                holdTimeLossSamples++;
            }
            if (t.netPnL < largestLoss) largestLoss = t.netPnL;

            currentConsecutiveLosses++;
            currentConsecutiveWins = 0;
            if (currentConsecutiveLosses > maxConsecutiveLosses) maxConsecutiveLosses = currentConsecutiveLosses;
        }
    }

    const totalClosed = winningTrades + losingTrades;
    const winRate = totalClosed > 0 ? (winningTrades / totalClosed) * 100 : 0;
    const profitFactor = totalGrossLoss > 0 ? totalGrossWin / totalGrossLoss : (totalGrossWin > 0 ? Infinity : 0);
    const avgWin = winningTrades > 0 ? totalGrossWin / winningTrades : 0;
    const avgLoss = losingTrades > 0 ? totalGrossLoss / losingTrades : 0;
    const averageRR = avgLoss > 0 ? avgWin / avgLoss : (avgWin > 0 ? Infinity : 0);
    const profitPerDay = uniqueTradingDays.size > 0 ? totalNetPnL / uniqueTradingDays.size : 0;

    return {
        totalNetPnL,
        totalGrossPnL,
        totalCommission,
        winRate,
        profitFactor,
        totalTrades: trades.length,
        winningTrades,
        losingTrades,
        largestWin: largestWin === -Infinity ? 0 : largestWin,
        largestLoss: largestLoss === Infinity ? 0 : largestLoss,
        avgWin,
        avgLoss,
        averageRR,
        maxDrawdown,
        avgHoldTimeWin: holdTimeWinSamples > 0 ? totalHoldTimeWin / holdTimeWinSamples : 0,
        avgHoldTimeLoss: holdTimeLossSamples > 0 ? totalHoldTimeLoss / holdTimeLossSamples : 0,
        holdTimeWinSamples,
        holdTimeLossSamples,
        maxConsecutiveWins,
        maxConsecutiveLosses,
        profitPerDay
    };
}
