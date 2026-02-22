import { UploadBatch } from '../types';
import { Trash2, FileText } from 'lucide-react';
import { format } from 'date-fns';

interface UploadedFilesTableProps {
    batches: UploadBatch[];
    onDeleteBatch: (fileId: string) => void;
}

export default function UploadedFilesTable({ batches, onDeleteBatch }: UploadedFilesTableProps) {
    if (batches.length === 0) return null;

    return (
        <div className="mt-8 bg-card rounded-lg border border-border overflow-hidden">
            <div className="p-4 border-b border-border bg-card-header flex justify-between items-center">
                <h3 className="font-semibold flex items-center gap-2">
                    <FileText size={18} className="text-accent" /> Uploaded History
                </h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-background text-muted uppercase">
                        <tr>
                            <th className="px-6 py-3">File Name</th>
                            <th className="px-6 py-3">Import Date</th>
                            <th className="px-6 py-3 text-right">Valid Trades</th>
                            <th className="px-6 py-3 text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {batches.map(batch => (
                            <tr key={batch.id} className="border-b border-border hover:bg-background/50 transition-colors">
                                <td className="px-6 py-4 font-medium text-text">{batch.fileName}</td>
                                <td className="px-6 py-4 text-muted">{format(batch.uploadDate, 'yyyy-MM-dd HH:mm:ss')}</td>
                                <td className="px-6 py-4 text-right text-accent">{batch.tradeCount}</td>
                                <td className="px-6 py-4 text-center">
                                    <button
                                        onClick={() => {
                                            if (window.confirm(`Are you sure you want to delete all trades from ${batch.fileName}?`)) {
                                                onDeleteBatch(batch.id);
                                            }
                                        }}
                                        className="icon-btn-flat danger"
                                        title="Delete this file"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
