import { useState, useEffect, useMemo } from 'react';
import { RawTrade, ClosedTrade, UploadBatch, Account } from './types';
import { StorageService } from './services/storageService';
import { matchTradesFIFO } from './utils/tradeLogic';
import { aggregateDailyStats, calculateOverallStats } from './utils/statistics';
import Dashboard from './components/Dashboard';
import UploadModal from './components/UploadModal';
import UploadedFilesTable from './components/UploadedFilesTable';
import AccountSelector from './components/AccountSelector';
import { Upload, Trash2, LayoutDashboard, Database } from 'lucide-react';

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
                await StorageService.createAccount("Default Account");
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
            alert("No active account selected for import.");
            return;
        }
        batch.accountId = activeAccountId;

        const addedCount = await StorageService.saveTradesAndBatch(batch, newTrades);
        alert(`Successfully imported ${addedCount} new trades from ${batch.fileName} (ignored duplicates).`);
        loadData();
        setIsUploadModalOpen(false);
    };

    const handleClearData = async () => {
        if (window.confirm("Are you sure you want to clear ALL trading data for ALL accounts? This cannot be undone.")) {
            try {
                await StorageService.clearAll();
                setRawTrades([]);
                setClosedTrades([]);
                setBatches([]);
                setAccounts([]);
                setActiveAccountId(null);
                alert("Data cleared successfully. The app is now fully factory reset.");
            } catch (e) {
                alert("Error clearing data. Please refresh the page and try again.");
                console.error(e);
            }
        }
    };

    const handleDeleteBatch = async (fileId: string) => {
        try {
            await StorageService.deleteBatch(fileId);
            loadData();
        } catch (e) {
            alert("Error deleting the file data.");
            console.error(e);
        }
    };

    if (isLoading) {
        return <div className="loading-screen">Loading Data...</div>;
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
                    />
                )}

                <div className="sidebar-menu">
                    <button
                        className={`menu-btn ${currentTab === 'dashboard' ? 'active' : ''}`}
                        onClick={() => setCurrentTab('dashboard')}
                    >
                        <LayoutDashboard size={18} /> Dashboard
                    </button>
                    <button
                        className={`menu-btn ${currentTab === 'history' ? 'active' : ''}`}
                        onClick={() => setCurrentTab('history')}
                    >
                        <Database size={18} /> Data Management
                    </button>
                </div>

                <div className="sidebar-bottom">
                    <button className="btn btn-primary" onClick={() => setIsUploadModalOpen(true)}>
                        <Upload size={18} /> Import CSV
                    </button>
                    <button className="btn btn-danger" onClick={handleClearData}>
                        <Trash2 size={18} /> Clear Data
                    </button>
                </div>
            </nav>

            <main className="main-content">
                <header className="top-header">
                    <h1>{currentTab === 'dashboard' ? 'Trading Dashboard' : 'Data Management'}</h1>
                    {currentTab === 'dashboard' && closedTrades.length > 0 && (
                        <div className="flex items-center gap-4 ml-6">
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-muted">From:</label>
                                <input
                                    type="date"
                                    className="date-input"
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-muted">To:</label>
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
                        <div className="header-stats" style={{ marginLeft: 'auto' }}>
                            <span>Filtered PnL: </span>
                            <span className={overallStats && overallStats.totalNetPnL >= 0 ? 'text-green font-bold' : 'text-red font-bold'}>
                                ${overallStats?.totalNetPnL.toFixed(2) || '0.00'}
                            </span>
                        </div>
                    )}
                </header>

                <div className="content-scroll">
                    {rawTrades.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon"><Upload size={48} /></div>
                            <h3>No Trading Data Found</h3>
                            <p>Import your Interactive Brokers CSV to generate insights.</p>
                            <button className="btn btn-primary mt-4" onClick={() => setIsUploadModalOpen(true)}>
                                Upload File
                            </button>
                        </div>
                    ) : (
                        <>
                            {currentTab === 'dashboard' && (
                                <Dashboard
                                    closedTrades={closedTrades}
                                    dailyStats={dailyStats}
                                    overallStats={overallStats!}
                                />
                            )}
                            {currentTab === 'history' && (
                                <div className="p-4">
                                    <UploadedFilesTable
                                        batches={batches}
                                        onDeleteBatch={handleDeleteBatch}
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
                />
            )}
        </div>
    );
}

export default App;
