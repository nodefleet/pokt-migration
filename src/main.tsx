// Importar polyfills primero
import './polyfills';

import './styles.css';
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Header from './components/Header';
import MainContent from './components/MainContent';
import Footer from './components/Footer';
import IndividualImport from './components/IndividualImport';
import WalletDashboard from './components/WalletDashboard';
import NetworkError from './components/NetworkError';
import { AppState, StoredWallet } from './types';
import { WalletService } from './controller/WalletService';
import { Transaction, NetworkType } from './controller/WalletManager';
import { AnimatePresence } from 'framer-motion';
import { storageService } from './controller/storage.service';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// Importar Firebase Analytics
import { analytics, trackEvent } from './firebase';
import { DEBUG_CONFIG, STORAGE_KEYS } from './controller/config';

// Ya no es necesario configurar Buffer aquí, ya está en polyfills.ts
// import { Buffer } from 'buffer';
// window.Buffer = Buffer;

const queryClient = new QueryClient();

const App: React.FC = () => {
    const navigate = useNavigate();
    const [state, setState] = useState<AppState>({
        walletAddress: null,
        showTransactions: false
    });
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [balance, setBalance] = useState<string>('0');
    const [networkType, setNetworkType] = useState<NetworkType>('shannon');
    const [isMainnet, setIsMainnet] = useState<boolean>(true);
    const [networkError, setNetworkError] = useState<string | null>(null);
    const [walletService] = useState(() => new WalletService());

    // Registrar evento de inicialización de la aplicación
    useEffect(() => {
        trackEvent('app_initialized', {
            timestamp: new Date().toISOString()
        });
    }, []);

    // Función para cargar balance y transacciones
    const loadWalletData = async (address: string) => {
        try {
            DEBUG_CONFIG.log('📊 Loading wallet data for:', address);

            if (!address) {
                DEBUG_CONFIG.error('❌ No wallet address provided to loadWalletData');
                return;
            }

            // Resetear balance a 0 antes de cargar para evitar mostrar el balance anterior
            setBalance('0');

            // Verificar que el walletService esté inicializado
            if (!walletService.getWalletManager()) {
                DEBUG_CONFIG.log('⚠️ WalletManager no inicializado, inicializando...');
                await walletService.init();
            }

            // Cargar balance
            const walletInfo = await walletService.getCurrentWalletInfo();
            let currentBalance = '0';

            if (walletInfo) {
                DEBUG_CONFIG.log(`💰 Balance loaded for ${address}: ${walletInfo.balance}`);
                currentBalance = walletInfo.balance;
                setBalance(currentBalance);
            } else {
                DEBUG_CONFIG.warn(`⚠️ No wallet info returned for address ${address}`);
                // Intentar obtener balance directamente
                const directBalance = await walletService.getBalance(address);
                if (directBalance) {
                    DEBUG_CONFIG.log(`💰 Direct balance loaded: ${directBalance}`);
                    currentBalance = directBalance;
                    setBalance(currentBalance);
                } else {
                    DEBUG_CONFIG.warn('⚠️ No se pudo obtener balance directo');
                    setBalance('0');
                }
            }

            // Cargar transacciones
            try {
                const walletTransactions = await walletService.getTransactions(address);
                setTransactions(walletTransactions);
                DEBUG_CONFIG.log('✅ Transactions loaded:', walletTransactions.length);
            } catch (txError) {
                DEBUG_CONFIG.error('❌ Error loading transactions:', txError);
                setTransactions([]);
            }

            // Disparar evento de actualización para que otros componentes se actualicen
            // Siempre usar el balance actualizado (currentBalance)
            window.dispatchEvent(new CustomEvent('wallet_data_updated', {
                detail: { address, balance: currentBalance }
            }));

        } catch (error) {
            DEBUG_CONFIG.error('❌ Error loading wallet data:', error);
            // En caso de error, mantener valores por defecto
            setBalance('0');
            setTransactions([]);
        }
    };

    // Listener para cambios en storage
    useEffect(() => {
        const handleStorageUpdate = async (event: CustomEvent) => {
            const { key, value } = event.detail;
            DEBUG_CONFIG.log('Storage updated:', key, value);

            // Manejar actualizaciones de wallets Shannon
            if (key === 'shannon_wallet' && value) {
                const walletData = JSON.parse(value);
                if (walletData.parsed?.address) {
                    setState(prev => ({ ...prev, walletAddress: walletData.parsed.address }));
                    setNetworkType('shannon');

                    // SIEMPRE RESPETAR la configuración isMainnet del storage - NUNCA SOBRESCRIBIR
                    const savedIsMainnet = storageService.getSync<boolean>('isMainnet');
                    if (savedIsMainnet !== null && savedIsMainnet !== undefined) {
                        setIsMainnet(savedIsMainnet);
                        DEBUG_CONFIG.log('Shannon wallet updated - RESPECTING saved isMainnet:', savedIsMainnet);
                    } else {
                        // Solo usar TESTNET por defecto si NO HAY configuración previa
                        setIsMainnet(true);
                        await storageService.set('isMainnet', true);
                        DEBUG_CONFIG.log('Shannon wallet updated - using TESTNET default (NO previous config)');
                    }

                    DEBUG_CONFIG.log('Shannon wallet address updated from storage:', walletData.parsed.address);

                    // Navegar al dashboard si no estamos ya ahí
                    if (window.location.pathname !== '/wallet') {
                        navigate('/wallet');
                    }
                }
            }

            // Manejar actualizaciones de wallets Morse
            if (key === 'morse_wallet' && value) {
                const walletData = JSON.parse(value);
                if (walletData.parsed?.address) {
                    setState(prev => ({ ...prev, walletAddress: walletData.parsed.address }));
                    setNetworkType('morse');

                    // MORSE TAMBIÉN RESPETA la configuración isMainnet del storage
                    const savedIsMainnet = await storageService.get<boolean>('isMainnet');
                    if (savedIsMainnet !== null && savedIsMainnet !== undefined) {
                        setIsMainnet(savedIsMainnet);
                        DEBUG_CONFIG.log('Morse wallet updated - RESPECTING saved isMainnet:', savedIsMainnet);
                    } else {
                        // Si no hay configuración previa, usar false como default para Morse
                        setIsMainnet(true);
                        await storageService.set('isMainnet', true);
                        DEBUG_CONFIG.log('Morse wallet updated - using testnet as default (NO previous config)');
                    }

                    DEBUG_CONFIG.log('Morse wallet address updated from storage:', walletData.parsed.address);

                    // Navegar al dashboard
                    if (window.location.pathname !== '/wallet') {
                        navigate('/wallet');
                    }
                }
            }
        };

        window.addEventListener('storage_updated', handleStorageUpdate as unknown as EventListener);

        return () => {
            window.removeEventListener('storage_updated', handleStorageUpdate as unknown as EventListener);
        };
    }, [navigate]);

    // Comprobar si hay una wallet activa al cargar
    useEffect(() => {
        const checkStoredWallets = async () => {
            try {
                // PRIMERO: Cargar configuración de red cacheada ANTES de inicializar walletService
                const cachedIsMainnet = await storageService.get<boolean>('isMainnet');
                const cachedNetworkType = await storageService.get<string>('pokt_network_type') || 'shannon';

                DEBUG_CONFIG.log('🚀 APP INIT - Cached network config:', {
                    isMainnet: cachedIsMainnet,
                    networkType: cachedNetworkType
                });

                // Configurar estado inicial basado en cache
                if (cachedIsMainnet !== null && cachedIsMainnet !== undefined) {
                    setIsMainnet(cachedIsMainnet);
                    DEBUG_CONFIG.log(`📍 Using cached isMainnet: ${cachedIsMainnet}`);
                } else {
                    // Si no hay cache, defaultear a testnet
                    setIsMainnet(false);
                    await storageService.set('isMainnet', true);
                    DEBUG_CONFIG.log('📍 No cached isMainnet - defaulting to testnet');
                }

                // Inicializar el walletService DESPUÉS de configurar el estado
                await walletService.init();

                // Usar storageService en lugar de acceso directo
                const morseWallet = await storageService.get<StoredWallet>('morse_wallet');
                const shannonWallet = await storageService.get<StoredWallet>('shannon_wallet');

                if (morseWallet || shannonWallet) {
                    const lastWallet = morseWallet && shannonWallet
                        ? morseWallet.timestamp > shannonWallet.timestamp
                            ? morseWallet
                            : shannonWallet
                        : morseWallet || shannonWallet;

                    DEBUG_CONFIG.log('Using wallet:', lastWallet);

                    if (lastWallet && lastWallet.parsed?.address) {
                        // USAR DIRECTAMENTE la red guardada en storage
                        const address = lastWallet.parsed.address;
                        const networkFromStorage = lastWallet.network; // morse o shannon

                        // Configurar estado directamente según lo guardado
                        setState(prev => ({ ...prev, walletAddress: address }));
                        setNetworkType(networkFromStorage);

                        // USAR LA CONFIGURACIÓN YA CARGADA (no volver a cargarla)
                        const finalIsMainnet = true; // FORZAR booleano válido
                        DEBUG_CONFIG.log(`📍 Using final config for wallet loading: ${networkFromStorage} ${finalIsMainnet ? 'mainnet' : 'testnet'}`);
                        DEBUG_CONFIG.log(`🔍 DEBUG finalIsMainnet type: ${typeof finalIsMainnet}, value: ${finalIsMainnet}`);

                        // CONFIGURAR WALLETSERVICE con la configuración cacheada
                        if (networkFromStorage === 'morse') {
                            await walletService.switchNetwork('morse', false);
                        } else {
                            await walletService.switchNetwork('shannon', finalIsMainnet);
                        }

                        // Si hay una wallet activa, navegar al dashboard a menos que esté en una página de importación específica
                        const currentPath = window.location.pathname;
                        const isImportPage = currentPath.includes('/import/');
                        const isRootPage = currentPath === '/';

                        // Solo navegar automáticamente si estamos en la página raíz y no es una navegación explícita a import
                        if (isRootPage && !isImportPage) {
                            DEBUG_CONFIG.log('Auto-navigating to wallet dashboard from root page');
                            navigate('/wallet');
                        }

                        // CARGAR DATOS AUTOMÁTICAMENTE para wallets activas
                        if (lastWallet && lastWallet.parsed?.address) {
                            DEBUG_CONFIG.log('📊 Loading data for stored wallet:', lastWallet.parsed.address);
                            // Pequeño delay para permitir que la configuración se complete
                            setTimeout(() => {
                                loadWalletData(lastWallet.parsed.address);
                            }, 500);
                        }
                    }
                }
            } catch (error) {
                DEBUG_CONFIG.error('Error loading wallets:', error);
            }
        };

        checkStoredWallets();
    }, [navigate]);

    const handleWalletImport = async (code: string, password: string, network?: NetworkType, fromStorage = false) => {
        try {
            DEBUG_CONFIG.log('🚀 handleWalletImport START:', {
                codePreview: code.substring(0, 50) + '...',
                network,
                fromStorage
            });

            if (!walletService.getWalletManager()) {
                await walletService.init();
            }

            // Usar el nuevo método que detecta automáticamente la red
            const walletInfo = await walletService.importWallet(code, password, network);
            DEBUG_CONFIG.log('✅ Wallet imported successfully:', walletInfo);

            // Solo guardar en storage si NO viene del storage (evitar loops)
            if (!fromStorage) {
                const storageData = {
                    serialized: code,
                    network: walletInfo.network,
                    timestamp: Date.now(),
                    parsed: { address: walletInfo.address }
                };
                DEBUG_CONFIG.log('💾 Saving to storage:', `${walletInfo.network}_wallet`, storageData);
                await storageService.set(`${walletInfo.network}_wallet`, storageData);
            }

            DEBUG_CONFIG.log('🔄 Updating app state with:', {
                address: walletInfo.address,
                network: walletInfo.network
            });

            setState(prev => ({ ...prev, walletAddress: walletInfo.address }));
            setNetworkType(walletInfo.network);

            // MANTENER la configuración isMainnet del storage si existe
            if (fromStorage) {
                // Cargar isMainnet desde storage si viene del storage
                const savedIsMainnet = await storageService.get<boolean>('isMainnet');
                if (savedIsMainnet !== null && savedIsMainnet !== undefined) {
                    setIsMainnet(savedIsMainnet);
                    DEBUG_CONFIG.log(`💾 Using saved isMainnet from storage: ${savedIsMainnet}`);
                } else {
                    setIsMainnet(walletInfo.isMainnet);
                    DEBUG_CONFIG.log(`🔧 Set isMainnet from walletInfo: ${walletInfo.isMainnet}`);
                }
            } else {
                // Nueva importación - usar el valor detectado y guardarlo
                setIsMainnet(walletInfo.isMainnet);
                DEBUG_CONFIG.log(`🆕 New import - set isMainnet: ${walletInfo.isMainnet}`);
            }

            // Importante: Cargar los datos de la wallet antes de navegar
            await loadWalletData(walletInfo.address);

            // Trigger wallet selector refresh  
            window.dispatchEvent(new CustomEvent('wallets_updated', {
                detail: { type: 'wallet_imported', network: walletInfo.network, address: walletInfo.address }
            }));
            DEBUG_CONFIG.log('✅ Wallet selector refresh event triggered for import');

            // Also trigger migration prerequisites refresh
            window.dispatchEvent(new CustomEvent('migration_check_needed', {
                detail: { type: 'wallet_imported', network: walletInfo.network, address: walletInfo.address }
            }));
            DEBUG_CONFIG.log('✅ Migration prerequisites refresh event triggered for import');

            navigate('/wallet');

            trackEvent('wallet_imported', {
                network_type: walletInfo.network,
                is_mainnet: walletInfo.isMainnet,
                from_storage: fromStorage
            });

            return { address: walletInfo.address, network: walletInfo.network };
        } catch (error) {
            console.error('❌ Error importing wallet:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            // Registrar evento de error en importación
            trackEvent('wallet_import_failed', {
                network_type: network || networkType,
                is_mainnet: isMainnet,
                from_storage: fromStorage,
                error: errorMessage
            });
            DEBUG_CONFIG.error('❌ Error importing wallet:', error);
            throw error;
        }
    };

    const handleCreateWallet = async (password: string, network?: NetworkType) => {
        try {
            DEBUG_CONFIG.log(`🚀 handleCreateWallet: Creating ${network || 'shannon'} wallet...`);
            
            if (!walletService.getWalletManager()) {
                await walletService.init();
            }

            // Check current storage state
            const storedIsMainnet = await storageService.get<boolean>('isMainnet');
            DEBUG_CONFIG.log(`🔍 DEBUG: Storage isMainnet: ${storedIsMainnet}`);

            // Asegurar que estamos creando una wallet Shannon (por defecto)
            const targetNetwork = network || 'shannon';
            // FIX: Use the stored isMainnet value instead of hardcoded false
            const targetIsMainnet = storedIsMainnet !== null ? storedIsMainnet : false;

            DEBUG_CONFIG.log(`🎯 Target configuration: ${targetNetwork} ${targetIsMainnet ? 'mainnet' : 'testnet'} (from storage: ${storedIsMainnet})`);

            // Track wallet creation event
            trackEvent('wallet_created', {
                network_type: targetNetwork,
                is_mainnet: targetIsMainnet
            });

            // Usar el método createWallet del walletService
            DEBUG_CONFIG.log(`🔄 Calling walletService.createWallet with: password, ${targetNetwork}, ${targetIsMainnet}`);
            const walletInfo = await walletService.createWallet(password, targetNetwork, targetIsMainnet);
            DEBUG_CONFIG.log(`✅ Wallet created:`, walletInfo);

            // Always switch to the newly created wallet (better UX)
            DEBUG_CONFIG.log('🎯 Switching to newly created wallet');
            setState(prev => ({ ...prev, walletAddress: walletInfo.address }));
            setNetworkType(walletInfo.network);
            setIsMainnet(walletInfo.isMainnet);
            
            DEBUG_CONFIG.log(`🔄 App state updated - Address: ${walletInfo.address}, Network: ${walletInfo.network}, IsMainnet: ${walletInfo.isMainnet}`);

            // Load wallet data before navigating
            DEBUG_CONFIG.log('🔄 Loading wallet data for newly created wallet:', walletInfo.address);
            await loadWalletData(walletInfo.address);

            // For Shannon wallets, don't auto-navigate - let the mnemonic reminder handle navigation
            // For other wallet types, navigate immediately
            if (targetNetwork === 'shannon') {
                DEBUG_CONFIG.log('🔔 Shannon wallet created - will show mnemonic reminder, no auto-navigation');
                // Don't navigate automatically for Shannon - let the mnemonic reminder popup handle it
            } else {
                // Navigate immediately for non-Shannon wallets
                navigate('/wallet');
            }

            // Trigger wallet selector refresh (always fire this event)
            window.dispatchEvent(new CustomEvent('wallets_updated', {
                detail: { type: 'wallet_created', network: walletInfo.network, address: walletInfo.address }
            }));
            DEBUG_CONFIG.log('✅ Wallet selector refresh event triggered');

            // Also trigger migration prerequisites refresh
            window.dispatchEvent(new CustomEvent('migration_check_needed', {
                detail: { type: 'wallet_created', network: walletInfo.network, address: walletInfo.address }
            }));
            DEBUG_CONFIG.log('✅ Migration prerequisites refresh event triggered');

            // Small delay to ensure storage and events have propagated
            await new Promise(resolve => setTimeout(resolve, 100));

            return { address: walletInfo.address, network: walletInfo.network };
        } catch (error) {
            console.error('❌ Error creating wallet:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            setNetworkError(`Error creating wallet: ${errorMessage}`);

            // Registrar evento de error en creación
            trackEvent('wallet_creation_failed', {
                error: errorMessage
            });

            DEBUG_CONFIG.error('❌ Error creating wallet:', error);
            throw error;
        }
    };

    const handleLogout = async (network?: NetworkType) => {
        try {
            DEBUG_CONFIG.log(`🚪 Starting ${network || 'complete'} logout...`);

            if (network) {
                // Network-specific logout
                if (network === 'morse') {
                    // Morse logout: Clear only Morse wallet data
                    await storageService.remove('morse_wallet');
                    await storageService.remove('morse_wallets');
                    DEBUG_CONFIG.log('✅ Morse wallet logout completed - Shannon wallet preserved');
                } else if (network === 'shannon') {
                    // Shannon logout: Clear ALL wallet data (Shannon + all Morse)
                    // This is because Shannon is the primary wallet in our workflow
                    DEBUG_CONFIG.log('🔄 Shannon logout - clearing ALL wallets (Shannon is primary)');
                    
                    // Clear Shannon data
                    await storageService.remove('shannon_wallet');
                    await storageService.remove('shannon_wallets');
                    
                    // Clear all Morse data too (since they depend on Shannon)
                    await storageService.remove('morse_wallet');
                    await storageService.remove('morse_wallets');
                    
                    // Clear all wallet-related storage
                    await storageService.remove(STORAGE_KEYS.WALLET_ADDRESS);
                    await storageService.remove(STORAGE_KEYS.NETWORK_TYPE);
                    await storageService.remove(STORAGE_KEYS.NETWORK);
                    
                    DEBUG_CONFIG.log('✅ Complete logout - all wallets cleared');
                }

                // If we're currently on the logged out network, or if Shannon was logged out, clear current state
                if (networkType === network || network === 'shannon') {
                    setState({ walletAddress: null, showTransactions: false });
                    setBalance('0');
                    setTransactions([]);
                    setNetworkError(null);
                    // Navigate to home page
                    navigate('/');
                }
            } else {
                // Complete logout (fallback for backward compatibility)
                DEBUG_CONFIG.log('🚪 Starting complete logout...');

                // 1. Limpiar el servicio de wallets
                walletService.logout();

                // 2. Limpiar estados locales
                setState({ walletAddress: null, showTransactions: false });
                setBalance('0');
                setTransactions([]);
                setNetworkType('shannon');
                setIsMainnet(false);
                setNetworkError(null);

                // 3. LIMPIAR COMPLETAMENTE TODO EL STORAGE relacionado con wallets
                await storageService.remove('isMainnet');
                await storageService.remove('shannon_wallet');
                await storageService.remove('morse_wallet');
                await storageService.remove('walletAddress');
                await storageService.remove('walletData');
                await storageService.remove('pokt_network_type');
                await storageService.remove('pokt_network');

                // 4. Limpiar cualquier otro dato residual
                const keys = await storageService.keys();
                for (const key of keys) {
                    if (key.includes('wallet') || key.includes('address') || key.includes('network')) {
                        await storageService.remove(key);
                        DEBUG_CONFIG.log(`🧹 Removed storage key: ${key}`);
                    }
                }

                DEBUG_CONFIG.log('✅ Complete logout finished - all wallet data cleared');

                // 5. Navegar a la página principal
                navigate('/');
            }
        } catch (error) {
            DEBUG_CONFIG.error('❌ Error during logout:', error);
            // Asegurar navegación aunque haya errores
            navigate('/');
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-black text-white">
            <Header
                walletAddress={state.walletAddress}
                onLogout={handleLogout}
                currentNetwork={networkType}
                isMainnet={isMainnet}
                onWalletChange={async (address: string, network: NetworkType, isMainnetSelected?: boolean) => {
                    try {
                        setNetworkError(null);

                        DEBUG_CONFIG.log(`🔄 DIRECT wallet change to: ${address} (${network}) - Mainnet: ${isMainnetSelected}`);

                        // Actualización INMEDIATA del estado - sin esperar
                        setState(prev => ({ ...prev, walletAddress: address }));
                        setNetworkType(network);

                        // USAR DIRECTAMENTE lo que selecciona el usuario - SIN DETECCIÓN
                        if (isMainnetSelected !== undefined) {
                            setIsMainnet(isMainnetSelected);
                            DEBUG_CONFIG.log(`🎯 MANUAL mainnet selection: ${isMainnetSelected} - SAVED TO STORAGE`);
                        } else {
                            // Solo para Shannon cuando no se especifica, usar TESTNET por defecto
                            if (network === 'shannon') {
                                setIsMainnet(true);
                                await storageService.set('isMainnet', true);
                                DEBUG_CONFIG.log(`📍 Shannon TESTNET default (NO manual selection)`);
                            } else {
                                // Morse siempre testnet
                                setIsMainnet(true);
                                await storageService.set('isMainnet', true);
                                DEBUG_CONFIG.log(`🟡 MORSE always testnet - SAVED TO STORAGE`);
                            }
                        }

                        // Actualizar walletManager con la nueva configuración
                        await walletService.switchNetwork(network, isMainnetSelected === true);

                        // Importante: Cargar los datos de la nueva wallet seleccionada
                        DEBUG_CONFIG.log('🔄 Loading wallet data for new selected wallet:', address);
                        await loadWalletData(address);

                        // Guardar la dirección seleccionada en localStorage
                        await storageService.set('walletAddress', address);

                        // Navegar al dashboard si no estamos ya ahí
                        if (window.location.pathname !== '/wallet') {
                            navigate('/wallet');
                        }
                    } catch (error) {
                        DEBUG_CONFIG.error('Error changing wallet:', error);
                        setNetworkError(error instanceof Error ? error.message : 'Error changing wallet');
                    }
                }}
                onNetworkChange={async (network: NetworkType) => {
                    try {
                        setNetworkError(null);

                        DEBUG_CONFIG.log(`🔄 DIRECT network change to: ${network}`);

                        // Verificación RÁPIDA de wallet
                        const storedWallet = await storageService.get<StoredWallet>(`${network}_wallet`);
                        if (!storedWallet || !storedWallet.parsed?.address) {
                            setNetworkError(`No wallet found for ${network} network`);
                            return;
                        }

                        // Actualización INMEDIATA del estado - USAR LA RED SELECCIONADA DIRECTAMENTE
                        const address = storedWallet.parsed.address;
                        setState(prev => ({ ...prev, walletAddress: address }));
                        setNetworkType(network);

                        // MANTENER LA CONFIGURACIÓN ACTUAL DE MAINNET/TESTNET - NO SOBRESCRIBIR
                        if (network === 'morse') {
                            setIsMainnet(true); // Morse siempre testnet
                            await storageService.set('isMainnet', true);
                            DEBUG_CONFIG.log(`🟡 MORSE network selected - always testnet`);
                        } else {
                            // Para Shannon: MANTENER la configuración actual del usuario
                            const currentIsMainnet = await storageService.get<boolean>('isMainnet');
                            if (currentIsMainnet !== null && currentIsMainnet !== undefined) {
                                setIsMainnet(currentIsMainnet);
                                DEBUG_CONFIG.log(`🔵 SHANNON network selected - MAINTAINING user preference: ${currentIsMainnet === true ? 'mainnet' : 'testnet'}`);
                            } else {
                                // Solo si no hay configuración previa, usar TESTNET por defecto
                                setIsMainnet(true);
                                await storageService.set('isMainnet', true);
                                DEBUG_CONFIG.log(`🔵 SHANNON network selected - using TESTNET default (NO previous config)`);
                            }
                        }

                        // Configuración de red DIRECTA
                        // CARGAR EL VALOR REAL de isMainnet desde storage para evitar desincronización
                        const currentStoredIsMainnet = await storageService.get<boolean>('isMainnet');
                        const realIsMainnet = currentStoredIsMainnet !== null ? currentStoredIsMainnet : false;
                        const finalIsMainnet = network === 'morse' ? false : realIsMainnet;
                        DEBUG_CONFIG.log(`🔍 DEBUG NETWORK SWITCH - network: ${network}, state.isMainnet: ${isMainnet}, storage.isMainnet: ${currentStoredIsMainnet}, finalIsMainnet: ${finalIsMainnet}`);
                        if (network === 'morse') {
                            await walletService.switchNetwork('morse', false);
                        } else {
                            await walletService.switchNetwork('shannon', finalIsMainnet);
                        }

                        // Limpiar datos
                        setTransactions([]);

                        // No resetear inmediatamente a 0, mantener balance anterior mientras carga
                        setTransactions([]);

                        // CARGAR AUTOMÁTICAMENTE LOS NUEVOS DATOS
                        await loadWalletData(address);

                        DEBUG_CONFIG.log(`✅ DIRECT network change completed: ${network} with wallet ${address}`);
                    } catch (error) {
                        DEBUG_CONFIG.error('Error changing network:', error);
                        setNetworkError(error instanceof Error ? error.message : 'Error changing network');
                    }
                }}
                onMainnetChange={async (isMainnetSelected: boolean) => {
                    try {
                        DEBUG_CONFIG.log(`🎯 MANUAL mainnet change: ${isMainnetSelected}`);

                        // Actualizar estado inmediatamente
                        setIsMainnet(isMainnetSelected);
                        DEBUG_CONFIG.log(`💾 Mainnet preference saved to storage: ${isMainnetSelected}`);

                        // Reconfigurar la red con la nueva configuración
                        if (networkType !== 'morse') {
                            await walletService.switchNetwork(networkType, isMainnetSelected);
                        }

                        // Limpiar balance y transacciones para forzar recarga
                        setTransactions([]);

                        // CARGAR AUTOMÁTICAMENTE LOS NUEVOS DATOS si hay wallet activa
                        if (state.walletAddress) {
                            await loadWalletData(state.walletAddress);
                        }

                        DEBUG_CONFIG.log(`✅ Mainnet configuration changed to: ${isMainnetSelected === true ? 'MAINNET' : 'TESTNET'}`);
                    } catch (error) {
                        DEBUG_CONFIG.error('Error changing mainnet configuration:', error);
                    }
                }}
            />
            <main className="flex-grow max-w-6xl mx-auto px-4 py-8">
                <Routes>
                    <Route path="/" element={<MainContent onWalletImport={handleWalletImport} />} />

                    <Route path="/wallet" element={
                        (() => {

                            return state.walletAddress ? (
                                <WalletDashboard
                                    key={`${state.walletAddress}-${networkType}-${isMainnet}`}
                                    walletAddress={state.walletAddress}
                                    balance={balance}
                                    transactions={transactions}
                                    network={networkType}
                                    isMainnet={isMainnet}
                                    walletManager={walletService.getWalletManager()}
                                    onLogout={handleLogout}
                                    onNetworkChange={async (network: NetworkType) => {
                                        try {
                                            setNetworkError(null);

                                            // Verificar si existe una wallet para esta red
                                            const storedWallet = await storageService.get<StoredWallet>(`${network}_wallet`);
                                            if (!storedWallet || !storedWallet.parsed?.address) {
                                                setNetworkError(`No wallet found for ${network} network`);
                                                return;
                                            }

                                            // USAR DIRECTAMENTE la red seleccionada - SIN DETECCIÓN
                                            DEBUG_CONFIG.log(`🔄 WalletDashboard: Direct change to ${network} network`);

                                            // Configurar estado directamente
                                            const address = storedWallet.parsed.address;
                                            setState(prev => ({ ...prev, walletAddress: address }));
                                            setNetworkType(network);

                                            // MANTENER LA CONFIGURACIÓN ACTUAL DE MAINNET/TESTNET - NO SOBRESCRIBIR
                                            if (network === 'morse') {
                                                setIsMainnet(true); // Morse siempre testnet
                                                await storageService.set('isMainnet', true);
                                            } else {
                                                // Para Shannon: MANTENER la configuración actual del usuario
                                                const currentIsMainnet = await storageService.get<boolean>('isMainnet');
                                                if (currentIsMainnet !== null && currentIsMainnet !== undefined) {
                                                    setIsMainnet(currentIsMainnet);
                                                    DEBUG_CONFIG.log(`🔵 WalletDashboard: MAINTAINING user preference: ${currentIsMainnet === true ? 'mainnet' : 'testnet'}`);
                                                } else {
                                                    // Solo si no hay configuración previa, usar TESTNET por defecto
                                                    setIsMainnet(true);
                                                    await storageService.set('isMainnet', true);
                                                    DEBUG_CONFIG.log(`🔵 WalletDashboard: using TESTNET default (NO previous config)`);
                                                }
                                            }

                                            // Limpiar datos
                                            setTransactions([]);

                                            // No resetear inmediatamente a 0, mantener balance anterior mientras carga
                                            setTransactions([]);

                                            // CARGAR AUTOMÁTICAMENTE LOS NUEVOS DATOS
                                            await loadWalletData(address);

                                            DEBUG_CONFIG.log(`✅ WalletDashboard: Direct network change to ${network} completed`);
                                        } catch (error) {
                                            DEBUG_CONFIG.error('Error changing network:', error);
                                            setNetworkError(error instanceof Error ? error.message : 'Error changing network');
                                        }
                                    }}
                                    onSend={() => { }}
                                    onReceive={() => { }}
                                    onSwap={() => { }}
                                    onStake={() => { }}
                                    onViewTransactions={() => setState(prev => ({ ...prev, showTransactions: true }))}
                                />
                            ) : (
                                (() => {
                                    return <Navigate to="/" replace />;
                                })()
                            );
                        })()
                    } />

                    <Route path="/import/individual" element={
                        <IndividualImport
                            onWalletImport={handleWalletImport}
                            onCreateWallet={handleCreateWallet}
                            onReturn={() => navigate('/')}
                        />
                    } />

                </Routes>
            </main>
            <Footer />

            <AnimatePresence>
                {networkError && (
                    <NetworkError
                        network={networkType}
                        error={networkError}
                        onRetry={async () => {
                            try {
                                setNetworkError(null);
                                await walletService.switchNetwork(networkType, isMainnet);
                                if (state.walletAddress) {
                                    const walletInfo = await walletService.getCurrentWalletInfo();
                                    if (walletInfo) {
                                        setBalance(walletInfo.balance);
                                        setTransactions(await walletService.getTransactions(walletInfo.address));
                                    }
                                }
                            } catch (error) {
                                setNetworkError(error instanceof Error ? error.message : 'Reconnection error');
                            }
                        }}
                        onSwitchNetwork={async () => {
                            try {
                                setNetworkError(null);
                                await walletService.switchNetwork('shannon', false);
                                setNetworkType('shannon');
                                setIsMainnet(false);
                                if (state.walletAddress) {
                                    const walletInfo = await walletService.getCurrentWalletInfo();
                                    if (walletInfo) {
                                        setBalance(walletInfo.balance);
                                        setTransactions(await walletService.getTransactions(walletInfo.address));
                                    }
                                }
                            } catch (error) {
                                setNetworkError(error instanceof Error ? error.message : 'Error changing network');
                            }
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
);

root.render(
    <BrowserRouter basename="/">
        <QueryClientProvider client={queryClient}>
            <App />
        </QueryClientProvider>
    </BrowserRouter>
); 