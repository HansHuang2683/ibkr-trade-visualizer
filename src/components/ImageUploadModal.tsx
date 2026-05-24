import React, { useState, useEffect, useCallback } from 'react';
import { X, Upload, Trash2, Maximize2, Image as ImageIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ClosedTrade, TradeImage } from '../types';
import { StorageService } from '../services/storageService';

interface Props {
    trade: ClosedTrade;
    onClose: () => void;
    onUpdateStatus: (tradeId: string, hasImages: boolean) => void;
}

const ImageUploadModal: React.FC<Props> = ({ trade, onClose, onUpdateStatus }) => {
    const [images, setImages] = useState<TradeImage[]>([]);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [isClosing, setIsClosing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const loadImages = useCallback(async () => {
        const tradeImages = await StorageService.getTradeImages(trade.id);
        setImages(tradeImages);
    }, [trade.id]);

    useEffect(() => {
        loadImages();
    }, [loadImages]);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(onClose, 300);
    };

    const processFiles = async (files: FileList | File[]) => {
        const newImages: TradeImage[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file.type.startsWith('image/')) continue;

            const reader = new FileReader();
            const promise = new Promise<void>((resolve) => {
                reader.onload = async (e) => {
                    const base64 = e.target?.result as string;
                    const newImg: TradeImage = {
                        id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        tradeId: trade.id,
                        data: base64,
                        name: file.name || 'Pasted Image',
                        timestamp: Date.now()
                    };
                    await StorageService.saveTradeImage(newImg);
                    newImages.push(newImg);
                    resolve();
                };
            });
            reader.readAsDataURL(file);
            await promise;
        }

        if (newImages.length > 0) {
            setImages(prev => [...prev, ...newImages]);
            await StorageService.setTradeHasImages(trade.id, true);
            onUpdateStatus(trade.id, true);
        }
    };

    const handlePaste = useCallback((e: ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        const files: File[] = [];
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                if (blob) files.push(blob);
            }
        }
        if (files.length > 0) {
            processFiles(files);
        }
    }, [trade.id, onUpdateStatus]);

    useEffect(() => {
        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [handlePaste]);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (previewImage) {
                    setPreviewImage(null);
                } else {
                    handleClose();
                }
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [previewImage]);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files) {
            processFiles(e.dataTransfer.files);
        }
    };

    const handleDelete = async (e: React.MouseEvent, imageId: string) => {
        e.stopPropagation();
        await StorageService.deleteTradeImage(imageId);
        const updatedImages = images.filter(img => img.id !== imageId);
        setImages(updatedImages);

        if (updatedImages.length === 0) {
            await StorageService.setTradeHasImages(trade.id, false);
            onUpdateStatus(trade.id, false);
        }
    };

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div
                className={`modal-content image-upload-modal ${isClosing ? 'closing' : ''}`}
                onClick={e => e.stopPropagation()}
            >
                <div className="modal-header">
                    <div className="flex items-center gap-2">
                        <ImageIcon size={20} className="text-blue" />
                        <div>
                            <h3>Trade Review: {trade.symbol}</h3>
                            <p className="modal-subtitle">
                                {format(trade.entryDate, 'MMM d, yyyy')} • {trade.side} • ${trade.netPnL.toFixed(2)}
                            </p>
                        </div>
                    </div>
                    <button className="modal-close" onClick={handleClose}>
                        <X size={18} />
                    </button>
                </div>

                <div className="modal-body">
                    {/* Paste / Drop Hint */}
                    <div
                        className={`upload-dropzone ${isDragging ? 'dragging' : ''}`}
                        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                    >
                        <Upload size={32} className="text-muted mb-2" />
                        <p>Drag images here or <strong>Ctrl + V</strong> to paste from clipboard</p>
                        <p className="text-xs text-muted mt-1">Supports PNG, JPG, GIF</p>
                    </div>

                    {/* Image Gallery */}
                    <div className="image-gallery">
                        {images.map(img => (
                            <div key={img.id} className="gallery-item" onClick={() => setPreviewImage(img.data)}>
                                <img src={img.data} alt={img.name} />
                                <div className="gallery-item-overlay">
                                    <button className="icon-btn delete" onClick={(e) => handleDelete(e, img.id)}>
                                        <Trash2 size={16} />
                                    </button>
                                    <Maximize2 size={16} className="maximize-icon" />
                                </div>
                            </div>
                        ))}
                        {images.length === 0 && (
                            <div className="empty-gallery">
                                <p>No screenshots attached to this trade.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Lightbox Preview */}
            {previewImage && (
                <div className="lightbox-overlay" onClick={() => setPreviewImage(null)}>
                    <div className="lightbox-content animate-scale-up" onClick={e => e.stopPropagation()}>
                        <button className="lightbox-close" onClick={() => setPreviewImage(null)}>
                            <X size={24} />
                        </button>
                        <img src={previewImage} alt="Preview" />
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImageUploadModal;
