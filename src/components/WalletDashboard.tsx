import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WalletDashboardProps } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import { ERROR_MESSAGES, DEBUG_CONFIG } from '../controller/config';
import { WalletManager, Transaction, NetworkType } from '../controller/WalletManager';
import LoadingSpinner from './LoadingSpinner';
import TransactionHistory from './TransactionHistory';
import { formatBalance, shortenAddress } from '../utils/utils';
import { storageService } from '../controller/storage.service';
import MigrationDialog from './MigrationDialog';
import { morseWalletService } from '../controller/MorseWallet';
// Importar Firebase Analytics
import { trackEvent } from '../firebase';

interface StoredWallet {
    serialized: string;
    network: NetworkType;
    timestamp: number;
    parsed: any;
}

// Función para obtener transacciones directamente desde la API RPC de Shannon
const fetchShannonTransactions = async (address: string): Promise<any[]> => {
    try {
        DEBUG_CONFIG.log('🔍 Fetching Shannon transactions directly from RPC API...');

        // URL de la API RPC de Shannon
        const rpcUrl = 'https://shannon-grove-rpc.mainnet.poktroll.com/';

        // Consulta para transacciones enviadas
        const sendQuery = {
            jsonrpc: '2.0',
            id: Math.floor(Math.random() * 1000000000),
            method: 'tx_search',
            params: [`message.sender='${address}'`, true, '1', '100', 'desc']
        };

        // Consulta para transacciones recibidas
        const receiveQuery = {
            jsonrpc: '2.0',
            id: Math.floor(Math.random() * 1000000000),
            method: 'tx_search',
            params: [`transfer.recipient='${address}'`, true, '1', '100', 'desc']
        };

        // Realizar ambas consultas en paralelo
        const [sendResponse, receiveResponse] = await Promise.all([
            fetch(rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sendQuery)
            }),
            fetch(rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(receiveQuery)
            })
        ]);

        // Procesar las respuestas
        const sendData = await sendResponse.json();
        const receiveData = await receiveResponse.json();

        // Extraer las transacciones
        const sentTxs = sendData.result?.txs || [];
        const receivedTxs = receiveData.result?.txs || [];

        // Combinar todas las transacciones
        const allTxs = [...sentTxs, ...receivedTxs];

        DEBUG_CONFIG.log(`✅ Found ${allTxs.length} Shannon transactions directly from RPC`);
        return allTxs;
    } catch (error) {
        DEBUG_CONFIG.error('❌ Error fetching Shannon transactions directly:', error);
        return [];
    }
};

const WalletDashboard: React.FC<WalletDashboardProps> = ({
    walletAddress,
    balance,
    transactions: initialTransactions,
    onSwap,
    network = 'shannon',
    isMainnet = true,
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
    const [showMigrationDialog, setShowMigrationDialog] = useState<boolean>(false);
    const [morsePrivateKey, setMorsePrivateKey] = useState<string | null>(null);
    const navigate = useNavigate();
    // NOTE: Do NOT call onLogout directly from parent or on button click. Only call from handleLogoutConfirm/modal.
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    
    // Shannon wallet mnemonic reminder popup state
    const [showShannonMnemonicReminder, setShowShannonMnemonicReminder] = useState(false);

    const handleLogoutClick = () => {
        setShowLogoutConfirm(true);
    };

    const handleLogoutConfirm = () => {
        setShowLogoutConfirm(false);
        // Pass the current network to onLogout for network-specific logout
        onLogout(network);
    };

    const handleLogoutCancel = () => {
        setShowLogoutConfirm(false);
    };

    const fetchBalanceAndTransactions = useCallback(async () => {
        try {
            if (!walletAddress) {
                DEBUG_CONFIG.log('No wallet address provided, skipping balance fetch');
                return;
            }

            setLoading(true);
            DEBUG_CONFIG.log(`🔄 Fetching balance and transactions for ${walletAddress} on ${network} (mainnet: ${isMainnet})`);

            // Verificar si walletManager está definido antes de usarlo
            if (!walletManager) {
                DEBUG_CONFIG.warn('WalletManager no está inicializado. Esperando inicialización...');
                setShowOfflineWarning(true);
                setLoading(false);
                return;
            }

            // Verificar si estamos en modo offline
            const isOffline = walletManager.isOfflineMode ? walletManager.isOfflineMode() : false;
            setShowOfflineWarning(isOffline);

            // Obtener balance aunque estemos en modo offline (devolverá 0)
            const fetchedBalance = await walletManager.getBalance(walletAddress);
            DEBUG_CONFIG.log(`💰 Fetched balance for ${walletAddress}: ${fetchedBalance}`);

            // Actualizar el balance siempre, incluso cuando es 0
            setFormattedBalanceValue(formatBalance(fetchedBalance, isMainnet));

            // Disparar evento de actualización para que otros componentes se actualicen
            window.dispatchEvent(new CustomEvent('wallet_balance_updated', {
                detail: { address: walletAddress, balance: fetchedBalance }
            }));

            // Intentar obtener transacciones solo si no estamos en modo offline
            if (!isOffline) {
                try {
                    // Primero intentar con el método normal
                    const fetchedTransactions = await walletManager.getTransactions(walletAddress);

                    // Si no hay transacciones y estamos en Shannon, intentar directamente con la API RPC
                    if (fetchedTransactions.length === 0 && network === 'shannon') {
                        DEBUG_CONFIG.log('No se encontraron transacciones con el método normal, intentando directamente con RPC...');
                        const directTransactions = await fetchShannonTransactions(walletAddress);
                        if (directTransactions.length > 0) {
                            setTransactionsList(directTransactions);
                        } else {
                            setTransactionsList(fetchedTransactions);
                        }
                    } else {
                        setTransactionsList(fetchedTransactions);
                    }
                } catch (txError) {
                    DEBUG_CONFIG.error('Error obteniendo transacciones con el método normal:', txError);

                    // Si hay un error y estamos en Shannon, intentar directamente con la API RPC
                    if (network === 'shannon') {
                        DEBUG_CONFIG.log('Intentando obtener transacciones directamente con RPC debido a error...');
                        const directTransactions = await fetchShannonTransactions(walletAddress);
                        setTransactionsList(directTransactions);
                    } else {
                        setTransactionsList([]);
                    }
                }
            } else {
                setTransactionsList([]);
            }
        } catch (error) {
            DEBUG_CONFIG.error('Error al obtener datos de la wallet:', error);
            setShowOfflineWarning(true);
        } finally {
            setLoading(false);
        }
    }, [walletManager, walletAddress, network, isMainnet]);

    // Actualizar cuando cambian las props
    useEffect(() => {
        // Siempre actualizar el balance formateado, incluso cuando es 0
        if (balance !== undefined) {
            setFormattedBalanceValue(formatBalance(balance, isMainnet));
            DEBUG_CONFIG.log('⚡ WalletDashboard: Balance prop updated:', balance);
        }
    }, [balance, isMainnet]);

    // Efecto para obtener balance y transacciones
    useEffect(() => {
        // Solo intentar obtener datos si tenemos una dirección válida
        if (walletAddress) {
            DEBUG_CONFIG.log(`⚡ WalletDashboard: Wallet/network changed - fetching data for ${walletAddress} (${network})`);
            fetchBalanceAndTransactions();
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
                DEBUG_CONFIG.error('Error al cargar wallets:', error);
                setError('Error al cargar las wallets guardadas');
            }
        };

        // Listener for migration prerequisites refresh
        const handleMigrationCheck = () => {
            DEBUG_CONFIG.log('🔄 WalletDashboard: Migration prerequisites refresh triggered');
            // Add small delay to ensure storage operations are complete
            setTimeout(() => {
                loadStoredWallets();
            }, 100);
        };

        loadStoredWallets();
        
        // Add event listener for migration check
        window.addEventListener('migration_check_needed', handleMigrationCheck);

        return () => {
            window.removeEventListener('migration_check_needed', handleMigrationCheck);
        };
    }, []);

    // Escuchar cambios en el storage para actualizar automáticamente
    useEffect(() => {
        const handleStorageUpdate = () => {
            DEBUG_CONFIG.log('📦 Storage updated in WalletDashboard - refreshing data...');
            fetchBalanceAndTransactions();
        };

        const handleWalletDataUpdate = (event: CustomEvent) => {
            const { address, balance } = event.detail;
            DEBUG_CONFIG.log(`💰 WalletDashboard received wallet_data_updated event for ${address} with balance ${balance}`);

            // Solo actualizar si es para nuestra wallet actual
            if (address === walletAddress) {
                // Siempre actualizar el balance, incluso si es 0
                setFormattedBalanceValue(formatBalance(balance, isMainnet));
                DEBUG_CONFIG.log(`💰 Balance updated to: ${balance} (formatted: ${formatBalance(balance, isMainnet)})`);
            }
        };

        // Escuchar eventos customizados de storage
        window.addEventListener('storageUpdate', handleStorageUpdate);
        window.addEventListener('wallet_data_updated', handleWalletDataUpdate as EventListener);

        // También escuchar el evento wallet_balance_updated
        window.addEventListener('wallet_balance_updated', handleWalletDataUpdate as EventListener);

        return () => {
            window.removeEventListener('storageUpdate', handleStorageUpdate);
            window.removeEventListener('wallet_data_updated', handleWalletDataUpdate as EventListener);
            window.removeEventListener('wallet_balance_updated', handleWalletDataUpdate as EventListener);
        };
    }, [fetchBalanceAndTransactions, walletAddress, isMainnet]);

    // Check for Shannon mnemonic reminder flag on component mount
    useEffect(() => {
        const checkMnemonicReminder = async () => {
            try {
                const shouldShowReminder = await storageService.get<boolean>('show_shannon_mnemonic_reminder');
                if (shouldShowReminder && network === 'shannon') {
                    DEBUG_CONFIG.log('🔔 Showing Shannon mnemonic reminder on wallet dashboard');
                    setShowShannonMnemonicReminder(true);
                    // Clear the flag so it doesn't show again
                    await storageService.remove('show_shannon_mnemonic_reminder');
                    
                    // Auto-hide after 15 seconds
                    setTimeout(() => {
                        setShowShannonMnemonicReminder(false);
                    }, 15000);
                }
            } catch (error) {
                console.error('Error checking mnemonic reminder flag:', error);
            }
        };
        
        checkMnemonicReminder();
    }, [network]); // Re-run if network changes

    // Función para intentar reconectar manualmente
    const handleReconnect = async () => {
        try {
            if (!walletManager) {
                DEBUG_CONFIG.warn('WalletManager no está inicializado');
                return;
            }
            setLoading(true);
            setError(null);

            // CORREGIR: El WalletManager espera isTestnet, no isMainnet
            const isTestnet = !isMainnet; // Negar directamente - más simple y confiable
            DEBUG_CONFIG.log(`🔍 DEBUG WalletDashboard handleReconnect: isMainnet=${isMainnet}, isTestnet=${isTestnet}`);

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
                DEBUG_CONFIG.warn('WalletManager no está inicializado');
                return;
            }
            setLoading(true);
            setError(null);

            // CORREGIR: El WalletManager espera isTestnet, no isMainnet
            const isTestnet = !isMainnet; // Negar directamente - más simple y confiable
            DEBUG_CONFIG.log(`🔍 DEBUG WalletDashboard handleSwitchToShannon: isMainnet=${isMainnet}, isTestnet=${isTestnet}`);

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
                DEBUG_CONFIG.warn('WalletManager no está inicializado');
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
            DEBUG_CONFIG.error('Error al cambiar de red:', error);
            setError(error instanceof Error ? error.message : 'Error al cambiar de red');
            setLoading(false);
        }
    };

    // Función para abrir el diálogo de migración
    const handleMigrationRequest = async () => {
        try {
            DEBUG_CONFIG.log('🔄 Opening migration dialog...');

            // Verificar si hay wallets de Morse disponibles
            const morseWalletsData = await storageService.get<any[]>('morse_wallets');
            const legacyMorseWallet = await storageService.get<any>('morse_wallet');
            
            DEBUG_CONFIG.log('🔍 Migration debug - Morse wallets:', {
                morseWalletsData: morseWalletsData ? morseWalletsData.length : 0,
                legacyMorseWallet: legacyMorseWallet ? 'EXISTS' : 'NOT_FOUND',
                legacyMorseAddress: legacyMorseWallet?.parsed?.address
            });
            
            const hasMorseWallets = (Array.isArray(morseWalletsData) && morseWalletsData.length > 0) ||
                (legacyMorseWallet && legacyMorseWallet.parsed?.address);

            // Verificar si hay wallets de Shannon disponibles
            const shannonWalletsData = await storageService.get<any[]>('shannon_wallets');
            const legacyShannonWallet = await storageService.get<any>('shannon_wallet');
            
            DEBUG_CONFIG.log('🔍 Migration debug - Shannon wallets:', {
                shannonWalletsData: shannonWalletsData ? shannonWalletsData.length : 0,
                legacyShannonWallet: legacyShannonWallet ? 'EXISTS' : 'NOT_FOUND',
                legacyShannonAddress: legacyShannonWallet?.parsed?.address,
                legacyShannonWalletPreview: legacyShannonWallet
            });
            
            const hasShannonWallets = (Array.isArray(shannonWalletsData) && shannonWalletsData.length > 0) ||
                (legacyShannonWallet && legacyShannonWallet.parsed?.address);

            DEBUG_CONFIG.log('🔍 Migration debug - Final checks:', {
                hasMorseWallets,
                hasShannonWallets
            });

            // Si no hay wallets de Morse, redirigir a la página de importación de Morse
            if (!hasMorseWallets) {
                DEBUG_CONFIG.log('⚠️ No Morse wallets found. Redirecting to import page...');
                navigate('/import/individual?network=morse&message=You need to import your Morse wallet first to perform migration.');
                return;
            }

            // Si no hay wallets de Shannon, redirigir a la página de importación de Shannon
            if (!hasShannonWallets) {
                DEBUG_CONFIG.log('⚠️ No Shannon wallets found. Redirecting to import page...');
                navigate('/import/individual?network=shannon&message=You need to import your Shannon wallet first to perform migration.');
                return;
            }

            // Check for Morse wallet data (private key OR PKK armored key)
            DEBUG_CONFIG.log('🔑 Checking for Morse wallet data (private key or PKK armored)...');
            try {
                // First try to get private key
                const privateKey = await morseWalletService.getMorsePrivateKey();
                
                // If no private key, check for PKK armored wallets
                let hasPKKArmoredWallet = false;
                if (!privateKey) {
                    const { storageService } = await import('../controller/storage.service');
                    const morseWalletsData = await storageService.get<any[]>('morse_wallets') || [];
                    
                    // Check if any Morse wallet has PKK armored data
                    hasPKKArmoredWallet = morseWalletsData.some((wallet: any) => {
                        return wallet.parsed?.ppkData || 
                               (wallet.parsed?.kdf && wallet.parsed?.salt && wallet.parsed?.ciphertext);
                    });
                    
                    DEBUG_CONFIG.log('🔐 PKK armored wallet check:', {
                        morseWalletsCount: morseWalletsData.length,
                        hasPKKArmoredWallet,
                        walletsWithPKK: morseWalletsData.filter(w => w.parsed?.ppkData || (w.parsed?.kdf && w.parsed?.salt && w.parsed?.ciphertext)).length
                    });
                }

                DEBUG_CONFIG.log('🔑 Morse wallet data result:', {
                    hasPrivateKey: !!privateKey,
                    privateKeyLength: privateKey ? privateKey.length : 0,
                    privateKeyPreview: privateKey ? privateKey.substring(0, 10) + '...' : 'null',
                    hasPKKArmoredWallet
                });

                if (!privateKey && !hasPKKArmoredWallet) {
                    DEBUG_CONFIG.error('❌ No Morse wallet data found (neither private key nor PKK armored)');
                    setError('No Morse wallet found. Please import a Morse wallet first.');
                    return;
                }

                DEBUG_CONFIG.log('✅ All migration prerequisites met. Opening migration dialog...');
                setMorsePrivateKey(privateKey); // Will be null for PKK wallets, but that's fine
                setShowMigrationDialog(true);
                DEBUG_CONFIG.log('✅ Migration dialog state updated:', {
                    showMigrationDialog: true,
                    morsePrivateKeySet: !!privateKey,
                    hasPKKArmoredWallet
                });
            } catch (error) {
                DEBUG_CONFIG.error('❌ Error checking Morse wallet data:', error);
                setError(`Error checking Morse wallet data: ${error instanceof Error ? error.message : String(error)}`);
                return;
            }
        } catch (error) {
            DEBUG_CONFIG.error('❌ Error opening migration dialog:', error);
            setError('Error al abrir el diálogo de migración');
        }
    };

    // Función para cerrar el diálogo de migración
    const handleCloseMigrationDialog = () => {
        setShowMigrationDialog(false);
        setMorsePrivateKey(null);
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

    // Solo mostrar acciones para Morse (botón Migrate) y Shannon (sin Swap)
    const actions = isMorseNetwork ? [
        { 
            label: 'Migrate', 
            icon: '🔄', 
            color: 'from-blue-600/30 to-indigo-600/30', 
            onClick: () => {
                DEBUG_CONFIG.log('🔄 Migrate button clicked (Morse network)');
                handleMigrationRequest();
            }
        },
        {
            label: 'Import Wallet', icon: '📥', color: 'from-green-600/30 to-emerald-600/30', onClick: () => {
                DEBUG_CONFIG.log('Navigating to import individual...');
                navigate('/import/individual');
            }
        }
    ] : [
        { 
            label: 'Migrate', 
            icon: '🔄', 
            color: 'from-blue-600/30 to-indigo-600/30', 
            onClick: () => {
                DEBUG_CONFIG.log('🔄 Migrate button clicked (Shannon network)');
                handleMigrationRequest();
            }
        },
        {
            label: 'Import Wallet', icon: '📥', color: 'from-green-600/30 to-emerald-600/30', onClick: () => {
                DEBUG_CONFIG.log('Navigating to import individual...');
                navigate('/import/individual');
            }
        }
    ];

    // Determinar si debemos deshabilitar funciones debido al modo offline
    const isOffline = walletManager?.isOfflineMode ? walletManager.isOfflineMode() : false;
    const disableFeatures = isOffline && isMorseNetwork;

    // Safety check: if walletManager is null, don't disable migrate button
    if (!walletManager) {
        console.warn('⚠️ WalletManager is null - migrate button will remain enabled');
    }

    // Calculate actual shouldDisable for migrate button
    const isMigrateAction = true; // For migrate button
    const isImportAction = false; // For migrate button
    const actualShouldDisableMigrate = disableFeatures && !isImportAction && !isMigrateAction;

    // DEBUG: Log the values to understand why migrate button might be disabled
    console.log('🔍 WalletDashboard Debug - Migrate Button Status:', {
        network,
        isMorseNetwork,
        walletManagerExists: !!walletManager,
        hasIsOfflineMethod: !!(walletManager?.isOfflineMode),
        isOffline,
        disableFeatures,
        actualShouldDisableMigrate, // This is the real value for migrate button
        calculation: `${disableFeatures} && !${isImportAction} && !${isMigrateAction} = ${actualShouldDisableMigrate}`
    });

    return (
        <motion.div
            className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white pb-20 rounded-t-lg"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={containerVariants}
        >
            {/* Barra superior con información de red */}
            <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700/50 p-4 sticky top-0 z-10 rounded-t-lg">
                <div className="container mx-auto flex justify-between items-center">
                    <div className="flex items-center">
                        <span className={`w-3 h-3 rounded-full mr-2 ${isOffline ? 'bg-red-500' : 'bg-green-500'}`}></span>
                        <span className="font-medium">
                            Network {network.charAt(0).toUpperCase() + network.slice(1)}
                            {(() => {
                                DEBUG_CONFIG.log('🔍 DEBUG isMainnet:', { value: isMainnet, type: typeof isMainnet, boolean: Boolean(isMainnet) });
                                const isMainnetBool = Boolean(isMainnet);
                                return isMainnetBool ? ' Mainnet' : ' Testnet';
                            })()}
                            {isOffline ? ' - Offline Mode' : ''}
                        </span>
                    </div>
                </div>
            </header>

            {/* Shannon Mnemonic Reminder Popup */}
            {showShannonMnemonicReminder && (
                <motion.div
                    className="container mx-auto p-4"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    <div className="bg-green-900/50 text-green-300 p-6 rounded-xl border border-green-700/50 flex items-start">
                        <i className="fas fa-check-circle text-green-400 text-2xl mr-4 mt-1"></i>
                        <div className="flex-1">
                            <h3 className="font-semibold mb-2 text-xl">Shannon Wallet Created Successfully! 🎉</h3>
                            <div className="bg-green-800/30 border border-green-700 rounded-lg p-4 mb-3">
                                <p className="text-green-200 font-semibold mb-2">
                                    <i className="fas fa-exclamation-triangle mr-2"></i>
                                    IMPORTANT: Save Your Secret Phrase Now!
                                </p>
                                <ul className="text-green-200 text-sm space-y-1 list-disc pl-5">
                                    <li>Your 24-word secret phrase is the ONLY way to recover your wallet</li>
                                    <li>Write it down on paper and store it securely offline</li>
                                    <li>Never share your secret phrase with anyone</li>
                                    <li>Consider making multiple backup copies in safe locations</li>
                                </ul>
                            </div>
                            <p className="text-sm text-green-300 mb-2">
                                You can view your secret phrase by clicking the wallet selector above and selecting "View Secret Phrase".
                            </p>
                            <p className="text-xs text-green-400/80 mb-3">
                                This message will auto-dismiss in 15 seconds.
                            </p>
                            <button
                                onClick={() => setShowShannonMnemonicReminder(false)}
                                className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white rounded-lg text-sm transition-colors"
                            >
                                I understand, dismiss this message
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Logout Confirmation Modal (always rendered at root) */}
            <AnimatePresence>
                {showLogoutConfirm && (
                    <motion.div
                        className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="bg-gray-900 rounded-xl p-8 border-2 border-gray-700 shadow-xl max-w-sm w-full text-center"
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                        >
                            <h2 className="text-xl font-bold mb-4">Confirm Logout</h2>
                            <p className="mb-6 text-gray-300">
                                Are you sure you want to logout from your {network.charAt(0).toUpperCase() + network.slice(1)} wallet?
                            </p>
                            <div className="flex justify-center gap-4">
                                <button
                                    className="px-6 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold"
                                    onClick={handleLogoutConfirm}
                                >
                                    Yes, Logout
                                </button>
                                <button
                                    className="px-6 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold"
                                    onClick={handleLogoutCancel}
                                >
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

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
                                    const isMigrateAction = action.label === 'Migrate';
                                    // Migration uses backend service (not direct RPC), so it's available even in offline mode
                                    const shouldDisable = disableFeatures && !isImportAction && !isMigrateAction;

                                    return (
                                        <motion.button
                                            key={action.label}
                                            className={`p-6 bg-gradient-to-r ${action.color} rounded-xl text-center transition-all duration-200 border border-gray-700/50 hover:border-gray-600/50 ${shouldDisable ? 'opacity-70 cursor-not-allowed' : ''}`}
                                            whileHover={!shouldDisable ? { scale: 1.02, y: -2 } : {}}
                                            whileTap={!shouldDisable ? { scale: 0.98 } : {}}
                                            variants={itemVariants}
                                            disabled={shouldDisable}
                                            title={shouldDisable ? 'This feature is not available in offline mode' : ''}
                                            onClick={(e) => {
                                                console.log(`🖱️ Button "${action.label}" clicked!`, {
                                                    shouldDisable,
                                                    disabled: shouldDisable,
                                                    hasOnClick: !!action.onClick
                                                });
                                                
                                                if (shouldDisable) {
                                                    console.log(`❌ Button "${action.label}" is disabled, preventing action`);
                                                    e.preventDefault();
                                                    return;
                                                }
                                                
                                                if (action.onClick) {
                                                    try {
                                                        action.onClick();
                                                    } catch (error) {
                                                        console.error(`Error in ${action.label} onClick:`, error);
                                                    }
                                                } else {
                                                    console.warn(`No onClick handler for ${action.label}`);
                                                }
                                            }}
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
                                networkType={network}
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
                </AnimatePresence>
            </main>

            {/* Migration Dialog */}
            {showMigrationDialog && (
                <MigrationDialog
                    isOpen={showMigrationDialog}
                    onClose={handleCloseMigrationDialog}
                    morsePrivateKey={morsePrivateKey || undefined}
                    morseAddress={walletAddress}
                />
            )}
        </motion.div>
    );
};

export default WalletDashboard;