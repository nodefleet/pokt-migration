import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MigrationService } from '../controller/MigrationService';
import { storageService } from '../controller/storage.service';
import { walletService } from '../controller/WalletService';

// FontAwesome icons as components
const X = ({ className }: { className?: string }) => <i className={`fas fa-times ${className || ''}`}></i>;
const ArrowRight = ({ className }: { className?: string }) => <i className={`fas fa-arrow-right ${className || ''}`}></i>;
const CheckCircle = ({ className }: { className?: string }) => <i className={`fas fa-check-circle ${className || ''}`}></i>;
const AlertCircle = ({ className }: { className?: string }) => <i className={`fas fa-exclamation-circle ${className || ''}`}></i>;
const Info = ({ className }: { className?: string }) => <i className={`fas fa-info-circle ${className || ''}`}></i>;
const Wallet = ({ className }: { className?: string }) => <i className={`fas fa-wallet ${className || ''}`}></i>;
const Plus = ({ className }: { className?: string }) => <i className={`fas fa-plus ${className || ''}`}></i>;
const Download = ({ className }: { className?: string }) => <i className={`fas fa-download ${className || ''}`}></i>;

interface MigrationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    morsePrivateKey?: string;
    morseAddress?: string;
}

interface WalletOption {
    id: string;
    name: string;
    address: string;
    type: 'morse' | 'shannon';
    privateKey?: string;
}

const MigrationDialog: React.FC<MigrationDialogProps> = ({
    isOpen,
    onClose,
    morsePrivateKey,
    morseAddress
}) => {
    const navigate = useNavigate();
    const [selectedMorseWallet, setSelectedMorseWallet] = useState<string>('');
    const [selectedShannonWallet, setSelectedShannonWallet] = useState<string>('');
    const [morseWallets, setMorseWallets] = useState<WalletOption[]>([]);
    const [shannonWallets, setShannonWallets] = useState<WalletOption[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<React.ReactNode | null>(null);
    const [successMessage, setSuccessMessage] = useState<React.ReactNode | null>(null);
    const [migrationResult, setMigrationResult] = useState<any>(null);

    const migrationService = new MigrationService();

    useEffect(() => {
        if (isOpen) {
            loadWallets();
        }
    }, [isOpen]);

    // Nuevo useEffect para verificar la cuenta Shannon automáticamente cuando hay una wallet seleccionada
    useEffect(() => {
        if (selectedShannonWallet && shannonWallets.length > 0) {
            // Verificar cuenta Shannon automáticamente
            verifySelectedShannonAccount();
        }
    }, [selectedShannonWallet, shannonWallets]);

    // Extraer la lógica de verificación a una función separada para reutilizarla
    const verifySelectedShannonAccount = () => {
        const shannonWallet = shannonWallets.find(w => w.id === selectedShannonWallet);
        if (!shannonWallet || !shannonWallet.address) return;

        const statusContainer = document.getElementById('shannonStatusContainer');
        if (statusContainer) {
            statusContainer.classList.remove('bg-green-500/10', 'bg-red-500/10');
            statusContainer.classList.add('bg-gray-500/10');
            statusContainer.innerHTML = `
                <div class="flex items-center space-x-2">
                    <i class="fas fa-circle-question text-gray-400"></i>
                    <p class="font-medium text-gray-400 text-sm">Checking Shannon account...</p>
                </div>
            `;
        }

        // Verify account exists
        fetch(`https://shannon-grove-api.mainnet.poktroll.com/cosmos/auth/v1beta1/accounts/${shannonWallet.address}`)
            .then(response => {
                if (response.ok) {
                    if (statusContainer) {
                        statusContainer.innerHTML = `
                            <div class="flex items-center space-x-2">
                                <i class="fas fa-circle-check text-green-500"></i>
                                <p class="font-medium text-green-400 text-sm">Your Shannon account exists.</p>
                            </div>
                        `;
                        statusContainer.classList.remove('bg-gray-500/10');
                        statusContainer.classList.add('bg-green-500/10');
                        statusContainer.classList.remove('border-gray-500/30');
                        statusContainer.classList.add('border-green-500/30');
                    }
                } else {
                    if (statusContainer) {
                        statusContainer.innerHTML = `
                            <div class="flex items-center space-x-2">
                                <i class="fas fa-circle-xmark text-red-500"></i>
                                <p class="font-medium text-red-400 text-sm">Your Shannon account doesn't exist.</p>
                            </div>
                            <div class="text-white/80 text-xs pl-6 mt-1">
                                <p class="mb-1">You need to receive MACT tokens to activate your account.</p>
                                <a 
                                    href="https://faucet.beta.testnet.pokt.network/mact/" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    class="block text-center mt-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-xs font-medium"
                                >
                                    Click here to go to the MACT faucet
                                </a>
                            </div>
                        `;
                        statusContainer.classList.remove('bg-gray-500/10');
                        statusContainer.classList.add('bg-red-500/10');
                        statusContainer.classList.remove('border-gray-500/30');
                        statusContainer.classList.add('border-red-500/30');
                    }
                }
            })
            .catch(err => {
                console.error("Error checking account:", err);
            });
    };

    const loadWallets = async () => {
        try {
            console.log('🔄 Loading wallets from localStorage...');

            // Load Morse wallets - use correct key 'morse_wallet'
            const morseWallet = await storageService.get<any>('morse_wallet');
            console.log('📥 Loaded morse_wallet:', morseWallet);

            const morseOptions: WalletOption[] = [];
            if (morseWallet && morseWallet.parsed?.address) {
                morseOptions.push({
                    id: 'morse_1',
                    name: `Morse Wallet (${morseWallet.parsed.address.substring(0, 8)}...)`,
                    address: morseWallet.parsed.address,
                    type: 'morse',
                    privateKey: morsePrivateKey // Use the provided private key
                });
            }

            // Load Shannon wallets - use correct key 'shannon_wallet'
            const shannonWallet = await storageService.get<any>('shannon_wallet');
            console.log('📥 Loaded shannon_wallet:', shannonWallet);

            const shannonOptions: WalletOption[] = [];

            // Check for the new format (from WalletService)
            if (shannonWallet && shannonWallet.parsed?.address) {
                shannonOptions.push({
                    id: 'shannon_1',
                    name: `Shannon Wallet (${shannonWallet.parsed.address.substring(0, 8)}...)`,
                    address: shannonWallet.parsed.address,
                    type: 'shannon'
                });
            }

            // Also check for zustand store format (direct address field)
            else if (shannonWallet && shannonWallet.address && !shannonOptions.some(w => w.address === shannonWallet.address)) {
                shannonOptions.push({
                    id: 'shannon_store',
                    name: `Shannon Wallet (${shannonWallet.address.substring(0, 8)}...)`,
                    address: shannonWallet.address,
                    type: 'shannon'
                });
            }

            console.log('✅ Morse wallets found:', morseOptions.length);
            console.log('✅ Shannon wallets found:', shannonOptions.length);

            setMorseWallets(morseOptions);
            setShannonWallets(shannonOptions);

            // Auto-select if only one option available
            if (morseOptions.length === 1) {
                setSelectedMorseWallet(morseOptions[0].id);
            }
            if (shannonOptions.length === 1) {
                setSelectedShannonWallet(shannonOptions[0].id);
            }

            // Si tenemos todas las opciones, mostrar los status
            if (morseOptions.length > 0 && shannonOptions.length > 0) {
                setSuccessMessage(null);
                setError(null);
            }
        } catch (error) {
            console.error('❌ Error loading wallets:', error);
            setError('Error loading wallets from storage');
        }
    };

    const checkMigrationBackendAvailability = async () => {
        try {
            // Get backend URL from environment
            const backendUrl = import.meta.env.VITE_MIGRATION_API_URL || 'http://localhost:3001';

            console.log(`🔍 Verificando disponibilidad del backend en ${backendUrl}/api/migration/health`);

            // Check backend health - verificación simple
            // Si el backend responde correctamente (sin importar el contenido), lo consideramos disponible
            const response = await fetch(`${backendUrl}/api/migration/health`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            // Si la respuesta es exitosa (status 200-299), consideramos el servicio disponible
            if (response.ok) {
                console.log('✅ Backend disponible, status:', response.status);
                return true;
            }

            console.error(`❌ Backend respondió con error: ${response.status} ${response.statusText}`);
            return false;
        } catch (error) {
            console.error('❌ Error conectando al backend:', error);
            return false;
        }
    };

    const handleMigration = async () => {
        if (!selectedMorseWallet || !selectedShannonWallet) {
            setError('Please select both Morse and Shannon wallets');
            return;
        }

        const morseWallet = morseWallets.find(w => w.id === selectedMorseWallet);
        const shannonWallet = shannonWallets.find(w => w.id === selectedShannonWallet);

        if (!morseWallet || !shannonWallet) {
            setError('Selected wallets not found');
            return;
        }

        if (!morseWallet.privateKey) {
            setError('Morse private key not available');
            return;
        }

        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            console.log('🚀 Starting migration process...');
            console.log('📤 Morse wallet:', morseWallet.address);
            console.log('📥 Shannon wallet:', shannonWallet.address);

            // Verificar que el backend de migración esté disponible
            const backendAvailable = await checkMigrationBackendAvailability();
            if (!backendAvailable) {
                throw new Error(
                    'Migration backend service is not available. Please ensure the migration service is running on http://localhost:3001'
                );
            }

            // Verificar primero si la cuenta Shannon existe en la red
            try {
                console.log('🔍 Verificando si la cuenta Shannon existe en la red...');
                const shannonAddress = shannonWallet.address;

                // Obtener información de la wallet Morse para mostrar el balance
                const morseWalletData = storageService.getSync<any>('morse_wallet');
                let morseBalance = '0.00';
                let moredata = null;

                if (morseWalletData && morseWalletData.serialized) {
                    try {
                        moredata = morseWalletData.serialized;
                        if (moredata && moredata.balance) {
                            const balanceNum = parseFloat(moredata.balance);
                            morseBalance = balanceNum.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                            });
                        }
                    } catch (e) {
                        console.error('Error parsing morse wallet data', e);
                    }
                }

                const accountCheckResponse = await fetch(`https://shannon-grove-api.mainnet.poktroll.com/cosmos/auth/v1beta1/accounts/${shannonAddress}`);

                if (!accountCheckResponse.ok) {
                    // La cuenta no existe en la red
                    console.log('⚠️ La cuenta Shannon no existe en la red');
                    setError(
                        <div className="space-y-3">
                            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                                <div className="flex items-center space-x-2 mb-2">
                                    <i className="fas fa-circle-check text-green-500"></i>
                                    <p className="font-medium text-green-400">Your Morse account is ready.</p>
                                </div>
                                <p className="text-amber-200/80 text-sm pl-6">It can be migrated with {morseBalance} POKT</p>
                            </div>

                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                                <div className="flex items-center space-x-2 mb-2">
                                    <i className="fas fa-circle-xmark text-red-500"></i>
                                    <p className="font-medium text-red-400">Your Shannon account doesn't exist.</p>
                                </div>
                                <div className="text-white/80 text-sm pl-6">
                                    <p className="mb-2">You need to receive MACT tokens to activate your account on the network.</p>
                                    <a
                                        href="https://faucet.beta.testnet.pokt.network/mact/"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block text-center mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium"
                                    >
                                        Click here to go to the MACT faucet
                                    </a>
                                </div>
                            </div>
                        </div>
                    );
                    setIsLoading(false);
                    return;
                }

                console.log('✅ La cuenta Shannon existe en la red');

                // Si la cuenta Shannon existe, mostrar mensaje pero continuar con la migración
                setSuccessMessage(
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                        <div className="flex items-center space-x-2">
                            <i className="fas fa-circle-check text-green-500"></i>
                            <p className="font-medium text-green-400">Your Shannon account exists.</p>
                        </div>
                    </div>
                );
            } catch (error) {
                console.error('❌ Error verificando la cuenta Shannon:', error);
                // Continuar con el proceso aunque falle la verificación
            }

            let morseKeyData = morseWallet.privateKey;

            // Si tenemos información completa de la wallet, enviarla como JSON
            const morseWallets = storageService.getSync<any>('morse_wallet');
            let moredata = null;

            try {
                moredata = JSON.parse(morseWallets.serialized);
            } catch (e) {
                console.error('Error parsing morse wallet data', e);
            }
            const shannonWallets = storageService.getSync<any>('shannon_wallet');

            if (morseWallet.address && morseWallet.privateKey && moredata) {
                // Enviar la wallet Morse completa en formato JSON
                morseKeyData = JSON.stringify({
                    addr: moredata.address,
                    name: moredata.name || `wallet-${morseWallet.address.substring(0, 8)}`,
                    priv: moredata.priv,
                    pass: moredata.pass || "",
                    account: moredata.account || 0
                });
            }

            // Construir el payload con los nombres de campos correctos que espera el backend
            const migrationData = {
                morsePrivateKey: morseKeyData, // Usar campo en singular
                shannonAddress: {
                    address: shannonWallet.address,
                    signature: shannonWallets.serialized
                } // Usar shannonAddress en lugar de signingAccount
            };

            console.log('📡 Sending migration request to backend...');

            // URL fija para el backend de migración local
            const backendUrl = import.meta.env.VITE_MIGRATION_API_URL || 'http://localhost:3001';
            console.log(`🚀 Enviando solicitud de migración a: ${backendUrl}/api/migration/migrate`);

            // Send to backend endpoint
            const response = await fetch(`${backendUrl}/api/migration/migrate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(migrationData)
            });

            if (!response.ok) {
                console.error(`❌ Backend respondió con error: ${response.status} ${response.statusText}`);
                let errorMessage = `Migration failed: ${response.status} ${response.statusText}`;

                try {
                    const errorData = await response.json();
                    console.error('Error details:', errorData);
                    errorMessage = errorData.message || errorData.error || errorMessage;
                } catch (e) {
                    console.error('Could not parse error response:', e);
                }

                throw new Error(errorMessage);
            }

            const result = await response.json();
            console.log('📋 Backend response received:', result);

            // CORRECCIÓN: Verificar TANTO el éxito de la comunicación como el resultado real de la migración
            const migrationSuccess = result.success && result.data?.result?.success !== false;

            if (!migrationSuccess) {
                // La migración falló - extraer el mensaje de error del resultado interno
                const errorMessage = result.data?.result?.error ||
                    result.data?.error ||
                    result.error ||
                    'Migration process failed';

                console.error('❌ Migration failed:', errorMessage);

                // Mostrar un error más específico según el tipo de error
                if (errorMessage.includes('connection refused') || errorMessage.includes('Post "http://localhost:26657"')) {
                    throw new Error('Cannot connect to Shannon network node. Please try again later.');
                } else if (errorMessage.includes('Bad Gateway') || errorMessage.includes('502')) {
                    throw new Error('Shannon network node is currently unavailable. Please try again later.');
                } else if (errorMessage.includes('Usage:') || errorMessage.includes('claim-accounts')) {
                    throw new Error('Migration command configuration error. Please contact support.');
                } else {
                    throw new Error(`Migration error: ${errorMessage}`);
                }
            }

            // Si llegamos aquí, la migración fue exitosa
            console.log('✅ Migration completed successfully:', result);

            setMigrationResult(result);
            setSuccessMessage('Migration completed successfully! Check the migration results below.');

            // Save the new Shannon wallet if provided in result
            if (result.data?.result?.mappings && result.data.result.mappings.length > 0) {
                const mapping = result.data.result.mappings[0];
                if (mapping.shannon_address) {
                    await storageService.set('shannon_wallet', {
                        serialized: '', // Backend doesn't provide serialized wallet
                        network: 'shannon',
                        timestamp: Date.now(),
                        parsed: { address: mapping.shannon_address }
                    });
                    console.log('💾 New Shannon wallet saved to localStorage');
                }
            }

        } catch (error) {
            console.error('❌ Migration error:', error);
            setError(error instanceof Error ? error.message : 'Migration failed');
        } finally {
            setIsLoading(false);
        }
    };

    const reset = () => {
        setSelectedMorseWallet('');
        setSelectedShannonWallet('');
        setError(null);
        setSuccessMessage(null);
        setMigrationResult(null);
        setIsLoading(false);
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    // Functions to handle wallet creation/import navigation
    const handleCreateMorseWallet = () => {
        onClose();
        navigate('/import/individual?network=morse&action=create');
    };

    const handleImportMorseWallet = () => {
        onClose();
        navigate('/import/individual?network=morse&action=import');
    };

    const handleCreateShannonWallet = () => {
        onClose();
        navigate('/import/individual?network=shannon&action=create');
    };

    const handleImportShannonWallet = () => {
        onClose();
        navigate('/import/individual?network=shannon&action=import');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl border border-gray-700/50 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
                {/* Header */}
                <div className="relative p-4 border-b border-gray-700/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl flex items-center justify-center border border-blue-500/30">
                            <i className="fas fa-arrow-right text-blue-400"></i>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Wallet Migration</h2>
                            <p className="text-gray-400 text-xs mt-0.5">Migrate your Morse wallet to Shannon network</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-700/50"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                    {/* Info Banner - más compacto */}
                    <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-3">
                        <div className="flex items-center gap-2">
                            <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
                            <p className="text-blue-200/80 text-xs">
                                Select your wallets below to migrate from Morse to Shannon network.
                            </p>
                        </div>
                    </div>

                    {/* Estado de las wallets - SIEMPRE VISIBLE */}
                    <div className="space-y-2">
                        {/* Morse wallet status */}
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                            <div className="flex items-center space-x-2">
                                <i className="fas fa-circle-check text-green-500"></i>
                                <p className="font-medium text-green-400 text-sm">Your Morse account is ready.</p>
                            </div>
                            {selectedMorseWallet && morseWallets.length > 0 && (
                                <p className="text-amber-200/80 text-xs pl-6 mt-1">
                                    It can be migrated with {
                                        (() => {
                                            try {
                                                // Obtener la dirección seleccionada
                                                const selectedWallet = morseWallets.find(w => w.id === selectedMorseWallet);
                                                if (!selectedWallet) return '0.00';

                                                // Forzar actualización del balance (esto es asíncrono, pero al menos inicia la actualización)
                                                setTimeout(async () => {
                                                    const balance = await walletService.getBalance(selectedWallet.address);
                                                    // Actualizar el elemento DOM directamente con el balance actual
                                                    const balanceElement = document.getElementById('morseBalanceDisplay');
                                                    if (balanceElement && balance) {
                                                        const balanceNum = parseFloat(balance);
                                                        balanceElement.innerText = balanceNum.toLocaleString('en-US', {
                                                            minimumFractionDigits: 2,
                                                            maximumFractionDigits: 2
                                                        });
                                                    }
                                                }, 100);

                                                // Mientras tanto, intentar obtener del localStorage también
                                                const morseWalletData = storageService.getSync<any>('morse_wallet');
                                                let morseBalance = '0.00';
                                                if (morseWalletData && morseWalletData.serialized) {
                                                    try {
                                                        const data = JSON.parse(morseWalletData.serialized);
                                                        if (data && data.balance) {
                                                            const balanceNum = parseFloat(data.balance);
                                                            morseBalance = balanceNum.toLocaleString('en-US', {
                                                                minimumFractionDigits: 2,
                                                                maximumFractionDigits: 2
                                                            });
                                                        }
                                                    } catch (e) { }
                                                }
                                                return <span id="morseBalanceDisplay">{morseBalance}</span>;
                                            } catch (e) {
                                                console.error("Error obteniendo balance:", e);
                                                return '0.00';
                                            }
                                        })()
                                    } POKT
                                </p>
                            )}
                        </div>

                        {/* Shannon wallet status - Cambia según verificación */}
                        {selectedShannonWallet && shannonWallets.length > 0 && (
                            <div className="relative">
                                <div id="shannonStatusContainer" className="bg-gray-500/10 border border-gray-500/30 rounded-lg p-3">
                                    <div className="flex items-center space-x-2">
                                        <i className="fas fa-circle-question text-gray-400"></i>
                                        <p className="font-medium text-gray-400 text-sm">Checking Shannon account...</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="bg-gradient-to-r from-red-500/10 to-red-600/10 border border-red-500/30 rounded-xl p-3">
                            <div className="flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-semibold text-red-300 text-sm">Error</p>
                                    <div className="text-red-200/80 text-xs mt-1">
                                        {typeof error === 'string' ? error : error}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Success Message */}
                    {successMessage && !error && (
                        <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl p-3">
                            <div className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-semibold text-green-300 text-sm">Success</p>
                                    <div className="text-green-200/80 text-xs mt-1">
                                        {typeof successMessage === 'string' ? successMessage : successMessage}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {!migrationResult && (
                        <div className="grid md:grid-cols-1 gap-4">
                            {/* Morse Wallet Selection */}
                            <div className="bg-gradient-to-br from-orange-500/5 to-yellow-500/5 border border-orange-500/20 rounded-xl p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <Wallet className="w-4 h-4 text-orange-400" />
                                    <h3 className="font-semibold text-orange-300 text-sm">Select Morse Wallet</h3>
                                </div>

                                {morseWallets.length > 0 ? (
                                    <>
                                        <select
                                            value={selectedMorseWallet}
                                            onChange={(e) => setSelectedMorseWallet(e.target.value)}
                                            className="w-full p-2.5 bg-gray-800/60 border border-gray-600/50 rounded-lg text-white text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 focus:outline-none transition-all"
                                            disabled={isLoading}
                                        >
                                            <option value="">Choose Morse wallet...</option>
                                            {morseWallets.map((wallet) => (
                                                <option key={wallet.id} value={wallet.id}>
                                                    {wallet.name}
                                                </option>
                                            ))}
                                        </select>
                                        {selectedMorseWallet && (
                                            <div className="mt-2 p-2 bg-orange-500/5 rounded-lg border border-orange-500/20">
                                                <p className="text-xs text-orange-200/70 font-medium">Selected Address:</p>
                                                <p className="text-orange-300 font-mono text-xs break-all">
                                                    {morseWallets.find(w => w.id === selectedMorseWallet)?.address}
                                                </p>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-center space-y-2">
                                        <p className="text-orange-400/60 text-xs">No Morse wallets found</p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleCreateMorseWallet}
                                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-orange-600/20 to-yellow-600/20 border border-orange-500/30 rounded-lg text-orange-300 text-xs hover:from-orange-600/30 hover:to-yellow-600/30 hover:border-orange-500/50 transition-all duration-200"
                                            >
                                                <Plus className="w-3 h-3" />
                                                Create
                                            </button>
                                            <button
                                                onClick={handleImportMorseWallet}
                                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-orange-600/20 to-yellow-600/20 border border-orange-500/30 rounded-lg text-orange-300 text-xs hover:from-orange-600/30 hover:to-yellow-600/30 hover:border-orange-500/50 transition-all duration-200"
                                            >
                                                <Download className="w-3 h-3" />
                                                Import
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Shannon Wallet Selection */}
                            <div className="bg-gradient-to-br from-blue-500/5 to-purple-500/5 border border-blue-500/20 rounded-xl p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <Wallet className="w-4 h-4 text-blue-400" />
                                    <h3 className="font-semibold text-blue-300 text-sm">Select Shannon Wallet</h3>
                                </div>

                                {shannonWallets.length > 0 ? (
                                    <>
                                        <select
                                            value={selectedShannonWallet}
                                            onChange={(e) => {
                                                setSelectedShannonWallet(e.target.value);
                                                // Reset verification status
                                                setSuccessMessage(null);
                                                setError(null);

                                                // La verificación ocurrirá automáticamente por el useEffect
                                            }}
                                            className="w-full p-2.5 bg-gray-800/60 border border-gray-600/50 rounded-lg text-white text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 focus:outline-none transition-all"
                                            disabled={isLoading}
                                        >
                                            <option value="">Choose Shannon wallet...</option>
                                            {shannonWallets.map((wallet) => (
                                                <option key={wallet.id} value={wallet.id}>
                                                    {wallet.name}
                                                </option>
                                            ))}
                                        </select>
                                        {selectedShannonWallet && (
                                            <div className="mt-2 p-2 bg-blue-500/5 rounded-lg border border-blue-500/20">
                                                <p className="text-xs text-blue-200/70 font-medium">Selected Address:</p>
                                                <p className="text-blue-300 font-mono text-xs break-all">
                                                    {shannonWallets.find(w => w.id === selectedShannonWallet)?.address}
                                                </p>
                                            </div>
                                        )}
                                        <p className="text-blue-400/60 text-xs mt-2">
                                            This wallet must have funds to pay migration fees
                                        </p>
                                    </>
                                ) : (
                                    <div className="text-center space-y-2">
                                        <p className="text-blue-400/60 text-xs">No Shannon wallets found</p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleCreateShannonWallet}
                                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-lg text-blue-300 text-xs hover:from-blue-600/30 hover:to-purple-600/30 hover:border-blue-500/50 transition-all duration-200"
                                            >
                                                <Plus className="w-3 h-3" />
                                                Create
                                            </button>
                                            <button
                                                onClick={handleImportShannonWallet}
                                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-lg text-blue-300 text-xs hover:from-blue-600/30 hover:to-purple-600/30 hover:border-blue-500/50 transition-all duration-200"
                                            >
                                                <Download className="w-3 h-3" />
                                                Import
                                            </button>
                                        </div>
                                        <p className="text-blue-400/60 text-xs">
                                            Shannon wallet must have funds to pay migration fees
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Migration Result - condensado */}
                    {migrationResult && (
                        <div className={`bg-gradient-to-br ${migrationResult.data?.result?.success !== false
                            ? 'from-green-500/5 to-emerald-500/5 border-green-500/20'
                            : 'from-red-500/5 to-red-600/5 border-red-500/20'
                            } border rounded-xl p-3`}>
                            <h3 className={`text-base font-semibold mb-3 flex items-center gap-2 ${migrationResult.data?.result?.success !== false ? 'text-green-300' : 'text-red-300'
                                }`}>
                                {migrationResult.data?.result?.success !== false ? (
                                    <CheckCircle className="w-4 h-4" />
                                ) : (
                                    <AlertCircle className="w-4 h-4" />
                                )}
                                Migration Result
                            </h3>
                            <div className="space-y-3">
                                <div className="grid gap-3">
                                    <div className="p-3 bg-gray-800/40 rounded-lg border border-gray-700/50">
                                        <p className="text-xs text-gray-400 mb-1">Status</p>
                                        <p className={`font-medium text-sm ${migrationResult.data?.result?.success !== false ? 'text-green-400' : 'text-red-400'
                                            }`}>
                                            {migrationResult.data?.result?.success !== false ? 'Successful' : 'Failed'}
                                        </p>
                                    </div>

                                    {/* Otros campos del resultado de migración condensados */}
                                    {/* ... rest of the migration result UI with smaller text and padding ... */}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Actions - más compactos */}
                    <div className="flex gap-3 pt-4 border-t border-gray-700/50">
                        <button
                            onClick={handleClose}
                            className="flex-1 px-4 py-2.5 bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 hover:text-white rounded-lg transition-all duration-200 font-medium text-sm"
                            disabled={isLoading}
                        >
                            {migrationResult ? 'Close' : 'Cancel'}
                        </button>

                        {!migrationResult && (
                            <button
                                onClick={handleMigration}
                                disabled={!selectedMorseWallet || !selectedShannonWallet || isLoading}
                                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200 flex items-center justify-center gap-2 font-medium text-sm shadow-lg"
                            >
                                {isLoading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Migrating...
                                    </>
                                ) : (
                                    <>
                                        <ArrowRight className="w-4 h-4" />
                                        Migrate
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MigrationDialog; 