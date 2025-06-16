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
    const [selectedMorseWallets, setSelectedMorseWallets] = useState<string[]>([]);
    const [selectedShannonWallet, setSelectedShannonWallet] = useState<string>('');
    const [morseWallets, setMorseWallets] = useState<WalletOption[]>([]);
    const [shannonWallets, setShannonWallets] = useState<WalletOption[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<React.ReactNode | null>(null);
    const [successMessage, setSuccessMessage] = useState<React.ReactNode | null>(null);
    const [migrationResult, setMigrationResult] = useState<any>(null);

    const migrationService = new MigrationService();

    // Función para extraer el mensaje de error relevante de un error completo
    const extractRelevantErrorMessage = (errorText: string): string => {
        if (!errorText) return "Unknown error occurred during migration";

        // Buscar mensajes específicos y devolver mensajes amigables
        if (errorText.includes("Zero claimable Morse accounts found")) {
            return "Zero claimable Morse accounts found in the snapshot. Your wallet may not be eligible for migration.";
        }

        if (errorText.includes("connection refused") || errorText.includes("ECONNREFUSED")) {
            return "Cannot connect to migration service. Please try again later.";
        }

        if (errorText.includes("Usage:") && errorText.includes("claim-accounts")) {
            return "Migration command failed. Your Morse wallet may not be in the correct format.";
        }

        // Extraer la última línea significativa, que suele contener el error real
        const lines = errorText.split('\n').filter((line: string) =>
            line.trim() !== '' &&
            !line.includes('--') &&
            !line.includes('connection established') &&
            !line.includes('Example') &&
            !line.includes('Usage:') &&
            !line.includes('Flags:') &&
            !line.includes('Global Flags:')
        );

        if (lines.length > 0) {
            // Tomar la última línea que suele tener el mensaje real
            return lines[lines.length - 1].trim();
        }

        return "Migration failed. Please try again or contact support.";
    };

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
        const shannonWallet = shannonWallets.find((w: WalletOption) => w.id === selectedShannonWallet);
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

            // ---- MORSE wallets ---- //
            const storedMorseArr = await storageService.get<any[]>('morse_wallets');
            const morseOptions: WalletOption[] = [];
            if (Array.isArray(storedMorseArr) && storedMorseArr.length > 0) {
                storedMorseArr.forEach((item, idx) => {
                    const addr = item.parsed?.addr || `morse_${idx}`;
                morseOptions.push({
                        id: item.id,
                        name: `Morse Wallet (${addr.substring(0, 8)}...)`,
                        address: addr,
                    type: 'morse',
                        privateKey: item.serialized // Puede ser JSON o hex
                    });
                });
            } else {
                // Fallback legacy single key
                const legacyMorse = await storageService.get<any>('morse_wallet');
                if (legacyMorse && legacyMorse.parsed?.address) {
                    morseOptions.push({
                        id: 'morse_legacy',
                        name: `Morse Wallet (${legacyMorse.parsed.address.substring(0, 8)}...)`,
                        address: legacyMorse.parsed.address,
                        type: 'morse',
                        privateKey: legacyMorse.serialized || ''
                    });
                }
            }

            // ---- SHANNON wallets ---- //
            const storedShannonArr = await storageService.get<any[]>('shannon_wallets');
            const shannonOptions: WalletOption[] = [];
            if (Array.isArray(storedShannonArr) && storedShannonArr.length > 0) {
                storedShannonArr.forEach((item, idx) => {
                    const addr = item.parsed?.address || `shannon_${idx}`;
                shannonOptions.push({
                        id: item.id,
                        name: `Shannon Wallet (${addr.substring(0, 8)}...)`,
                        address: addr,
                        type: 'shannon',
                        privateKey: item.serialized // Usaremos como signature
                    });
                });
            } else {
                const legacyShannon = await storageService.get<any>('shannon_wallet');
                if (legacyShannon && legacyShannon.parsed?.address) {
                shannonOptions.push({
                        id: 'shannon_legacy',
                        name: `Shannon Wallet (${legacyShannon.parsed.address.substring(0, 8)}...)`,
                        address: legacyShannon.parsed.address,
                        type: 'shannon',
                        privateKey: legacyShannon.serialized || ''
                    });
                }
            }

            setMorseWallets(morseOptions);
            setShannonWallets(shannonOptions);

            // Auto select
            if (morseOptions.length > 0) setSelectedMorseWallets(morseOptions.map(o => o.id));
            if (shannonOptions.length === 1) setSelectedShannonWallet(shannonOptions[0].id);

                setSuccessMessage(null);
                setError(null);
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
        if (selectedMorseWallets.length === 0 || !selectedShannonWallet) {
            setError('Please select Morse wallet(s) and one Shannon wallet');
            return;
        }

        // Obtener los objetos seleccionados
        const selectedMorse: WalletOption[] = morseWallets.filter((w: WalletOption) => selectedMorseWallets.includes(w.id));
        const shannonWallet: WalletOption | undefined = shannonWallets.find((w: WalletOption) => w.id === selectedShannonWallet);

        if (selectedMorse.length === 0 || !shannonWallet) {
            setError('Selected wallets not found');
            return;
        }

        // Verificar que cada wallet Morse tenga privateKey disponible
        if (selectedMorse.some((w: WalletOption) => !w.privateKey)) {
            setError('Some Morse wallets have no private key available');
            return;
        }

        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            console.log('🚀 Starting migration process...');
            console.log('📤 Morse wallets:', selectedMorse.map((w: WalletOption) => w.address));
            console.log('📥 Shannon wallet:', shannonWallet.address);

            // Verificar backend 
            const backendAvailable = await checkMigrationBackendAvailability();
            if (!backendAvailable) throw new Error('Migration backend service is not available');

            // Preparar payload
            const shannonRaw = await storageService.get<any>('shannon_wallets');
            const shannonStoredObj = Array.isArray(shannonRaw) ? shannonRaw.find((s: any) => s.id === shannonWallet.id) : null;
            const shannonSignature = shannonStoredObj?.serialized || '';

            const migrationData = {
                morseWallets: selectedMorse.map((w: WalletOption) => w.privateKey as string),
                shannonAddress: {
                    address: shannonWallet.address,
                    signature: shannonSignature || (shannonWallet.privateKey || '')
                }
            };

            // Enviar
            const backendUrl = import.meta.env.VITE_MIGRATION_API_URL || 'http://localhost:3001';
            const response = await fetch(`${backendUrl}/api/migration/migrate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(migrationData)
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.message || err.error || response.statusText);
            }

            const result = await response.json();
            console.log('Migration result:', result);

            // Verificar si hay un error en el resultado
            if (result.result && result.result.success === false) {
                // Extraer mensaje de error útil
                let errorMessage = "Migration failed";

                if (result.result.error) {
                    // Buscar el mensaje de error real, ignorando la salida del comando
                    const errorText = result.result.error;

                    if (errorText.includes("Zero claimable Morse accounts found")) {
                        errorMessage = "Zero claimable Morse accounts found in the snapshot. Your wallet may not be eligible for migration.";
                    } else if (errorText.includes("connection refused") || errorText.includes("ECONNREFUSED")) {
                        errorMessage = "Cannot connect to migration service. Please try again later.";
                    } else if (errorText.includes("Usage:") && errorText.includes("claim-accounts")) {
                        errorMessage = "Migration command failed. Your Morse wallet may not be in the correct format.";
                } else {
                        // Extraer la última línea significativa del error
                        const lines = errorText.split('\n').filter((line: string) => line.trim() !== '');
                        if (lines.length > 0) {
                            errorMessage = lines[lines.length - 1].trim();
                        }
                    }
                }

                setError(errorMessage);
                setMigrationResult(result);
                return;
            }

            setMigrationResult(result);
            setSuccessMessage('Migration completed successfully!');
        } catch (err: any) {
            console.error('Migration error:', err);

            // Mejorar mensaje de error
            let errorMessage = err.message || 'Migration failed';

            // Detectar errores comunes y mostrar mensajes más claros
            if (typeof errorMessage === 'string') {
                if (errorMessage.includes('Zero claimable Morse accounts')) {
                    // Mostrar el mensaje exacto sin traducir
                    errorMessage = 'Zero claimable Morse accounts found in the snapshot. Check the logs and the input file before trying again.';
                } else if (errorMessage.includes('connection refused') || errorMessage.includes('ECONNREFUSED')) {
                    errorMessage = 'Cannot connect to migration service. Please try again later.';
                }
            }

            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const reset = () => {
        setSelectedMorseWallets([]);
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
                            <p className="text-gray-400 text-xs mt-0.5">Migrate your Morse wallets to Shannon network</p>
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
                                <p className="font-medium text-green-400 text-sm">Your Morse accounts are ready.</p>
                            </div>
                            {selectedMorseWallets.length > 0 && morseWallets.length > 0 && (
                                <p className="text-amber-200/80 text-xs pl-6 mt-1">
                                    They can be migrated with {
                                        (() => {
                                            try {
                                                // Obtener la dirección seleccionada
                                                const selectedWallets = morseWallets.filter((w: WalletOption) => selectedMorseWallets.includes(w.id));
                                                if (selectedWallets.length === 0) return '0.00';

                                                // Forzar actualización del balance (esto es asíncrono, pero al menos inicia la actualización)
                                                setTimeout(async () => {
                                                    const balances = await Promise.all(selectedWallets.map((w: WalletOption) => walletService.getBalance(w.address)));
                                                    // Actualizar el elemento DOM directamente con el balance actual
                                                    const balanceElements = selectedWallets.map((w: WalletOption) => document.getElementById(`morseBalanceDisplay-${w.id}`));
                                                    if (balanceElements && balances) {
                                                        const balanceNums = balances.map(balance => parseFloat(balance));
                                                        balanceElements.forEach((element, index) => {
                                                            if (element) {
                                                                element.innerText = balanceNums[index].toLocaleString('en-US', {
                                                            minimumFractionDigits: 2,
                                                            maximumFractionDigits: 2
                                                                });
                                                            }
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
                                                return <span id={`morseBalanceDisplay-${selectedWallets[0].id}`}>{morseBalance}</span>;
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
                            {/* Morse Wallet Cards (multi select) */}
                            <div className="bg-gradient-to-br from-orange-500/5 to-yellow-500/5 border border-orange-500/20 rounded-xl p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <Wallet className="w-4 h-4 text-orange-400" />
                                    <h3 className="font-semibold text-orange-300 text-sm">Select Morse Wallets</h3>
                                    {morseWallets.length > 1 && (
                                        <button
                                            onClick={() => setSelectedMorseWallets(morseWallets.map(w => w.id))}
                                            className="ml-auto text-xs text-orange-300 hover:text-orange-200 underline"
                                        >Select all</button>
                                    )}
                                </div>

                                {morseWallets.length === 0 && (
                                    <p className="text-orange-400/60 text-xs">No Morse wallets found</p>
                                )}

                                <div className="grid gap-2 max-h-48 overflow-y-auto pr-1">
                                    {morseWallets.map(wallet => {
                                        const selected = selectedMorseWallets.includes(wallet.id);
                                        return (
                                            <button
                                                key={wallet.id}
                                                onClick={() => {
                                                    setSelectedMorseWallets(prev => selected ? prev.filter(id => id !== wallet.id) : [...prev, wallet.id]);
                                                }}
                                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all text-left ${selected ? 'bg-orange-600/20 border-orange-500/50' : 'bg-gray-800/50 border-gray-600/30 hover:bg-gray-700/40'}`}
                                                disabled={isLoading}
                                            >
                                                <span className="text-xs truncate mr-2">{wallet.address}</span>
                                                {selected && <CheckCircle className="w-3 h-3 text-orange-300" />}
                                            </button>
                                        );
                                    })}
                                    </div>
                            </div>

                            {/* Shannon Wallet Cards (single select) */}
                            <div className="bg-gradient-to-br from-blue-500/5 to-purple-500/5 border border-blue-500/20 rounded-xl p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <Wallet className="w-4 h-4 text-blue-400" />
                                    <h3 className="font-semibold text-blue-300 text-sm">Select Shannon Wallet</h3>
                                </div>

                                {shannonWallets.length === 0 && (
                                    <p className="text-blue-400/60 text-xs">No Shannon wallets found</p>
                                )}

                                <div className="grid gap-2 max-h-48 overflow-y-auto pr-1">
                                    {shannonWallets.map(wallet => {
                                        const selected = selectedShannonWallet === wallet.id;
                                        return (
                                            <button
                                                key={wallet.id}
                                                onClick={() => {
                                                    setSelectedShannonWallet(wallet.id);
                                                    setSuccessMessage(null);
                                                    setError(null);
                                                }}
                                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all text-left ${selected ? 'bg-blue-600/20 border-blue-500/50' : 'bg-gray-800/50 border-gray-600/30 hover:bg-gray-700/40'}`}
                                                disabled={isLoading}
                                            >
                                                <span className="text-xs truncate mr-2">{wallet.address}</span>
                                                {selected && <CheckCircle className="w-3 h-3 text-blue-300" />}
                                            </button>
                                        );
                                    })}
                                        </div>
                                {selectedShannonWallet && (
                                    <p className="text-blue-400/60 text-xs mt-2">This wallet must have funds to pay migration fees</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Migration Result - condensado */}
                    {migrationResult && (
                        <div className={`bg-gradient-to-br ${migrationResult.data?.result?.success !== false && migrationResult.result?.success !== false
                            ? 'from-green-500/5 to-emerald-500/5 border-green-500/20'
                            : 'from-red-500/5 to-red-600/5 border-red-500/20'
                            } border rounded-xl p-3`}>
                            <h3 className={`text-base font-semibold mb-3 flex items-center gap-2 ${migrationResult.data?.result?.success !== false && migrationResult.result?.success !== false ? 'text-green-300' : 'text-red-300'
                                }`}>
                                {migrationResult.data?.result?.success !== false && migrationResult.result?.success !== false ? (
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
                                        <p className={`font-medium text-sm ${migrationResult.data?.result?.success !== false && migrationResult.result?.success !== false ? 'text-green-400' : 'text-red-400'
                                            }`}>
                                            {migrationResult.data?.result?.success !== false && migrationResult.result?.success !== false ? 'Successful' : 'Failed'}
                                        </p>
                                    </div>

                                    {/* Mostrar mensaje de error específico siempre que haya un error */}
                                    {(error || migrationResult.result?.error || migrationResult.data?.result?.error) && (
                                        <div className="p-3 bg-red-900/20 rounded-lg border border-red-700/50">
                                            <p className="text-xs text-gray-400 mb-1">Error Details</p>
                                            <p className="font-medium text-sm text-red-400">
                                                {typeof error === 'string' ? extractRelevantErrorMessage(error) :
                                                    extractRelevantErrorMessage(
                                                        (typeof migrationResult.result?.error === 'string' ? migrationResult.result?.error : '') ||
                                                        (typeof migrationResult.data?.result?.error === 'string' ? migrationResult.data?.result?.error : '') ||
                                                        "Unknown error occurred during migration"
                                                    )}
                                            </p>
                                        </div>
                                    )}

                                    {/* Si hay mappings, mostrarlos */}
                                    {(migrationResult.data?.result?.mappings || migrationResult.result?.mappings) &&
                                        (migrationResult.data?.result?.mappings?.length > 0 || migrationResult.result?.mappings?.length > 0) && (
                                            <div className="p-3 bg-gray-800/40 rounded-lg border border-gray-700/50">
                                                <p className="text-xs text-gray-400 mb-1">Accounts Migrated</p>
                                                <p className="font-medium text-sm text-green-400">
                                                    {migrationResult.data?.result?.mappings?.length || migrationResult.result?.mappings?.length || 0}
                                                </p>
                                            </div>
                                        )}
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
                                disabled={selectedMorseWallets.length === 0 || !selectedShannonWallet || isLoading}
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