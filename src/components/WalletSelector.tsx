import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { storageService } from '../controller/storage.service';
import { StoredWallet } from '../types';
import { NetworkType } from '../controller/WalletManager';

interface WalletSelectorProps {
    currentAddress: string | null;
    currentNetwork: NetworkType;
    isMainnet?: boolean;
    onWalletChange: (address: string, network: NetworkType, isMainnet?: boolean) => void;
    onNetworkChange: (network: NetworkType) => void;
    onMainnetChange?: (isMainnet: boolean) => void;
    onImportNew: () => void;
}

const WalletSelector: React.FC<WalletSelectorProps> = ({
    currentAddress,
    currentNetwork,
    isMainnet,
    onWalletChange,
    onNetworkChange,
    onMainnetChange,
    onImportNew
}) => {
    const [availableWallets, setAvailableWallets] = useState<{
        shannon: StoredWallet[],
        morse: StoredWallet[]
    }>({ shannon: [], morse: [] });
    const [isOpen, setIsOpen] = useState(false);
    const [selectedMainnet, setSelectedMainnet] = useState<boolean>(isMainnet === true || false);

    // SOLO CARGAR DESDE STORAGE AL INICIO, UNA VEZ
    useEffect(() => {
        const loadInitialData = async () => {
            // Cargar wallets
            await loadAvailableWallets();

            // Cargar isMainnet SOLO si no viene del padre
            if (isMainnet === undefined) {
                const savedIsMainnet = await storageService.get<boolean>('isMainnet');
                if (savedIsMainnet !== null && savedIsMainnet !== undefined) {
                    console.log('🎯 WalletSelector: INITIAL load from storage:', savedIsMainnet === true ? 'mainnet' : 'testnet');
                    setSelectedMainnet(savedIsMainnet === true);
                } else {
                    console.log('🎯 WalletSelector: NO storage value, using false as default');
                    setSelectedMainnet(false);
                }
            } else {
                console.log('🎯 WalletSelector: INITIAL using parent value:', isMainnet === true ? 'mainnet' : 'testnet');
                setSelectedMainnet(isMainnet === true);
            }
        };

        loadInitialData();

        // Listener para actualizaciones de storage (solo wallets, no isMainnet)
        const handleStorageUpdate = () => {
            console.log('WalletSelector: Storage actualizado, recargando wallets');
            loadAvailableWallets();
        };

        window.addEventListener('storage_updated', handleStorageUpdate);

        return () => {
            window.removeEventListener('storage_updated', handleStorageUpdate);
        };
    }, []); // SIN DEPENDENCIAS para que solo se ejecute una vez

    // SINCRONIZAR CON EL PADRE SOLO CUANDO CAMBIE
    useEffect(() => {
        if (isMainnet !== undefined) {
            console.log('🎯 WalletSelector: Parent isMainnet changed, syncing:', isMainnet === true ? 'mainnet' : 'testnet');
            setSelectedMainnet(isMainnet === true);
        }
    }, [isMainnet]);

    const loadAvailableWallets = async () => {
        try {
            const shannonWallet = await storageService.get<StoredWallet>('shannon_wallet');
            const morseWallet = await storageService.get<StoredWallet>('morse_wallet');

            const shannon = shannonWallet ? [shannonWallet] : [];
            const morse = morseWallet ? [morseWallet] : [];

            setAvailableWallets({ shannon, morse });
        } catch (error) {
            console.error('Error loading wallets:', error);
        }
    };

    const handleWalletSelect = (wallet: StoredWallet) => {
        if (wallet.parsed?.address) {
            console.log(`🎯 Wallet selected: ${wallet.parsed.address} - Network: ${wallet.network} - Mainnet: ${selectedMainnet === true ? 'mainnet' : 'testnet'}`);

            // Pasar tanto la dirección como la configuración de red seleccionada
            onWalletChange(wallet.parsed.address, wallet.network as NetworkType, selectedMainnet);

            // Aquí podríamos agregar lógica adicional para forzar la configuración de mainnet/testnet
            // basada en el select si es necesario

            setIsOpen(false);
        }
    };

    const truncateAddress = (address: string) => {
        return `${address.slice(0, 8)}...${address.slice(-6)}`;
    };

    // Determinar qué redes están disponibles
    const hasShannon = availableWallets.shannon.length > 0;
    const hasMorse = availableWallets.morse.length > 0;
    const availableNetworks = [];
    if (hasShannon) availableNetworks.push('shannon');
    if (hasMorse) availableNetworks.push('morse');

    return (
        <div className="relative z-50">
            <motion.button
                className="flex items-center space-x-2 bg-gradient-to-r from-gray-800/90 to-gray-900/90 backdrop-blur-sm hover:from-gray-700/90 hover:to-gray-800/90 px-4 py-2.5 rounded-xl border border-indigo-500/30 shadow-md shadow-indigo-500/10 transition-all duration-300"
                onClick={() => setIsOpen(!isOpen)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
            >
                <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${currentNetwork === 'shannon'
                        ? 'bg-gradient-to-r from-blue-400 to-blue-500 shadow-sm shadow-blue-400/50'
                        : 'bg-gradient-to-r from-yellow-400 to-amber-500 shadow-sm shadow-yellow-400/50'
                        }`} />
                    <span className={`text-sm font-medium ${currentNetwork === 'shannon'
                        ? 'bg-gradient-to-r from-blue-300 to-blue-100 bg-clip-text text-transparent'
                        : 'bg-gradient-to-r from-yellow-300 to-amber-200 bg-clip-text text-transparent'
                        }`}>
                        {currentNetwork.toUpperCase()}
                    </span>
                    {currentAddress && (
                        <span className="text-xs text-gray-300 font-mono">
                            {truncateAddress(currentAddress)}
                        </span>
                    )}
                </div>
                <svg
                    className={`w-4 h-4 transition-transform text-gray-300 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </motion.button>

            {isOpen && (
                <motion.div
                    className="fixed w-80 top-auto right-auto mt-2 bg-gradient-to-b from-gray-800/95 to-gray-900/95 backdrop-blur-md border border-indigo-500/30 rounded-xl shadow-xl overflow-hidden"
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        zIndex: 100
                    }}
                >
                    <div className="p-5">
                        <h3 className="text-lg font-semibold mb-4 bg-gradient-to-r from-blue-300 to-purple-300 bg-clip-text text-transparent">Select Wallet</h3>

                        {/* Network Selector - Solo mostrar si hay más de una red disponible */}
                        {availableNetworks.length > 1 && (
                            <div className="mb-5">
                                <label className="block text-sm font-medium mb-2 text-gray-300">Network:</label>
                                <div className="flex space-x-2">
                                    {hasShannon && (
                                        <button
                                            className={`flex-1 px-3 py-2 rounded-lg text-sm transition-all duration-300 ${currentNetwork === 'shannon'
                                                ? 'bg-gradient-to-r from-blue-600/70 to-blue-700/70 text-white shadow-md shadow-blue-600/20'
                                                : 'bg-gray-700/70 text-gray-300 hover:bg-gray-600/70'
                                                }`}
                                            onClick={() => onNetworkChange('shannon')}
                                        >
                                            <div className="flex items-center justify-center space-x-1.5">
                                                <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                                                <span>Shannon</span>
                                            </div>
                                        </button>
                                    )}
                                    {hasMorse && (
                                        <button
                                            className={`flex-1 px-3 py-2 rounded-lg text-sm transition-all duration-300 ${currentNetwork === 'morse'
                                                ? 'bg-gradient-to-r from-yellow-600/70 to-amber-700/70 text-white shadow-md shadow-yellow-600/20'
                                                : 'bg-gray-700/70 text-gray-300 hover:bg-gray-600/70'
                                                }`}
                                            onClick={() => onNetworkChange('morse')}
                                        >
                                            <div className="flex items-center justify-center space-x-1.5">
                                                <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                                                <span>Morse</span>
                                            </div>
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* 🔥 SELECT PARA MAINNET/TESTNET - OCULTAR EN MORSE */}
                        {currentNetwork === 'shannon' && (
                            <div className="mb-5">
                                <label className="block text-sm font-medium mb-2 text-yellow-300">
                                    <i className="fas fa-exclamation-triangle mr-1.5"></i>
                                    Select Environment:
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                    <select
                                        value={selectedMainnet === true ? 'mainnet' : 'testnet'}
                                        onChange={(e) => {
                                            const newIsMainnet = e.target.value === 'mainnet';
                                            setSelectedMainnet(newIsMainnet);

                                            // GUARDAR INMEDIATAMENTE EN STORAGE cuando el usuario cambie
                                            storageService.set('isMainnet', newIsMainnet).then(() => {
                                                console.log('🎯 WalletSelector: Mainnet preference saved to storage:', newIsMainnet === true ? 'mainnet' : 'testnet');
                                            });

                                            // Notificar el cambio al componente padre si existe el callback
                                            if (onMainnetChange) {
                                                onMainnetChange(newIsMainnet);
                                            }
                                        }}
                                        className="block w-full pl-4 pr-10 py-2.5 bg-gray-700/80 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none shadow-inner transition-all duration-300"
                                    >
                                        <option value="testnet" className="bg-gray-700">🧪 TESTNET (Recommended)</option>
                                        <option value="mainnet" className="bg-gray-700">🚀 MAINNET (Real Money)</option>
                                    </select>
                                </div>
                                <p className={`text-xs mt-2 ${selectedMainnet === true ? 'text-red-300' : 'text-green-300'}`}>
                                    {selectedMainnet === true
                                        ? '⚠️ Mainnet uses real POKT tokens'
                                        : '✅ Testnet is safe for testing'}
                                </p>
                            </div>
                        )}

                        {/* Available Wallets */}
                        <div className="space-y-3">
                            <label className="block text-sm font-medium text-gray-300">Available Wallets:</label>

                            {/* Shannon Wallets */}
                            {hasShannon && (
                                <div className="space-y-1.5">
                                    <p className="text-xs font-medium text-blue-400 ml-1">Shannon:</p>
                                    {availableWallets.shannon.map((wallet, index) => (
                                        <button
                                            key={`shannon-${index}`}
                                            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all duration-300 ${wallet.parsed?.address === currentAddress && currentNetwork === 'shannon'
                                                ? 'bg-gradient-to-r from-blue-600/60 to-blue-700/60 text-white shadow-sm'
                                                : 'bg-gray-800/60 hover:bg-gray-700/60 text-gray-300'
                                                }`}
                                            onClick={() => handleWalletSelect(wallet)}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="font-mono">{wallet.parsed?.address ? truncateAddress(wallet.parsed.address) : 'Invalid Address'}</span>
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/50 text-blue-300 border border-blue-800/50">Shannon</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Morse Wallets */}
                            {hasMorse && (
                                <div className="space-y-1.5">
                                    <p className="text-xs font-medium text-yellow-400 ml-1">Morse:</p>
                                    {availableWallets.morse.map((wallet, index) => (
                                        <button
                                            key={`morse-${index}`}
                                            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all duration-300 ${wallet.parsed?.address === currentAddress && currentNetwork === 'morse'
                                                ? 'bg-gradient-to-r from-yellow-600/60 to-amber-700/60 text-white shadow-sm'
                                                : 'bg-gray-800/60 hover:bg-gray-700/60 text-gray-300'
                                                }`}
                                            onClick={() => handleWalletSelect(wallet)}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="font-mono">{wallet.parsed?.address ? truncateAddress(wallet.parsed.address) : 'Invalid Address'}</span>
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/50 text-yellow-300 border border-yellow-800/50">Morse</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Import New Wallet Button */}
                            <div className="pt-3 mt-3 border-t border-gray-700/70">
                                <button
                                    className="w-full px-3 py-2.5 rounded-lg text-sm bg-gradient-to-r from-indigo-600/60 to-purple-600/60 hover:from-indigo-500/60 hover:to-purple-500/60 text-white transition-all duration-300 flex items-center justify-center space-x-2"
                                    onClick={() => {
                                        setIsOpen(false);
                                        onImportNew();
                                    }}
                                >
                                    <i className="fas fa-plus-circle"></i>
                                    <span>Import New Wallet</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    );
};

export default WalletSelector; 