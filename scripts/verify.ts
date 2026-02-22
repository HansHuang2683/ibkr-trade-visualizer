import * as fs from 'fs';
import * as path from 'path';
import { parseCSV, matchTradesFIFO } from '../src/utils/tradeLogic';
import { calculateOverallStats, aggregateDailyStats } from '../src/utils/statistics';

async function main() {
    const filePath = './interactive-brokers-trade-history-2026-02-21T11_01_49.653Z_a6b2c.csv';
    const fileData = fs.readFileSync(filePath, 'utf8');

    try {
        const rawTrades = await parseCSV(fileData);

        // Let's create two versions:
        // Version 1: The STRICT time-only sort (imitates pandas stable sort)
        const tradesPandas = [...rawTrades].sort((a, b) => {
            const timeDiff = a.date.getTime() - b.date.getTime();
            if (timeDiff !== 0) return timeDiff;
            // Pandas stable sort keeps the original order of the CSV if times are the same.
            // Original CSV order has lower index first (newest first).
            return (a as any).originalIndex - (b as any).originalIndex;
        });
        const closedPandas = matchTradesFIFO(tradesPandas);
        const statsPandas = calculateOverallStats(closedPandas);

        // Version 2: The CORRECT chronological sort (handles ties by original index)
        const tradesCorrect = [...rawTrades].sort((a, b) => {
            const timeDiff = a.date.getTime() - b.date.getTime();
            if (timeDiff !== 0) return timeDiff;
            return (b as any).originalIndex - (a as any).originalIndex;
        });
        const closedCorrect = matchTradesFIFO(tradesCorrect);
        const statsCorrect = calculateOverallStats(closedCorrect);
        const dailyCorrect = aggregateDailyStats(closedCorrect);

        const dailyPandas = aggregateDailyStats(closedPandas);
        console.log(`--- PANDAS SCRIPT SIMULATION (Stable Date Sort) ---`);
        console.log(`Total Net PnL: $${statsPandas.totalNetPnL.toFixed(2)}`);
        console.log(`\n--- PANDAS DAILY BREAKDOWN ---`);
        for (const day of dailyPandas) {
            console.log(`${day.dateStr}: $${day.netPnL.toFixed(2)}`);
        }

        console.log(`\n--- CORRECT CHRONOLOGICAL SORT ---`);
        console.log(`Total Net PnL: $${statsCorrect.totalNetPnL.toFixed(2)}`);

        console.log(`\n--- DAILY BREAKDOWN ---`);
        for (const day of dailyCorrect) {
            console.log(`${day.dateStr}: $${day.netPnL.toFixed(2)}`);
        }
    } catch (e) {
        console.error("Error reading trades", e);
    }
}

main();
