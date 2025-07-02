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
    const [isMainnet, setIsMainnet] = useState<boolean>(false);
    const [networkError, setNetworkError] = useState<string | null>(null);
    const [walletService] = useState(() => new WalletService());

    // Function to load balance and transactions
    const loadWalletData = async (address: string) => {
        try {
            console.log('📊 Loading wallet data for:', address);

            if (!address) {
                console.error('❌ No wallet address provided to loadWalletData');
                return;
            }

            // Reset balance to 0 before loading to avoid showing the previous balance
            setBalance('0');

            // Verify that walletService is initialized
            if (!walletService.getWalletManager()) {
                console.log('⚠️ WalletManager no initialized, initializing...');
                await walletService.init();
            }

            // Load balance
            const walletInfo = await walletService.getCurrentWalletInfo();
            if (walletInfo) {
                console.log(`💰 Balance loaded for ${address}: ${walletInfo.balance}`);
                setBalance(walletInfo.balance);
            } else {
                console.warn(`⚠️ No wallet info returned for address ${address}`);
                // Try to get balance directly
                const directBalance = await walletService.getBalance(address);
                if (directBalance) {
                    console.log(`💰 Direct balance loaded: ${directBalance}`);
                    setBalance(directBalance);
                } else {
                    console.warn('⚠️ No se pudo obtener balance directo');
                    setBalance('0');
                }
            }

            // Load transactions
            try {
                const walletTransactions = await walletService.getTransactions(address);
                setTransactions(walletTransactions);
                console.log('✅ Transactions loaded:', walletTransactions.length);
            } catch (txError) {
                console.error('❌ Error loading transactions:', txError);
                setTransactions([]);
            }

            // Trigger update event for other components to update
            window.dispatchEvent(new CustomEvent('wallet_data_updated', {
                detail: { address, balance: walletInfo?.balance || '0' }
            }));

        } catch (error) {
            console.error('❌ Error loading wallet data:', error);
            // In case of error, keep default values
            setBalance('0');
            setTransactions([]);
        }
    };

    // Listener for storage changes
    useEffect(() => {
        const handleStorageUpdate = async (event: CustomEvent) => {
            const { key, value } = event.detail;
            console.log('Storage updated:', key, value);

            // Handle Shannon wallets updates
            if (key === 'shannon_wallet' && value) {
                const walletData = JSON.parse(value);
                if (walletData.parsed?.address) {
                    setState(prev => ({ ...prev, walletAddress: walletData.parsed.address }));
                    setNetworkType('shannon');

                    // ALWAYS RESPECT the isMainnet configuration from storage - NEVER OVERWRITE
                    const savedIsMainnet = storageService.getSync<boolean>('isMainnet');
                    if (savedIsMainnet !== null && savedIsMainnet !== undefined) {
                        setIsMainnet(savedIsMainnet);
                        console.log('Shannon wallet updated - RESPECTING saved isMainnet:', savedIsMainnet);
                    } else {
                        // Only use TESTNET by default if there is NO previous configuration
                        setIsMainnet(false);
                        await storageService.set('isMainnet', false);
                        console.log('Shannon wallet updated - using TESTNET default (NO previous config)');
                    }

                    console.log('Shannon wallet address updated from storage:', walletData.parsed.address);

                    // Navigate to dashboard if we're not already there
                    if (window.location.pathname !== '/wallet') {
                        navigate('/wallet');
                    }
                }
            }

            // Handle Morse wallets updates
            if (key === 'morse_wallet' && value) {
                const walletData = JSON.parse(value);
                if (walletData.parsed?.address) {
                    setState(prev => ({ ...prev, walletAddress: walletData.parsed.address }));
                    setNetworkType('morse');

                    // MORSE ALSO RESPECTS the isMainnet configuration from storage
                    const savedIsMainnet = await storageService.get<boolean>('isMainnet');
                    if (savedIsMainnet !== null && savedIsMainnet !== undefined) {
                        setIsMainnet(savedIsMainnet);
                        console.log('Morse wallet updated - RESPECTING saved isMainnet:', savedIsMainnet);
                    } else {
                        // If there is no previous configuration, use false as default for Morse
                        setIsMainnet(false);
                        await storageService.set('isMainnet', false);
                        console.log('Morse wallet updated - using testnet as default (NO previous config)');
                    }

                    console.log('Morse wallet address updated from storage:', walletData.parsed.address);

                    // Navigate to dashboard
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

    // Check if there is an active wallet when loading
    useEffect(() => {
        const checkStoredWallets = async () => {
            try {
                // FIRST: Load cached network configuration BEFORE initializing walletService
                const cachedIsMainnet = await storageService.get<boolean>('isMainnet');
                const cachedNetworkType = await storageService.get<string>('pokt_network_type') || 'shannon';

                console.log('🚀 APP INIT - Cached network config:', {
                    isMainnet: cachedIsMainnet,
                    networkType: cachedNetworkType
                });

                // Configure initial state based on cache
                if (cachedIsMainnet !== null && cachedIsMainnet !== undefined) {
                    setIsMainnet(cachedIsMainnet);
                    console.log(`📍 Using cached isMainnet: ${cachedIsMainnet}`);
                } else {
                    // If there is no cache, default to testnet
                    setIsMainnet(false);
                    await storageService.set('isMainnet', false);
                    console.log('📍 No cached isMainnet - defaulting to testnet');
                }

                // Initialize walletService AFTER configuring the state
                await walletService.init();

                // Use storageService instead of direct access
                const morseWallet = await storageService.get<StoredWallet>('morse_wallet');
                const shannonWallet = await storageService.get<StoredWallet>('shannon_wallet');

                console.log('Morse wallet from storage:', morseWallet);
                console.log('Shannon wallet from storage:', shannonWallet);

                if (morseWallet || shannonWallet) {
                    const lastWallet = morseWallet && shannonWallet
                        ? morseWallet.timestamp > shannonWallet.timestamp
                            ? morseWallet
                            : shannonWallet
                        : morseWallet || shannonWallet;

                    console.log('Using wallet:', lastWallet);

                    if (lastWallet && lastWallet.parsed?.address) {
                        // USE DIRECTLY the network saved in storage
                        const address = lastWallet.parsed.address;
                        const networkFromStorage = lastWallet.network; // morse or shannon

                        // Configure state directly according to what was saved
                        setState(prev => ({ ...prev, walletAddress: address }));
                        setNetworkType(networkFromStorage);

                        // USE THE CONFIGURATION ALREADY LOADED (don't load it again)
                        const finalIsMainnet = Boolean(cachedIsMainnet === true); // FORCE valid boolean
                        console.log(`📍 Using final config for wallet loading: ${networkFromStorage} ${finalIsMainnet ? 'mainnet' : 'testnet'}`);
                        console.log(`🔍 DEBUG finalIsMainnet type: ${typeof finalIsMainnet}, value: ${finalIsMainnet}`);

                        // Configure walletService with the cached configuration
                        if (networkFromStorage === 'morse') {
                            await walletService.switchNetwork('morse', false);
                        } else {
                            await walletService.switchNetwork('shannon', finalIsMainnet);
                        }

                        // If there is an active wallet, navigate to dashboard unless on an import specific page
                        const currentPath = window.location.pathname;
                        const isImportPage = currentPath.includes('/import/');
                        const isRootPage = currentPath === '/';

                        // Only auto-navigate if we're on the root page and not an explicit navigation to import
                        if (isRootPage && !isImportPage) {
                            console.log('Auto-navigating to wallet dashboard from root page');
                            navigate('/wallet');
                        }

                        // Load data automatically for active wallets
                        if (lastWallet && lastWallet.parsed?.address) {
                            console.log('📊 Loading data for stored wallet:', lastWallet.parsed.address);
                            // Small delay to allow configuration to complete
                            setTimeout(() => {
                                loadWalletData(lastWallet.parsed.address);
                            }, 500);
                        }
                    }
                }
            } catch (error) {
                console.error('Error loading wallets:', error);
            }
        };

        checkStoredWallets();
    }, [navigate]);

    const handleWalletImport = async (code: string, password: string, network?: NetworkType, fromStorage = false) => {
        try {
            console.log('🚀 handleWalletImport START:', {
                codePreview: code.substring(0, 50) + '...',
                network,
                fromStorage
            });

            if (!walletService.getWalletManager()) {
                await walletService.init();
            }

            // Use the new method that automatically detects the network
            const walletInfo = await walletService.importWallet(code, password, network);
            console.log('✅ Wallet imported successfully:', walletInfo);

            // Only save to storage if NOT coming from storage (avoid loops)
            if (!fromStorage) {
                const storageData = {
                    serialized: code,
                    network: walletInfo.network,
                    timestamp: Date.now(),
                    parsed: { address: walletInfo.address }
                };
                console.log('💾 Saving to storage:', `${walletInfo.network}_wallet`, storageData);
                await storageService.set(`${walletInfo.network}_wallet`, storageData);
            }

            console.log('🔄 Updating app state with:', {
                address: walletInfo.address,
                network: walletInfo.network
            });

            setState(prev => ({ ...prev, walletAddress: walletInfo.address }));
            setNetworkType(walletInfo.network);

            // Keep the storage isMainnet configuration if it exists
            if (fromStorage) {
                // Load isMainnet from storage if coming from storage
                const savedIsMainnet = await storageService.get<boolean>('isMainnet');
                if (savedIsMainnet !== null && savedIsMainnet !== undefined) {
                    setIsMainnet(savedIsMainnet);
                    console.log(`💾 Using saved isMainnet from storage: ${savedIsMainnet}`);
                } else {
                    setIsMainnet(walletInfo.isMainnet);
                    await storageService.set('isMainnet', walletInfo.isMainnet);
                    console.log(`🔧 Set isMainnet from walletInfo: ${walletInfo.isMainnet}`);
                }
            } else {
                // New import - use the detected value and save it
                setIsMainnet(walletInfo.isMainnet);
                await storageService.set('isMainnet', walletInfo.isMainnet);
                console.log(`🆕 New import - set isMainnet: ${walletInfo.isMainnet}`);
            }

            console.log('🧭 Navigating to /wallet...');
            navigate('/wallet');
            console.log('✅ handleWalletImport COMPLETED successfully');

            return { address: walletInfo.address, network: walletInfo.network };
        } catch (error) {
            console.error('❌ Error importing wallet:', error);
            throw error;
        }
    };

    const handleCreateWallet = async (password: string, network?: NetworkType) => {
        try {
            if (!walletService.getWalletManager()) {
                await walletService.init();
            }

            // Use the walletService createWallet method
            const walletInfo = await walletService.createWallet(password, network || 'shannon', false);

            // Save to storage with the detected configuration
            await storageService.set(`${walletInfo.network}_wallet`, {
                serialized: '', // The created wallet does not have a mnemonic to save
                network: walletInfo.network,
                timestamp: Date.now(),
                parsed: { address: walletInfo.address }
            });

            setState(prev => ({ ...prev, walletAddress: walletInfo.address }));
            setNetworkType(walletInfo.network);

            // For new wallet created, use the detected value and save it
            setIsMainnet(walletInfo.isMainnet);
            await storageService.set('isMainnet', walletInfo.isMainnet);
            console.log(`💾 New wallet created - saving isMainnet: ${walletInfo.isMainnet}`);

            navigate('/wallet');

            return { address: walletInfo.address, network: walletInfo.network };
        } catch (error) {
            console.error('Error creating wallet:', error);
            throw error;
        }
    };

    const handleLogout = async () => {
        try {
            console.log('🚪 Starting complete logout...');

            // 1. Clear the wallet service
            walletService.logout();

            // 2. Clear local states
            setState({ walletAddress: null, showTransactions: false });
            setBalance('0');
            setTransactions([]);
            setNetworkType('shannon');
            setIsMainnet(false);
            setNetworkError(null);

            // 3. CLEAR COMPLETELY ALL THE STORAGE related to wallets
            await storageService.remove('isMainnet');
            await storageService.remove('shannon_wallet');
            await storageService.remove('morse_wallet');
            await storageService.remove('walletAddress');
            await storageService.remove('walletData');
            await storageService.remove('pokt_network_type');
            await storageService.remove('pokt_network');

            // 4. Clear any other residual data
            const keys = await storageService.keys();
            for (const key of keys) {
                if (key.includes('wallet') || key.includes('address') || key.includes('network')) {
                    await storageService.remove(key);
                    console.log(`🧹 Removed storage key: ${key}`);
                }
            }

            console.log('✅ Complete logout finished - all wallet data cleared');

            // 5. Navigate to the main page
            navigate('/');
        } catch (error) {
            console.error('❌ Error during logout:', error);
            // Ensure navigation even if there are errors
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

                        console.log(`🔄 DIRECT wallet change to: ${address} (${network}) - Mainnet: ${isMainnetSelected}`);

                        // Immediate state update - without waiting
                        setState(prev => ({ ...prev, walletAddress: address }));
                        setNetworkType(network);

                        // USE DIRECTLY what the user selects - WITHOUT DETECTION
                        if (isMainnetSelected !== undefined) {
                            setIsMainnet(isMainnetSelected);
                            // Save manual selection to storage
                            await storageService.set('isMainnet', isMainnetSelected);
                            console.log(`🎯 MANUAL mainnet selection: ${isMainnetSelected} - SAVED TO STORAGE`);
                        } else {
                            // Only for Shannon when not specified, use TESTNET by default
                            if (network === 'shannon') {
                                setIsMainnet(false);
                                await storageService.set('isMainnet', false);
                                console.log(`📍 Shannon TESTNET default (NO manual selection)`);
                            } else {
                                // Morse always testnet
                                setIsMainnet(false);
                                await storageService.set('isMainnet', false);
                                console.log(`🟡 MORSE always testnet - SAVED TO STORAGE`);
                            }
                        }

                        // Update walletManager with the new configuration
                        await walletService.switchNetwork(network, isMainnetSelected === true);

                        // Important: Load data for the new selected wallet
                        console.log('🔄 Loading wallet data for new selected wallet:', address);
                        await loadWalletData(address);

                        // Save selected address to localStorage
                        await storageService.set('walletAddress', address);

                        // Navigate to dashboard if we're not already there
                        if (window.location.pathname !== '/wallet') {
                            navigate('/wallet');
                        }
                    } catch (error) {
                        console.error('Error changing wallet:', error);
                        setNetworkError(error instanceof Error ? error.message : 'Error changing wallet');
                    }
                }}
                onNetworkChange={async (network: NetworkType) => {
                    try {
                        setNetworkError(null);

                        console.log(`🔄 DIRECT network change to: ${network}`);

                        // Quick check of wallet
                        const storedWallet = await storageService.get<StoredWallet>(`${network}_wallet`);
                        if (!storedWallet || !storedWallet.parsed?.address) {
                            setNetworkError(`No wallet found for ${network} network`);
                            return;
                        }

                        // Immediate state update - USE THE SELECTED RED DIRECTLY
                        const address = storedWallet.parsed.address;
                        setState(prev => ({ ...prev, walletAddress: address }));
                        setNetworkType(network);

                        // KEEP THE CURRENT MAINNET/TESTNET CONFIGURATION - NO OVERWRITE
                        if (network === 'morse') {
                            setIsMainnet(false); // Morse always testnet
                            await storageService.set('isMainnet', false);
                            console.log(`🟡 MORSE network selected - always testnet`);
                        } else {
                            // For Shannon: KEEP THE CURRENT USER PREFERENCE
                            const currentIsMainnet = await storageService.get<boolean>('isMainnet');
                            if (currentIsMainnet !== null && currentIsMainnet !== undefined) {
                                setIsMainnet(currentIsMainnet);
                                console.log(`🔵 SHANNON network selected - MAINTAINING user preference: ${currentIsMainnet === true ? 'mainnet' : 'testnet'}`);
                            } else {
                                // Only if there is no previous configuration, use TESTNET by default
                                setIsMainnet(false);
                                await storageService.set('isMainnet', false);
                                console.log(`🔵 SHANNON network selected - using TESTNET default (NO previous config)`);
                            }
                        }

                        // Direct network configuration
                        // LOAD THE REAL VALUE of isMainnet from storage to avoid desynchronization
                        const currentStoredIsMainnet = await storageService.get<boolean>('isMainnet');
                        const realIsMainnet = currentStoredIsMainnet !== null ? currentStoredIsMainnet : false;
                        const finalIsMainnet = network === 'morse' ? false : realIsMainnet;
                        console.log(`🔍 DEBUG NETWORK SWITCH - network: ${network}, state.isMainnet: ${isMainnet}, storage.isMainnet: ${currentStoredIsMainnet}, finalIsMainnet: ${finalIsMainnet}`);
                        if (network === 'morse') {
                            await walletService.switchNetwork('morse', false);
                        } else {
                            await walletService.switchNetwork('shannon', finalIsMainnet);
                        }

                        // Clear data
                        setTransactions([]);

                        // No reset immediately to 0, keep previous balance while loading
                        setTransactions([]);

                        // Load data automatically
                        await loadWalletData(address);

                        console.log(`✅ DIRECT network change completed: ${network} with wallet ${address}`);
                    } catch (error) {
                        console.error('Error changing network:', error);
                        setNetworkError(error instanceof Error ? error.message : 'Error changing network');
                    }
                }}
                onMainnetChange={async (isMainnetSelected: boolean) => {
                    try {
                        console.log(`🎯 MANUAL mainnet change: ${isMainnetSelected}`);

                        // Update state immediately
                        setIsMainnet(isMainnetSelected);

                        // Save to storage for manual selection persistence
                        await storageService.set('isMainnet', isMainnetSelected);
                        console.log(`💾 Mainnet preference saved to storage: ${isMainnetSelected}`);

                        // Reconfigure the network with the new configuration
                        if (networkType !== 'morse') {
                            await walletService.switchNetwork(networkType, isMainnetSelected);
                        }

                        // Clear balance and transactions to force reload
                        setTransactions([]);

                        // Load data automatically if there is an active wallet
                        if (state.walletAddress) {
                            await loadWalletData(state.walletAddress);
                        }

                        console.log(`✅ Mainnet configuration changed to: ${isMainnetSelected === true ? 'MAINNET' : 'TESTNET'}`);
                    } catch (error) {
                        console.error('Error changing mainnet configuration:', error);
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

                                            // Verify if there is a wallet for this red
                                            const storedWallet = await storageService.get<StoredWallet>(`${network}_wallet`);
                                            if (!storedWallet || !storedWallet.parsed?.address) {
                                                setNetworkError(`No wallet found for ${network} network`);
                                                return;
                                            }

                                            // USE DIRECTLY the red selected - WITHOUT DETECTION
                                            console.log(`🔄 WalletDashboard: Direct change to ${network} network`);

                                            // Configure state directly
                                            const address = storedWallet.parsed.address;
                                            setState(prev => ({ ...prev, walletAddress: address }));
                                            setNetworkType(network);

                                            // KEEP THE CURRENT MAINNET/TESTNET CONFIGURATION - NO OVERWRITE
                                            if (network === 'morse') {
                                                setIsMainnet(false); // Morse always testnet
                                                await storageService.set('isMainnet', false);
                                            } else {
                                                // For Shannon: KEEP THE CURRENT USER PREFERENCE
                                                const currentIsMainnet = await storageService.get<boolean>('isMainnet');
                                                if (currentIsMainnet !== null && currentIsMainnet !== undefined) {
                                                    setIsMainnet(currentIsMainnet);
                                                    console.log(`🔵 WalletDashboard: MAINTAINING user preference: ${currentIsMainnet === true ? 'mainnet' : 'testnet'}`);
                                                } else {
                                                    // Only if there is no previous configuration, use TESTNET by default
                                                    setIsMainnet(false);
                                                    await storageService.set('isMainnet', false);
                                                    console.log(`🔵 WalletDashboard: using TESTNET default (NO previous config)`);
                                                }
                                            }

                                            // Clear data
                                            setTransactions([]);

                                            // No reset immediately to 0, keep previous balance while loading
                                            setTransactions([]);

                                            // Load data automatically
                                            await loadWalletData(address);

                                            console.log(`✅ WalletDashboard: Direct network change to ${network} completed`);
                                        } catch (error) {
                                            console.error('Error changing network:', error);
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