import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MigrationService } from '../controller/MigrationService';
import { storageService } from '../controller/storage.service';

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
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [migrationResult, setMigrationResult] = useState<any>(null);

    const migrationService = new MigrationService();

    useEffect(() => {
        if (isOpen) {
            loadWallets();
        }
    }, [isOpen]);

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
        } catch (error) {
            console.error('❌ Error loading wallets:', error);
            setError('Error loading wallets from storage');
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

            // Preparar los datos en el formato que espera el backend
            // La clave privada Morse puede estar en formato JSON o hex
            let morseKeyData = morseWallet.privateKey;

            // Si tenemos información completa de la wallet, enviarla como JSON
            const morseWallets = storageService.getSync<any>('morse_wallet');
            const moredata = JSON.parse(morseWallets.serialized);
            if (morseWallet.address && morseWallet.privateKey) {
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
                shannonAddress: shannonWallet.address // Usar shannonAddress en lugar de signingAccount
            };

            console.log('📡 Sending migration request to backend...');

            // Get backend URL from environment
            const backendUrl = import.meta.env.VITE_MIGRATION_API_URL || 'http://localhost:3001';

            // Send to backend endpoint
            const response = await fetch(`${backendUrl}/api/migration/migrate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(migrationData)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Migration failed: ${response.status} ${response.statusText}`);
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

                // Mostrar un error más específico si es un problema de conexión
                if (errorMessage.includes('connection refused') || errorMessage.includes('Post "http://localhost:26657"')) {
                    throw new Error('Cannot connect to local Pocket Network node. Please ensure the node is running on localhost:26657');
                } else if (errorMessage.includes('Usage:') || errorMessage.includes('claim-accounts')) {
                    throw new Error('Migration command error. Check backend configuration and pocketd command');
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
            <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl border border-gray-700/50 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                {/* Header */}
                <div className="relative p-8 border-b border-gray-700/50">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl flex items-center justify-center border border-blue-500/30">
                            <i className="fas fa-arrow-right text-blue-400"></i>
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white">Wallet Migration</h2>
                            <p className="text-gray-400 text-sm mt-1">Migrate your Morse wallet to Shannon network</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-700/50"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 space-y-8">
                    {/* Info Banner */}
                    <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-6">
                        <div className="flex items-center gap-3 mb-3">
                            <Info className="w-5 h-5 text-blue-400" />
                            <span className="font-semibold text-blue-300">Automatic Migration</span>
                        </div>
                        <p className="text-blue-200/80 text-sm leading-relaxed">
                            Select your Morse wallet to migrate and the Shannon wallet that will sign the transaction.
                            The process will be executed automatically on the backend.
                        </p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="bg-gradient-to-r from-red-500/10 to-red-600/10 border border-red-500/30 rounded-xl p-6">
                            <div className="flex items-center gap-3">
                                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                                <div>
                                    <p className="font-semibold text-red-300">Error</p>
                                    <p className="text-red-200/80 text-sm mt-1">{error}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Success Message */}
                    {successMessage && (
                        <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl p-6">
                            <div className="flex items-center gap-3">
                                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                                <div>
                                    <p className="font-semibold text-green-300">Success</p>
                                    <p className="text-green-200/80 text-sm mt-1">{successMessage}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {!migrationResult && (
                        <div className="grid md:grid-cols-1 gap-8">
                            {/* Morse Wallet Selection */}
                            <div className="bg-gradient-to-br from-orange-500/5 to-yellow-500/5 border border-orange-500/20 rounded-xl p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <Wallet className="w-5 h-5 text-orange-400" />
                                    <h3 className="font-semibold text-orange-300">Select Morse Wallet</h3>
                                </div>

                                {morseWallets.length > 0 ? (
                                    <>
                                        <select
                                            value={selectedMorseWallet}
                                            onChange={(e) => setSelectedMorseWallet(e.target.value)}
                                            className="w-full p-4 bg-gray-800/60 border border-gray-600/50 rounded-xl text-white focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 focus:outline-none transition-all"
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
                                            <div className="mt-3 p-3 bg-orange-500/5 rounded-lg border border-orange-500/20">
                                                <p className="text-xs text-orange-200/70 font-medium">Selected Address:</p>
                                                <p className="text-orange-300 font-mono text-sm break-all">
                                                    {morseWallets.find(w => w.id === selectedMorseWallet)?.address}
                                                </p>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-center space-y-4">
                                        <p className="text-orange-400/60 text-sm">No Morse wallets found</p>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={handleCreateMorseWallet}
                                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-600/20 to-yellow-600/20 border border-orange-500/30 rounded-lg text-orange-300 hover:from-orange-600/30 hover:to-yellow-600/30 hover:border-orange-500/50 transition-all duration-200"
                                            >
                                                <Plus className="w-4 h-4" />
                                                Create Morse
                                            </button>
                                            <button
                                                onClick={handleImportMorseWallet}
                                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-600/20 to-yellow-600/20 border border-orange-500/30 rounded-lg text-orange-300 hover:from-orange-600/30 hover:to-yellow-600/30 hover:border-orange-500/50 transition-all duration-200"
                                            >
                                                <Download className="w-4 h-4" />
                                                Import Morse
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Shannon Wallet Selection */}
                            <div className="bg-gradient-to-br from-blue-500/5 to-purple-500/5 border border-blue-500/20 rounded-xl p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <Wallet className="w-5 h-5 text-blue-400" />
                                    <h3 className="font-semibold text-blue-300">Select Shannon Wallet</h3>
                                </div>

                                {shannonWallets.length > 0 ? (
                                    <>
                                        <select
                                            value={selectedShannonWallet}
                                            onChange={(e) => setSelectedShannonWallet(e.target.value)}
                                            className="w-full p-4 bg-gray-800/60 border border-gray-600/50 rounded-xl text-white focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 focus:outline-none transition-all"
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
                                            <div className="mt-3 p-3 bg-blue-500/5 rounded-lg border border-blue-500/20">
                                                <p className="text-xs text-blue-200/70 font-medium">Selected Address:</p>
                                                <p className="text-blue-300 font-mono text-sm break-all">
                                                    {shannonWallets.find(w => w.id === selectedShannonWallet)?.address}
                                                </p>
                                            </div>
                                        )}
                                        <p className="text-blue-400/60 text-xs mt-3">
                                            This wallet must have funds to pay migration fees
                                        </p>
                                    </>
                                ) : (
                                    <div className="text-center space-y-4">
                                        <p className="text-blue-400/60 text-sm">No Shannon wallets found</p>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={handleCreateShannonWallet}
                                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-lg text-blue-300 hover:from-blue-600/30 hover:to-purple-600/30 hover:border-blue-500/50 transition-all duration-200"
                                            >
                                                <Plus className="w-4 h-4" />
                                                Create Shannon
                                            </button>
                                            <button
                                                onClick={handleImportShannonWallet}
                                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-lg text-blue-300 hover:from-blue-600/30 hover:to-purple-600/30 hover:border-blue-500/50 transition-all duration-200"
                                            >
                                                <Download className="w-4 h-4" />
                                                Import Shannon
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

                    {/* Migration Result */}
                    {migrationResult && (
                        <div className={`bg-gradient-to-br ${migrationResult.data?.result?.success !== false
                            ? 'from-green-500/5 to-emerald-500/5 border-green-500/20'
                            : 'from-red-500/5 to-red-600/5 border-red-500/20'
                            } border rounded-xl p-6`}>
                            <h3 className={`text-xl font-semibold mb-4 flex items-center gap-3 ${migrationResult.data?.result?.success !== false ? 'text-green-300' : 'text-red-300'
                                }`}>
                                {migrationResult.data?.result?.success !== false ? (
                                    <CheckCircle className="w-6 h-6" />
                                ) : (
                                    <AlertCircle className="w-6 h-6" />
                                )}
                                Migration Result
                            </h3>
                            <div className="space-y-4">
                                <div className="grid gap-4">
                                    <div className="p-4 bg-gray-800/40 rounded-lg border border-gray-700/50">
                                        <p className="text-sm text-gray-400 mb-1">Status</p>
                                        <p className={`font-medium ${migrationResult.data?.result?.success !== false ? 'text-green-400' : 'text-red-400'
                                            }`}>
                                            {migrationResult.data?.result?.success !== false ? 'Successful' : 'Failed'}
                                        </p>
                                    </div>

                                    {/* Mostrar información de sesión */}
                                    {migrationResult.data?.sessionId && (
                                        <div className="p-4 bg-gray-800/40 rounded-lg border border-gray-700/50">
                                            <p className="text-sm text-gray-400 mb-1">Session ID</p>
                                            <p className="text-blue-400 font-mono text-sm break-all">{migrationResult.data.sessionId}</p>
                                        </div>
                                    )}

                                    {/* Mostrar mensaje del resultado */}
                                    {migrationResult.data?.result?.message && (
                                        <div className="p-4 bg-gray-800/40 rounded-lg border border-gray-700/50">
                                            <p className="text-sm text-gray-400 mb-1">Message</p>
                                            <p className="text-white text-sm">{migrationResult.data.result.message}</p>
                                        </div>
                                    )}

                                    {/* Mostrar error si existe */}
                                    {migrationResult.data?.result?.error && (
                                        <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/30">
                                            <p className="text-sm text-red-400 mb-1">Error Details</p>
                                            <p className="text-red-300 text-sm break-all">{migrationResult.data.result.error}</p>
                                        </div>
                                    )}

                                    {/* Mostrar información de archivos generados */}
                                    {migrationResult.data?.result?.files?.input && (
                                        <div className="p-4 bg-gray-800/40 rounded-lg border border-gray-700/50">
                                            <p className="text-sm text-gray-400 mb-1">Input File Generated</p>
                                            <p className="text-gray-300 font-mono text-xs break-all">{migrationResult.data.result.files.input}</p>
                                        </div>
                                    )}

                                    {/* Información heredada para compatibilidad */}
                                    {migrationResult.newWallet && (
                                        <div className="p-4 bg-gray-800/40 rounded-lg border border-gray-700/50">
                                            <p className="text-sm text-gray-400 mb-1">New Shannon Address</p>
                                            <p className="text-green-400 font-mono text-sm break-all">{migrationResult.newWallet.address}</p>
                                        </div>
                                    )}
                                    {migrationResult.transactionHash && (
                                        <div className="p-4 bg-gray-800/40 rounded-lg border border-gray-700/50">
                                            <p className="text-sm text-gray-400 mb-1">Transaction Hash</p>
                                            <p className="text-blue-400 font-mono text-sm break-all">{migrationResult.transactionHash}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-4 pt-6 border-t border-gray-700/50">
                        <button
                            onClick={handleClose}
                            className="flex-1 px-6 py-3 bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 hover:text-white rounded-xl transition-all duration-200 font-medium"
                            disabled={isLoading}
                        >
                            {migrationResult ? 'Close' : 'Cancel'}
                        </button>

                        {!migrationResult && (
                            <button
                                onClick={handleMigration}
                                disabled={!selectedMorseWallet || !selectedShannonWallet || isLoading}
                                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-200 flex items-center justify-center gap-3 font-medium shadow-lg"
                            >
                                {isLoading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Migrating Wallet...
                                    </>
                                ) : (
                                    <>
                                        <ArrowRight className="w-5 h-5" />
                                        Start Migration
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