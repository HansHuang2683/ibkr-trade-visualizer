import { RawTrade, ClosedTrade } from '../types';

// Deterministic hash for trades
export function fastStringHash(str: string): number {
    let hash = 2166136261; // FNV offset basis
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return hash >>> 0; // Convert to unsigned 32-bit integer
}

/**
 * Orchestrates the FIFO matching logic...
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
    const realizedTrades = trades.filter(t => typeof t.realizedPnL === 'number');
    const fifoTrades = trades.filter(t => typeof t.realizedPnL !== 'number');

    const realizedClosedTrades: ClosedTrade[] = realizedTrades.map(t => ({
        id: t.hashId,
        symbol: t.symbol,
        side: t.realizedPnL! >= 0 ? 'Long' : 'Short',
        qty: t.qty,
        entryPrice: t.fillPrice,
        exitPrice: t.fillPrice,
        entryDate: t.date,
        exitDate: t.date,
        holdTimeMs: 0,
        commission: t.commission,
        grossPnL: typeof t.realizedGrossPnL === 'number' ? t.realizedGrossPnL : t.realizedPnL! + t.commission,
        netPnL: t.realizedPnL!,
        transactionType: t.transactionType,
        isCashEvent: t.isCashEvent
    }));

    // Group by symbol first
    const symbolMap = new Map<string, RawTrade[]>();
    for (const t of fifoTrades) {
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
                const closeCode = t.transactionType ?? '';
                const isUnmatchedCloseOnly = closeCode.includes('C') && !closeCode.includes('O');
                if (isUnmatchedCloseOnly) {
                    // The report can start with a close for a position opened before
                    // the selected date range. Without the opening leg, FIFO cannot
                    // reconstruct a reviewable trade, so we skip it instead of
                    // inventing a fake entry.
                    continue;
                }
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
                // For MES and other futures, IBKR's Net Amount already reflects total dollar value
                // (e.g. Qty=1, Price=6705, NetAmount=-33527.5 means multiplier=5)
                // We derive gross PnL from the net amounts directly when available,
                // falling back to price * qty if netAmount is zero or unreliable.
                const isLong = top.side === 'Buy';
                const entryPrice = top.fillPrice;
                const exitPrice = incTrade.fillPrice;

                // Determine price multiplier from the opening leg
                // abs(netAmount) = price * qty * multiplier --> multiplier = abs(netAmount) / (price * qty)
                // Only use this if the netAmount looks like a notional value (significantly different from price)
                const openNotional = Math.abs(top.netAmount);
                const openFaceValue = top.fillPrice * top.qty;
                const rawMultiplier = (openNotional > 0 && openFaceValue > 0)
                    ? openNotional / openFaceValue
                    : 1;
                // Round to nearest standard multiplier to avoid floating-point noise
                // Common futures multipliers: 1, 2, 5, 10, 20, 50, 100
                const standardMultipliers = [100, 50, 20, 10, 5, 2, 1];
                let multiplier = 1;
                for (const m of standardMultipliers) {
                    if (Math.abs(rawMultiplier - m) / m < 0.05) { // within 5% of a standard multiplier
                        multiplier = m;
                        break;
                    }
                }
                // If nothing matched, fallback to raw (e.g., odd-lot futures)
                if (multiplier === 1 && rawMultiplier > 1.1) {
                    multiplier = Math.round(rawMultiplier);
                }

                const priceDiff = isLong ? exitPrice - entryPrice : entryPrice - exitPrice;
                const grossPnL = priceDiff * matchQty * multiplier;
                const totalCommissionForMatch = partialTopComm + partialIncComm;
                const netPnL = grossPnL - totalCommissionForMatch;

                closedTrades.push({
                    id: `${top.hashId}-${incTrade.hashId}`,
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
    closedTrades.push(...realizedClosedTrades);
    closedTrades.sort((a, b) => b.exitDate.getTime() - a.exitDate.getTime());

    return closedTrades;
}
