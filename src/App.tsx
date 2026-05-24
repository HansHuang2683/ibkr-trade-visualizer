import { useState, useEffect, useMemo } from 'react';
import { RawTrade, ClosedTrade, UploadBatch, Account } from './types';
import { StorageService } from './services/storageService';
import { matchTradesFIFO } from './utils/tradeLogic';
import { aggregateDailyStats, calculateOverallStats } from './utils/statistics';
import Dashboard from './components/Dashboard';
import UploadModal from './components/UploadModal';
import UploadedFilesTable from './components/UploadedFilesTable';
import AccountSelector from './components/AccountSelector';
import MetricTooltip from './components/MetricTooltip';
import { Upload, Trash2, LayoutDashboard, Database } from 'lucide-react';
import { Language, translations } from './i18n';

function App() {
    const [rawTrades, setRawTrades] = useState<RawTrade[]>([]);
    const [closedTrades, setClosedTrades] = useState<ClosedTrade[]>([]);
    const [batches, setBatches] = useState<UploadBatch[]>([]);

    const [accounts, setAccounts] = useState<Account[]>([]);
    const [activeAccountId, setActiveAccountId] = useState<string | null>(null);

    const [currentTab, setCurrentTab] = useState<'dashboard' | 'history'>('dashboard');

    // Date Filters
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [language, setLanguage] = useState<Language>(() => {
        return (localStorage.getItem('trade_visual_language') as Language) || 'en';
    });
    const t = translations[language];

    useEffect(() => {
        localStorage.setItem('trade_visual_language', language);
    }, [language]);

    useEffect(() => {
        initializeData();
    }, [activeAccountId]);

    const initializeData = async () => {
        setIsLoading(true);
        // Ensure legacy data is bound to a default account on first run
        if (!activeAccountId) {
            await StorageService.migrateLegacyData();
            let allAccounts = await StorageService.getAccounts();

            // If still no accounts (brand new user), create one
            if (allAccounts.length === 0) {
                await StorageService.createAccount(t.defaultAccount);
                allAccounts = await StorageService.getAccounts();
            }

            setAccounts(allAccounts);
            if (allAccounts.length > 0) {
                // Select the first account automatically
                setActiveAccountId(allAccounts[0].id);
                return; // Will re-trigger useEffect with valid activeAccountId
            }
        }
        await loadData();
    };

    const loadData = async () => {
        if (!activeAccountId) {
            setRawTrades([]);
            setBatches([]);
            setClosedTrades([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const trades = await StorageService.getTrades(activeAccountId);
            const storedBatches = await StorageService.getBatches(activeAccountId);
            setRawTrades(trades);
            setBatches(storedBatches);

            if (trades.length > 0) {
                const matched = matchTradesFIFO(trades);
                setClosedTrades(matched);
            } else {
                setClosedTrades([]);
            }
        } catch (e) {
            console.error('Failed to load trades', e);
        }
        setIsLoading(false);
    };

    const filteredTrades = useMemo(() => {
        return closedTrades.filter(trade => {
            let pass = true;
            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                pass = pass && trade.exitDate.getTime() >= start.getTime();
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                pass = pass && trade.exitDate.getTime() <= end.getTime();
            }
            return pass;
        });
    }, [closedTrades, startDate, endDate]);

    const dailyStats = useMemo(() => aggregateDailyStats(filteredTrades), [filteredTrades]);
    const overallStats = useMemo(() => calculateOverallStats(filteredTrades), [filteredTrades]);

    const handleUploadSuccess = async (batch: any, newTrades: RawTrade[]) => {
        // Ensure the batch gets tied to the current active account
        if (!activeAccountId) {
            alert(t.noActiveAccount);
            return;
        }
        batch.accountId = activeAccountId;

        const addedCount = await StorageService.saveTradesAndBatch(batch, newTrades);
        alert(t.importSuccess(addedCount, batch.fileName));
        loadData();
        setIsUploadModalOpen(false);
    };

    const handleClearData = async () => {
        if (window.confirm(t.clearConfirm)) {
            try {
                await StorageService.clearAll();
                setRawTrades([]);
                setClosedTrades([]);
                setBatches([]);
                setAccounts([]);
                setActiveAccountId(null);
                alert(t.clearSuccess);
            } catch (e) {
                alert(t.clearError);
                console.error(e);
            }
        }
    };

    const handleDeleteBatch = async (fileId: string) => {
        try {
            await StorageService.deleteBatch(fileId);
            loadData();
        } catch (e) {
            alert(t.deleteFileError);
            console.error(e);
        }
    };

    if (isLoading) {
        return <div className="loading-screen">{t.loadingData}</div>;
    }

    return (
        <div className="app-container flex">
            <nav className="sidebar flex-col">
                <div className="sidebar-logo">
                    <div className="logo-icon">V</div>
                    <h2>TradeVisual</h2>
                </div>

                {accounts.length > 0 && activeAccountId && (
                    <AccountSelector
                        accounts={accounts}
                        activeAccountId={activeAccountId}
                        onSelectAccount={setActiveAccountId}
                        setAccounts={setAccounts}
                        t={t}
                    />
                )}

                <div className="sidebar-menu">
                    <button
                        className={`menu-btn ${currentTab === 'dashboard' ? 'active' : ''}`}
                        onClick={() => setCurrentTab('dashboard')}
                    >
                        <LayoutDashboard size={18} /> {t.dashboard}
                    </button>
                    <button
                        className={`menu-btn ${currentTab === 'history' ? 'active' : ''}`}
                        onClick={() => setCurrentTab('history')}
                    >
                        <Database size={18} /> {t.dataManagement}
                    </button>
                </div>

                <div className="sidebar-bottom">
                    <button className="btn btn-primary" onClick={() => setIsUploadModalOpen(true)}>
                        <Upload size={18} /> {t.importCsv}
                    </button>
                    <button className="btn btn-danger" onClick={handleClearData}>
                        <Trash2 size={18} /> {t.clearData}
                    </button>
                </div>
            </nav>

            <main className="main-content">
                <header className="top-header">
                    <h1>{currentTab === 'dashboard' ? t.tradingDashboard : t.dataManagement}</h1>
                    {currentTab === 'dashboard' && closedTrades.length > 0 && (
                        <div className="flex items-center gap-4 ml-6">
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-muted">{t.from}</label>
                                <input
                                    type="date"
                                    className="date-input"
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-muted">{t.to}</label>
                                <input
                                    type="date"
                                    className="date-input"
                                    value={endDate}
                                    onChange={e => setEndDate(e.target.value)}
                                />
                            </div>
                        </div>
                    )}
                    {currentTab === 'dashboard' && (
                        <div className="header-stats flex items-center gap-6" style={{ marginLeft: 'auto' }}>
                            <div className="language-toggle" aria-label="Language selector">
                                <button className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')} type="button">
                                    EN
                                </button>
                                <button className={language === 'zh' ? 'active' : ''} onClick={() => setLanguage('zh')} type="button">
                                    中
                                </button>
                            </div>
                            <MetricTooltip
                                title={t.totalCommission}
                                description={t.totalCommissionDesc}
                                metrics={[]}
                            >
                                <div className="flex items-center gap-2 cursor-help">
                                    <span className="text-muted">{t.commission} </span>
                                    <span className="text-red font-bold">
                                        ${overallStats?.totalCommission.toFixed(2) || '0.00'}
                                    </span>
                                </div>
                            </MetricTooltip>

                            <MetricTooltip
                                title={t.netPnl}
                                description={t.netPnlDesc}
                                metrics={[]}
                            >
                                <div className="flex items-center gap-2 cursor-help">
                                    <span className="text-muted">{t.filteredPnl} </span>
                                    <span className={overallStats && overallStats.totalNetPnL >= 0 ? 'text-green font-bold' : 'text-red font-bold'}>
                                        ${overallStats?.totalNetPnL.toFixed(2) || '0.00'}
                                    </span>
                                </div>
                            </MetricTooltip>
                        </div>
                    )}
                </header>

                <div className="content-scroll">
                    {rawTrades.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon"><Upload size={48} /></div>
                            <h3>{t.noTradingData}</h3>
                            <p>{t.importPrompt}</p>
                            <button className="btn btn-primary mt-4" onClick={() => setIsUploadModalOpen(true)}>
                                {t.uploadFile}
                            </button>
                        </div>
                    ) : (
                        <>
                            {currentTab === 'dashboard' && (
                                <Dashboard
                                    closedTrades={closedTrades}
                                    dailyStats={dailyStats}
                                    overallStats={overallStats!}
                                    t={t}
                                />
                            )}
                            {currentTab === 'history' && (
                                <div className="p-4">
                                    <UploadedFilesTable
                                        batches={batches}
                                        onDeleteBatch={handleDeleteBatch}
                                        t={t}
                                    />
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>

            {isUploadModalOpen && (
                <UploadModal
                    onClose={() => setIsUploadModalOpen(false)}
                    onSuccess={handleUploadSuccess}
                    t={t}
                />
            )}
        </div>
    );
}

export default App;
