import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { storageService } from '../controller/storage.service';
import { StoredWallet } from '../types';
import { NetworkType } from '../controller/WalletManager';
import { walletService } from '../controller/WalletService';

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
    const [selectedMainnet, setSelectedMainnet] = useState<boolean>(true);
    const [hasShannon, setHasShannon] = useState(false);
    const [hasMorse, setHasMorse] = useState(false);
    const [showPrivateKey, setShowPrivateKey] = useState<string | null>(null);
    const [privateKeyData, setPrivateKeyData] = useState<string | null>(null);

    // SOLO CARGAR DESDE STORAGE AL INICIO, UNA VEZ
    useEffect(() => {
        const loadInitialData = async () => {
            // Cargar wallets
            await loadAvailableWallets();
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

    const loadAvailableWallets = async () => {
        // Usar el nuevo método del walletService para obtener todas las wallets
        try {
            const allWallets = await walletService.getAllWallets();
            setAvailableWallets(allWallets);
            setHasShannon(allWallets.shannon.length > 0);
            setHasMorse(allWallets.morse.length > 0);
        } catch (error) {
            console.error('Error cargando wallets:', error);
            // Fallback al método anterior si falla

            // --- SHANNON wallets ---
            const shannonArr = (await storageService.get<any[]>('shannon_wallets')) || [];
            const rawShannonWallets = Array.isArray(shannonArr) ? shannonArr : [];

            // Add legacy single shannon_wallet
            const legacyShannon = await storageService.get<any>('shannon_wallet');
            if (legacyShannon && !rawShannonWallets.some(w => w.id === 'shannon_legacy')) {
                rawShannonWallets.push({ ...legacyShannon, id: 'shannon_legacy' });
            }

            // Deduplicate by parsed.address (first occurrence wins)
            const shannonSeen = new Set<string>();
            const shannonWallets = rawShannonWallets.filter((w: any) => {
                const addr: string | undefined = w.parsed?.address;
                if (addr) {
                    if (shannonSeen.has(addr)) return false;
                    shannonSeen.add(addr);
                }
                return true;
            });

            // --- MORSE wallets ---
            const morseArr = (await storageService.get<any[]>('morse_wallets')) || [];
            const rawMorseWallets = Array.isArray(morseArr) ? morseArr : [];

            // Add legacy single morse_wallet (NOT morse_wallets)
            const legacyMorse = await storageService.get<any>('morse_wallet');
            if (legacyMorse && !rawMorseWallets.some(w => w.id === 'morse_legacy')) {
                rawMorseWallets.push({ ...legacyMorse, id: 'morse_legacy' });
            }

            // Deduplicate by parsed.addr or parsed.address
            const morseSeen = new Set<string>();
            const morseWallets = rawMorseWallets.filter((w: any) => {
                const addr: string | undefined = w.parsed?.addr || w.parsed?.address;
                if (addr) {
                    if (morseSeen.has(addr)) return false;
                    morseSeen.add(addr);
                }
                return true;
            });

            setAvailableWallets({ shannon: shannonWallets, morse: morseWallets });
            setHasShannon(shannonWallets.length > 0);
            setHasMorse(morseWallets.length > 0);
        }
    };

    // Helper to safely obtain an address from StoredWallet (supports Morse addr field)
    const getWalletAddress = (wallet: StoredWallet): string | undefined => {
        return wallet.parsed?.address || wallet.parsed?.addr;
    };

    const handleWalletSelect = (wallet: StoredWallet) => {
        const addr = getWalletAddress(wallet);
        if (addr) {
            console.log(`🎯 Wallet selected: ${addr} - Network: ${wallet.network} - Mainnet: ${selectedMainnet === true ? 'mainnet' : 'testnet'}`);

            // Pass both the address and the selected network/mainnet flag
            onWalletChange(addr, (wallet.network || currentNetwork) as NetworkType, selectedMainnet);

            setIsOpen(false);
        }
    };

    const truncateAddress = (address: string) => {
        return `${address.slice(0, 8)}...${address.slice(-6)}`;
    };

    // Función para mostrar la clave privada de la wallet seleccionada
    const handleShowPrivateKey = async (address: string, network: NetworkType) => {
        try {
            setPrivateKeyData(null); // Resetear datos anteriores
            setShowPrivateKey(address); // Mostrar el modal

            let privateKey: string | null = null;

            if (network === 'morse') {
                // Obtener clave privada de Morse
                privateKey = await walletService.getMorsePrivateKey();
                console.log('🔑 Obtenida clave privada de Morse');
            } else {
                // Obtener clave privada de Shannon
                privateKey = await walletService.getShannonPrivateKey();
                console.log('🔑 Obtenida clave privada de Shannon');
            }

            if (privateKey) {
                // Verificar si es un mnemónico (12 o 24 palabras separadas por espacios)
                const words = privateKey.trim().split(/\s+/);
                if (words.length === 12 || words.length === 24) {
                    // Es un mnemónico, mostrarlo directamente
                    setPrivateKeyData(privateKey);
                }
                // Verificar si es un objeto JSON
                else if (privateKey.startsWith('{') && privateKey.endsWith('}')) {
                    try {
                        const jsonObj = JSON.parse(privateKey);

                        // Si el objeto tiene un campo mnemonic o serialized que es un mnemónico, mostrar ese valor
                        if (jsonObj.mnemonic && typeof jsonObj.mnemonic === 'string') {
                            setPrivateKeyData(jsonObj.mnemonic);
                        }
                        // Si no hay mnemonic pero hay serialized y parece un mnemónico
                        else if (jsonObj.serialized && typeof jsonObj.serialized === 'string') {
                            const serializedWords = jsonObj.serialized.trim().split(/\s+/);
                            if (serializedWords.length === 12 || serializedWords.length === 24) {
                                setPrivateKeyData(jsonObj.serialized);
                            } else {
                                // Si no es un mnemónico, mostrar el objeto completo formateado
                                setPrivateKeyData(JSON.stringify(jsonObj, null, 2));
                            }
                        }
                        // Si no hay campos específicos reconocibles, mostrar el objeto completo
                        else {
                            setPrivateKeyData(JSON.stringify(jsonObj, null, 2));
                        }
                    } catch {
                        // Si no se puede parsear como JSON, mostrar como texto plano
                        setPrivateKeyData(privateKey);
                    }
                } else {
                    // Cualquier otro formato (clave hexadecimal, etc.)
                    setPrivateKeyData(privateKey);
                }
            } else {
                setPrivateKeyData('Could not retrieve private key. The wallet might be in serialized or mnemonic format.');
            }
        } catch (error) {
            console.error('Error retrieving private key:', error);
            setPrivateKeyData('Error retrieving private key: ' + (error instanceof Error ? error.message : String(error)));
        }
    };

    useEffect(() => {
        const isMainnet = storageService.getSync<boolean>('isMainnet') as boolean;
        setSelectedMainnet(isMainnet);
    }, []);

    // Determinar qué redes están disponibles
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
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute right-0 mt-2 w-72 bg-gray-900/95 backdrop-blur-md rounded-xl shadow-lg shadow-black/50 border border-gray-700/50 overflow-hidden z-50"
                >
                    <div className="p-4">
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
                                        value={selectedMainnet ? 'mainnet' : 'testnet'}
                                        onChange={(e) => {
                                            const newIsMainnet = e.target.value === 'mainnet';
                                            setSelectedMainnet(newIsMainnet);
                                            storageService.set('isMainnet', newIsMainnet)
                                            // Notificar el cambio al componente padre si existe el callback
                                            if (onMainnetChange) {
                                                onMainnetChange(newIsMainnet);
                                            }
                                        }}
                                        className="block w-full pl-4 pr-10 py-2.5 bg-gray-700/80 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none shadow-inner transition-all duration-300"
                                    >
                                        <option value="mainnet" className="bg-gray-700">🚀 MAINNET</option>
                                        <option value="testnet" className="bg-gray-700">🧪 TESTNET</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        <div className="space-y-4">
                            {/* Shannon Wallets */}
                            {hasShannon && (
                                <div className="space-y-1.5">
                                    <p className="text-xs font-medium text-blue-400 ml-1">Shannon:</p>
                                    {availableWallets.shannon.map((wallet, index) => {
                                        const walletAddress = getWalletAddress(wallet);
                                        const isSelected = walletAddress === currentAddress && currentNetwork === 'shannon';

                                        return (
                                            <div
                                                key={`shannon-${index}`}
                                                className={`w-full rounded-lg transition-all duration-300 ${isSelected
                                                    ? 'border-2 border-blue-500 bg-blue-900/20'
                                                    : 'border border-gray-700/50'
                                                    }`}
                                            >
                                                <button
                                                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all duration-300 ${isSelected
                                                        ? 'bg-gradient-to-r from-blue-600/60 to-blue-700/60 text-white shadow-sm'
                                                        : 'bg-gray-800/60 hover:bg-gray-700/60 text-gray-300'
                                                        }`}
                                                    onClick={() => handleWalletSelect(wallet)}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-mono">{walletAddress ? truncateAddress(walletAddress) : 'Invalid Address'}</span>
                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/50 text-blue-300 border border-blue-800/50">Shannon</span>
                                                    </div>
                                                </button>

                                                {isSelected && (
                                                    <div className="px-3 py-1.5 flex justify-end">
                                                        <button
                                                            onClick={() => walletAddress && handleShowPrivateKey(walletAddress, 'shannon')}
                                                            className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 transition-colors"
                                                            title="View private key"
                                                        >
                                                            <i className="fas fa-key mr-1"></i> View Private Key
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Morse Wallets */}
                            {hasMorse && (
                                <div className="space-y-1.5">
                                    <p className="text-xs font-medium text-yellow-400 ml-1">Morse:</p>
                                    {availableWallets.morse.map((wallet, index) => {
                                        const walletAddress = getWalletAddress(wallet);
                                        const isSelected = walletAddress === currentAddress && currentNetwork === 'morse';

                                        return (
                                            <div
                                                key={`morse-${index}`}
                                                className={`w-full rounded-lg transition-all duration-300 ${isSelected
                                                    ? 'border-2 border-yellow-500 bg-yellow-900/20'
                                                    : 'border border-gray-700/50'
                                                    }`}
                                            >
                                                <button
                                                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all duration-300 ${isSelected
                                                        ? 'bg-gradient-to-r from-yellow-600/60 to-amber-700/60 text-white shadow-sm'
                                                        : 'bg-gray-800/60 hover:bg-gray-700/60 text-gray-300'
                                                        }`}
                                                    onClick={() => handleWalletSelect(wallet)}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-mono">{walletAddress ? truncateAddress(walletAddress) : 'Invalid Address'}</span>
                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/50 text-yellow-300 border border-yellow-800/50">Morse</span>
                                                    </div>
                                                </button>

                                                {isSelected && (
                                                    <div className="px-3 py-1.5 flex justify-end">
                                                        <button
                                                            onClick={() => walletAddress && handleShowPrivateKey(walletAddress, 'morse')}
                                                            className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 transition-colors"
                                                            title="View private key"
                                                        >
                                                            <i className="fas fa-key mr-1"></i> View Private Key
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Import New Wallet Button */}
                            <div className="pt-2 border-t border-gray-700/50">
                                <button
                                    onClick={() => {
                                        setIsOpen(false);
                                        onImportNew();
                                    }}
                                    className="w-full px-4 py-2.5 bg-gradient-to-r from-indigo-600/70 to-purple-700/70 hover:from-indigo-500/70 hover:to-purple-600/70 text-white rounded-lg text-sm font-medium transition-all duration-300 flex items-center justify-center space-x-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                    <span>Import New Wallet</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Modal para mostrar clave privada */}
            {showPrivateKey && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="bg-gray-900 border-2 border-red-500/50 rounded-xl p-6 max-w-md w-full mx-4 shadow-lg shadow-red-500/20"
                        style={{
                            position: 'fixed',
                            left: '50%',
                            top: '50%',
                            transform: 'translate(-50%, -50%)'
                        }}
                    >
                        <h3 className="text-xl font-bold mb-2 text-white flex items-center">
                            <i className="fas fa-exclamation-triangle text-red-500 mr-2"></i>
                            {privateKeyData && (
                                privateKeyData.trim().split(/\s+/).length === 12 || privateKeyData.trim().split(/\s+/).length === 24
                                    ? "Memonic Phrase - DANGER ZONE"
                                    : "Private Key - DANGER ZONE"
                            )}
                            {!privateKeyData && "Wallet Secrets - DANGER ZONE"}
                        </h3>

                        <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 mb-4">
                            <p className="text-red-300 text-sm mb-2 font-semibold">
                                <i className="fas fa-shield-alt mr-2"></i>
                                EXTREME CAUTION! This is your private key.
                            </p>
                            <ul className="text-red-200 text-xs space-y-1 list-disc pl-5">
                                <li>Never share your private key with anyone</li>
                                <li>Anyone with this key can steal your funds</li>
                                <li>Store it securely offline if needed</li>
                                <li>Take a screenshot only if absolutely necessary</li>
                            </ul>
                        </div>

                        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
                            {privateKeyData ? (
                                privateKeyData.includes("Could not retrieve") || privateKeyData.includes("Error") ? (
                                    <div className="text-yellow-300 text-sm p-2 bg-yellow-900/20 border border-yellow-800 rounded">
                                        <i className="fas fa-info-circle mr-2"></i>
                                        {privateKeyData}
                                    </div>
                                ) : (
                                    <div className="break-all font-mono text-sm text-gray-300 bg-gray-900 p-3 rounded border border-gray-700">
                                        {privateKeyData}
                                    </div>
                                )
                            ) : (
                                <div className="flex justify-center py-4">
                                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-blue-500"></div>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end">
                            <button
                                onClick={() => setShowPrivateKey(null)}
                                className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg text-sm transition-colors"
                            >
                                Close and Secure
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default WalletSelector; 