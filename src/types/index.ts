export interface Account {
    id: string;
    name: string;
    createdAt: Date;
}

export interface RawTrade {
    hashId: string; // Unique fingerprint based on properties
    fileId: string; // The ID of the UploadBatch this trade belongs to
    accountId: string; // The ID of the Account this trade belongs to
    symbol: string;
    side: 'Buy' | 'Sell';
    qty: number;
    fillPrice: number;
    date: Date;
    commission: number;
    netAmount: number;
}

export interface UploadBatch {
    id: string;          // Unique ID for the uploaded file
    fileName: string;    // Original file name
    accountId: string;   // The ID of the Account this batch belongs to
    uploadDate: Date;    // When it was uploaded
    tradeCount: number;  // How many valid trades it contained
}

export interface ClosedTrade {
    id: string; // Unique ID for the matched trade
    symbol: string;
    side: 'Long' | 'Short'; // Long (Buy then Sell) or Short (Sell then Buy)
    qty: number;
    entryPrice: number;
    exitPrice: number;
    entryDate: Date;
    exitDate: Date;
    holdTimeMs: number;
    commission: number;
    grossPnL: number;
    netPnL: number;
}
