import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WalletDashboardProps } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import { ERROR_MESSAGES } from '../controller/config';
import { WalletManager, Transaction, NetworkType } from '../controller/WalletManager';
import LoadingSpinner from './LoadingSpinner';
import TransactionHistory from './TransactionHistory';
import { formatBalance, shortenAddress } from '../utils/utils';
import { storageService } from '../controller/storage.service';

interface StoredWallet {
    serialized: string;
    network: NetworkType;
    timestamp: number;
    parsed: any;
}

const WalletDashboard: React.FC<WalletDashboardProps> = ({
    walletAddress,
    balance,
    transactions: initialTransactions,
    onSwap,
    network = 'shannon',
    isMainnet = false,
    walletManager,
    onLogout
}) => {
    // Estado local para actualizar valores desde el walletManager
    const [formattedBalanceValue, setFormattedBalanceValue] = useState<string>(formatBalance(balance));
    const [transactionsList, setTransactionsList] = useState<any[]>(initialTransactions);
    const [loading, setLoading] = useState<boolean>(false);
    const [showOfflineWarning, setShowOfflineWarning] = useState<boolean>(false);
    const [storedWallets, setStoredWallets] = useState<{
        morse?: StoredWallet;
        shannon?: StoredWallet;
    }>({});
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const fetchBalanceAndTransactions = useCallback(async () => {
        try {
            setLoading(true);

            // Verificar si walletManager está definido antes de usarlo
            if (!walletManager) {
                console.warn('WalletManager no está inicializado. Esperando inicialización...');
                setShowOfflineWarning(true);
                setLoading(false);
                return;
            }

            // Verificar si estamos en modo offline
            const isOffline = walletManager.isOfflineMode ? walletManager.isOfflineMode() : false;
            setShowOfflineWarning(isOffline);

            // Obtener balance aunque estemos en modo offline (devolverá 0)
            const fetchedBalance = await walletManager.getBalance(walletAddress);
            setFormattedBalanceValue(formatBalance(fetchedBalance));

            // Intentar obtener transacciones solo si no estamos en modo offline
            if (!isOffline) {
                const fetchedTransactions = await walletManager.getTransactions(walletAddress);
                setTransactionsList(fetchedTransactions);
            } else {
                setTransactionsList([]);
            }
        } catch (error) {
            console.error('Error al obtener datos de la wallet:', error);
            setShowOfflineWarning(true);
        } finally {
            setLoading(false);
        }
    }, [walletManager, walletAddress]);

    useEffect(() => {
        // Solo intentar obtener datos si tenemos una dirección válida
        if (walletAddress) {
            fetchBalanceAndTransactions();
            // Actualizar datos cada 30 segundos si no estamos en modo offline
            const intervalId = setInterval(() => {
                if (walletManager && walletManager.isOfflineMode && !walletManager.isOfflineMode()) {
                    fetchBalanceAndTransactions();
                }
            }, 30000);

            return () => clearInterval(intervalId);
        }
    }, [walletManager, walletAddress, network, isMainnet, fetchBalanceAndTransactions]);

    // Cargar las wallets guardadas al iniciar
    useEffect(() => {
        const loadStoredWallets = async () => {
            try {
                const morseWallet = await storageService.get<StoredWallet>('morse_wallet');
                const shannonWallet = await storageService.get<StoredWallet>('shannon_wallet');

                setStoredWallets({
                    morse: morseWallet || undefined,
                    shannon: shannonWallet || undefined
                });
            } catch (error) {
                console.error('Error al cargar wallets:', error);
                setError('Error al cargar las wallets guardadas');
            }
        };

        loadStoredWallets();
    }, []);

    // Escuchar cambios en el storage para actualizar automáticamente
    useEffect(() => {
        const handleStorageUpdate = () => {
            console.log('📦 Storage updated in WalletDashboard - refreshing data...');
            fetchBalanceAndTransactions();
        };

        // Escuchar eventos customizados de storage
        window.addEventListener('storageUpdate', handleStorageUpdate);

        return () => {
            window.removeEventListener('storageUpdate', handleStorageUpdate);
        };
    }, [fetchBalanceAndTransactions]);

    // Función para intentar reconectar manualmente
    const handleReconnect = async () => {
        try {
            if (!walletManager) {
                console.warn('WalletManager no está inicializado');
                return;
            }
            setLoading(true);
            setError(null);

            // CORREGIR: El WalletManager espera isTestnet, no isMainnet
            const isTestnet = !isMainnet; // Negar directamente - más simple y confiable
            console.log(`🔍 DEBUG WalletDashboard handleReconnect: isMainnet=${isMainnet}, isTestnet=${isTestnet}`);

            await walletManager.switchNetwork(network, isTestnet);
            await fetchBalanceAndTransactions();
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Error al reconectar');
            setShowOfflineWarning(true);
        } finally {
            setLoading(false);
        }
    };

    // Función para cambiar a Shannon si estamos en Morse
    const handleSwitchToShannon = async () => {
        try {
            if (!walletManager) {
                console.warn('WalletManager no está inicializado');
                return;
            }
            setLoading(true);
            setError(null);

            // CORREGIR: El WalletManager espera isTestnet, no isMainnet
            const isTestnet = !isMainnet; // Negar directamente - más simple y confiable
            console.log(`🔍 DEBUG WalletDashboard handleSwitchToShannon: isMainnet=${isMainnet}, isTestnet=${isTestnet}`);

            await walletManager.switchNetwork('shannon', isTestnet);
            await fetchBalanceAndTransactions();
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Error al cambiar de red');
            setShowOfflineWarning(true);
        } finally {
            setLoading(false);
        }
    };

    // Cambiar de red y wallet
    const handleNetworkSwitch = async (newNetwork: NetworkType) => {
        try {
            if (!walletManager) {
                console.warn('WalletManager no está inicializado');
                return;
            }

            setLoading(true);
            setError(null);

            const storedWallet = storedWallets[newNetwork];
            if (!storedWallet) {
                throw new Error(`No hay wallet guardada para la red ${newNetwork}`);
            }

            // Cambiar de red en el WalletManager
            await walletManager.switchNetwork(newNetwork);

            // Importar la wallet guardada
            await walletManager.importWallet(storedWallet.serialized, '');

            setLoading(false);
        } catch (error) {
            console.error('Error al cambiar de red:', error);
            setError(error instanceof Error ? error.message : 'Error al cambiar de red');
            setLoading(false);
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                when: "beforeChildren",
                staggerChildren: 0.1
            }
        },
        exit: { opacity: 0 }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: { type: "spring", stiffness: 100 }
        }
    };

    const isMorseNetwork = network === 'morse';

    // Solo mostrar acciones para Morse (botón Migrate) y Shannon (botón Swap)
    const actions = isMorseNetwork ? [
        { label: 'Migrate', icon: '🔄', color: 'from-blue-600/30 to-indigo-600/30', onClick: () => handleSwitchToShannon() },
        {
            label: 'Import Wallet', icon: '📥', color: 'from-green-600/30 to-emerald-600/30', onClick: () => {
                console.log('Navigating to import individual...');
                navigate('/import/individual');
            }
        }
    ] : [
        { label: 'Swap', icon: '↔', color: 'from-purple-600/30 to-pink-600/30', onClick: onSwap },
        {
            label: 'Import Wallet', icon: '📥', color: 'from-green-600/30 to-emerald-600/30', onClick: () => {
                console.log('Navigating to import individual...');
                navigate('/import/individual');
            }
        }
    ];

    // Determinar si debemos deshabilitar funciones debido al modo offline
    const isOffline = walletManager?.isOfflineMode ? walletManager.isOfflineMode() : false;
    const disableFeatures = isOffline && isMorseNetwork;

    return (
        <motion.div
            className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white pb-20"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={containerVariants}
        >
            {/* Barra superior con información de red */}
            <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700/50 p-4 sticky top-0 z-10">
                <div className="container mx-auto flex justify-between items-center">
                    <div className="flex items-center">
                        <span className={`w-3 h-3 rounded-full mr-2 ${isOffline ? 'bg-red-500' : 'bg-green-500'}`}></span>
                        <span className="font-medium">
                            Network {network.charAt(0).toUpperCase() + network.slice(1)}
                            {isMainnet === true ? ' Mainnet' : ' Testnet'}
                            {isOffline ? ' - Offline Mode' : ''}
                        </span>
                    </div>
                    <button
                        onClick={onLogout}
                        className="text-gray-400 hover:text-white transition-colors"
                        title="Logout"
                    >
                        <i className="fas fa-sign-out-alt"></i>
                    </button>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8">
                <AnimatePresence mode="wait">
                    {isMorseNetwork && (
                        <motion.div
                            className="mb-6 p-4 bg-yellow-500/20 border-l-4 border-yellow-500 text-yellow-100 rounded-r-lg"
                            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                            animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
                            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                        >
                            <p><strong>Advice:</strong> {ERROR_MESSAGES.MORSE_DEPRECATED}</p>
                        </motion.div>
                    )}

                    {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <LoadingSpinner size="large" color="border-blue-500" />
                        </div>
                    ) : (
                        <>
                            <motion.section
                                className="bg-gray-900/50 backdrop-blur-sm rounded-2xl p-8 mb-8 border border-gray-800/50"
                                variants={itemVariants}
                            >
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                                    <div>
                                        <h1 className="text-3xl font-bold mb-1">{formattedBalanceValue} <span className="text-blue-400">POKT</span></h1>
                                        <p className="text-gray-400">{walletAddress}</p>
                                    </div>
                                </div>
                            </motion.section>

                            <motion.section
                                className="mb-8"
                                variants={itemVariants}
                            >
                                <h2 className="text-xl font-semibold mb-4 text-gray-300">Quick Actions</h2>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {actions.map((action) => {
                                        const isImportAction = action.label === 'Import Wallet';
                                        const shouldDisable = disableFeatures && !isImportAction;

                                        return (
                                            <motion.button
                                                key={action.label}
                                                className={`p-6 bg-gradient-to-r ${action.color} rounded-xl text-center transition-all duration-200 border border-gray-700/50 hover:border-gray-600/50 ${shouldDisable ? 'opacity-70 cursor-not-allowed' : ''}`}
                                                whileHover={!shouldDisable ? { scale: 1.02, y: -2 } : {}}
                                                whileTap={!shouldDisable ? { scale: 0.98 } : {}}
                                                variants={itemVariants}
                                                disabled={shouldDisable}
                                                title={shouldDisable ? 'This feature is not available in offline mode' : ''}
                                                onClick={action.onClick}
                                            >
                                                <span className="block text-3xl mb-3">{action.icon}</span>
                                                <span className="text-lg font-medium">{action.label}</span>
                                                {shouldDisable && (
                                                    <span className="block text-xs mt-2 text-red-300">Not available</span>
                                                )}
                                            </motion.button>
                                        );
                                    })}
                                </div>
                            </motion.section>

                            {/* Transaction History */}
                            <motion.section
                                className="mb-8"
                                variants={itemVariants}
                            >
                                <TransactionHistory
                                    transactions={transactionsList}
                                    walletAddress={walletAddress}
                                    isLoading={loading}
                                    onRefresh={fetchBalanceAndTransactions}
                                />
                            </motion.section>

                            {/* Advertencia de modo offline */}
                            {showOfflineWarning && (
                                <motion.div
                                    className="mt-8 p-6 bg-gradient-to-r from-purple-600/30 to-blue-600/30 rounded-xl border border-purple-500/50 text-center"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 20 }}
                                    transition={{ type: "spring", stiffness: 100 }}
                                >
                                    <h3 className="text-lg font-semibold text-white mb-3">
                                        <i className="fas fa-exclamation-triangle text-yellow-400 text-2xl mr-2"></i>
                                        Limited connectivity
                                    </h3>
                                    <p className="text-gray-300 mb-4">
                                        {isMorseNetwork ? ERROR_MESSAGES.MORSE_DEPRECATED : 'Could not connect to the network. Some features will be limited.'}
                                    </p>
                                    <div className="mt-3 flex flex-wrap gap-2 justify-center">
                                        <button
                                            onClick={handleReconnect}
                                            className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl transition-all duration-200"
                                        >
                                            Try again
                                        </button>
                                        {isMorseNetwork && (
                                            <button
                                                onClick={handleSwitchToShannon}
                                                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-all duration-200"
                                            >
                                                Switch to Shannon
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </>
                    )}
                </AnimatePresence>
            </main>
        </motion.div>
    );
};

export default WalletDashboard;