import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WalletDashboardProps } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import { ERROR_MESSAGES, DEBUG_CONFIG } from '../controller/config';
import { backendUrl } from '../controller/config';
import { WalletManager, Transaction, NetworkType } from '../controller/WalletManager';
import LoadingSpinner from './LoadingSpinner';
import TransactionHistory from './TransactionHistory';
import { formatBalance, shortenAddress } from '../utils/utils';
import { storageService } from '../controller/storage.service';
import MigrationDialog from './MigrationDialog';
import { morseWalletService } from '../controller/MorseWallet';
import StakeDialog from './StakeDialog';
import { walletService } from '../controller/WalletService';

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

        // URL de la API RPC de Shannon - usar la URL correcta
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

        DEBUG_CONFIG.log('[STAKE] RPC queries:', { sendQuery, receiveQuery });

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

        DEBUG_CONFIG.log('[STAKE] RPC responses:', { sendData, receiveData });

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
    const [showStakeDialog, setShowStakeDialog] = useState(false);
    const [stakeResult, setStakeResult] = useState<null | { success: boolean, message: string, fileUrl?: string, fileName?: string, sessionId?: string, details?: any, executeResult?: any, statusResult?: any, stakeFiles?: any[], mnemonicsData?: any, mnemonicsUrl?: string, mnemonicsFileName?: string }>(null);
    const [executeLoading, setExecuteLoading] = useState(false);
    const [executeError, setExecuteError] = useState<string | null>(null);
    const [executeNetwork, setExecuteNetwork] = useState('main');
    const [executePassphrase, setExecutePassphrase] = useState('');
    const [autoRefreshInterval, setAutoRefreshInterval] = useState<NodeJS.Timeout | null>(null);
    const [showStakeConfirmation, setShowStakeConfirmation] = useState(false);
    const [pendingStakeNodes, setPendingStakeNodes] = useState<number>(0);

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
                    DEBUG_CONFIG.log('[STAKE] Normal method returned transactions:', fetchedTransactions.length);

                    // Si no hay transacciones y estamos en Shannon, intentar directamente con la API RPC
                    if (fetchedTransactions.length === 0 && network === 'shannon') {
                        DEBUG_CONFIG.log('No se encontraron transacciones con el método normal, intentando directamente con RPC...');
                        const directTransactions = await fetchShannonTransactions(walletAddress);
                        if (directTransactions.length > 0) {
                            setTransactionsList(directTransactions);
                            DEBUG_CONFIG.log('[STAKE] Direct RPC method found transactions:', directTransactions.length);
                        } else {
                            setTransactionsList(fetchedTransactions);
                            DEBUG_CONFIG.log('[STAKE] No transactions found with either method');
                        }
                    } else {
                        setTransactionsList(fetchedTransactions);
                        DEBUG_CONFIG.log('[STAKE] Using normal method transactions:', fetchedTransactions.length);
                    }
                } catch (txError) {
                    DEBUG_CONFIG.error('Error obteniendo transacciones con el método normal:', txError);

                    // Si hay un error y estamos en Shannon, intentar directamente con la API RPC
                    if (network === 'shannon') {
                        DEBUG_CONFIG.log('Intentando obtener transacciones directamente con RPC debido a error...');
                        try {
                            const directTransactions = await fetchShannonTransactions(walletAddress);
                            setTransactionsList(directTransactions);
                            DEBUG_CONFIG.log('[STAKE] Fallback RPC method found transactions:', directTransactions.length);
                        } catch (directError) {
                            DEBUG_CONFIG.error('Error with direct RPC method:', directError);
                            setTransactionsList([]);
                        }
                    } else {
                        setTransactionsList([]);
                    }
                }
            } else {
                setTransactionsList([]);
                DEBUG_CONFIG.log('[STAKE] Offline mode - no transactions loaded');
            }
        } catch (error) {
            DEBUG_CONFIG.error('Error al obtener datos de la wallet:', error);
            setShowOfflineWarning(true);
        } finally {
            setLoading(false);
        }
    }, [walletManager, walletAddress, network, isMainnet]);

    // Function to fetch only the balance
    const fetchBalanceOnly = useCallback(async () => {
        try {
            if (!walletAddress) return;
            if (!walletManager) return;
            setLoading(true);
            const fetchedBalance = await walletManager.getBalance(walletAddress);
            setFormattedBalanceValue(formatBalance(fetchedBalance, isMainnet));
            window.dispatchEvent(new CustomEvent('wallet_balance_updated', {
                detail: { address: walletAddress, balance: fetchedBalance }
            }));
        } catch (error) {
            DEBUG_CONFIG.error('Error fetching balance only:', error);
        } finally {
            setLoading(false);
        }
    }, [walletManager, walletAddress, isMainnet]);

    // Auto-refresh balance every 30 seconds
    useEffect(() => {
        if (!walletAddress || !walletManager) return;
        if (autoRefreshInterval) clearInterval(autoRefreshInterval);
        const interval = setInterval(() => {
            fetchBalanceOnly();
        }, 30000); // 30 seconds
        setAutoRefreshInterval(interval);
        return () => clearInterval(interval);
    }, [walletAddress, walletManager, fetchBalanceOnly]);

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

        loadStoredWallets();
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
            const hasMorseWallets = (Array.isArray(morseWalletsData) && morseWalletsData.length > 0) ||
                (legacyMorseWallet && legacyMorseWallet.parsed?.address);

            // Verificar si hay wallets de Shannon disponibles
            const shannonWalletsData = await storageService.get<any[]>('shannon_wallets');
            const legacyShannonWallet = await storageService.get<any>('shannon_wallet');
            const hasShannonWallets = (Array.isArray(shannonWalletsData) && shannonWalletsData.length > 0) ||
                (legacyShannonWallet && legacyShannonWallet.parsed?.address);

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

            // Obtener la clave privada de Morse
            const privateKey = await morseWalletService.getMorsePrivateKey();

            if (!privateKey) {
                setError('I cannot get the private key of morse. please import a valid morse wallet.');
                return;
            }

            setMorsePrivateKey(privateKey);
            setShowMigrationDialog(true);
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

    // Method to generate transactions from stake file content
    const generateTransactionsFromFileContent = async (
        stakeFileContent: any,
        ownerAddress: string,
        network: string
    ): Promise<any[]> => {
        try {
            DEBUG_CONFIG.log('[STAKE] Generating transactions from stake file content:', {
                stakeFileContent,
                ownerAddress,
                network,
                contentType: typeof stakeFileContent,
                isArray: Array.isArray(stakeFileContent),
                keys: stakeFileContent && typeof stakeFileContent === 'object' ? Object.keys(stakeFileContent) : 'N/A'
            });

            if (!stakeFileContent) {
                throw new Error('No stake file content provided');
            }

            // Handle different formats of stake file content
            let transactions: any[] = [];

            if (Array.isArray(stakeFileContent)) {
                DEBUG_CONFIG.log('[STAKE] Stake file content is an array, processing each item as a stake file');
                // Each item in the array is a separate stake file
                for (let i = 0; i < stakeFileContent.length; i++) {
                    const stakeFile = stakeFileContent[i];
                    DEBUG_CONFIG.log(`[STAKE] Processing stake file ${i + 1}/${stakeFileContent.length}:`, stakeFile);
                    
                    const transaction = await generateTransactionFromStakeFile(stakeFile, ownerAddress, network);
                    transactions.push(transaction);
                }
            } else if (typeof stakeFileContent === 'object') {
                DEBUG_CONFIG.log('[STAKE] Stake file content is a single object, processing as single stake file');
                const transaction = await generateTransactionFromStakeFile(stakeFileContent, ownerAddress, network);
                transactions.push(transaction);
            } else if (typeof stakeFileContent === 'string') {
                // Check if it's YAML content (starts with key-value pairs)
                if (stakeFileContent.includes('stake_amount:') || stakeFileContent.includes('owner_address:')) {
                    DEBUG_CONFIG.log('[STAKE] Stake file content is YAML, processing directly');
                    const transaction = await generateTransactionFromStakeFile(stakeFileContent, ownerAddress, network);
                    transactions.push(transaction);
                } else {
                    // Try to parse as JSON only if it doesn't look like YAML
                    try {
                        const parsed = JSON.parse(stakeFileContent);
                        DEBUG_CONFIG.log('[STAKE] Parsed string content as JSON');
                        if (Array.isArray(parsed)) {
                            for (let i = 0; i < parsed.length; i++) {
                                const transaction = await generateTransactionFromStakeFile(parsed[i], ownerAddress, network);
                                transactions.push(transaction);
                            }
                        } else {
                            const transaction = await generateTransactionFromStakeFile(parsed, ownerAddress, network);
                            transactions.push(transaction);
                        }
                    } catch (parseError) {
                        // If JSON parsing fails, treat as YAML
                        DEBUG_CONFIG.log('[STAKE] JSON parsing failed, treating as YAML content');
                        const transaction = await generateTransactionFromStakeFile(stakeFileContent, ownerAddress, network);
                        transactions.push(transaction);
                    }
                }
            } else {
                throw new Error(`Unsupported stake file content type: ${typeof stakeFileContent}`);
            }

            DEBUG_CONFIG.log('[STAKE] Generated transactions:', {
                count: transactions.length,
                transactions: transactions.map((tx, i) => ({
                    index: i,
                    type: typeof tx,
                    isObject: typeof tx === 'object',
                    keys: tx && typeof tx === 'object' ? Object.keys(tx) : 'N/A',
                    hasMessages: tx && typeof tx === 'object' && Array.isArray(tx.messages),
                    messagesCount: tx && typeof tx === 'object' && Array.isArray(tx.messages) ? tx.messages.length : 0
                }))
            });

            return transactions;
        } catch (error) {
            DEBUG_CONFIG.error('[STAKE] Error generating transactions from file content:', error);
            throw new Error(`Failed to generate transactions from file content: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    // Helper function to generate a single transaction from a stake file
    const generateTransactionFromStakeFile = async (
        stakeFile: any,
        ownerAddress: string,
        network: string
    ): Promise<any> => {
        DEBUG_CONFIG.log('[STAKE] Generating transaction from stake file:', {
            stakeFile,
            ownerAddress,
            network
        });

        // If stakeFile is a string (YAML content), parse it
        let stakeData = stakeFile;
        if (typeof stakeFile === 'string') {
            DEBUG_CONFIG.log('[STAKE] Stake file is YAML string, parsing...');
            try {
                // Simple YAML parsing for the stake file structure
                stakeData = parseYamlStakeFile(stakeFile);
                DEBUG_CONFIG.log('[STAKE] Parsed YAML stake data:', stakeData);
            } catch (parseError) {
                throw new Error(`Failed to parse YAML stake file: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
            }
        }

        // Extract stake information from the stake file
        const stakeAmount = stakeData.stake_amount || stakeData.amount || "60005000000"; // 60,005 POKT in upokt
        const services = stakeData.services || ["0001"];
        const relayChain = stakeData.relay_chain || stakeData.relayChain || "0001";
        const operatorAddress = stakeData.operator_address || stakeData.operatorAddress;

        DEBUG_CONFIG.log('[STAKE] Extracted stake information:', {
            stakeAmount,
            services,
            relayChain,
            operatorAddress
        });

        // Create the proper POKT supplier staking message
        // This follows the POKT network's expected message structure
        const stakeMessage = {
            typeUrl: "/pokt.supplier.MsgStakeSupplier",
            value: {
                address: operatorAddress || ownerAddress,
                stake: {
                    amount: stakeAmount,
                    denom: "upokt"
                },
                services: services.map((service: any) => {
                    if (typeof service === 'string') {
                        return {
                            service: service,
                            endpoints: []
                        };
                    } else if (service.service_id) {
                        return {
                            service: service.service_id,
                            endpoints: service.endpoints || []
                        };
                    } else {
                        return {
                            service: service,
                            endpoints: []
                        };
                    }
                })
            }
        };

        // Create the transaction structure with proper POKT format
        const transaction = {
            messages: [stakeMessage],
            fee: {
                amount: [{ denom: 'upokt', amount: '200000' }],
                gas: '200000'
            },
            memo: `Stake supplier transaction for ${services.join(',')} services`,
            timeoutHeight: '0'
        };

        DEBUG_CONFIG.log('[STAKE] Generated POKT supplier staking transaction:', {
            typeUrl: stakeMessage.typeUrl,
            address: stakeMessage.value.address,
            stakeAmount: stakeMessage.value.stake.amount,
            services: stakeMessage.value.services,
            fee: transaction.fee
        });

        return transaction;
    };

    // Helper function to parse YAML stake file content
    const parseYamlStakeFile = (yamlContent: string): any => {
        DEBUG_CONFIG.log('[STAKE] Parsing YAML content:', yamlContent.substring(0, 200) + '...');
        
        const result: any = {};
        const lines = yamlContent.split('\n');
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('#')) continue;
            
            // Handle simple key-value pairs
            if (trimmedLine.includes(':')) {
                const colonIndex = trimmedLine.indexOf(':');
                const key = trimmedLine.substring(0, colonIndex).trim();
                const value = trimmedLine.substring(colonIndex + 1).trim();
                
                if (key === 'stake_amount') {
                    // Extract numeric value from "60005000000upokt"
                    const numericValue = value.replace(/[^\d]/g, '');
                    result.stake_amount = numericValue;
                } else if (key === 'owner_address') {
                    result.owner_address = value;
                } else if (key === 'operator_address') {
                    result.operator_address = value;
                } else if (key === 'service_id') {
                    // Handle services array
                    if (!result.services) result.services = [];
                    result.services.push(value);
                } else if (key === 'services') {
                    // Handle services array in different formats
                    if (!result.services) result.services = [];
                    if (value.startsWith('[') && value.endsWith(']')) {
                        // Array format: [0001, 0002]
                        const services = value.slice(1, -1).split(',').map(s => s.trim().replace(/"/g, ''));
                        result.services.push(...services);
                    } else {
                        // Single service
                        result.services.push(value);
                    }
                } else if (key === 'relay_chain' || key === 'relayChain') {
                    result.relay_chain = value;
                } else if (key === 'amount') {
                    // Extract numeric value from amount field
                    const numericValue = value.replace(/[^\d]/g, '');
                    result.amount = numericValue;
                }
            }
        }
        
        // Parse complex service structure from the YAML content
        // Look for service blocks with service_id, endpoints, and rev_share_percent
        const serviceBlocks = yamlContent.match(/-\s*service_id:\s*(\w+)[\s\S]*?(?=-\s*service_id:|$)/g);
        if (serviceBlocks && serviceBlocks.length > 0) {
            result.services = [];
            for (const block of serviceBlocks) {
                const serviceIdMatch = block.match(/service_id:\s*(\w+)/);
                if (serviceIdMatch) {
                    const serviceId = serviceIdMatch[1];
                    const service: any = {
                        service_id: serviceId,
                        endpoints: [] as any[]
                    };
                    
                    // Extract endpoints
                    const endpointMatches = block.match(/publicly_exposed_url:\s*(.+)/g);
                    if (endpointMatches) {
                        for (const endpointMatch of endpointMatches) {
                            const url = endpointMatch.replace('publicly_exposed_url:', '').trim();
                            service.endpoints.push({
                                publicly_exposed_url: url,
                                rpc_type: 'json_rpc'
                            });
                        }
                    }
                    
                    result.services.push(service);
                }
            }
        }
        
        // Ensure we have default values for required fields
        if (!result.services || result.services.length === 0) {
            result.services = ['0001']; // Default service
        }
        
        if (!result.stake_amount && !result.amount) {
            result.stake_amount = '60005000000'; // Default stake amount (60,005 POKT)
        }
        
        DEBUG_CONFIG.log('[STAKE] Parsed YAML result:', result);
        return result;
    };

    // Helper function to fetch real mnemonics from the dedicated endpoint
    const fetchRealMnemonics = async (sessionId: string): Promise<any | null> => {
        try {
            DEBUG_CONFIG.log('[STAKE] 🔍 Fetching real mnemonics from dedicated endpoint for sessionId:', sessionId);
            
            const response = await fetch(`${backendUrl}/api/stake/download-mnemonics/${sessionId}`);
            
            if (!response.ok) {
                DEBUG_CONFIG.error('[STAKE] Failed to fetch real mnemonics, status:', response.status);
                return null;
            }
            
            const mnemonicsResponse = await response.json();
            DEBUG_CONFIG.log('[STAKE] 🎉 Real mnemonics fetched successfully:', {
                success: mnemonicsResponse.success,
                message: mnemonicsResponse.message,
                sessionId: mnemonicsResponse.sessionId,
                hasData: !!mnemonicsResponse.data,
                hasWallets: !!(mnemonicsResponse.data && mnemonicsResponse.data.wallets),
                walletsCount: mnemonicsResponse.data?.wallets?.length || 0,
                mnemonicsInfo: mnemonicsResponse.mnemonicsInfo
            });
            
            if (mnemonicsResponse.success && mnemonicsResponse.data && mnemonicsResponse.data.wallets) {
                return {
                    sessionId: mnemonicsResponse.sessionId,
                    createdAt: new Date().toISOString(),
                    ownerAddress: walletAddress,
                    numberOfNodes: mnemonicsResponse.data.wallets.length,
                    totalWallets: mnemonicsResponse.data.wallets.length,
                    wallets: mnemonicsResponse.data.wallets,
                    downloadInstructions: "Store this file securely. It contains your real node wallet mnemonics.",
                    securityWarning: "Keep this file secure and private. If you lose it, you cannot recover your node wallets.",
                    source: "dedicated_mnemonics_endpoint",
                    mnemonicsInfo: mnemonicsResponse.mnemonicsInfo
                };
            }
            
            DEBUG_CONFIG.warn('[STAKE] ⚠️ Real mnemonics endpoint returned success but no wallets data');
            return null;
            
        } catch (error) {
            DEBUG_CONFIG.error('[STAKE] ❌ Error fetching real mnemonics:', error);
            return null;
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

    // Solo mostrar acciones para Morse (botón Migrate) y Shannon (sin Swap)
    const actions = isMorseNetwork ? [
        { label: 'Migrate', icon: '🔄', color: 'from-blue-600/30 to-indigo-600/30', onClick: () => handleMigrationRequest() },
        {
            label: 'Import Wallet', icon: '📥', color: 'from-green-600/30 to-emerald-600/30', onClick: () => {
                DEBUG_CONFIG.log('Navigating to import individual...');
                navigate('/import/individual');
            }
        }
    ] : [
        { label: 'Migrate', icon: '🔄', color: 'from-blue-600/30 to-indigo-600/30', onClick: () => handleMigrationRequest() },
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

    // Function to handle the actual staking process after confirmation
    const handleActualStaking = async (nodes: number) => {
        // CRITICAL FIX: Get the currently selected wallet address from walletService
        // with fallback to the walletAddress prop
        let currentWalletAddress = walletService.getCurrentWalletAddress();
        
        // If walletService doesn't have a current wallet, use the prop
        if (!currentWalletAddress && walletAddress) {
            currentWalletAddress = walletAddress;
            DEBUG_CONFIG.log('[STAKE] Using walletAddress prop as fallback:', currentWalletAddress);
        }
        
        if (!currentWalletAddress) {
            throw new Error('No wallet currently selected. Please select a wallet first.');
        }
        
        DEBUG_CONFIG.log('[STAKE] Using wallet address:', currentWalletAddress);
        DEBUG_CONFIG.log('[STAKE] Wallet source:', walletService.getCurrentWalletAddress() ? 'walletService' : 'props');
        
        // GET OWNER WALLET MNEMONIC FOR COMPARISON (DO NOT DISPLAY THIS)
        let ownerWalletMnemonic: string | null = null;
        try {
            const storedWallet = await walletService.getWalletByAddress(currentWalletAddress);
            if (storedWallet && storedWallet.mnemonic) {
                ownerWalletMnemonic = storedWallet.mnemonic.toLowerCase().trim();
            }
        } catch (error) {
            DEBUG_CONFIG.warn('[STAKE] Could not get owner wallet mnemonic for comparison:', error);
        }
        
        DEBUG_CONFIG.log('[STAKE] Owner wallet mnemonic obtained for filtering:', {
            hasOwnerMnemonic: !!ownerWalletMnemonic,
            ownerMnemonicWordCount: ownerWalletMnemonic ? ownerWalletMnemonic.split(' ').length : 0
        });
        
        DEBUG_CONFIG.log('[STAKE] Initiating stake API call', {
            backendUrl,
            ownerAddress: currentWalletAddress,
            numberOfNodes: nodes
        });
        DEBUG_CONFIG.log('[STAKE] Stake nodes request payload:', {
            url: `${backendUrl}/api/stake/create`,
            payload: {
                ownerAddress: currentWalletAddress,
                numberOfNodes: nodes
            }
        });
        let mnemonicsUrl: string = '';
        let mnemonicsFileName: string = '';
        let sessionId: string = '';
        try {
            const response = await fetch(`${backendUrl}/api/stake/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ownerAddress: currentWalletAddress,
                    numberOfNodes: nodes
                }),
            });
            DEBUG_CONFIG.log('[STAKE] API response status:', response.status);
            DEBUG_CONFIG.log('[STAKE] API response headers:', Object.fromEntries(response.headers.entries()));
            
            let fileUrl, fileName, sessionId, details;
            if (response.ok) {
                const contentType = response.headers.get('content-type');
                DEBUG_CONFIG.log('[STAKE] Content-Type:', contentType);
                
                // First, try to get the raw response text to see what we're actually getting
                const responseText = await response.text();
                DEBUG_CONFIG.log('[STAKE] Raw response text (first 500 chars):', responseText.substring(0, 500));
                
                // Try to parse as JSON regardless of content-type
                let jsonResponse = null;
                try {
                    jsonResponse = JSON.parse(responseText);
                    DEBUG_CONFIG.log('[STAKE] Successfully parsed as JSON:', jsonResponse);
                } catch (parseError) {
                    DEBUG_CONFIG.log('[STAKE] Could not parse as JSON:', parseError);
                }
                
                if (contentType && contentType.includes('application/zip')) {
                    // Handle ZIP file response
                    const blob = new Blob([responseText], { type: 'application/zip' });
                    fileName = `stake_files_${Date.now()}.zip`;
                    fileUrl = URL.createObjectURL(blob);
                    
                    // Try to get sessionId from multiple sources
                    const responseSessionId = response.headers.get('x-session-id') || 
                                             response.headers.get('session-id') ||
                                             response.headers.get('x-stake-session-id') ||
                                             (jsonResponse && jsonResponse.sessionId) ||
                                             (jsonResponse && jsonResponse.data && jsonResponse.data.sessionId);
                    
                    DEBUG_CONFIG.log('[STAKE] ZIP response - sessionId from headers:', response.headers.get('x-session-id'));
                    DEBUG_CONFIG.log('[STAKE] ZIP response - sessionId from session-id header:', response.headers.get('session-id'));
                    DEBUG_CONFIG.log('[STAKE] ZIP response - sessionId from x-stake-session-id header:', response.headers.get('x-stake-session-id'));
                    DEBUG_CONFIG.log('[STAKE] ZIP response - sessionId from JSON response:', jsonResponse && jsonResponse.sessionId);
                    DEBUG_CONFIG.log('[STAKE] ZIP response - sessionId from JSON response.data:', jsonResponse && jsonResponse.data && jsonResponse.data.sessionId);
                    DEBUG_CONFIG.log('[STAKE] ZIP response - Final sessionId:', responseSessionId);
                    
                    setStakeResult({ 
                        success: true, 
                        message: jsonResponse.message || `Successfully created ${nodes} stake file(s)!`, 
                        fileUrl, 
                        fileName, 
                        sessionId: responseSessionId || undefined,
                        details: jsonResponse && jsonResponse.details,
                        stakeFiles: jsonResponse.stakeFiles || [],
                        mnemonicsData: undefined,
                        mnemonicsUrl,
                        mnemonicsFileName
                    });
                } else {
                    // Handle JSON response
                    if (jsonResponse) {
                        DEBUG_CONFIG.log('[STAKE] JSON API response body:', jsonResponse);
                        
                        // Try multiple possible locations for sessionId
                        sessionId = jsonResponse.sessionId || 
                                   jsonResponse.data?.sessionId ||
                                   jsonResponse.result?.sessionId ||
                                   jsonResponse.response?.sessionId;
                        
                        details = jsonResponse.details || 
                                 jsonResponse.data?.details ||
                                 jsonResponse.result?.details;
                        
                        DEBUG_CONFIG.log('[STAKE] Extracted sessionId:', sessionId);
                        DEBUG_CONFIG.log('[STAKE] Extracted details:', details);
                        DEBUG_CONFIG.log('[STAKE] All possible sessionId locations:', {
                            'jsonResponse.sessionId': jsonResponse.sessionId,
                            'jsonResponse.data?.sessionId': jsonResponse.data?.sessionId,
                            'jsonResponse.result?.sessionId': jsonResponse.result?.sessionId,
                            'jsonResponse.response?.sessionId': jsonResponse.response?.sessionId
                        });
                        
                        if (jsonResponse.fileBase64 && jsonResponse.fileName) {
                            const link = document.createElement('a');
                            link.href = `data:application/zip;base64,${jsonResponse.fileBase64}`;
                            link.download = jsonResponse.fileName;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            // If mnemonicsData is present, trigger immediate download
                            if (jsonResponse.mnemonicsData) {
                                const mnemonicsJson = JSON.stringify(jsonResponse.mnemonicsData, null, 2);
                                const mnemonicsBlob = new Blob([mnemonicsJson], { type: 'application/json' });
                                mnemonicsUrl = URL.createObjectURL(mnemonicsBlob);
                                mnemonicsFileName = `wallet_mnemonics_${jsonResponse.mnemonicsData.sessionId || sessionId || Date.now()}.json`;
                                // Auto-download
                                const mnemonicsLink = document.createElement('a');
                                mnemonicsLink.href = mnemonicsUrl;
                                mnemonicsLink.download = mnemonicsFileName;
                                document.body.appendChild(mnemonicsLink);
                                mnemonicsLink.click();
                                document.body.removeChild(mnemonicsLink);
                            }
                            setStakeResult({ 
                                success: true, 
                                message: jsonResponse.message || `Successfully created ${nodes} stake file(s)!`, 
                                fileUrl, 
                                fileName, 
                                sessionId, 
                                details, 
                                stakeFiles: jsonResponse.stakeFiles || [],
                                mnemonicsData: undefined,
                                mnemonicsUrl,
                                mnemonicsFileName
                            });
                        } else if (jsonResponse.fileUrl && jsonResponse.fileName) {
                            setStakeResult({ 
                                success: true, 
                                message: jsonResponse.message || `Successfully created ${nodes} stake file(s)!`, 
                                fileUrl: jsonResponse.fileUrl, 
                                fileName: jsonResponse.fileName, 
                                sessionId, 
                                details, 
                                stakeFiles: jsonResponse.stakeFiles || [],
                                mnemonicsData: undefined,
                                mnemonicsUrl: jsonResponse.mnemonicsUrl,
                                mnemonicsFileName: jsonResponse.mnemonicsFileName
                            });
                        } else {
                            setStakeResult({ 
                                success: true, 
                                message: jsonResponse.message || `Successfully created ${nodes} stake file(s)!`, 
                                sessionId, 
                                details, 
                                stakeFiles: jsonResponse.stakeFiles || [],
                                mnemonicsData: jsonResponse.mnemonicsData,
                                mnemonicsUrl: jsonResponse.mnemonicsUrl,
                                mnemonicsFileName: jsonResponse.mnemonicsFileName
                            });
                        }
                    } else {
                        DEBUG_CONFIG.log('[STAKE] No JSON response and not ZIP - unexpected response type');
                        setStakeResult({ 
                            success: false, 
                            message: 'Unexpected response format from server' 
                        });
                    }
                }
            } else {
                const result = await response.json().catch(() => ({}));
                DEBUG_CONFIG.log('[STAKE] Error response:', result);
                setStakeResult({ success: false, message: result.error || 'Failed to create stake files' });
            }
        } catch (error: any) {
            DEBUG_CONFIG.error('[STAKE] Network error:', error);
            setStakeResult({ success: false, message: 'Network error: ' + (error.message || error) });
        }
    };

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
                                    <h1 className="text-3xl font-bold mb-1 flex items-center gap-2">
                                        {formattedBalanceValue} <span className="text-blue-400">POKT</span>
                                        <button
                                            className="ml-2 p-1 rounded-full bg-gray-800 hover:bg-gray-700 text-blue-300 hover:text-blue-400 transition"
                                            title="Refresh Balance"
                                            onClick={fetchBalanceOnly}
                                            disabled={loading}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 0113.5-5.303M19.5 12a7.5 7.5 0 01-13.5 5.303M12 6v6l4 2" />
                                            </svg>
                                        </button>
                                    </h1>
                                    <p className="text-gray-400 flex items-center gap-2">
                                        {walletAddress}
                                        <a
                                            href={`https://${!isMainnet ? 'beta.' : ''}poktscan.com/account/${walletAddress}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="ml-2 px-2 py-1 rounded bg-blue-900 hover:bg-blue-800 text-blue-300 hover:text-white text-xs font-semibold transition"
                                            title="View on Poktscan Explorer"
                                        >
                                            View on Poktscan
                                        </a>
                                    </p>
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
                                {/* Stake button for Shannon only */}
                                {network === 'shannon' && (
                                    <motion.button
                                        className="p-6 bg-gradient-to-r from-red-600/80 to-pink-500/80 rounded-xl text-center transition-all duration-200 border border-red-500/50 hover:border-red-600/70 text-white font-semibold shadow-lg"
                                        whileHover={{ scale: 1.02, y: -2 }}
                                        whileTap={{ scale: 0.98 }}
                                        variants={itemVariants}
                                        onClick={() => setShowStakeDialog(true)}
                                    >
                                        <span className="block text-3xl mb-3">🔥</span>
                                        <span className="text-lg font-medium">Stake</span>
                                    </motion.button>
                                )}
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
            {showMigrationDialog && morsePrivateKey && (
                <MigrationDialog
                    isOpen={showMigrationDialog}
                    onClose={handleCloseMigrationDialog}
                    morsePrivateKey={morsePrivateKey}
                    morseAddress={walletAddress}
                />
            )}
            {/* Stake Dialog */}
            {showStakeDialog && network === 'shannon' && (
                <StakeDialog
                    balance={parseFloat(balance) / 1_000_000}
                    onClose={() => setShowStakeDialog(false)}
                    onStake={async (nodes) => {
                        // Show confirmation dialog first
                        setPendingStakeNodes(nodes);
                        setShowStakeConfirmation(true);
                    }}
                />
            )}
            {/* Stake Confirmation Dialog */}
            {showStakeConfirmation && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                    <div className="bg-gray-900 rounded-xl p-8 border-2 border-yellow-500/50 shadow-xl max-w-md w-full mx-4">
                        <h3 className="text-xl font-bold mb-4 text-yellow-400 flex items-center">
                            <i className="fas fa-exclamation-triangle mr-2"></i>
                            Confirm Staking
                        </h3>
                        <div className="mb-6">
                            <p className="text-gray-300 mb-3">
                                You're about to stake <span className="font-bold text-blue-400">{pendingStakeNodes}</span> node{pendingStakeNodes !== 1 ? 's' : ''}.
                            </p>
                            <p className="text-gray-300 mb-3">
                                Amount: <span className="font-bold text-green-400">{(pendingStakeNodes * 60005).toLocaleString()} POKT</span>
                            </p>
                            <p className="text-yellow-300 text-sm">
                                Are you sure you want to proceed with this action?
                            </p>
                        </div>
                        <div className="flex justify-center gap-4">
                            <button
                                className="px-6 py-2 rounded-lg bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white font-semibold transition-all duration-200"
                                onClick={async () => {
                                    setShowStakeConfirmation(false);
                                    setShowStakeDialog(false);
                                    await handleActualStaking(pendingStakeNodes);
                                }}
                            >
                                Yes, Stake {pendingStakeNodes} Node{pendingStakeNodes !== 1 ? 's' : ''}
                            </button>
                            <button
                                className="px-6 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold transition-all duration-200"
                                onClick={() => {
                                    setShowStakeConfirmation(false);
                                    setPendingStakeNodes(0);
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Stake Result Modal */}
            {stakeResult && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                    <div className="bg-gray-900 rounded-xl p-8 border-2 border-gray-700 shadow-xl max-w-2xl w-full text-center max-h-[90vh] overflow-y-auto">
                        <h2 className={`text-2xl font-bold mb-4 ${stakeResult!.success ? 'text-green-400' : 'text-red-400'}`}>{stakeResult!.success ? '' : 'Stake Failed'}</h2>
                        {/* Only show the generated message and download button if success */}
                        {stakeResult!.success && (
                            <div className="mb-4">
                                <div className="text-green-400 font-semibold mb-2">stake config files were generated!</div>
                                {/* If a ZIP is available, show a single download button */}
                                {stakeResult!.fileUrl && stakeResult!.fileName && (
                                    <a
                                        href={stakeResult!.fileUrl}
                                        download={stakeResult!.fileName}
                                        className="inline-block px-6 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-red-600 text-white font-semibold shadow-lg hover:from-pink-600 hover:to-red-700"
                                    >
                                        Download All Stake Files (ZIP)
                                    </a>
                                )}
                                {/* If multiple files are available as an array, show download links for each */}
                                {stakeResult!.stakeFiles && Array.isArray(stakeResult!.stakeFiles) && stakeResult!.stakeFiles.length > 1 && !stakeResult!.fileUrl && (
                                    <div className="flex flex-col gap-2 mt-2">
                                        {stakeResult!.stakeFiles.map((file: any, idx: number) => (
                                            <a
                                                key={file.fileName || idx}
                                                href={`data:text/yaml;charset=utf-8,${encodeURIComponent(file.content)}`}
                                                download={file.fileName || `stake_file_${idx + 1}.yaml`}
                                                className="inline-block px-4 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-red-600 text-white font-semibold shadow-lg hover:from-pink-600 hover:to-red-700"
                                            >
                                                Download {file.fileName || `Stake File ${idx + 1}`}
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {/* Details Section */}
                        {stakeResult!.details && (
                            <div className="mb-4 text-left text-sm bg-gray-800/60 rounded-lg p-4">
                                <div className="mb-2"><span className="font-semibold text-gray-200">Owner Address:</span> <span className="font-mono text-blue-300">{stakeResult!.details.ownerAddress}</span></div>
                                {stakeResult!.details.operator && <div className="mb-2"><span className="font-semibold text-gray-200">Operator:</span> <span className="font-mono text-pink-300">{stakeResult!.details.operator}</span></div>}
                                {stakeResult!.details.amount && <div className="mb-2"><span className="font-semibold text-gray-200">Amount:</span> <span className="font-mono text-green-300">{stakeResult!.details.amount.toLocaleString()} POKT</span></div>}
                                {stakeResult!.details.revShare && <div className="mb-2"><span className="font-semibold text-gray-200">Rev Share:</span> <span className="font-mono text-yellow-300">{stakeResult!.details.revShare}</span></div>}
                                {stakeResult!.details.services && Array.isArray(stakeResult!.details.services) && (
                                    <div className="mb-2"><span className="font-semibold text-gray-200">Services:</span> <span className="font-mono text-purple-300">{stakeResult!.details.services.join(', ')}</span></div>
                                )}
                            </div>
                        )}
                        
                        {/* Show success message and download button if available, only once */}
                        {stakeResult!.success && (
                            <div className="mb-4">
                                <div className="text-green-400 font-semibold mb-2">stake config files were generated!</div>
                                {stakeResult!.fileUrl && stakeResult!.fileName && (
                                    <a
                                        href={stakeResult!.fileUrl}
                                        download={stakeResult!.fileName}
                                        className="inline-block px-6 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-red-600 text-white font-semibold shadow-lg hover:from-pink-600 hover:to-red-700"
                                    >
                                        Download Stake File
                                    </a>
                                )}
                            </div>
                        )}
                        
                        {/* Execute Stake Transactions - Always show if sessionId exists */}
                        {stakeResult!.sessionId && (
                            <div className="mb-4 p-4 bg-gray-800/40 rounded-lg border border-gray-700">
                                <h3 className="text-lg font-semibold text-gray-200 mb-3">Execute POKT CLI</h3>
                                <p className="text-sm text-gray-400 mb-3">Execute POKT CLI commands directly from the frontend. The backend will handle the CLI execution with your wallet.</p>
                                <div className="flex flex-col gap-3 items-center">
                                    <div className="flex gap-2 w-full max-w-md">
                                        <select
                                            value={executeNetwork}
                                            onChange={e => setExecuteNetwork(e.target.value)}
                                            className="flex-1 px-3 py-2 rounded-lg bg-gray-800 text-white border border-gray-600"
                                        >
                                            <option value="main" disabled>Mainnet (disabled in staging)</option>
                                            <option value="beta">Beta</option>
                                        </select>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            className="px-6 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold shadow-lg hover:from-blue-700 hover:to-indigo-700"
                                            disabled={executeLoading}
                                            onClick={async () => {
                                                setExecuteLoading(true);
                                                setExecuteError(null);
                                                try {
                                                    DEBUG_CONFIG.log('[STAKE] Executing POKT CLI stake directly for sessionId:', stakeResult!.sessionId);
                                                    
                                                    // Step 1: Get the stake file content from the backend
                                                    const generateResponse = await fetch(`${backendUrl}/api/stake/generate-cli/${stakeResult!.sessionId}`, {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({
                                                            network: executeNetwork,
                                                            ownerAddress: walletAddress,
                                                            keyringBackend: 'memory'
                                                        })
                                                    });
                                                    
                                                    if (!generateResponse.ok) {
                                                        const errorResult = await generateResponse.json().catch(() => ({}));
                                                        throw new Error(errorResult.error || errorResult.message || 'Failed to get stake file content');
                                                    }
                                                    
                                                    const responseData = await generateResponse.json();
                                                    DEBUG_CONFIG.log('[STAKE] Generated stake file content response:', responseData);
                                                    
                                                    // Step 2: Extract stake file content
                                                    if (!responseData.success || !responseData.data?.success) {
                                                        throw new Error('Failed to get stake file content from backend');
                                                    }
                                                    
                                                    const stakeData = responseData.data.data;
                                                    const unsignedTransactions = stakeData.unsignedTransactions || [];
                                                    
                                                    if (unsignedTransactions.length === 0) {
                                                        throw new Error('No stake files found');
                                                    }
                                                    
                                                    // Step 3: Execute POKT CLI directly with ALL stake files
                                                    const stakeFilesPayload = unsignedTransactions.map((file: any, idx: number) => {
                                                        if (!file.stakeFileContent) {
                                                            throw new Error(`No stake file content found for file #${idx + 1}`);
                                                        }
                                                        return {
                                                            content: file.stakeFileContent,
                                                            fileName: file.fileName || `stake_file_${stakeResult!.sessionId}_${idx + 1}.yaml`
                                                        };
                                                    });
                                                    DEBUG_CONFIG.log('[STAKE] Executing POKT CLI with all stake files:', stakeFilesPayload);
                                                    
                                                    // Get the wallet information from storage
                                                    const storedWallet = await storageService.get<any>('shannon_wallet');
                                                    if (!storedWallet || !storedWallet.serialized) {
                                                        throw new Error('No Shannon wallet found in storage. Please import your wallet first.');
                                                    }
                                                    
                                                    // Extract the actual mnemonic from the wallet
                                                    let mnemonic: string;
                                                    if (storedWallet.parsed && storedWallet.parsed.mnemonic) {
                                                        // If we have the parsed wallet with mnemonic
                                                        mnemonic = storedWallet.parsed.mnemonic;
                                                    } else if (storedWallet.mnemonic) {
                                                        // If mnemonic is stored directly
                                                        mnemonic = storedWallet.mnemonic;
                                                    } else if (typeof storedWallet.serialized === 'string' && storedWallet.serialized.split(' ').length >= 12) {
                                                        // If serialized is actually the mnemonic phrase
                                                        mnemonic = storedWallet.serialized;
                                                    } else {
                                                        // Try to decrypt the wallet to get the mnemonic
                                                        DEBUG_CONFIG.log('[STAKE] No mnemonic found in direct fields, attempting to decrypt wallet...');
                                                        try {
                                                            // Import the decryptWallet function from ShannonWallet
                                                            const { decryptWallet } = await import('../controller/ShannonWallet');
                                                            const walletInfo = await decryptWallet(storedWallet.serialized, 'CREA');
                                                            mnemonic = walletInfo.mnemonic;
                                                            DEBUG_CONFIG.log('[STAKE] Successfully decrypted wallet and extracted mnemonic');
                                                        } catch (decryptError) {
                                                            DEBUG_CONFIG.error('[STAKE] Failed to decrypt wallet:', decryptError);
                                                            throw new Error('Could not extract mnemonic from wallet. Please re-import your wallet with the mnemonic phrase.');
                                                        }
                                                    }
                                                    
                                                    // Validate that we have a proper mnemonic (12 or 24 words)
                                                    if (!mnemonic || mnemonic.split(' ').length < 12) {
                                                        DEBUG_CONFIG.error('[STAKE] Invalid mnemonic format:', {
                                                            mnemonic: mnemonic,
                                                            wordCount: mnemonic ? mnemonic.split(' ').length : 0,
                                                            isValid: mnemonic && (mnemonic.split(' ').length === 12 || mnemonic.split(' ').length === 24)
                                                        });
                                                        throw new Error('Invalid mnemonic format. Expected 12 or 24 words, but got: ' + (mnemonic ? mnemonic.split(' ').length : 0) + ' words.');
                                                    }
                                                    
                                                    // Ensure mnemonic is properly formatted (lowercase, trimmed)
                                                    mnemonic = mnemonic.toLowerCase().trim();
                                                    
                                                    DEBUG_CONFIG.log('[STAKE] Final mnemonic validation:', {
                                                        wordCount: mnemonic.split(' ').length,
                                                        isValid: mnemonic.split(' ').length === 12 || mnemonic.split(' ').length === 24,
                                                        mnemonicPreview: `${mnemonic.substring(0, 50)}...`,
                                                        mnemonicWords: mnemonic.split(' ').slice(0, 5).join(' ') + '...'
                                                    });
                                                    
                                                    // Create a unique key name for this session
                                                    const keyName = `owner`;
                                                    
                                                    // Prepare the request payload with ALL stake files
                                                    const requestPayload = {
                                                        stakeFiles: stakeFilesPayload,
                                                        mnemonic: mnemonic,
                                                        keyName: keyName,
                                                        network: executeNetwork,
                                                        ownerAddress: walletAddress,
                                                        keyringBackend: 'test'
                                                    };
                                                    
                                                    DEBUG_CONFIG.log('[STAKE] Request payload for execute-local-cli:', {
                                                        hasStakeFiles: !!requestPayload.stakeFiles,
                                                        stakeFilesLength: requestPayload.stakeFiles.length,
                                                        stakeFileContentType: typeof requestPayload.stakeFiles[0].content,
                                                        stakeFileContentLength: requestPayload.stakeFiles[0].content?.length || 0,
                                                        hasMnemonic: !!requestPayload.mnemonic,
                                                        mnemonicWordCount: requestPayload.mnemonic ? requestPayload.mnemonic.split(' ').length : 0,
                                                        mnemonicPreview: requestPayload.mnemonic ? `${requestPayload.mnemonic.substring(0, 50)}...` : 'None',
                                                        mnemonicType: typeof requestPayload.mnemonic,
                                                        mnemonicFirstWords: requestPayload.mnemonic ? requestPayload.mnemonic.split(' ').slice(0, 3).join(' ') : 'None',
                                                        mnemonicLastWords: requestPayload.mnemonic ? requestPayload.mnemonic.split(' ').slice(-3).join(' ') : 'None',
                                                        keyName: requestPayload.keyName,
                                                        keyNameType: typeof requestPayload.keyName,
                                                        network: requestPayload.network,
                                                        ownerAddress: requestPayload.ownerAddress
                                                    });
                                                    
                                                    // Log the full payload for debugging (but mask the mnemonic for security)
                                                    const maskedPayload = {
                                                        ...requestPayload,
                                                        mnemonic: requestPayload.mnemonic ? 
                                                            `${requestPayload.mnemonic.split(' ').slice(0, 3).join(' ')} ... ${requestPayload.mnemonic.split(' ').slice(-3).join(' ')}` : 
                                                            'None'
                                                    };
                                                    DEBUG_CONFIG.log('[STAKE] Full request payload (mnemonic masked):', JSON.stringify(maskedPayload, null, 2));
                                                    
                                                    // Execute POKT CLI using a local execution endpoint
                                                    const executeResponse = await fetch(`${backendUrl}/api/stake/execute-local-cli`, {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify(requestPayload)
                                                    });
                                                    
                                                    // If the first format fails, try alternative formats
                                                    if (!executeResponse.ok) {
                                                        const errorResult = await executeResponse.json().catch(() => ({}));
                                                        DEBUG_CONFIG.log('[STAKE] First attempt failed, trying alternative format...', errorResult);
                                                        
                                                        // Try alternative format: single stake file content (first file)
                                                        const alternativePayload = {
                                                            stakeFileContent: stakeFilesPayload[0].content,
                                                            mnemonic: mnemonic,
                                                            keyName: keyName,
                                                            network: executeNetwork,
                                                            ownerAddress: walletAddress,
                                                            keyringBackend: 'test'
                                                        };
                                                        
                                                        DEBUG_CONFIG.log('[STAKE] Trying alternative payload format:', alternativePayload);
                                                        
                                                        const alternativeResponse = await fetch(`${backendUrl}/api/stake/execute-local-cli`, {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify(alternativePayload)
                                                        });
                                                        
                                                        if (!alternativeResponse.ok) {
                                                            const altErrorResult = await alternativeResponse.json().catch(() => ({}));
                                                            DEBUG_CONFIG.log('[STAKE] Alternative format also failed, trying third format...', altErrorResult);
                                                            
                                                            // Try third format: array of stake file contents (all files)
                                                            const thirdPayload = {
                                                                stakeFileContents: stakeFilesPayload.map((f: any) => f.content),
                                                                mnemonic: mnemonic,
                                                                keyName: keyName,
                                                                network: executeNetwork,
                                                                ownerAddress: walletAddress,
                                                                keyringBackend: 'test'
                                                            };
                                                            
                                                            DEBUG_CONFIG.log('[STAKE] Trying third payload format:', thirdPayload);
                                                            
                                                            const thirdResponse = await fetch(`${backendUrl}/api/stake/execute-local-cli`, {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify(thirdPayload)
                                                            });
                                                            
                                                            if (!thirdResponse.ok) {
                                                                const thirdErrorResult = await thirdResponse.json().catch(() => ({}));
                                                                DEBUG_CONFIG.log('[STAKE] Third format also failed, trying fourth format...', thirdErrorResult);
                                                                
                                                                // Try fourth format: separate mnemonic field with different structure (all files)
                                                                const fourthPayload = {
                                                                    stakeFiles: stakeFilesPayload,
                                                                    walletMnemonic: mnemonic, // Different field name
                                                                    keyName: keyName,
                                                                    network: executeNetwork,
                                                                    ownerAddress: walletAddress,
                                                                    keyringBackend: 'test',
                                                                    mnemonicPhrase: mnemonic // Also include as separate field
                                                                };
                                                                
                                                                DEBUG_CONFIG.log('[STAKE] Trying fourth payload format:', {
                                                                    ...fourthPayload,
                                                                    walletMnemonic: fourthPayload.walletMnemonic ? 
                                                                        `${fourthPayload.walletMnemonic.split(' ').slice(0, 3).join(' ')} ... ${fourthPayload.walletMnemonic.split(' ').slice(-3).join(' ')}` : 
                                                                        'None',
                                                                    mnemonicPhrase: fourthPayload.mnemonicPhrase ? 
                                                                        `${fourthPayload.mnemonicPhrase.split(' ').slice(0, 3).join(' ')} ... ${fourthPayload.mnemonicPhrase.split(' ').slice(-3).join(' ')}` : 
                                                                        'None'
                                                                });
                                                                
                                                                const fourthResponse = await fetch(`${backendUrl}/api/stake/execute-local-cli`, {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify(fourthPayload)
                                                                });
                                                                
                                                                if (!fourthResponse.ok) {
                                                                    const fourthErrorResult = await fourthResponse.json().catch(() => ({}));
                                                                    DEBUG_CONFIG.error('[STAKE] All four formats failed:', {
                                                                        firstError: errorResult,
                                                                        secondError: altErrorResult,
                                                                        thirdError: thirdErrorResult,
                                                                        fourthError: fourthErrorResult
                                                                    });
                                                                    throw new Error(`Failed to execute POKT CLI commands. All payload formats failed. Please check the backend API documentation.`);
                                                                }
                                                                
                                                                // Use the fourth response
                                                                const executeData = await fourthResponse.json();
                                                                DEBUG_CONFIG.log('[STAKE] Fourth format succeeded:', executeData);
                                                                
                                                                // Extract variables needed for result
                                                                const currentSessionId = executeData?.sessionId || executeData?.result?.data?.data?.sessionId || stakeResult?.sessionId || '';
                                                                const fileUrl = stakeResult?.fileUrl || '';
                                                                const fileName = stakeResult?.fileName || '';
                                                                const details = stakeResult?.details || {};
                                                                const stakeFiles = stakeResult?.stakeFiles || [];
                                                                
                                                                // Fetch real mnemonics from the dedicated endpoint
                                                                DEBUG_CONFIG.log('[STAKE] FOURTH FORMAT - Fetching real mnemonics after CLI execution...');
                                                                const realMnemonicsData = await fetchRealMnemonics(currentSessionId);
                                                                
                                                                if (realMnemonicsData) {
                                                                  DEBUG_CONFIG.log('[STAKE] FOURTH FORMAT - Real mnemonics fetched successfully');
                                                                  
                                                                  // Auto-download the real mnemonics
                                                                  const mnemonicsJson = JSON.stringify(realMnemonicsData, null, 2);
                                                                  const mnemonicsBlob = new Blob([mnemonicsJson], { type: 'application/json' });
                                                                  const currentMnemonicsUrl = URL.createObjectURL(mnemonicsBlob);
                                                                  const currentMnemonicsFileName = `real_operator_mnemonics_${currentSessionId || Date.now()}.json`;
                                                                  
                                                                  // Auto-download
                                                                  const link = document.createElement('a');
                                                                  link.href = currentMnemonicsUrl;
                                                                  link.download = currentMnemonicsFileName;
                                                                  document.body.appendChild(link);
                                                                  link.click();
                                                                  document.body.removeChild(link);
                                                                  
                                                                  // Save to stakeResult with real mnemonics
                                                                  setStakeResult(prev => ({
                                                                    ...(prev || {}),
                                                                    success: true,
                                                                    message: executeData.message || `✅ Successfully executed CLI and downloaded real operator mnemonics!`,
                                                                    fileUrl: fileUrl,
                                                                    fileName: fileName,
                                                                    sessionId: currentSessionId,
                                                                    details: details,
                                                                    stakeFiles: stakeFiles,
                                                                    mnemonicsData: realMnemonicsData,
                                                                    mnemonicsUrl: currentMnemonicsUrl,
                                                                    mnemonicsFileName: currentMnemonicsFileName
                                                                  }));
                                                                  
                                                                  DEBUG_CONFIG.log('[STAKE] FOURTH FORMAT - Updated stakeResult with real mnemonics');
                                                                } else {
                                                                  DEBUG_CONFIG.warn('[STAKE] FOURTH FORMAT - Could not fetch real mnemonics, proceeding without them');
                                                                  
                                                                  // Save to stakeResult without mnemonics
                                                                  setStakeResult(prev => ({
                                                                    ...(prev || {}),
                                                                    success: true,
                                                                    message: executeData.message || `✅ Successfully executed CLI! Real operator mnemonics will be available after processing.`,
                                                                    fileUrl: fileUrl,
                                                                    fileName: fileName,
                                                                    sessionId: currentSessionId,
                                                                    details: details,
                                                                    stakeFiles: stakeFiles
                                                                  }));
                                                                }
                                                                
                                                                return; // Exit early since we succeeded with fourth format
                                                            }
                                                            
                                                            // Use the third response
                                                            const executeData = await thirdResponse.json();
                                                            DEBUG_CONFIG.log('[STAKE] Third format succeeded:', executeData);
                                                            
                                                            // Extract variables needed for result
                                                            const currentSessionId = executeData?.sessionId || executeData?.result?.data?.data?.sessionId || stakeResult?.sessionId || '';
                                                            const fileUrl = stakeResult?.fileUrl || '';
                                                            const fileName = stakeResult?.fileName || '';
                                                            const details = stakeResult?.details || {};
                                                            const stakeFiles = stakeResult?.stakeFiles || [];
                                                            
                                                            // Fetch real mnemonics from the dedicated endpoint
                                                            DEBUG_CONFIG.log('[STAKE] THIRD FORMAT - Fetching real mnemonics after CLI execution...');
                                                            const realMnemonicsData = await fetchRealMnemonics(currentSessionId);
                                                            
                                                            if (realMnemonicsData) {
                                                              DEBUG_CONFIG.log('[STAKE] THIRD FORMAT - Real mnemonics fetched successfully');
                                                              
                                                              // Auto-download the real mnemonics
                                                              const mnemonicsJson = JSON.stringify(realMnemonicsData, null, 2);
                                                              const mnemonicsBlob = new Blob([mnemonicsJson], { type: 'application/json' });
                                                              const currentMnemonicsUrl = URL.createObjectURL(mnemonicsBlob);
                                                              const currentMnemonicsFileName = `real_operator_mnemonics_${currentSessionId || Date.now()}.json`;
                                                              
                                                              // Auto-download
                                                              const link = document.createElement('a');
                                                              link.href = currentMnemonicsUrl;
                                                              link.download = currentMnemonicsFileName;
                                                              document.body.appendChild(link);
                                                              link.click();
                                                              document.body.removeChild(link);
                                                              
                                                              // Save to stakeResult with real mnemonics
                                                              setStakeResult(prev => ({
                                                                ...(prev || {}),
                                                                success: true,
                                                                message: executeData.message || `✅ Successfully executed CLI and downloaded real operator mnemonics!`,
                                                                fileUrl: fileUrl,
                                                                fileName: fileName,
                                                                sessionId: currentSessionId,
                                                                details: details,
                                                                stakeFiles: stakeFiles,
                                                                mnemonicsData: realMnemonicsData,
                                                                mnemonicsUrl: currentMnemonicsUrl,
                                                                mnemonicsFileName: currentMnemonicsFileName
                                                              }));
                                                              
                                                              DEBUG_CONFIG.log('[STAKE] THIRD FORMAT - Updated stakeResult with real mnemonics');
                                                            } else {
                                                              DEBUG_CONFIG.warn('[STAKE] THIRD FORMAT - Could not fetch real mnemonics, proceeding without them');
                                                              
                                                              // Save to stakeResult without mnemonics
                                                              setStakeResult(prev => ({
                                                                ...(prev || {}),
                                                                success: true,
                                                                message: executeData.message || `✅ Successfully executed CLI! Real operator mnemonics will be available after processing.`,
                                                                fileUrl: fileUrl,
                                                                fileName: fileName,
                                                                sessionId: currentSessionId,
                                                                details: details,
                                                                stakeFiles: stakeFiles
                                                              }));
                                                            }
                                                            
                                                            return; // Exit early since we succeeded with third format
                                                        }
                                                        
                                                        // Use the alternative response
                                                        const executeData = await alternativeResponse.json();
                                                        DEBUG_CONFIG.log('[STAKE] Alternative format succeeded:', executeData);
                                                        
                                                        // Extract variables needed for result
                                                        const currentSessionId = executeData?.sessionId || executeData?.result?.data?.data?.sessionId || stakeResult?.sessionId || '';
                                                        const fileUrl = stakeResult?.fileUrl || '';
                                                        const fileName = stakeResult?.fileName || '';
                                                        const details = stakeResult?.details || {};
                                                        const stakeFiles = stakeResult?.stakeFiles || [];
                                                        
                                                        // Fetch real mnemonics from the dedicated endpoint
                                                        DEBUG_CONFIG.log('[STAKE] ALTERNATIVE FORMAT - Fetching real mnemonics after CLI execution...');
                                                        const realMnemonicsData = await fetchRealMnemonics(currentSessionId);
                                                        
                                                        if (realMnemonicsData) {
                                                          DEBUG_CONFIG.log('[STAKE] ALTERNATIVE FORMAT - Real mnemonics fetched successfully');
                                                          
                                                          // Auto-download the real mnemonics
                                                          const mnemonicsJson = JSON.stringify(realMnemonicsData, null, 2);
                                                          const mnemonicsBlob = new Blob([mnemonicsJson], { type: 'application/json' });
                                                          const currentMnemonicsUrl = URL.createObjectURL(mnemonicsBlob);
                                                          const currentMnemonicsFileName = `real_operator_mnemonics_${currentSessionId || Date.now()}.json`;
                                                          
                                                          // Auto-download
                                                          const link = document.createElement('a');
                                                          link.href = currentMnemonicsUrl;
                                                          link.download = currentMnemonicsFileName;
                                                          document.body.appendChild(link);
                                                          link.click();
                                                          document.body.removeChild(link);
                                                          
                                                          // Save to stakeResult with real mnemonics
                                                          setStakeResult(prev => ({
                                                            ...(prev || {}),
                                                            success: true,
                                                            message: executeData.message || `✅ Successfully executed CLI and downloaded real operator mnemonics!`,
                                                            fileUrl: fileUrl,
                                                            fileName: fileName,
                                                            sessionId: currentSessionId,
                                                            details: details,
                                                            stakeFiles: stakeFiles,
                                                            mnemonicsData: realMnemonicsData,
                                                            mnemonicsUrl: currentMnemonicsUrl,
                                                            mnemonicsFileName: currentMnemonicsFileName
                                                          }));
                                                          
                                                          DEBUG_CONFIG.log('[STAKE] ALTERNATIVE FORMAT - Updated stakeResult with real mnemonics');
                                                        } else {
                                                          DEBUG_CONFIG.warn('[STAKE] ALTERNATIVE FORMAT - Could not fetch real mnemonics, proceeding without them');
                                                          
                                                          // Save to stakeResult without mnemonics
                                                          setStakeResult(prev => ({
                                                            ...(prev || {}),
                                                            success: true,
                                                            message: executeData.message || `✅ Successfully executed CLI! Real operator mnemonics will be available after processing.`,
                                                            fileUrl: fileUrl,
                                                            fileName: fileName,
                                                            sessionId: currentSessionId,
                                                            details: details,
                                                            stakeFiles: stakeFiles
                                                          }));
                                                        }
                                                        
                                                        return; // Exit early since we succeeded with alternative format
                                                    }
                                                    
                                                    const executeData = await executeResponse.json();
                                                    DEBUG_CONFIG.log('[STAKE] POKT CLI execution response:', executeData);
                                                    
                                                    // Add debug logging for the actual response structure
                                                    DEBUG_CONFIG.log('[STAKE] PRIMARY FORMAT - Response structure:', {
                                                        executeData,
                                                        hasData: !!executeData.data,
                                                        dataData: executeData.data?.data,
                                                        dataKeys: executeData.data ? Object.keys(executeData.data) : 'No data',
                                                        dataDataKeys: executeData.data?.data ? Object.keys(executeData.data.data) : 'No data.data'
                                                    });
                                                    
                                                    // Try to extract mnemonics from the primary format response
                                                    if (executeData.success && executeData.data?.data) {
                                                        const responseData = executeData.data.data;
                                                        
                                                        // Extract variables needed for result
                                                        const currentSessionId = executeData?.sessionId || executeData?.result?.data?.data?.sessionId || stakeResult?.sessionId || '';
                                                        const fileUrl = stakeResult?.fileUrl || '';
                                                        const fileName = stakeResult?.fileName || '';
                                                        const details = stakeResult?.details || {};
                                                        const stakeFiles = stakeResult?.stakeFiles || [];
                                                        
                                                        // Fetch real mnemonics from the dedicated endpoint
                                                        DEBUG_CONFIG.log('[STAKE] PRIMARY FORMAT - Fetching real mnemonics after CLI execution...');
                                                        const realMnemonicsData = await fetchRealMnemonics(currentSessionId);
                                                        
                                                        if (realMnemonicsData) {
                                                          DEBUG_CONFIG.log('[STAKE] PRIMARY FORMAT - Real mnemonics fetched successfully');
                                                          
                                                          // Auto-download the real mnemonics
                                                          const mnemonicsJson = JSON.stringify(realMnemonicsData, null, 2);
                                                          const mnemonicsBlob = new Blob([mnemonicsJson], { type: 'application/json' });
                                                          const currentMnemonicsUrl = URL.createObjectURL(mnemonicsBlob);
                                                          const currentMnemonicsFileName = `real_operator_mnemonics_${currentSessionId || Date.now()}.json`;
                                                          
                                                          // Auto-download
                                                          const link = document.createElement('a');
                                                          link.href = currentMnemonicsUrl;
                                                          link.download = currentMnemonicsFileName;
                                                          document.body.appendChild(link);
                                                          link.click();
                                                          document.body.removeChild(link);
                                                          
                                                          // Save to stakeResult with real mnemonics
                                                          setStakeResult(prev => ({
                                                            ...(prev || {}),
                                                            success: true,
                                                            message: executeData.message || `✅ Successfully executed CLI and downloaded real operator mnemonics!`,
                                                            fileUrl: fileUrl,
                                                            fileName: fileName,
                                                            sessionId: currentSessionId,
                                                            details: details,
                                                            stakeFiles: stakeFiles,
                                                            mnemonicsData: realMnemonicsData,
                                                            mnemonicsUrl: currentMnemonicsUrl,
                                                            mnemonicsFileName: currentMnemonicsFileName
                                                          }));
                                                          
                                                          DEBUG_CONFIG.log('[STAKE] PRIMARY FORMAT - Updated stakeResult with real mnemonics');
                                                        } else {
                                                          DEBUG_CONFIG.warn('[STAKE] PRIMARY FORMAT - Could not fetch real mnemonics, proceeding without them');
                                                          
                                                          // Save to stakeResult without mnemonics
                                                          setStakeResult(prev => ({
                                                            ...(prev || {}),
                                                            success: true,
                                                            message: executeData.message || `✅ Successfully executed CLI! Real operator mnemonics will be available after processing.`,
                                                            fileUrl: fileUrl,
                                                            fileName: fileName,
                                                            sessionId: currentSessionId,
                                                            details: details,
                                                            stakeFiles: stakeFiles
                                                          }));
                                                        }
                                                    }
                                                    
                                                    // Step 4: Update result with execution details
                                                    const executionSummary = {
                                                        method: 'pokt-cli-executed',
                                                        sessionId: stakeResult!.sessionId,
                                                        network: executeNetwork,
                                                        ownerAddress: walletAddress,
                                                        ownerKeyName: keyName,
                                                        keyringBackend: 'test',
                                                        stakeFileContent: (stakeFilesPayload[0]?.stakeFileContent || stakeFilesPayload[0]?.content || '').substring(0, 200) + '...',
                                                        result: executeData,
                                                        executed: true,
                                                        formatUsed: 'primary'
                                                    };
                                                    
                                                    DEBUG_CONFIG.log('[STAKE] POKT CLI execution completed successfully:', executionSummary);
                                                    setStakeResult(prev => prev ? { 
                                                        ...prev, 
                                                        executeResult: executionSummary 
                                                    } : prev);
                                                } catch (err: any) {
                                                    DEBUG_CONFIG.error('[STAKE] POKT CLI execution error:', err);
                                                    setExecuteError(err.message || 'Error executing POKT CLI commands');
                                                } finally {
                                                    setExecuteLoading(false);
                                                }
                                            }}
                                        >
                                            {executeLoading ? 'Executing...' : 'Execute POKT CLI'}
                                        </button>
                                        <button
                                            className="px-6 py-2 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold shadow-lg hover:from-green-700 hover:to-emerald-700"
                                            onClick={async () => {
                                                try {
                                                    DEBUG_CONFIG.log('[STAKE] Checking status for sessionId:', stakeResult!.sessionId);
                                                    const response = await fetch(`${backendUrl}/api/stake/status/${stakeResult!.sessionId}`);
                                                    const result = await response.json();
                                                    DEBUG_CONFIG.log('[STAKE] Status response:', result);
                                                    setStakeResult(prev => prev ? { ...prev, statusResult: result } : prev);
                                                } catch (err: any) {
                                                    DEBUG_CONFIG.error('[STAKE] Status check error:', err);
                                                    setExecuteError(err.message || 'Error checking status');
                                                }
                                            }}
                                        >
                                            Check Status
                                        </button>
                                    </div>
                                    {executeError && <div className="text-red-400 text-sm">{executeError}</div>}
                                </div>
                            </div>
                        )}
                        
                        {/* Show status result */}
                        {stakeResult!.statusResult && (
                            <div className="mb-4 text-left text-xs bg-gray-800/60 rounded-lg p-4 max-h-60 overflow-y-auto">
                                <div className="font-semibold text-blue-400 mb-2">Status Result:</div>
                                <pre className="whitespace-pre-wrap text-gray-200">{typeof stakeResult!.statusResult === 'string' ? stakeResult!.statusResult : JSON.stringify(stakeResult!.statusResult, null, 2)}</pre>
                            </div>
                        )}
                        
                        {/* Show warning and download button if mnemonicsData is present */}
                        {stakeResult?.mnemonicsData && (
                            <div className="mb-4">
                                <div className="text-yellow-400 font-semibold mb-2 flex items-center">
                                    <i className="fas fa-exclamation-triangle mr-2"></i>
                                    Node Wallet Mnemonics - CRITICAL SECURITY WARNING
                                </div>
                                
                                <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-4">
                                    <p className="text-red-300 text-sm mb-2 font-semibold">
                                        <i className="fas fa-shield-alt mr-2"></i>
                                        EXTREME CAUTION! These are your node wallet secret phrases.
                                    </p>
                                    <ul className="text-red-200 text-xs space-y-1 list-disc pl-5">
                                        <li>Never share these mnemonics with anyone</li>
                                        <li>Anyone with these phrases can steal your funds</li>
                                        <li>Store them securely offline immediately</li>
                                        <li>Take screenshots only if absolutely necessary</li>
                                    </ul>
                                </div>

                                {/* Important Note about generated wallets */}
                                <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-3 mb-4">
                                    <p className="text-blue-300 text-sm font-semibold mb-1">
                                        <i className="fas fa-info-circle mr-2"></i>
                                        Important Note
                                    </p>
                                    <p className="text-blue-200 text-xs">
                                        These are <strong>newly generated node wallet mnemonics</strong> for demonstration purposes. 
                                        In the final version, the backend will provide the actual node wallet mnemonics created during the staking process.
                                    </p>
                                </div>

                                {/* Display each wallet's mnemonic */}
                                <div className="space-y-4">
                                    <div className="text-gray-300 text-sm mb-3">
                                        <div className="mb-2">
                                            Session ID: <span className="font-mono text-blue-300">{stakeResult!.mnemonicsData.sessionId}</span>
                                        </div>
                                        <div className="mb-2">
                                            Owner Address: <span className="font-mono text-green-300">{stakeResult!.mnemonicsData.ownerAddress}</span>
                                        </div>
                                        <div className="text-sm text-yellow-300">
                                            <i className="fas fa-server mr-1"></i>
                                            Node Wallets: {stakeResult!.mnemonicsData.numberOfNodes} wallet{stakeResult!.mnemonicsData.numberOfNodes !== 1 ? 's' : ''} generated
                                        </div>
                                    </div>
                                    
                                    {stakeResult!.mnemonicsData.wallets && stakeResult!.mnemonicsData.wallets.map((wallet: any, index: number) => (
                                        <div key={index} className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <h4 className="text-gray-200 font-semibold flex items-center">
                                                    <i className="fas fa-server text-blue-400 mr-2"></i>
                                                    Node #{wallet.nodeNumber || index + 1}: {wallet.walletName || `node_${index + 1}`}
                                                </h4>
                                                <button
                                                    onClick={(event) => {
                                                        if (wallet.mnemonic) {
                                                            navigator.clipboard.writeText(wallet.mnemonic);
                                                            // Show a brief feedback
                                                            const btn = event.target as HTMLButtonElement;
                                                            const originalText = btn.textContent;
                                                            btn.textContent = 'Copied!';
                                                            btn.className = btn.className.replace('from-blue-600', 'from-green-600').replace('to-blue-700', 'to-green-700');
                                                            setTimeout(() => {
                                                                if (originalText) btn.textContent = originalText;
                                                                btn.className = btn.className.replace('from-green-600', 'from-blue-600').replace('to-green-700', 'to-blue-700');
                                                            }, 2000);
                                                        }
                                                    }}
                                                    className="px-3 py-1 text-xs bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded transition-all duration-200 flex items-center"
                                                    title="Copy node wallet mnemonic to clipboard"
                                                >
                                                    <i className="fas fa-copy mr-1"></i>
                                                    Copy Mnemonic
                                                </button>
                                            </div>
                                            
                                            <div className="text-xs text-gray-400 mb-2">
                                                <span className="inline-block mr-4">
                                                    <i className="fas fa-wallet mr-1"></i>
                                                    Address: <span className="font-mono text-blue-300">{wallet.address}</span>
                                                </span>
                                                {wallet.note && (
                                                    <span className="inline-block text-yellow-400">
                                                        <i className="fas fa-exclamation-circle mr-1"></i>
                                                        {wallet.note}
                                                    </span>
                                                )}
                                            </div>
                                            
                                            {wallet.mnemonic ? (
                                                <div className="bg-gray-900 border border-gray-600 rounded p-3">
                                                    <div className="font-mono text-sm text-gray-200 break-all leading-relaxed">
                                                        {wallet.mnemonic}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-yellow-300 text-sm p-2 bg-yellow-900/20 border border-yellow-800 rounded">
                                                    <i className="fas fa-exclamation-circle mr-2"></i>
                                                    No mnemonic available for this node wallet
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Keep the download option as backup */}
                                <div className="mt-4 pt-4 border-t border-gray-700">
                                    <div className="text-gray-400 text-sm mb-2">
                                        You can also download this information as a JSON file:
                                    </div>
                                    <a
                                        href={stakeResult!.mnemonicsUrl}
                                        download={stakeResult!.mnemonicsFileName}
                                        className="inline-block px-4 py-2 rounded-lg bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white text-sm font-semibold shadow-lg transition-all duration-200"
                                    >
                                        <i className="fas fa-download mr-2"></i>
                                        Download Node Wallets JSON
                                    </a>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-center gap-4 mt-4">
                            <button
                                className="px-6 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold"
                                onClick={() => setStakeResult(null)}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </motion.div>
    );
};

export default WalletDashboard;