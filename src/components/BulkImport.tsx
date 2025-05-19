import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BulkImportProps } from '../types';

const BulkImport: React.FC<BulkImportProps> = ({ onReturn, onBulkImport }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedNetwork, setSelectedNetwork] = useState<'morse' | 'shannon' | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file && file.type === 'application/json') {
            onBulkImport();
        }
    }, [onBulkImport]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type === 'application/json') {
            onBulkImport();
        }
    }, [onBulkImport]);

    const openModal = (network: 'morse' | 'shannon') => {
        setSelectedNetwork(network);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedNetwork(null);
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] bg-gradient-to-b from-gray-900 to-black px-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-4xl"
            >
                <h1 className="text-4xl sm:text-5xl font-bold mb-4 text-center bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    <i className="fas fa-file-import mr-3"></i>
                    Bulk Import
                </h1>
                <p className="text-blue-400 mb-12 text-center text-lg sm:text-xl">
                    Select a network and upload your JSON file to import multiple wallets
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                    {[
                        {
                            network: 'morse' as const,
                            color: 'from-blue-600/50 to-blue-700/50',
                            borderColor: 'border-blue-500/50',
                            icon: 'fa-bolt'
                        },
                        {
                            network: 'shannon' as const,
                            color: 'from-purple-600/50 to-purple-700/50',
                            borderColor: 'border-purple-500/50',
                            icon: 'fa-network-wired'
                        }
                    ].map(({ network, color, borderColor, icon }) => (
                        <motion.div
                            key={network}
                            className={`p-8 rounded-2xl bg-gradient-to-r ${color} border ${borderColor} backdrop-blur-sm`}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <h2 className="text-2xl font-semibold mb-4 text-white capitalize">
                                <i className={`fas ${icon} mr-2`}></i>
                                {network}
                            </h2>
                            <p className="text-gray-300 mb-6">
                                Import multiple {network} wallets from a JSON file
                            </p>
                            <motion.button
                                onClick={() => openModal(network)}
                                className="w-full py-4 px-6 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all duration-200 border border-white/20 hover:border-white/30"
                                whileHover={{ y: -2 }}
                                whileTap={{ y: 0 }}
                            >
                                <i className="fas fa-upload mr-2"></i>
                                Upload JSON File
                            </motion.button>
                        </motion.div>
                    ))}
                </div>

                <div className="flex justify-center">
                    <motion.button
                        onClick={onReturn}
                        className="px-8 py-4 bg-gray-800/50 hover:bg-gray-700/50 text-white rounded-xl transition-all duration-200 border border-gray-700/50 hover:border-gray-600/50"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <i className="fas fa-arrow-left mr-2"></i>
                        Return
                    </motion.button>
                </div>
            </motion.div>

            <AnimatePresence>
                {isModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
                        onClick={closeModal}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-gray-900 rounded-2xl p-8 max-w-lg w-full border border-gray-800"
                            onClick={e => e.stopPropagation()}
                        >
                            <h3 className="text-2xl font-semibold mb-4 text-white">
                                <i className="fas fa-file-upload mr-2"></i>
                                Upload {selectedNetwork?.charAt(0).toUpperCase()}{selectedNetwork?.slice(1)} JSON File
                            </h3>
                            <div
                                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors duration-200 ${isDragging ? 'border-blue-400 bg-blue-400/10' : 'border-gray-700 hover:border-gray-600'
                                    }`}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                            >
                                <div className="text-6xl mb-4">
                                    <i className="fas fa-file-code"></i>
                                </div>
                                <p className="text-gray-300 mb-4">
                                    Drag and drop your JSON file here, or
                                </p>
                                <label className="inline-block px-6 py-3 bg-blue-600/50 hover:bg-blue-600/70 text-white rounded-xl cursor-pointer transition-colors duration-200 border border-blue-500/50 hover:border-blue-400/50">
                                    <i className="fas fa-folder-open mr-2"></i>
                                    Select File
                                    <input
                                        type="file"
                                        accept=".json"
                                        className="hidden"
                                        onChange={handleFileSelect}
                                    />
                                </label>
                            </div>
                            <div className="mt-6 text-center">
                                <button
                                    onClick={closeModal}
                                    className="text-gray-400 hover:text-gray-300 transition-colors duration-200"
                                >
                                    <i className="fas fa-times mr-2"></i>
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default BulkImport; 