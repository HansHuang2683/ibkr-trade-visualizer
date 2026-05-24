import localforage from 'localforage';
import { RawTrade, UploadBatch, Account, TradeImage } from '../types';

const STORE_KEY = 'trade_history_raw_trades';
const BATCHES_KEY = 'trade_history_batches';
const ACCOUNTS_KEY = 'trade_history_accounts';
const IMAGES_KEY = 'trade_history_images';

// Separate store for images to keep main metadata fast
const imagesStore = localforage.createInstance({
    name: 'TradeHistoryVisualizer',
    storeName: 'images'
});

localforage.config({
    name: 'TradeHistoryVisualizer',
    storeName: 'trades'
});

export const StorageService = {
    /**
     * Account Management
     */
    async getAccounts(): Promise<Account[]> {
        const data = await localforage.getItem<Account[]>(ACCOUNTS_KEY);
        if (data) {
            return data.map(a => ({
                ...a,
                createdAt: new Date(a.createdAt)
            })).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        }
        return [];
    },

    async createAccount(name: string): Promise<Account> {
        const accounts = await this.getAccounts();
        const newAccount: Account = {
            id: `acc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name,
            createdAt: new Date()
        };
        accounts.push(newAccount);
        await localforage.setItem(ACCOUNTS_KEY, accounts);
        return newAccount;
    },

    async deleteAccount(accountId: string): Promise<void> {
        // Delete accounts
        const accounts = await this.getAccounts();
        const filteredAccounts = accounts.filter(a => a.id !== accountId);
        await localforage.setItem(ACCOUNTS_KEY, filteredAccounts);

        // Delete associated trades
        const allTrades = await this.getTrades();
        const filteredTrades = allTrades.filter(t => t.accountId !== accountId);
        await localforage.setItem(STORE_KEY, filteredTrades);

        // Delete associated batches
        const allBatches = await this.getBatches();
        const filteredBatches = allBatches.filter(b => b.accountId !== accountId);
        await localforage.setItem(BATCHES_KEY, filteredBatches);
    },

    /**
     * Loads trades, optionally filtered by accountId.
     */
    async getTrades(accountId?: string): Promise<RawTrade[]> {
        const data = await localforage.getItem<RawTrade[]>(STORE_KEY);
        if (data) {
            let parsed = data.map(t => ({
                ...t,
                date: new Date(t.date)
            }));
            if (accountId) {
                parsed = parsed.filter(t => t.accountId === accountId);
            }
            return parsed;
        }
        return [];
    },

    /**
     * Loads batches, optionally filtered by accountId.
     */
    async getBatches(accountId?: string): Promise<UploadBatch[]> {
        const data = await localforage.getItem<UploadBatch[]>(BATCHES_KEY);
        if (data) {
            let parsed = data.map(b => ({
                ...b,
                uploadDate: new Date(b.uploadDate)
            }));
            if (accountId) {
                parsed = parsed.filter(b => b.accountId === accountId);
            }
            return parsed;
        }
        return [];
    },

    /**
     * Saves trades incrementally AND saves the batch metadata.
     * Includes account isolation.
     */
    async saveTradesAndBatch(batch: UploadBatch, newTrades: RawTrade[]): Promise<number> {
        const allExistingTrades = await this.getTrades(); // Get ALL to append properly

        // Only check for duplicates within the same account
        const accountTrades = allExistingTrades.filter(t => t.accountId === batch.accountId);
        const existingHashSet = new Set(accountTrades.map(t => t.hashId));

        const trulyNewTrades: RawTrade[] = [];
        for (const trade of newTrades) {
            // Safety measure: ensure incoming trades have the correct accountId
            trade.accountId = batch.accountId;
            if (!existingHashSet.has(trade.hashId)) {
                trulyNewTrades.push(trade);
                existingHashSet.add(trade.hashId);
            }
        }

        if (trulyNewTrades.length > 0) {
            const merged = [...allExistingTrades, ...trulyNewTrades];
            // Keep them sorted strictly
            merged.sort((a, b) => {
                const diff = a.date.getTime() - b.date.getTime();
                if (diff !== 0) return diff;
                const aIdx = (a as any).originalIndex || 0;
                const bIdx = (b as any).originalIndex || 0;
                return bIdx - aIdx;
            });
            await localforage.setItem(STORE_KEY, merged);

            // Save the batch
            const existingBatches = await this.getBatches();
            // Update trade count to reflect actual imported trades
            const batchToSave = { ...batch, tradeCount: trulyNewTrades.length };
            existingBatches.push(batchToSave);
            // Sort batches newest first
            existingBatches.sort((a, b) => b.uploadDate.getTime() - a.uploadDate.getTime());
            await localforage.setItem(BATCHES_KEY, existingBatches);
        }

        return trulyNewTrades.length;
    },

    /**
     * Deletes a specific batch and all trades associated with its fileId.
     */
    async deleteBatch(fileId: string): Promise<void> {
        // Remove trades
        const allTrades = await this.getTrades();
        const filteredTrades = allTrades.filter(t => t.fileId !== fileId);
        await localforage.setItem(STORE_KEY, filteredTrades);

        // Remove batch
        const allBatches = await this.getBatches();
        const filteredBatches = allBatches.filter(b => b.id !== fileId);
        await localforage.setItem(BATCHES_KEY, filteredBatches);
    },

    /**
     * Clears all trades, batches, and accounts from local storage.
     */
    async clearAll(): Promise<void> {
        await localforage.removeItem(STORE_KEY);
        await localforage.removeItem(BATCHES_KEY);
        await localforage.removeItem(ACCOUNTS_KEY);
    },

    /**
     * Migration routine: Creates a Default Account and binds legacy orphan data to it.
     */
    async migrateLegacyData(): Promise<boolean> {
        let migrated = false;
        const accounts = await this.getAccounts();

        // If no accounts exist but there are trades, we need to migrate
        if (accounts.length === 0) {
            const allTrades = await this.getTrades();
            if (allTrades.length > 0 || (await this.getBatches()).length > 0) {
                // Create Default Account
                const defaultAcc = await this.createAccount("Default Account");

                // Update legacy trades
                const upgradedTrades = allTrades.map(t => ({ ...t, accountId: defaultAcc.id }));
                await localforage.setItem(STORE_KEY, upgradedTrades);

                // Update legacy batches
                const allBatches = await this.getBatches();
                const upgradedBatches = allBatches.map(b => ({ ...b, accountId: defaultAcc.id }));
                await localforage.setItem(BATCHES_KEY, upgradedBatches);

                migrated = true;
                console.log("Migrated legacy data to Default Account.");
            }
        }
        return migrated;
    },

    /**
     * Image Management
     */
    async getTradeImages(tradeId: string): Promise<TradeImage[]> {
        const allImages = await imagesStore.getItem<TradeImage[]>(IMAGES_KEY) || [];
        return allImages.filter(img => img.tradeId === tradeId);
    },

    async saveTradeImage(image: TradeImage): Promise<void> {
        const allImages = await imagesStore.getItem<TradeImage[]>(IMAGES_KEY) || [];
        allImages.push(image);
        await imagesStore.setItem(IMAGES_KEY, allImages);
    },

    async deleteTradeImage(imageId: string): Promise<void> {
        const allImages = await imagesStore.getItem<TradeImage[]>(IMAGES_KEY) || [];
        const filtered = allImages.filter(img => img.id !== imageId);
        await imagesStore.setItem(IMAGES_KEY, filtered);
    },

    /**
     * Updates the hasImages flag on a ClosedTrade in local storage if needed.
     */
    async setTradeHasImages(tradeId: string, has: boolean): Promise<void> {
        const key = `has_images_${tradeId}`;
        await localforage.setItem(key, has);
    },

    async getTradeHasImages(tradeId: string): Promise<boolean> {
        const key = `has_images_${tradeId}`;
        return (await localforage.getItem<boolean>(key)) || false;
    }
};
