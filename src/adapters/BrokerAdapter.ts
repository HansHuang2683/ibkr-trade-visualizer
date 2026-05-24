import { RawTrade, UploadBatch } from '../types';

export interface ParseResult {
    batch: Omit<UploadBatch, 'accountId'>;
    trades: RawTrade[];
}

export interface BrokerAdapter {
    id: string;
    name: string;
    description: string;
    parse(file: File | string, fileId: string, fileName: string): Promise<ParseResult>;
}
