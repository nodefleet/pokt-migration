import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Transaction } from '../controller/WalletManager';

interface TransactionHistoryProps {
    transactions: Transaction[];
    walletAddress: string;
    isLoading?: boolean;
    onRefresh?: () => void;
}

const TransactionHistory: React.FC<TransactionHistoryProps> = ({
    transactions,
    walletAddress,
    isLoading = false,
    onRefresh
}) => {
    // Ordenar transacciones por fecha (más reciente primero)
    const sortedTransactions = [...transactions].sort((a, b) => {
        return b.height - a.height;
    });

    const formatAmount = (amount: string) => {
        const upokt = parseFloat(amount);
        const pokt = upokt / 1000000; // Convertir de upokt a POKT
        return pokt.toFixed(6);
    };

    const formatAddress = (address: string) => {
        return `${address.slice(0, 8)}...${address.slice(-6)}`;
    };

    const getTransactionTypeIcon = (type: 'send' | 'recv') => {
        return type === 'send' ? '↗️' : '↙️';
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'confirmed': return 'text-green-400';
            case 'pending': return 'text-yellow-400';
            case 'failed': return 'text-red-400';
            default: return 'text-gray-400';
        }
    };

    return (
        <div className="bg-gray-800 rounded-xl p-6">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold">Transaction History</h3>
                <div className="flex items-center space-x-4">
                    {onRefresh && (
                        <motion.button
                            onClick={onRefresh}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            disabled={isLoading}
                        >
                            {isLoading ? '🔄' : '🔃'} Update
                        </motion.button>
                    )}
                </div>
            </div>

            {/* Lista de transacciones */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
                <AnimatePresence>
                    {sortedTransactions.length === 0 ? (
                        <motion.div
                            className="text-center py-8 text-gray-400"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            {isLoading ? 'Loading transactions...' : 'No transactions found'}
                        </motion.div>
                    ) : (
                        sortedTransactions.map((tx, index) => (
                            <motion.div
                                key={tx.hash}
                                className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <span className="text-2xl">
                                            {getTransactionTypeIcon(tx.type)}
                                        </span>
                                        <div>
                                            <div className="flex items-center space-x-2">
                                                <span className="font-medium">
                                                    {tx.type === 'send' ? 'Sent to' : 'Received from'}
                                                </span>
                                                <span className="text-blue-400 font-mono text-sm">
                                                    {formatAddress(tx.type === 'send' ? tx.to : tx.from)}
                                                </span>
                                            </div>
                                            <div className="flex items-center space-x-2 text-sm text-gray-400">
                                                <span>Hash:</span>
                                                <span className="font-mono">
                                                    {formatAddress(tx.hash)}
                                                </span>
                                                <span>•</span>
                                                <span>Height: {tx.height}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`text-lg font-semibold ${tx.type === 'send' ? 'text-red-400' : 'text-green-400'
                                            }`}>
                                            {tx.type === 'send' ? '-' : '+'}{formatAmount(tx.value)} POKT
                                        </div>
                                        <div className={`text-sm ${getStatusColor(tx.status)}`}>
                                            {tx.status === 'confirmed' ? 'Confirmed' :
                                                tx.status === 'pending' ? 'Pending' : 'Failed'}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>

            {/* Estadísticas */}
            {sortedTransactions.length > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-600">
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <div className="text-lg font-semibold text-green-400">
                                {sortedTransactions.filter(tx => tx.type === 'recv').length}
                            </div>
                            <div className="text-sm text-gray-400">Received</div>
                        </div>
                        <div>
                            <div className="text-lg font-semibold text-red-400">
                                {sortedTransactions.filter(tx => tx.type === 'send').length}
                            </div>
                            <div className="text-sm text-gray-400">Sent</div>
                        </div>
                        <div>
                            <div className="text-lg font-semibold text-blue-400">
                                {sortedTransactions.length}
                            </div>
                            <div className="text-sm text-gray-400">Total</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TransactionHistory; 