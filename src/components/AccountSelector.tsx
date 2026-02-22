import { useState, useRef, useEffect } from 'react';
import { Account } from '../types';
import { StorageService } from '../services/storageService';
import { ChevronDown, Plus, Trash2, Check, X, Wallet } from 'lucide-react';

interface Props {
    accounts: Account[];
    activeAccountId: string;
    onSelectAccount: (id: string) => void;
    setAccounts: (accounts: Account[]) => void;
}

const AccountSelector = ({ accounts, activeAccountId, onSelectAccount, setAccounts }: Props) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newAccountName, setNewAccountName] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);

    const activeAccount = accounts.find(a => a.id === activeAccountId);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setIsMenuOpen(false);
                setIsCreating(false);
                setNewAccountName('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleCreateAccount = async () => {
        if (!newAccountName.trim()) return;
        const newAcc = await StorageService.createAccount(newAccountName.trim());
        const updatedAccounts = await StorageService.getAccounts();
        setAccounts(updatedAccounts);
        onSelectAccount(newAcc.id);
        setNewAccountName('');
        setIsCreating(false);
        setIsMenuOpen(false);
    };

    const handleDeleteAccount = async (id: string, name: string) => {
        if (accounts.length <= 1) {
            alert("You cannot delete your only account.");
            return;
        }
        if (window.confirm(`Delete account "${name}" and ALL its data? This cannot be undone.`)) {
            await StorageService.deleteAccount(id);
            const updatedAccounts = await StorageService.getAccounts();
            setAccounts(updatedAccounts);
            if (activeAccountId === id) {
                onSelectAccount(updatedAccounts[0].id);
            }
            setIsMenuOpen(false);
        }
    };

    return (
        <div className="account-selector-wrapper" ref={wrapperRef}>
            {/* Trigger Button */}
            <button
                className="account-selector-btn"
                onClick={() => setIsMenuOpen(v => !v)}
                title="Switch Account"
            >
                <div className="account-selector-btn-left">
                    <Wallet size={14} className="account-icon" />
                    <span className="account-name">{activeAccount?.name || 'Accounts'}</span>
                </div>
                <ChevronDown size={14} className={`account-chevron ${isMenuOpen ? 'open' : ''}`} />
            </button>

            {/* Floating Dropdown */}
            {isMenuOpen && (
                <div className="account-dropdown">
                    {/* Account list */}
                    <div className="account-list">
                        {accounts.map(acc => (
                            <div
                                key={acc.id}
                                className={`account-item ${acc.id === activeAccountId ? 'active' : ''}`}
                                onClick={() => {
                                    onSelectAccount(acc.id);
                                    setIsMenuOpen(false);
                                }}
                            >
                                <div className="account-item-left">
                                    {acc.id === activeAccountId
                                        ? <Check size={13} className="account-check" />
                                        : <span className="account-check-placeholder" />
                                    }
                                    <span className="account-item-name">{acc.name}</span>
                                </div>
                                {accounts.length > 1 && acc.id !== activeAccountId && (
                                    <button
                                        className="account-delete-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteAccount(acc.id, acc.name);
                                        }}
                                        title="Delete Account"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* New Account section */}
                    <div className="account-create-section">
                        {isCreating ? (
                            <div className="account-create-row">
                                <input
                                    type="text"
                                    className="account-create-input"
                                    placeholder="Account name..."
                                    value={newAccountName}
                                    onChange={e => setNewAccountName(e.target.value)}
                                    autoFocus
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') handleCreateAccount();
                                        if (e.key === 'Escape') { setIsCreating(false); setNewAccountName(''); }
                                    }}
                                />
                                <button className="account-create-confirm" onClick={handleCreateAccount}>
                                    <Check size={14} />
                                </button>
                                <button className="account-create-cancel" onClick={() => { setIsCreating(false); setNewAccountName(''); }}>
                                    <X size={14} />
                                </button>
                            </div>
                        ) : (
                            <button className="account-new-btn" onClick={() => setIsCreating(true)}>
                                <Plus size={14} />
                                <span>New Account</span>
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AccountSelector;
