import { useState, Fragment, useEffect } from 'react';
import { DailyStat } from '../utils/statistics';
import { ClosedTrade } from '../types';
import { ChevronDown, ChevronRight, ArrowUpDown, Image as ImageIcon } from 'lucide-react';
import { format } from 'date-fns';
import ImageUploadModal from './ImageUploadModal';
import { StorageService } from '../services/storageService';

interface Props {
    dailyStats: DailyStat[];
}

type SortKey = 'entryDate' | 'holdTime' | 'netPnL';

const getHoldMinutes = (entryDate: Date, exitDate: Date) =>
    Math.round((exitDate.getTime() - entryDate.getTime()) / 60000);

const formatHoldTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const formatTradePrice = (trade: ClosedTrade, value: number) =>
    trade.isCashEvent || value === 0 ? '-' : value.toString();

const formatTradePoints = (trade: ClosedTrade) => {
    if (trade.isCashEvent) return '-';
    const points = trade.side === 'Long'
        ? trade.exitPrice - trade.entryPrice
        : trade.entryPrice - trade.exitPrice;
    return points.toFixed(2);
};

const getTradeDirectionClass = (trade: ClosedTrade) => {
    if (trade.isCashEvent) return 'text-muted';
    return trade.side === 'Long' ? 'text-green' : 'text-red';
};

const DailyPnLTable: React.FC<Props> = ({ dailyStats }) => {
    const [expandedDate, setExpandedDate] = useState<string | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: SortKey, direction: 'asc' | 'desc' } | null>(null);

    // Image Modal State
    const [selectedTrade, setSelectedTrade] = useState<ClosedTrade | null>(null);
    const [tradesWithImages, setTradesWithImages] = useState<Set<string>>(new Set());

    // Refresh image status for visible trades
    useEffect(() => {
        const checkImages = async () => {
            const hasImagesSet = new Set<string>();
            const allClosedTrades = dailyStats.flatMap(s => s.closedTrades);

            for (const trade of allClosedTrades) {
                const has = await StorageService.getTradeHasImages(trade.id);
                if (has) hasImagesSet.add(trade.id);
            }
            setTradesWithImages(hasImagesSet);
        };
        checkImages();
    }, [dailyStats]);

    const handleDayClick = (dateStr: string) => {
        if (expandedDate === dateStr) setExpandedDate(null);
        else setExpandedDate(dateStr);
    };

    const handleSort = (key: SortKey) => {
        setSortConfig(prev => {
            if (prev?.key === key) {
                return prev.direction === 'asc' ? { key, direction: 'desc' } : null;
            }
            return { key, direction: 'asc' };
        });
    };

    const sortIcon = (key: SortKey) => {
        if (!sortConfig || sortConfig.key !== key)
            return <ArrowUpDown size={12} className="inline-icon sort-icon-idle" />;
        return <ArrowUpDown size={12} className={`inline-icon sort-icon-active${sortConfig.direction === 'desc' ? ' sort-icon-desc' : ''}`} />;
    };

    const sortedTrades = (trades: ClosedTrade[]) => {
        if (!sortConfig) return trades;
        return [...trades].sort((a, b) => {
            let aVal: number, bVal: number;
            if (sortConfig.key === 'entryDate') {
                aVal = a.entryDate.getTime(); bVal = b.entryDate.getTime();
            } else if (sortConfig.key === 'holdTime') {
                aVal = getHoldMinutes(a.entryDate, a.exitDate);
                bVal = getHoldMinutes(b.entryDate, b.exitDate);
            } else {
                aVal = a.netPnL; bVal = b.netPnL;
            }
            return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
        });
    };

    const handleSymbolClick = (e: React.MouseEvent, trade: ClosedTrade) => {
        e.stopPropagation();
        setSelectedTrade(trade);
    };

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setSelectedTrade(null);
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, []);

    const handleUpdateImageStatus = (tradeId: string, hasImages: boolean) => {
        setTradesWithImages(prev => {
            const next = new Set(prev);
            if (hasImages) next.add(tradeId);
            else next.delete(tradeId);
            return next;
        });
    };

    return (
        <div className="data-table-container">
            <table className="data-table">
                <thead>
                    <tr>
                        <th style={{ width: '40px' }}></th>
                        <th>Date</th>
                        <th className="text-right">Trades</th>
                        <th className="text-right">Gross PnL</th>
                        <th className="text-right">Commissions</th>
                        <th className="text-right">Net PnL</th>
                    </tr>
                </thead>
                <tbody>
                    {dailyStats.map((day) => {
                        const isExpanded = expandedDate === day.dateStr;
                        return (
                            <Fragment key={day.dateStr}>
                                <tr
                                    className={`day-row ${isExpanded ? 'expanded' : ''} ${day.netPnL >= 0 ? 'row-green' : 'row-red'}`}
                                    onClick={() => handleDayClick(day.dateStr)}
                                >
                                    <td className="text-center">
                                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    </td>
                                    <td className="font-medium">{day.dateStr}</td>
                                    <td className="text-right">{day.tradesCount}</td>
                                    <td className={`text-right ${day.grossPnL >= 0 ? 'text-green' : 'text-red'}`}>
                                        ${day.grossPnL.toFixed(2)}
                                    </td>
                                    <td className="text-right">${day.commission.toFixed(2)}</td>
                                    <td className={`text-right font-bold ${day.netPnL >= 0 ? 'text-green' : 'text-red'}`}>
                                        ${day.netPnL.toFixed(2)}
                                    </td>
                                </tr>

                                {isExpanded && (
                                    <tr className="trades-detail-row">
                                        <td colSpan={6} className="trades-detail-cell">
                                            <div className="trades-table-wrapper">
                                                <h4>Trades for {day.dateStr}</h4>
                                                <table className="trades-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Symbol</th>
                                                            <th>Side</th>
                                                            <th className="text-right">Qty</th>
                                                            <th className="text-right">Entry</th>
                                                            <th className="text-right">Exit</th>
                                                            <th className="text-right">Points</th>
                                                            <th
                                                                className={`sortable-header ${sortConfig?.key === 'entryDate' ? 'sort-active' : ''}`}
                                                                onClick={() => handleSort('entryDate')}
                                                            >
                                                                Entry Time {sortIcon('entryDate')}
                                                            </th>
                                                            <th>Exit Time</th>
                                                            <th
                                                                className={`sortable-header ${sortConfig?.key === 'holdTime' ? 'sort-active' : ''}`}
                                                                onClick={() => handleSort('holdTime')}
                                                            >
                                                                Hold Time {sortIcon('holdTime')}
                                                            </th>
                                                            <th className="text-right">Comm</th>
                                                            <th
                                                                className={`text-right sortable-header ${sortConfig?.key === 'netPnL' ? 'sort-active' : ''}`}
                                                                onClick={() => handleSort('netPnL')}
                                                            >
                                                                Net PnL {sortIcon('netPnL')}
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {sortedTrades(day.closedTrades).map((trade) => (
                                                            <tr key={trade.id}>
                                                                <td
                                                                    className="symbol-clickable"
                                                                    onClick={(e) => handleSymbolClick(e, trade)}
                                                                >
                                                                    <div className="flex items-center gap-1">
                                                                        <span>{trade.symbol}</span>
                                                                        {tradesWithImages.has(trade.id) && (
                                                                            <ImageIcon size={14} className="text-muted" />
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className={getTradeDirectionClass(trade)}>{trade.transactionType || trade.side}</td>
                                                                <td className="text-right">{trade.qty}</td>
                                                                <td className="text-right">{formatTradePrice(trade, trade.entryPrice)}</td>
                                                                <td className="text-right">{formatTradePrice(trade, trade.exitPrice)}</td>
                                                                <td className={`text-right font-medium ${trade.netPnL >= 0 ? 'text-green' : 'text-red'}`}>
                                                                    {formatTradePoints(trade)}
                                                                </td>
                                                                <td className="text-xs text-muted">{format(trade.entryDate, 'HH:mm')}</td>
                                                                <td className="text-xs text-muted">{format(trade.exitDate, 'HH:mm')}</td>
                                                                <td className="text-xs text-muted">{formatHoldTime(getHoldMinutes(trade.entryDate, trade.exitDate))}</td>
                                                                <td className="text-right text-xs">${trade.commission.toFixed(2)}</td>
                                                                <td className={`text-right font-bold ${trade.netPnL >= 0 ? 'text-green' : 'text-red'}`}>
                                                                    ${trade.netPnL.toFixed(2)}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </Fragment>
                        );
                    })}
                </tbody>
            </table>

            {selectedTrade && (
                <ImageUploadModal
                    trade={selectedTrade}
                    onClose={() => setSelectedTrade(null)}
                    onUpdateStatus={handleUpdateImageStatus}
                />
            )}
        </div>
    );
};

export default DailyPnLTable;
