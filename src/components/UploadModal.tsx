import { useState, useEffect } from 'react';
import { RawTrade, UploadBatch } from '../types';
import { X, UploadCloud } from 'lucide-react';
import { BrokerAdapter } from '../adapters/BrokerAdapter';
import { IBKRAdapter } from '../adapters/ibkrAdapter';
import { TradingViewAdapter } from '../adapters/tradingViewAdapter';
import { Translation } from '../i18n';

const AVAILABLE_BROKERS: BrokerAdapter[] = [
    IBKRAdapter,
    TradingViewAdapter
];

interface UploadModalProps {
    onClose: () => void;
    onSuccess: (batch: UploadBatch, trades: RawTrade[]) => void;
    t: Translation;
}

const UploadModal: React.FC<UploadModalProps> = ({ onClose, onSuccess, t }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedBroker, setSelectedBroker] = useState<string>(AVAILABLE_BROKERS[0].id);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);


    const processFile = async (file: File) => {
        setIsLoading(true);
        setError(null);
        try {
            const adapter = AVAILABLE_BROKERS.find(b => b.id === selectedBroker);
            if (!adapter) throw new Error("Please select a broker.");

            const fileId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
            const { batch, trades } = await adapter.parse(file, fileId, file.name);
            
            if (trades.length === 0) {
                throw new Error("No valid trade rows found in file.");
            }

            // Add required account id placeholder (App.tsx overwrites this)
            const modifiedBatch: UploadBatch = {
                ...batch,
                accountId: ''
            };

            onSuccess(modifiedBatch, trades);
        } catch (e: any) {
            setError(e.message || t.parseError);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFile(e.dataTransfer.files[0]);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            processFile(e.target.files[0]);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <button className="modal-close" onClick={onClose}><X size={20} /></button>
                <h2>{t.importTradeHistory}</h2>
                <p className="text-muted mb-4">{t.uploadBrokerCsv}</p>

                <div className="broker-selector-container mb-6">
                    <label className="text-sm text-muted mb-2 block">{t.brokerFormat}</label>
                    <div className="broker-grid">
                        {AVAILABLE_BROKERS.map(broker => (
                            <div 
                                key={broker.id}
                                className={`broker-card ${selectedBroker === broker.id ? 'active' : ''}`}
                                onClick={() => setSelectedBroker(broker.id)}
                            >
                                <div className="broker-name">{t.brokerName(broker.id, broker.name)}</div>
                                <div className="broker-desc">{t.brokerDescription(broker.id, broker.description)}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div
                    className={`drop-zone ${isDragging ? 'dragging' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <UploadCloud size={48} className="drop-icon" />
                    <h3>{t.dragDropCsv}</h3>
                    <p>{t.or}</p>
                    <label className="btn btn-secondary mt-2">
                        {t.browseFile}
                        <input type="file" accept=".csv" onChange={handleFileChange} hidden />
                    </label>
                </div>

                {isLoading && <div className="mt-4 text-accent text-center">{t.parsingFile}</div>}
                {error && <div className="mt-4 text-red text-center">{error}</div>}
            </div>
        </div>
    );
};

export default UploadModal;
