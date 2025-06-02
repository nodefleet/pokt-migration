import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { WalletService } from '../controller/WalletService';

interface WalletMigrationProps {
    walletService: WalletService;
    onClose: () => void;
    onSuccess: () => void;
}

const WalletMigration: React.FC<WalletMigrationProps> = ({
    walletService,
    onClose,
    onSuccess
}) => {
    const [step, setStep] = useState<number>(1);
    const [morseAddress, setMorseAddress] = useState<string>('');
    const [morsePassword, setMorsePassword] = useState<string>('');
    const [morseImportCode, setMorseImportCode] = useState<string>('');
    const [shannonAddress, setShannonAddress] = useState<string>('');
    const [shannonPassword, setShannonPassword] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<boolean>(false);

    const handleImportMorseWallet = async () => {
        try {
            setIsProcessing(true);
            setError(null);

            // Intentar importar wallet de Morse
            const morseWalletInfo = await walletService.importWallet(
                morseImportCode,
                morsePassword,
                'morse',
                false // testnet para este ejemplo
            );

            setMorseAddress(morseWalletInfo.address);
            setStep(2);
        } catch (error) {
            setError(`Error importando wallet de Morse: ${error}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCreateShannonWallet = async () => {
        try {
            setIsProcessing(true);
            setError(null);

            // Crear una nueva wallet en Shannon
            const shannonWalletInfo = await walletService.createWallet(
                shannonPassword,
                'shannon',
                false // testnet para este ejemplo
            );

            setShannonAddress(shannonWalletInfo.address);
            setStep(3);
        } catch (error) {
            setError(`Error creando wallet de Shannon: ${error}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleMigrateWallet = async () => {
        try {
            setIsProcessing(true);
            setError(null);

            // Realizar la migración
            const migrationSuccess = await walletService.migrateFromMorseToShannon(
                morseAddress,
                shannonAddress
            );

            if (migrationSuccess) {
                setSuccess(true);
                setStep(4);
            } else {
                setError('La migración no se ha completado correctamente.');
            }
        } catch (error) {
            setError(`Error durante la migración: ${error}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFinish = () => {
        onSuccess();
        onClose();
    };

    return (
        <motion.div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <motion.div
                className="bg-gray-900 rounded-2xl border border-gray-800/50 shadow-xl w-full max-w-md"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
            >
                <div className="p-6 border-b border-gray-800/50">
                    <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-semibold text-blue-300">
                            Migración de Morse a Shannon
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-gray-500 hover:text-gray-300 transition-colors"
                            disabled={isProcessing}
                        >
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                </div>

                <div className="p-6">
                    {/* Barra de progreso */}
                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-2">
                            {[1, 2, 3, 4].map(stepNumber => (
                                <div
                                    key={stepNumber}
                                    className={`w-10 h-10 rounded-full flex items-center justify-center ${stepNumber === step
                                        ? 'bg-blue-600 text-white'
                                        : stepNumber < step
                                            ? 'bg-green-600 text-white'
                                            : 'bg-gray-700 text-gray-400'
                                        }`}
                                >
                                    {stepNumber < step ? (
                                        <i className="fas fa-check"></i>
                                    ) : (
                                        stepNumber
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="h-1 bg-gray-700 relative">
                            <div
                                className="absolute top-0 left-0 h-full bg-blue-600"
                                style={{ width: `${((step - 1) / 3) * 100}%` }}
                            ></div>
                        </div>
                    </div>

                    {/* Paso 1: Importar Wallet Morse */}
                    {step === 1 && (
                        <div>
                            <h3 className="text-xl font-medium mb-4 text-white">
                                Paso 1: Importar Wallet Morse
                            </h3>
                            <p className="text-gray-400 mb-6">
                                Ingresa la información de tu wallet de Morse para comenzar el proceso de migración.
                            </p>

                            <div className="mb-4">
                                <label className="block text-gray-400 mb-2">
                                    Código de Importación (Mnemónico/Private Key)
                                </label>
                                <textarea
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white"
                                    rows={3}
                                    value={morseImportCode}
                                    onChange={e => setMorseImportCode(e.target.value)}
                                    placeholder="word1 word2 word3..."
                                    disabled={isProcessing}
                                ></textarea>
                            </div>

                            <div className="mb-6">
                                <label className="block text-gray-400 mb-2">
                                    Contraseña
                                </label>
                                <input
                                    type="password"
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white"
                                    value={morsePassword}
                                    onChange={e => setMorsePassword(e.target.value)}
                                    disabled={isProcessing}
                                />
                            </div>

                            {error && (
                                <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
                                    {error}
                                </div>
                            )}

                            <div className="flex justify-between">
                                <button
                                    onClick={onClose}
                                    className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                                    disabled={isProcessing}
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleImportMorseWallet}
                                    className={`px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center ${isProcessing ? 'opacity-70 cursor-not-allowed' : ''
                                        }`}
                                    disabled={isProcessing || !morseImportCode || !morsePassword}
                                >
                                    {isProcessing && (
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    )}
                                    Siguiente
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Paso 2: Crear Wallet Shannon */}
                    {step === 2 && (
                        <div>
                            <h3 className="text-xl font-medium mb-4 text-white">
                                Paso 2: Crear Wallet Shannon
                            </h3>
                            <p className="text-gray-400 mb-6">
                                Ahora crearemos una nueva wallet en la red Shannon.
                            </p>

                            <div className="mb-6">
                                <label className="block text-gray-400 mb-2">
                                    Contraseña para la nueva wallet
                                </label>
                                <input
                                    type="password"
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white"
                                    value={shannonPassword}
                                    onChange={e => setShannonPassword(e.target.value)}
                                    disabled={isProcessing}
                                />
                            </div>

                            {error && (
                                <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
                                    {error}
                                </div>
                            )}

                            <div className="flex justify-between">
                                <button
                                    onClick={() => setStep(1)}
                                    className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                                    disabled={isProcessing}
                                >
                                    Atrás
                                </button>
                                <button
                                    onClick={handleCreateShannonWallet}
                                    className={`px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center ${isProcessing ? 'opacity-70 cursor-not-allowed' : ''
                                        }`}
                                    disabled={isProcessing || !shannonPassword}
                                >
                                    {isProcessing && (
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    )}
                                    Siguiente
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Paso 3: Confirmar y Migrar */}
                    {step === 3 && (
                        <div>
                            <h3 className="text-xl font-medium mb-4 text-white">
                                Paso 3: Confirmar y Migrar
                            </h3>
                            <p className="text-gray-400 mb-6">
                                Revisa la información y confirma para iniciar la migración.
                            </p>

                            <div className="mb-4 p-4 bg-gray-800/50 rounded-lg">
                                <h4 className="text-gray-300 mb-2">Wallet de Morse</h4>
                                <p className="text-sm font-mono text-gray-400 break-all">{morseAddress}</p>
                            </div>

                            <div className="mb-6 p-4 bg-gray-800/50 rounded-lg">
                                <h4 className="text-gray-300 mb-2">Nueva Wallet de Shannon</h4>
                                <p className="text-sm font-mono text-gray-400 break-all">{shannonAddress}</p>
                            </div>

                            {error && (
                                <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
                                    {error}
                                </div>
                            )}

                            <div className="flex justify-between">
                                <button
                                    onClick={() => setStep(2)}
                                    className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                                    disabled={isProcessing}
                                >
                                    Atrás
                                </button>
                                <button
                                    onClick={handleMigrateWallet}
                                    className={`px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center ${isProcessing ? 'opacity-70 cursor-not-allowed' : ''
                                        }`}
                                    disabled={isProcessing}
                                >
                                    {isProcessing && (
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    )}
                                    Iniciar Migración
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Paso 4: Resultado */}
                    {step === 4 && (
                        <div>
                            <div className="text-center mb-6">
                                {success ? (
                                    <div>
                                        <div className="mb-4 flex justify-center">
                                            <div className="w-16 h-16 rounded-full bg-green-600/30 flex items-center justify-center">
                                                <i className="fas fa-check text-2xl text-green-400"></i>
                                            </div>
                                        </div>
                                        <h3 className="text-xl font-medium text-green-400 mb-2">
                                            Migración Exitosa
                                        </h3>
                                        <p className="text-gray-400">
                                            Tus fondos han sido migrados correctamente de Morse a Shannon.
                                        </p>
                                    </div>
                                ) : (
                                    <div>
                                        <div className="mb-4 flex justify-center">
                                            <div className="w-16 h-16 rounded-full bg-red-600/30 flex items-center justify-center">
                                                <i className="fas fa-times text-2xl text-red-400"></i>
                                            </div>
                                        </div>
                                        <h3 className="text-xl font-medium text-red-400 mb-2">
                                            Error en la Migración
                                        </h3>
                                        <p className="text-gray-400">
                                            {error || 'Hubo un problema durante el proceso de migración.'}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={handleFinish}
                                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                            >
                                Finalizar
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
};

export default WalletMigration;