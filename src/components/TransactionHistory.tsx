import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Transaction } from '../controller/WalletManager';

interface TransactionHistoryProps {
    transactions: Transaction[] | any[]; // Aceptar cualquier formato de transacción
    walletAddress: string;
    isLoading?: boolean;
    onRefresh?: () => void;
    networkType?: 'shannon' | 'morse';
}

const TransactionHistory: React.FC<TransactionHistoryProps> = ({
    transactions,
    walletAddress,
    isLoading = false,
    onRefresh,
    networkType = 'shannon'
}) => {
    // Procesar transacciones según el formato (Shannon o Morse)
    const processedTransactions = React.useMemo(() => {
        if (!transactions || transactions.length === 0) return [];

        // Detectar si son transacciones de Shannon (formato diferente)
        const isShannon = networkType === 'shannon' ||
            (transactions[0] && transactions[0].tx_result && transactions[0].height);

        if (isShannon) {
            return transactions.map(tx => {
                // Extraer información de transacción Shannon
                try {
                    const height = tx.height || '0';
                    const hash = tx.hash || '';
                    const code = tx.tx_result?.code || 1;

                    // Para transacciones de migración, siempre marcarlas como confirmadas si tienen amount
                    let isMigrationTx = false;
                    let status: 'pending' | 'confirmed' | 'failed' = code === 0 ? 'confirmed' : 'failed';

                    // Buscar eventos de transferencia
                    let from = '';
                    let to = '';
                    let amount = '0';
                    let type: 'send' | 'recv' = 'recv';

                    // Buscar en los eventos
                    if (tx.tx_result?.events) {
                        // Verificar si es una transacción de migración
                        const migrationEvents = tx.tx_result.events.filter(
                            (event: any) => event.type === 'pocket.migration.EventMorseAccountClaimed'
                        );

                        if (migrationEvents && migrationEvents.length > 0) {
                            isMigrationTx = true;
                            // Las transacciones de migración siempre se consideran exitosas si tienen eventos
                            status = 'confirmed';
                        }

                        // Buscar eventos de transferencia
                        const transferEvents = tx.tx_result.events.filter(
                            (event: any) => event.type === 'transfer'
                        );

                        if (transferEvents && transferEvents.length > 0) {
                            for (const event of transferEvents) {
                                const attributes = event.attributes || [];

                                // Buscar atributos relevantes
                                for (let i = 0; i < attributes.length; i++) {
                                    const attr = attributes[i];
                                    if (attr.key === 'sender') {
                                        from = attr.value || '';
                                    } else if (attr.key === 'recipient') {
                                        to = attr.value || '';
                                    } else if (attr.key === 'amount') {
                                        amount = attr.value || '0upokt';
                                    }
                                }

                                // Determinar si es envío o recepción respecto a nuestra wallet
                                if (from === walletAddress) {
                                    type = 'send';
                                } else if (to === walletAddress) {
                                    type = 'recv';
                                }
                            }
                        }

                        // También buscar eventos de migración
                        if (migrationEvents && migrationEvents.length > 0) {
                            for (const event of migrationEvents) {
                                const attributes = event.attributes || [];

                                // Buscar atributos relevantes
                                for (let i = 0; i < attributes.length; i++) {
                                    const attr = attributes[i];
                                    if (attr.key === 'shannon_dest_address') {
                                        // Limpiar comillas del valor
                                        to = (attr.value || '').replace(/"/g, '');
                                    } else if (attr.key === 'morse_src_address') {
                                        // Limpiar comillas del valor
                                        from = (attr.value || '').replace(/"/g, '');
                                    } else if (attr.key === 'claimed_balance') {
                                        try {
                                            const balanceObj = JSON.parse(attr.value || '{}');
                                            amount = balanceObj.amount + balanceObj.denom;
                                        } catch (e) {
                                            amount = attr.value || '0upokt';
                                        }
                                    }
                                }

                                // Las migraciones son siempre recepciones y confirmadas
                                type = 'recv';
                                status = 'confirmed';
                            }
                        }
                    }

                    // Si no se encontró información de transferencia, usar valores predeterminados
                    if (!from && !to) {
                        from = 'unknown';
                        to = 'unknown';
                    }

                    // Convertir a formato común de transacción
                    return {
                        hash,
                        from,
                        to,
                        value: amount.replace('upokt', ''),
                        timestamp: parseInt(height),
                        status,
                        type,
                        height: parseInt(height)
                    } as Transaction;
                } catch (error) {
                    console.error('Error processing Shannon transaction:', error, tx);
                    return null;
                }
            }).filter(Boolean); // Eliminar nulos
        }

        // Si son transacciones de Morse, devolverlas tal cual
        return transactions;
    }, [transactions, walletAddress, networkType]);

    // Procesar transacciones de Morse para corregir el estado
    const finalTransactions = React.useMemo(() => {
        if (!processedTransactions || processedTransactions.length === 0) return [];

        return processedTransactions.map(tx => {
            // Si es una transacción de Morse y tiene un valor positivo, considerarla confirmada
            if (networkType === 'morse' && parseFloat(tx.value) > 0) {
                return {
                    ...tx,
                    status: 'confirmed' // Forzar estado confirmado para transacciones con valor
                };
            }
            return tx;
        });
    }, [processedTransactions, networkType]);

    // Ordenar transacciones por fecha (más reciente primero)
    const sortedTransactions = [...finalTransactions].sort((a, b) => {
        return b.height - a.height;
    });

    const formatAmount = (amount: string) => {
        const upokt = parseFloat(amount);
        const pokt = upokt / 1000000; // Convertir de upokt a POKT
        return pokt.toFixed(6);
    };

    const formatAddress = (address: string) => {
        if (!address) return 'unknown';
        return `${address.slice(0, 8)}...${address.slice(-6)}`;
    };

    const getTransactionTypeIcon = (type: 'send' | 'recv') => {
        return type === 'send' ? '↗️' : '↘️';
    };

    const getStatusBadgeClass = (status: string) => {
        switch (status) {
            case 'confirmed': return 'badge-confirmed';
            case 'pending': return 'badge-pending';
            case 'failed': return 'badge-failed';
            default: return '';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'confirmed': return '✅';
            case 'pending': return '⏳';
            case 'failed': return '❌';
            default: return '❓';
        }
    };

    // Función para detectar si es una transacción de migración
    const isMigrationTransaction = (tx: Transaction | any): boolean => {
        // Verificar si es una transacción de migración basado en varios indicadores
        const isMigration =
            // Para Shannon - verificar si el hash contiene patrones de migración
            (tx.hash && typeof tx.hash === 'string' &&
                (tx.hash.includes('claim') || tx.hash.includes('morse'))) ||
            // Para Morse - verificar el tipo o memo
            (tx.type === 'migration') ||
            // Para transacciones con direcciones específicas
            (tx.to && typeof tx.to === 'string' &&
                (tx.to.includes('migration') || tx.to === 'claim')) ||
            // Verificar valor específico para migraciones
            (tx.value && (tx.value === '970000' || tx.value === '990000'));

        return isMigration;
    };

    return (
        <div className="gradient-bg rounded-xl p-6 shadow-xl border border-gray-700">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-gradient">
                    Transaction History
                </h3>
                <div className="flex items-center space-x-4">
                    {onRefresh && (
                        <motion.button
                            onClick={onRefresh}
                            className="px-4 py-2 gradient-blue rounded-lg text-sm font-medium shadow-lg flex items-center space-x-2 hover-lift"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <div className="animate-spin text-xl">🔄</div>
                            ) : (
                                <>
                                    <span className="text-xl">🔃</span>
                                    <span>Update</span>
                                </>
                            )}
                        </motion.button>
                    )}
                </div>
            </div>

            {/* Lista de transacciones */}
            <div className="space-y-4 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
                <AnimatePresence>
                    {sortedTransactions.length === 0 ? (
                        <motion.div
                            className="text-center py-12 text-gray-400 bg-gray-800/50 rounded-xl border border-gray-700"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            {isLoading ? (
                                <div className="flex flex-col items-center space-y-3">
                                    <div className="animate-spin text-2xl">🔄</div>
                                    <div>Loading transactions...</div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center space-y-3">
                                    <div className="text-3xl">📭</div>
                                    <div>No transactions found</div>
                                </div>
                            )}
                        </motion.div>
                    ) : (
                        sortedTransactions.map((tx, index) => (
                            <motion.div
                                key={tx.hash + index}
                                className="transaction-card p-5 hover-lift"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-4">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${tx.type === 'send' ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
                                            <span className="text-2xl">
                                                {tx.type === 'send' ? '↗️' : '↘️'}
                                            </span>
                                        </div>
                                        <div>
                                            <div className="flex items-center space-x-2">
                                                <span className="font-medium text-lg">
                                                    {tx.type === 'send' ? 'Sent to' : 'Received from'}
                                                </span>
                                                <span className="text-blue-400 font-mono text-sm bg-blue-900/20 px-2 py-1 rounded-md">
                                                    {formatAddress(tx.type === 'send' ? tx.to : tx.from)}
                                                </span>
                                                {isMigrationTransaction(tx) && (
                                                    <span className="text-purple-400 text-xs bg-purple-900/20 px-2 py-1 rounded-md">
                                                        Migration
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center space-x-2 text-sm text-gray-400 mt-1">
                                                <span className="text-gray-500">Hash:</span>
                                                <span className="font-mono bg-gray-800/80 px-2 py-0.5 rounded-md">
                                                    {formatAddress(tx.hash)}
                                                </span>
                                                <span className="text-gray-600">•</span>
                                                <span className="bg-gray-800/80 px-2 py-0.5 rounded-md">
                                                    Height: {tx.height}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`text-xl font-bold transaction-amount ${tx.type === 'send' ? 'text-red-400' : 'text-green-400'}`}>
                                            {tx.type === 'send' ? '-' : '+'}{formatAmount(tx.value)}
                                            <span className="text-sm ml-1 font-normal text-gray-300">POKT</span>
                                        </div>
                                        <div className="mt-1">
                                            <span className={`transaction-badge ${getStatusBadgeClass(tx.status)}`}>
                                                {getStatusIcon(tx.status)}
                                                <span className="ml-1">
                                                    {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                                                </span>
                                            </span>
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
                <div className="mt-8 pt-6 border-t border-gray-700">
                    <div className="grid grid-cols-3 gap-6 text-center">
                        <div className="rounded-xl p-4 gradient-green/10 border border-green-800/30 hover-lift">
                            <div className="text-2xl font-bold text-green-400 transaction-amount">
                                {sortedTransactions.filter(tx => tx.type === 'recv').length}
                            </div>
                            <div className="text-sm text-gray-300 mt-1">Received</div>
                        </div>
                        <div className="rounded-xl p-4 gradient-red/10 border border-red-800/30 hover-lift">
                            <div className="text-2xl font-bold text-red-400 transaction-amount">
                                {sortedTransactions.filter(tx => tx.type === 'send').length}
                            </div>
                            <div className="text-sm text-gray-300 mt-1">Sent</div>
                        </div>
                        <div className="rounded-xl p-4 gradient-blue/10 border border-blue-800/30 hover-lift">
                            <div className="text-2xl font-bold text-blue-400 transaction-amount">
                                {sortedTransactions.length}
                            </div>
                            <div className="text-sm text-gray-300 mt-1">Total</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Estilo para scrollbar personalizado */}
            <style >{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(30, 30, 30, 0.2);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(100, 100, 100, 0.4);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(100, 100, 100, 0.7);
                }
            `}</style>
        </div>
    );
};

export default TransactionHistory; 