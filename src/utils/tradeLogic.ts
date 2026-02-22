import Papa from 'papaparse';
import { RawTrade, ClosedTrade, UploadBatch } from '../types';
import { parse, isValid } from 'date-fns';

/**
 * Generates a unique, deterministic 32-bit integer hash for a string.
 * Uses a simple and extremely fast FNV-1a variant hash.
 */
function fastStringHash(str: string): number {
    let hash = 2166136261; // FNV offset basis
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return hash >>> 0; // Convert to unsigned 32-bit integer
}

/**
 * Generates a unique, deterministic hash for a trade row based strictly on data.
 */
export function generateBaseTradeHash(row: any): string {
    const dataString = `${row['Symbol']}|${row['Side']}|${row['Qty']}|${row['Fill Price']}|${row['Time']}|${row['Net Amount']}`;
    // Convert 32-bit integer back to a hex string for consistency
    return fastStringHash(dataString).toString(16);
}

/**
 * Parses the CSV file, strictly validates it, and returns trades and batch metadata.
 */
export function parseCSV(file: File | string, fileId: string, fileName: string): Promise<{ batch: Omit<UploadBatch, 'accountId'>, trades: RawTrade[] }> {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                try {
                    // Strict Validation: Ensure essential headers map to IBKR format
                    const headers = results.meta.fields || [];
                    const requiredHeaders = ['Symbol', 'Side', 'Qty', 'Fill Price', 'Time'];
                    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

                    if (missingHeaders.length > 0) {
                        return reject(new Error(`Invalid CSV format. Missing required headers: ${missingHeaders.join(', ')}`));
                    }

                    const trades: (RawTrade & { originalIndex: number })[] = [];
                    let rowIdx = 0;

                    // Track occurrences of identical base hashes within this single CSV 
                    // to prevent duplicate partial-fills from being dropped
                    const hashCounts = new Map<string, number>();

                    for (const row of results.data as any[]) {
                        rowIdx++;
                        if (!row['Symbol'] || !row['Time'] || !row['Fill Price']) continue;

                        // Expected format: yyyy-MM-dd HH:mm:ss
                        let date = new Date(row['Time']);
                        if (!isValid(date)) {
                            // Safari fallback: IBKR time is often "yyyy/M/d H:mm" or "yyyy-MM-dd HH:mm:ss"
                            date = parse(row['Time'], 'yyyy/M/d H:mm', new Date());
                            if (!isValid(date)) {
                                date = parse(row['Time'], 'yyyy-MM-dd HH:mm:ss', new Date());
                            }
                        }

                        const baseHash = generateBaseTradeHash(row);
                        const count = hashCounts.get(baseHash) || 0;
                        hashCounts.set(baseHash, count + 1);
                        const uniqueHash = `${baseHash}_${count}`;

                        trades.push({
                            hashId: uniqueHash,
                            fileId: fileId,
                            accountId: '', // Placeholder, injected by App.tsx environment
                            symbol: row['Symbol'],
                            side: row['Side'] as 'Buy' | 'Sell',
                            qty: parseFloat(row['Qty'] || '0'),
                            fillPrice: parseFloat(row['Fill Price'] || '0'),
                            date: date,
                            commission: Math.abs(parseFloat(row['Commission'] || '0')), // ensure positive commission
                            netAmount: parseFloat(row['Net Amount'] || '0'),
                            originalIndex: rowIdx,
                        });
                    }

                    // Sort by date ascending
                    // If dates are exactly the same (e.g. same minute), sort by originalIndex DESCENDING 
                    // because the original CSV lists newest trades at the top (lower index).
                    trades.sort((a, b) => {
                        const timeDiff = a.date.getTime() - b.date.getTime();
                        if (timeDiff !== 0) return timeDiff;
                        return b.originalIndex - a.originalIndex;
                    });

                    if (trades.length === 0) {
                        return reject(new Error("No valid trade records found in this file."));
                    }

                    // Strip out originalIndex to return pure RawTrade
                    const pureTrades = trades.map(({ originalIndex, ...t }) => t) as RawTrade[];

                    const batch: Omit<UploadBatch, 'accountId'> = {
                        id: fileId,
                        fileName: fileName,
                        uploadDate: new Date(),
                        tradeCount: pureTrades.length
                    };

                    resolve({ batch, trades: pureTrades });
                } catch (err) {
                    reject(err);
                }
            },
            error: (error) => {
                reject(error);
            }
        });
    });
}

/**
 * Runs FIFO (First In First Out) matching algorithm on raw trades.
 */
export function matchTradesFIFO(trades: RawTrade[]): ClosedTrade[] {
    // Group by symbol first
    const symbolMap = new Map<string, RawTrade[]>();
    for (const t of trades) {
        if (!symbolMap.has(t.symbol)) {
            symbolMap.set(t.symbol, []);
        }
        symbolMap.get(t.symbol)!.push(t);
    }

    const closedTrades: ClosedTrade[] = [];

    // Notice: to properly allocate commissions during partial fills,
    // we attach a remaining commission field while processing.
    type WorkingTrade = RawTrade & { remainingQty: number; remainingComm: number };

    for (const [symbol, symbolTrades] of symbolMap.entries()) {
        // We maintain a FIFO queue of open positions
        let openPositions: WorkingTrade[] = [];
        let readIndex = 0; // O(1) pointer for the top position instead of using .shift()

        for (const t of symbolTrades) {
            if (openPositions.length === readIndex) {
                // No open positions (or all consumed), start a new one
                openPositions.push({ ...t, remainingQty: t.qty, remainingComm: t.commission });
                continue;
            }

            const currentPos = openPositions[readIndex];

            // If same direction, just add to queue
            if (currentPos.side === t.side) {
                openPositions.push({ ...t, remainingQty: t.qty, remainingComm: t.commission });
                continue;
            }

            // Opposite direction -> we match!
            let incTrade = { ...t, remainingQty: t.qty, remainingComm: t.commission };

            while (incTrade.remainingQty > 0 && openPositions.length > readIndex) {
                const top = openPositions[readIndex];
                const matchQty = Math.min(top.remainingQty, incTrade.remainingQty);

                // Calculate proportional commissions
                const topCommProportion = matchQty / top.qty;
                const incCommProportion = matchQty / t.qty;

                const partialTopComm = top.commission * topCommProportion;
                const partialIncComm = t.commission * incCommProportion;

                top.remainingComm -= partialTopComm;
                incTrade.remainingComm -= partialIncComm;

                // PnL Logic
                // For Long (Buy then Sell): (SellPrice - BuyPrice) * Qty
                // Notice IBKR Futures: Net Amount shows total contract value multiplier included
                // E.g Qty=1, Price=6919, NetAmount=34595. Meaning multiplier=5.
                // So we should calculate Point Difference * Multiplier * Qty
                const multiplier = (top.fillPrice > 0 && top.netAmount > 0)
                    ? Math.abs(top.netAmount / (top.qty * top.fillPrice))
                    : 1;

                const isLong = top.side === 'Buy';
                const entryPrice = top.fillPrice;
                const exitPrice = incTrade.fillPrice;

                const priceDiff = isLong ? exitPrice - entryPrice : entryPrice - exitPrice;
                const grossPnL = priceDiff * matchQty * multiplier;
                const totalCommissionForMatch = partialTopComm + partialIncComm;
                const netPnL = grossPnL - totalCommissionForMatch;

                closedTrades.push({
                    id: `${top.hashId}-${incTrade.hashId}-${Date.now()}-${Math.random()}`,
                    symbol: symbol,
                    side: isLong ? 'Long' : 'Short',
                    qty: matchQty,
                    entryPrice: entryPrice,
                    exitPrice: exitPrice,
                    entryDate: top.date,
                    exitDate: incTrade.date,
                    holdTimeMs: incTrade.date.getTime() - top.date.getTime(),
                    commission: totalCommissionForMatch,
                    grossPnL: grossPnL,
                    netPnL: netPnL
                });

                // Update remaining qty
                top.remainingQty -= matchQty;
                incTrade.remainingQty -= matchQty;

                if (top.remainingQty <= 0) {
                    readIndex++; // Advance the pointer instead of expensive array mutating shift()
                }
            }

            // Periodically garbage collect the openPositions queue to prevent runaway linear memory limits
            // if trading very high frequency for a single symbol
            if (readIndex > 150) {
                openPositions = openPositions.slice(readIndex);
                readIndex = 0;
            }

            // If incoming trade still has qty left, it becomes the new open position in the opposite direction
            if (incTrade.remainingQty > 0) {
                openPositions.push(incTrade);
            }
        }
    }

    // Sort by exit date descending
    closedTrades.sort((a, b) => b.exitDate.getTime() - a.exitDate.getTime());

    return closedTrades;
}
