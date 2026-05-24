import { useMemo, useState, useEffect } from 'react';
import { DailyStat } from '../utils/statistics';
import { ChevronLeft, ChevronRight, X, ZoomOut, ArrowUpDown, Image as ImageIcon } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, addMonths, subMonths, addYears, subYears } from 'date-fns';
import { ClosedTrade } from '../types';
import ImageUploadModal from './ImageUploadModal';
import { StorageService } from '../services/storageService';
import { Translation } from '../i18n';

interface Props {
    dailyStats: DailyStat[];
    t: Translation;
}

type ViewLevel = 'day' | 'month' | 'year';
type SortKey = 'entryDate' | 'holdTime' | 'netPnL';

const getHoldSeconds = (entryDate: Date, exitDate: Date) =>
    Math.max(0, Math.round((exitDate.getTime() - entryDate.getTime()) / 1000));

const formatHoldTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.round(seconds / 60);
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

const DailyPnLCalendar: React.FC<Props> = ({ dailyStats, t }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState<DailyStat | null>(null);
    const [isClosing, setIsClosing] = useState(false);
    const [viewLevel, setViewLevel] = useState<ViewLevel>('day');
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);

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

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            setSelectedDay(null);
            setIsClosing(false);
        }, 200); // 必须与 CSS modalScaleDown 时长匹配
    };

    // ESC 键全局监听
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                // If the inner image modal is open, let it handle Esc
                if (selectedTrade) return;
                handleClose();
            }
        };
        window.addEventListener('keydown', handleEsc, true); // Use capture phase or check state
        return () => window.removeEventListener('keydown', handleEsc, true);
    }, [selectedTrade]);

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

    const sortedTrades = (trades: DailyStat['closedTrades']) => {
        if (!sortConfig) return trades;
        return [...trades].sort((a, b) => {
            let aVal: number, bVal: number;
            if (sortConfig.key === 'entryDate') {
                aVal = a.entryDate.getTime(); bVal = b.entryDate.getTime();
            } else if (sortConfig.key === 'holdTime') {
                aVal = getHoldSeconds(a.entryDate, a.exitDate);
                bVal = getHoldSeconds(b.entryDate, b.exitDate);
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

    const handleUpdateImageStatus = (tradeId: string, hasImages: boolean) => {
        setTradesWithImages(prev => {
            const next = new Set(prev);
            if (hasImages) next.add(tradeId);
            else next.delete(tradeId);
            return next;
        });
    };

    const statsMap = useMemo(() => {
        const map = new Map<string, DailyStat>();
        dailyStats.forEach(day => map.set(day.dateStr, day));
        return map;
    }, [dailyStats]);

    // DAY VIEW LOGIC
    const days = useMemo(() => {
        const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
        const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
        return eachDayOfInterval({ start, end });
    }, [currentMonth]);

    const getDayClass = (day: Date) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const stat = statsMap.get(dateStr);
        let classes = 'calendar-day ';
        if (!isSameMonth(day, currentMonth)) classes += 'not-current-month ';
        if (stat) {
            classes += 'has-trades ';
            if (stat.netPnL >= 0) classes += 'bg-green-soft ';
            else classes += 'bg-red-soft ';
        }
        return classes;
    };

    // MONTH VIEW LOGIC
    const monthlyStats = useMemo(() => {
        const map = new Map<number, { netPnL: number, tradesCount: number }>();
        const year = currentMonth.getFullYear();
        dailyStats.forEach(stat => {
            const d = new Date(stat.unixTime);
            if (d.getFullYear() === year) {
                const m = d.getMonth();
                const existing = map.get(m) || { netPnL: 0, tradesCount: 0 };
                existing.netPnL += stat.netPnL;
                existing.tradesCount += stat.tradesCount;
                map.set(m, existing);
            }
        });
        return map;
    }, [dailyStats, currentMonth]);

    const monthsList = t.months;

    // YEAR VIEW LOGIC
    const yearlyStats = useMemo(() => {
        const map = new Map<number, { netPnL: number, tradesCount: number }>();
        let minYear = new Date().getFullYear();
        let maxYear = minYear;
        dailyStats.forEach(stat => {
            const y = new Date(stat.unixTime).getFullYear();
            if (y < minYear) minYear = y;
            if (y > maxYear) maxYear = y;
            const existing = map.get(y) || { netPnL: 0, tradesCount: 0 };
            existing.netPnL += stat.netPnL;
            existing.tradesCount += stat.tradesCount;
            map.set(y, existing);
        });

        // Ensure a 12-year grid centered loosely around the data or current year
        const startYear = Math.min(minYear, currentMonth.getFullYear() - 5);
        const gridYears = Array.from({ length: 12 }, (_, i) => startYear + i);

        return { map, gridYears };
    }, [dailyStats, currentMonth]);


    // NAVIGATION
    const handleNext = () => {
        if (viewLevel === 'day') setCurrentMonth(addMonths(currentMonth, 1));
        else if (viewLevel === 'month') setCurrentMonth(addYears(currentMonth, 1));
        else setCurrentMonth(addYears(currentMonth, 12));
    };

    const handlePrev = () => {
        if (viewLevel === 'day') setCurrentMonth(subMonths(currentMonth, 1));
        else if (viewLevel === 'month') setCurrentMonth(subYears(currentMonth, 1));
        else setCurrentMonth(subYears(currentMonth, 12));
    };

    const handleHeaderClick = () => {
        if (viewLevel === 'day') setViewLevel('month');
        else if (viewLevel === 'month') setViewLevel('year');
    };

    return (
        <div className="calendar-container">
            <div className="calendar-header flex items-center justify-between mb-4">
                <div
                    className={`flex items-center gap-2 ${viewLevel !== 'year' ? 'cursor-pointer hover:text-accent transition-colors' : ''}`}
                    onClick={handleHeaderClick}
                    title={viewLevel !== 'year' ? t.zoomOut : ""}
                >
                    <h3 className="text-xl font-bold">
                        {viewLevel === 'day' && format(currentMonth, 'MMMM yyyy')}
                        {viewLevel === 'month' && format(currentMonth, 'yyyy')}
                        {viewLevel === 'year' && `${yearlyStats.gridYears[0]} - ${yearlyStats.gridYears[11]}`}
                    </h3>
                    {viewLevel !== 'year' && <ZoomOut size={16} className="text-muted" />}
                </div>

                <div className="flex gap-2">
                    <button className="icon-btn-flat" onClick={handlePrev}><ChevronLeft size={20} /></button>
                    <button className="icon-btn-flat" onClick={handleNext}><ChevronRight size={20} /></button>
                </div>
            </div>

            <div className="calendar-body-wrapper animate-zoom-in" key={viewLevel + currentMonth.getFullYear() + currentMonth.getMonth()}>
                {/* DAY LEVEL CALENDAR */}
                {viewLevel === 'day' && (
                    <div className="calendar-grid">
                        {t.weekdays.map(d => (
                            <div key={d} className="calendar-weekday text-center text-sm text-muted py-2">{d}</div>
                        ))}

                        {days.map((day, i) => {
                            const dateStr = format(day, 'yyyy-MM-dd');
                            const stat = statsMap.get(dateStr);
                            return (
                                <div
                                    key={i}
                                    className={getDayClass(day)}
                                    onClick={() => stat && setSelectedDay(stat)}
                                >
                                    <span className="day-number">{format(day, 'd')}</span>
                                    {stat && (
                                        <div className="day-stats mt-2 flex flex-col items-center">
                                            <span className={`font-bold ${stat.netPnL >= 0 ? 'text-green' : 'text-red'}`}>
                                                ${stat.netPnL.toFixed(0)}
                                            </span>
                                            <span className="text-xs text-muted">{t.tradeCountShort(stat.tradesCount)}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* MONTH LEVEL CALENDAR */}
                {viewLevel === 'month' && (
                    <div className="calendar-macro-grid">
                        {monthsList.map((monthName, i) => {
                            const stat = monthlyStats.get(i);
                            let classes = 'macro-calendar-cell ';
                            if (stat) classes += (stat.netPnL >= 0 ? 'bg-green-soft ' : 'bg-red-soft ');

                            return (
                                <div
                                    key={i}
                                    className={classes}
                                    onClick={() => {
                                        const newDate = new Date(currentMonth);
                                        newDate.setMonth(i);
                                        setCurrentMonth(newDate);
                                        setViewLevel('day');
                                    }}
                                >
                                    <span className="font-semibold text-lg mb-2">{monthName}</span>
                                    {stat ? (
                                        <>
                                            <span className={`font-bold text-xl ${stat.netPnL >= 0 ? 'text-green' : 'text-red'}`}>
                                                ${stat.netPnL.toFixed(0)}
                                            </span>
                                            <span className="text-xs text-muted mt-1">{t.tradeCountShort(stat.tradesCount)}</span>
                                        </>
                                    ) : (
                                        <span className="text-muted text-sm">-</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* YEAR LEVEL CALENDAR */}
                {viewLevel === 'year' && (
                    <div className="calendar-macro-grid">
                        {yearlyStats.gridYears.map(yearNum => {
                            const stat = yearlyStats.map.get(yearNum);
                            let classes = 'macro-calendar-cell ';
                            if (stat) classes += (stat.netPnL >= 0 ? 'bg-green-soft ' : 'bg-red-soft ');

                            return (
                                <div
                                    key={yearNum}
                                    className={classes}
                                    onClick={() => {
                                        const newDate = new Date(currentMonth);
                                        newDate.setFullYear(yearNum);
                                        setCurrentMonth(newDate);
                                        setViewLevel('month');
                                    }}
                                >
                                    <span className="font-semibold text-lg mb-2">{yearNum}</span>
                                    {stat ? (
                                        <>
                                            <span className={`font-bold text-xl ${stat.netPnL >= 0 ? 'text-green' : 'text-red'}`}>
                                                ${stat.netPnL.toFixed(0)}
                                            </span>
                                            <span className="text-xs text-muted mt-1">{t.tradeCountShort(stat.tradesCount)}</span>
                                        </>
                                    ) : (
                                        <span className="text-muted text-sm">-</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* DAY TRADES MODAL */}
            {selectedDay && (
                <div className={`modal-overlay ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
                    <div className={`modal-content ${isClosing ? 'closing' : ''}`} onClick={e => e.stopPropagation()}>
                        <button className="modal-close" onClick={handleClose} title={t.close}><X size={18} /></button>
                        <h2 className="mb-4 text-xl">{t.tradesFor(selectedDay.dateStr)}</h2>
                        <div className="flex gap-4 mb-6">
                            <span className="px-3 py-1 bg-panel rounded text-sm">{t.trades}: {selectedDay.tradesCount}</span>
                            <span className={`px-3 py-1 bg-panel rounded text-sm font-bold ${selectedDay.netPnL >= 0 ? 'text-green' : 'text-red'}`}>
                                {t.netPnl}: ${selectedDay.netPnL.toFixed(2)}
                            </span>
                        </div>
                        <div className="trades-table-wrapper" style={{ overflowX: 'auto', flex: 1 }}>
                            <table className="trades-table">
                                <thead>
                                    <tr>
                                        <th>{t.symbol}</th>
                                        <th>{t.side}</th>
                                        <th className="text-right">{t.qty}</th>
                                        <th className="text-right">{t.entry}</th>
                                        <th className="text-right">{t.exit}</th>
                                        <th className="text-right">{t.points}</th>
                                        <th
                                            className={`sortable-header${sortConfig?.key === 'entryDate' ? ' sort-active' : ''}`}
                                            onClick={() => handleSort('entryDate')}
                                        >{t.entryTime} {sortIcon('entryDate')}</th>
                                        <th>{t.exitTime}</th>
                                        <th
                                            className={`sortable-header${sortConfig?.key === 'holdTime' ? ' sort-active' : ''}`}
                                            onClick={() => handleSort('holdTime')}
                                        >{t.holdTime} {sortIcon('holdTime')}</th>
                                        <th className="text-right">{t.comm}</th>
                                        <th
                                            className={`text-right sortable-header${sortConfig?.key === 'netPnL' ? ' sort-active' : ''}`}
                                            onClick={() => handleSort('netPnL')}
                                        >{t.netPnl} {sortIcon('netPnL')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedTrades(selectedDay.closedTrades).map((trade) => (
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
                                            <td className="text-xs text-muted">{format(trade.entryDate, 'HH:mm:ss')}</td>
                                            <td className="text-xs text-muted">{format(trade.exitDate, 'HH:mm:ss')}</td>
                                            <td className="text-xs text-muted">{formatHoldTime(getHoldSeconds(trade.entryDate, trade.exitDate))}</td>
                                            <td className="text-right text-xs">${trade.commission.toFixed(2)}</td>
                                            <td className={`text-right font-bold ${trade.netPnL >= 0 ? 'text-green' : 'text-red'}`}>
                                                ${trade.netPnL.toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {selectedTrade && (
                <ImageUploadModal
                    trade={selectedTrade}
                    onClose={() => setSelectedTrade(null)}
                    onUpdateStatus={handleUpdateImageStatus}
                    t={t}
                />
            )}
        </div>
    );
};

export default DailyPnLCalendar;
