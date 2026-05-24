import Papa from 'papaparse';
import { RawTrade } from '../types';
import { parse, isValid } from 'date-fns';
import { BrokerAdapter, ParseResult } from './BrokerAdapter';

/**
 * Deterministic hash for TradingView/Simple format
 */
function fastStringHash(str: string): number {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return hash >>> 0;
}

function generateBaseTradeHash(row: any): string {
    const dataString = `${row['Symbol']}|${row['Side']}|${row['Qty']}|${row['Fill Price']}|${row['Time']}|${row['Net Amount']}`;
    return fastStringHash(dataString).toString(16);
}

export const TradingViewAdapter: BrokerAdapter = {
    id: 'tradingview',
    name: 'TradingView / Standard CSV',
    description: 'Supports columns: Symbol, Side, Qty, Fill Price, Time, Commission',

    async parse(file: File | string, fileId: string, fileName: string): Promise<ParseResult> {
        return new Promise((resolve, reject) => {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    try {
                        const headers = results.meta.fields || [];
                        const requiredHeaders = ['Symbol', 'Side', 'Qty', 'Fill Price', 'Time'];
                        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

                        if (missingHeaders.length > 0) {
                            return reject(new Error(`Invalid Format. Missing headers: ${missingHeaders.join(', ')}`));
                        }

                        const trades: RawTrade[] = [];
                        const hashCounts = new Map<string, number>();
                        let rowIdx = 0;

                        for (const row of results.data as any[]) {
                            rowIdx++;
                            if (!row['Symbol'] || !row['Time'] || !row['Fill Price']) continue;

                            let date = new Date(row['Time']);
                            if (!isValid(date)) {
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
                                accountId: '',
                                symbol: row['Symbol'],
                                side: row['Side'] as 'Buy' | 'Sell',
                                qty: parseFloat(row['Qty'] || '0'),
                                fillPrice: parseFloat(row['Fill Price'] || '0'),
                                date: date,
                                commission: Math.abs(parseFloat(row['Commission'] || '0')),
                                netAmount: parseFloat(row['Net Amount'] || '0'),
                            });
                        }

                        // Maintain chronological sort by default
                        trades.sort((a, b) => a.date.getTime() - b.date.getTime());

                        resolve({
                            batch: {
                                id: fileId,
                                fileName: fileName,
                                uploadDate: new Date(),
                                tradeCount: trades.length
                            },
                            trades
                        });
                    } catch (err) {
                        reject(err);
                    }
                },
                error: reject
            });
        });
    }
};
