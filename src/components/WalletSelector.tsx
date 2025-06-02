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
        <div className="relative">
            <motion.button
                className="flex items-center space-x-2 bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg border border-gray-600"
                onClick={() => setIsOpen(!isOpen)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
            >
                <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${currentNetwork === 'shannon' ? 'bg-blue-500' : 'bg-purple-500'}`} />
                    <span className="text-sm font-medium">
                        {currentNetwork.toUpperCase()}
                    </span>
                    {currentAddress && (
                        <span className="text-xs text-gray-400">
                            {truncateAddress(currentAddress)}
                        </span>
                    )}
                </div>
                <svg
                    className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </motion.button>

            {isOpen && (
                <motion.div
                    className="absolute top-full left-0 mt-2 w-80 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                >
                    <div className="p-4">
                        <h3 className="text-lg font-semibold mb-3">Select Wallet</h3>

                        {/* Network Selector - Solo mostrar si hay más de una red disponible */}
                        {availableNetworks.length > 1 && (
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-2">Network:</label>
                                <div className="flex space-x-2">
                                    {hasShannon && (
                                        <button
                                            className={`flex-1 px-3 py-2 rounded-md text-sm ${currentNetwork === 'shannon'
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                }`}
                                            onClick={() => onNetworkChange('shannon')}
                                        >
                                            Shannon
                                        </button>
                                    )}
                                    {hasMorse && (
                                        <button
                                            className={`flex-1 px-3 py-2 rounded-md text-sm ${currentNetwork === 'morse'
                                                ? 'bg-purple-600 text-white'
                                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                }`}
                                            onClick={() => onNetworkChange('morse')}
                                        >
                                            Morse
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* 🔥 SELECT PARA MAINNET/TESTNET - JUSTO ACÁ MAMAGUEVO! */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-2 text-yellow-400">⚡ Select Environment:</label>
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
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="testnet" className="bg-gray-700">🧪 TESTNET (Recommended)</option>
                                <option value="mainnet" className="bg-gray-700">🚀 MAINNET (Real Money)</option>
                            </select>
                            <p className="text-xs text-gray-400 mt-1">
                                {selectedMainnet === true ? '⚠️ Mainnet uses real POKT tokens' : '✅ Testnet is safe for testing'}
                            </p>
                        </div>

                        {/* Available Wallets */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium">Available Wallets:</label>

                            {/* Shannon Wallets */}
                            {hasShannon && (
                                <div>
                                    <p className="text-xs text-blue-400 mb-1">Shannon:</p>
                                    {availableWallets.shannon.map((wallet, index) => (
                                        <button
                                            key={`shannon-${index}`}
                                            className={`w-full text-left px-3 py-2 rounded-md text-sm mb-1 ${wallet.parsed?.address === currentAddress && currentNetwork === 'shannon'
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                                }`}
                                            onClick={() => handleWalletSelect(wallet)}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span>{wallet.parsed?.address ? truncateAddress(wallet.parsed.address) : 'Invalid Address'}</span>
                                                <span className="text-xs text-blue-400">Shannon</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Morse Wallets */}
                            {hasMorse && (
                                <div>
                                    <p className="text-xs text-purple-400 mb-1">Morse:</p>
                                    {availableWallets.morse.map((wallet, index) => (
                                        <button
                                            key={`morse-${index}`}
                                            className={`w-full text-left px-3 py-2 rounded-md text-sm mb-1 ${wallet.parsed?.address === currentAddress && currentNetwork === 'morse'
                                                ? 'bg-purple-600 text-white'
                                                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                                }`}
                                            onClick={() => handleWalletSelect(wallet)}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span>{wallet.parsed?.address ? truncateAddress(wallet.parsed.address) : 'Invalid Address'}</span>
                                                <span className="text-xs text-purple-400">Morse</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {!hasShannon && !hasMorse && (
                                <p className="text-gray-400 text-sm py-2">No saved wallets</p>
                            )}
                        </div>

                        {/* Import New Wallet Button */}
                        <div className="mt-4 pt-3 border-t border-gray-600">
                            <button
                                className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium"
                                onClick={() => {
                                    onImportNew();
                                    setIsOpen(false);
                                }}
                            >
                                + Import New Wallet
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    );
};

export default WalletSelector; 