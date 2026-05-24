import Papa from 'papaparse';
import { RawTrade } from '../types';
import { parse, isValid } from 'date-fns';
import { BrokerAdapter, ParseResult } from './BrokerAdapter';

/**
 * Deterministic FNV-1a hash for trade deduplication
 */
function fastStringHash(str: string): number {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return hash >>> 0;
}

/**
 * Cleans IBKR numeric strings:
 *  - Removes thousand-separator commas
 *  - Strips footnote suffixes like (1)
 */
function cleanNum(val: string | undefined): number {
    if (!val) return 0;
    const cleaned = val.replace(/\(\d+\)/g, '').replace(/,/g, '').trim();
    return parseFloat(cleaned) || 0;
}

/**
 * IBKR Realized P&L Summary Adapter
 *
 * Supports the Chinese-language "已实现盈亏总结" report exported from IBKR.
 * 
 * Row structure (header row):
 *   交易,Header,DataDiscriminator,资产分类,货币,代码,日期/时间,数量,交易价格,面值,佣金/税,基础,已实现的损益,代码
 * 
 * Data rows:
 *   交易,Data,Order,期货,USD,MESH6,"2026-03-10, 10:30:15",1,6799.25,-33996.25,-0.62,33996.87,0,O
 * 
 * Key conventions:
 *  - 数量 (Quantity): positive = Buy, negative = Sell
 *  - 面值 (Face Value / Notional): abs(face) / (abs(qty) * price) = contract multiplier
 *  - 佣金/税 (Commission): negative value in the file; we take abs()
 *  - 代码 (Code): O=Open, C=Close, C;O=simultaneous close+open
 */
export const IBKRAdapter: BrokerAdapter = {
    id: 'ibkr-transactions',
    name: 'IBKR Transaction History (Report)',
    description: 'Supports official IBKR Statement exports (Transaction History section)',

    async parse(file: File | string, fileId: string, fileName: string): Promise<ParseResult> {
        return new Promise((resolve, reject) => {
            Papa.parse(file, {
                header: false,        // manual header detection due to multi-section file
                skipEmptyLines: true,
                complete: (results) => {
                    try {
                        const hashCounts = new Map<string, number>();
                        let rowIndex = 0;

                        type TradeWithIndex = RawTrade & { rowIndex: number };
                        const tradesWithIndex: TradeWithIndex[] = [];

                        // ── Detect format: Chinese "已实现盈亏总结" vs. English "Transaction History" ──
                        // We scan all rows, building the header map from whichever header we find.
                        let format: 'chinese-pnl' | 'chinese-activity' | 'english-tx' | 'unknown' = 'unknown';

                        // Track current asset class section so we can scope the headerMap correctly
                        let currentHeaderMap: Record<string, number> = {};

                        for (const row of results.data as string[][]) {
                            const section = row[0]?.trim();
                            const rowType = row[1]?.trim();
                            const discriminator = row[2]?.trim();

                            // Chinese Activity Statement trade section.
                            // Import only close rows, using IBKR's realized PnL. Interest and transfers live in
                            // other sections and never enter the trade-performance dataset.
                            if (section === '\u4ea4\u6613' && rowType === 'Header') {
                                format = 'chinese-activity';
                                currentHeaderMap = {};
                                row.forEach((col, idx) => {
                                    const key = col.trim();
                                    if (!(key in currentHeaderMap)) currentHeaderMap[key] = idx;
                                });
                                continue;
                            }
                            if (format === 'chinese-activity' && section === '\u4ea4\u6613' && rowType === 'Data' && discriminator === 'Order') {
                                rowIndex++;

                                const assetClass = row[3]?.trim() ?? '';
                                const closeCode = row[15]?.trim() ?? '';
                                if (assetClass !== '\u671f\u8d27' || !closeCode.includes('C')) continue;

                                const symbol = row[5]?.trim() ?? '';
                                const dateStr = row[6]?.trim() ?? '';
                                const qtyRaw = cleanNum(row[7]);
                                const price = cleanNum(row[8]);
                                const notional = cleanNum(row[10]);
                                const commission = Math.abs(cleanNum(row[11]));
                                const realizedPnL = cleanNum(row[13]);

                                if (!symbol || !dateStr || price === 0) continue;

                                const side: 'Buy' | 'Sell' = qtyRaw >= 0 ? 'Buy' : 'Sell';
                                const qty = Math.abs(qtyRaw) || 1;
                                let date = parse(dateStr, 'yyyy-MM-dd, HH:mm:ss', new Date());
                                if (!isValid(date)) date = new Date(dateStr);

                                const dataStr = `${symbol}|${side}|${qty}|${price}|${dateStr}|${notional}|${commission}|${realizedPnL}|${closeCode}|${rowIndex}`;
                                const baseHash = fastStringHash(dataStr).toString(16);
                                const count = hashCounts.get(baseHash) ?? 0;
                                hashCounts.set(baseHash, count + 1);
                                const uniqueHash = `${baseHash}_${count}`;

                                tradesWithIndex.push({
                                    hashId: uniqueHash,
                                    fileId,
                                    accountId: '',
                                    symbol,
                                    side,
                                    qty,
                                    fillPrice: price,
                                    date,
                                    commission,
                                    netAmount: notional,
                                    realizedPnL,
                                    realizedGrossPnL: realizedPnL + commission,
                                    transactionType: closeCode,
                                    rowIndex,
                                });
                                continue;
                            }

                            // ── Chinese Realized P&L Summary (已实现盈亏总结) ──
                            if (section === '交易' && rowType === 'Header') {
                                format = 'chinese-pnl';
                                // IMPORTANT: Reset currentHeaderMap on every Header row.
                                // This file can have multiple '交易,Header' rows with different
                                // column layouts (e.g. stocks use '收益', futures use '面值').
                                currentHeaderMap = {};
                                // IMPORTANT: Only store the FIRST occurrence of each column name.
                                // The IBKR header has '代码' twice:
                                //   col 5  → ticker symbol (MESH6, TQQQ…)
                                //   col 13 → open/close flag (O, C, C;O…)
                                // Without this guard, col 13 overwrites col 5 and every "Symbol"
                                // lookup returns "O" or "C" instead of the actual ticker.
                                row.forEach((col, idx) => {
                                    const key = col.trim();
                                    if (!(key in currentHeaderMap)) currentHeaderMap[key] = idx;
                                });
                                continue;
                            }
                            if (format === 'chinese-pnl' && section === '交易' && rowType === 'Data' && row[2]?.trim() === 'Order') {
                                rowIndex++;

                                // Only process futures (期货) rows.
                                // Stock rows (股票) are skipped because:
                                //   a) Their opening trades may be outside the report period, causing phantom positions.
                                //   b) Stock PnL doesn't involve a futures multiplier.
                                // TODO: add stock support once we handle carry-in positions.
                                const assetClass = row[currentHeaderMap['资产分类']]?.trim() ?? '';
                                if (assetClass !== '期货') continue;

                                const dateStr     = row[currentHeaderMap['日期/时间']]?.trim() ?? '';
                                const symbol      = row[currentHeaderMap['代码']]?.trim() ?? '';
                                const qtyRaw      = cleanNum(row[currentHeaderMap['数量']]);
                                const price       = cleanNum(row[currentHeaderMap['交易价格']]);
                                // The futures section uses '面值' (face value/notional)
                                const notional    = cleanNum(row[currentHeaderMap['面值']]);
                                const commission  = Math.abs(cleanNum(row[currentHeaderMap['佣金/税']]));

                                if (!symbol || !dateStr || price === 0) continue;

                                // Positive qty = Buy, Negative qty = Sell
                                const side: 'Buy' | 'Sell' = qtyRaw >= 0 ? 'Buy' : 'Sell';
                                const qty = Math.abs(qtyRaw);

                                // Parse timestamp: "2026-03-10, 10:30:15"
                                let date = parse(dateStr, 'yyyy-MM-dd, HH:mm:ss', new Date());
                                if (!isValid(date)) {
                                    date = parse(dateStr, 'yyyy/M/d, HH:mm:ss', new Date());
                                }
                                if (!isValid(date)) {
                                    date = new Date(dateStr);
                                }

                                // Net amount = notional face value (actual dollar flow including multiplier)
                                const netAmount = notional;

                                const dataStr = `${symbol}|${side}|${qty}|${price}|${dateStr}|${notional}`;
                                const baseHash = fastStringHash(dataStr).toString(16);
                                const count = hashCounts.get(baseHash) ?? 0;
                                hashCounts.set(baseHash, count + 1);
                                const uniqueHash = `${baseHash}_${count}`;

                                tradesWithIndex.push({
                                    hashId: uniqueHash,
                                    fileId,
                                    accountId: '',
                                    symbol,
                                    side,
                                    qty,
                                    fillPrice: price,
                                    date,
                                    commission,
                                    netAmount,
                                    rowIndex,
                                });
                                continue;
                            }

                            // ── English Transaction History (legacy format) ──
                            if (section === 'Transaction History' && rowType === 'Header') {
                                format = 'english-tx';
                                currentHeaderMap = {};
                                row.forEach((col, idx) => { currentHeaderMap[col.trim()] = idx; });
                                continue;
                            }
                            if (format === 'english-tx' && section === 'Transaction History' && rowType === 'Data') {
                                rowIndex++;
                                const type = row[currentHeaderMap['Transaction Type']]?.trim() || 'Transaction';

                                const dateStr     = row[currentHeaderMap['Date']]?.trim() ?? '';
                                const rawSymbol   = row[currentHeaderMap['Symbol']]?.trim() ?? '';
                                const description = row[currentHeaderMap['Description']]?.trim() ?? '';
                                const qtyRaw      = cleanNum(row[currentHeaderMap['Quantity']]);
                                const price       = cleanNum(row[currentHeaderMap['Price']]);
                                const commission  = Math.abs(cleanNum(row[currentHeaderMap['Commission']]));
                                const grossAmount = cleanNum(row[currentHeaderMap['Gross Amount']]);
                                const netAmount   = cleanNum(row[currentHeaderMap['Net Amount']]);

                                if (!dateStr || netAmount === 0) continue;

                                let date = new Date(dateStr);
                                if (!isValid(date)) date = parse(dateStr, 'yyyy/M/d', new Date());

                                const symbol = rawSymbol && rawSymbol !== '-'
                                    ? rawSymbol
                                    : (description || type);
                                const side: 'Buy' | 'Sell' = type === 'Buy' || type === 'Sell'
                                    ? type
                                    : (netAmount >= 0 ? 'Buy' : 'Sell');
                                const qty = Math.abs(qtyRaw) || 1;
                                const dataStr = `${symbol}|${type}|${qtyRaw}|${price}|${dateStr}|${grossAmount}|${commission}|${netAmount}|${rowIndex}`;
                                const baseHash = fastStringHash(dataStr).toString(16);
                                const count = hashCounts.get(baseHash) ?? 0;
                                hashCounts.set(baseHash, count + 1);
                                const uniqueHash = `${baseHash}_${count}`;

                                tradesWithIndex.push({
                                    hashId: uniqueHash,
                                    fileId,
                                    accountId: '',
                                    symbol,
                                    side,
                                    qty,
                                    fillPrice: price,
                                    date,
                                    commission,
                                    netAmount: grossAmount,
                                    realizedPnL: netAmount,
                                    realizedGrossPnL: netAmount + commission,
                                    transactionType: type,
                                    isCashEvent: type !== 'Buy' && type !== 'Sell',
                                    rowIndex,
                                });
                            }
                        }

                        if (tradesWithIndex.length === 0) {
                            return reject(new Error(
                                'No valid trade records found. Please ensure this is an IBKR "Realized P&L Summary" (Chinese) or "Transaction History" (English) CSV export.'
                            ));
                        }

                        // Sort: primary = date ascending (exact timestamps so ties are rare)
                        //        secondary = rowIndex ascending (preserve CSV order for same-second fills)
                        tradesWithIndex.sort((a, b) => {
                            const timeDiff = a.date.getTime() - b.date.getTime();
                            if (timeDiff !== 0) return timeDiff;
                            return a.rowIndex - b.rowIndex;
                        });

                        const trades: RawTrade[] = tradesWithIndex.map(({ rowIndex: _r, ...t }) => t);

                        resolve({
                            batch: {
                                id: fileId,
                                fileName,
                                uploadDate: new Date(),
                                tradeCount: trades.length,
                            },
                            trades,
                        });
                    } catch (err) {
                        reject(err);
                    }
                },
                error: reject,
            });
        });
    },
};
