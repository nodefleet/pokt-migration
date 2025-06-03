import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IndividualImportProps, WalletImportResult } from '../types';
import { ERROR_MESSAGES } from '../controller/config';
import { NetworkType } from '../controller/WalletManager';
import { useNavigate } from 'react-router-dom';

const IndividualImport: React.FC<IndividualImportProps> = ({ onReturn, onWalletImport, onCreateWallet }) => {
    const [morseOpen, setMorseOpen] = useState(false);
    const [shannonOpen, setShannonOpen] = useState(false);
    const [morseInput, setMorseInput] = useState('');
    const [shannonInput, setShannonInput] = useState('');
    const [morsePassword, setMorsePassword] = useState('');
    const [shannonPassword, setShannonPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showMorseWarning, setShowMorseWarning] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [morseError, setMorseError] = useState('');
    const [morseLoading, setMorseLoading] = useState(false);
    const [showGuide, setShowGuide] = useState(false);

    const navigate = useNavigate();

    const toggleMorse = () => {
        setMorseOpen(!morseOpen);
        if (!morseOpen) setShannonOpen(false);
    };

    const toggleShannon = () => {
        setShannonOpen(!shannonOpen);
        if (!shannonOpen) setMorseOpen(false);
    };

    const handleMorseImport = async () => {
        if (!morseInput.trim()) {
            setMorseError('Please enter the Morse JSON keyfile or private key');
            return;
        }

        setMorseLoading(true);
        setMorseError('');
        setError('');

        try {
            console.log('🟡 Importing MORSE via main.tsx...');

            // Detectar si es JSON o clave privada
            const trimmedInput = morseInput.trim();
            let isJsonFormat = false;

            try {
                const parsed = JSON.parse(trimmedInput);
                if (parsed.addr && parsed.name && parsed.priv) {
                    isJsonFormat = true;
                    console.log('✅ Detected Morse JSON keyfile format');
                }
            } catch {
                console.log('📝 Detected private key format (not JSON)');
            }

            // Para JSON keyfiles, la contraseña puede ser opcional
            // Para claves privadas, usar contraseña por defecto si no se proporciona
            const passwordToUse = morsePassword.trim() || 'default';

            // Usar onWalletImport del main.tsx
            await onWalletImport(trimmedInput, passwordToUse, 'morse');

            console.log('✅ MORSE wallet imported successfully via main.tsx');
            setError('');
            setMorseError('');

        } catch (error: any) {
            console.error('❌ Error importing Morse wallet:', error);

            // Mensajes específicos para Morse en español
            if (error.message?.includes('JSON')) {
                setMorseError('Invalid JSON format. Ensure it has the fields addr, name and priv.');
            } else if (error.message?.includes('128 characters')) {
                setMorseError('Morse private key must be 128 hexadecimal characters');
            } else if (error.message?.includes('hex')) {
                setMorseError('Morse private key must be in hexadecimal format');
            } else if (error.message?.includes('Invalid')) {
                setMorseError('Invalid format. Use the complete JSON keyfile or the 128-character private key.');
            } else if (error.message?.includes('password')) {
                setMorseError('Error con la contraseña. Verifique que sea correcta.');
            } else {
                setMorseError('Error importing Morse wallet. Verify the format: complete JSON keyfile or hexadecimal private key.');
            }
        } finally {
            setMorseLoading(false);
        }
    };

    const handleShannonImport = async () => {
        setError(null);
        if (!shannonInput.trim()) {
            setError('Please enter a valid value: mnemonic, private key or JSON');
            return;
        }

        try {
            setLoading(true);
            // Usar onWalletImport del main.tsx en lugar del hook directo
            await onWalletImport(shannonInput, shannonPassword, 'shannon');
            console.log("Shannon Wallet imported successfully via main.tsx");
        } catch (error: any) {
            console.error('Error importing Shannon wallet:', error);
            setError(error.message || 'Error importing Shannon wallet');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateWallet = async (password: string) => {
        setError(null);
        if (!password) {
            setError('Please enter a password');
            return;
        }

        try {
            setLoading(true);
            // Usar onCreateWallet del main.tsx en lugar del hook directo
            await onCreateWallet(password, 'shannon');
            console.log("Shannon Wallet created successfully via main.tsx");
        } catch (error: any) {
            console.error('Error creating Shannon wallet:', error);
            setError(error.message || 'Error creating Shannon wallet');
        } finally {
            setLoading(false);
        }
    };

    const containerVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.4,
                ease: "easeOut"
            }
        }
    };

    const dropdownVariants = {
        hidden: {
            opacity: 0,
            scaleY: 0,
            transformOrigin: "top"
        },
        visible: {
            opacity: 1,
            scaleY: 1,
            transition: {
                duration: 0.2,
                ease: "easeOut"
            }
        },
        exit: {
            opacity: 0,
            scaleY: 0,
            transition: {
                duration: 0.2,
                ease: "easeIn"
            }
        }
    };

    const contentVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                duration: 0.2,
                delay: 0.1
            }
        }
    };

    return (
        <motion.div
            className="max-w-xl mx-auto p-6 w-screen rounded-2xl bg-gradient-to-b from-gray-900 to-black shadow-2xl"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            layout
        >
            <motion.h1
                className="text-4xl font-bold mb-6 text-center bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent"
                layout
            >
                Individual Import
            </motion.h1>
            <motion.p
                className="text-blue-400 mb-8 text-center text-lg"
                layout
            >
                Select a network to import your wallet
            </motion.p>

            {/* Morse Red Warning Banner */}
            {showMorseWarning && (
                <motion.div
                    className="mb-6 bg-yellow-900/50 text-yellow-300 p-4 rounded-xl border border-yellow-700/50 flex items-start"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    <i className="fas fa-exclamation-triangle text-yellow-400 text-xl mr-4 mt-1"></i>
                    <div>
                        <h3 className="font-semibold mb-1">Red Morse en Migración</h3>
                        <p className="text-sm">
                            {ERROR_MESSAGES.MORSE_DEPRECATED}
                        </p>
                        <p className="text-sm mt-2">
                            Recomend select Shannon for new wallets or migrate your Morse funds to Shannon.
                        </p>
                    </div>
                </motion.div>
            )}

            <motion.div className="space-y-6" layout>
                {/* Morse Section */}
                <motion.div className="relative" layout>
                    <motion.button
                        className={`w-full p-4 rounded-xl border-2 ${morseOpen ? 'border-yellow-500 bg-yellow-500/10' : 'border-yellow-400/30 hover:border-yellow-400'
                            } transition-colors duration-300 flex justify-between items-center group`}
                        onClick={toggleMorse}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        layout
                    >
                        <span className="text-xl font-semibold text-yellow-400 group-hover:text-yellow-300">
                            <i className="fas fa-bolt mr-2"></i>
                            Morse
                            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-yellow-900/70 text-yellow-300 border border-yellow-700/50">
                                In migration
                            </span>
                        </span>
                        <motion.span
                            animate={{ rotate: morseOpen ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            ▼
                        </motion.span>
                    </motion.button>

                    <AnimatePresence mode="wait">
                        {morseOpen && (
                            <motion.div
                                className="overflow-hidden"
                                variants={dropdownVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                layout
                            >
                                <motion.div
                                    className="mt-4 p-4 rounded-xl bg-gray-900/50"
                                    variants={contentVariants}
                                >
                                    <div className="space-y-4">
                                        <p className="text-sm text-gray-400">
                                            Import your Morse wallet using JSON keyfile or private key:
                                        </p>

                                        {/* Input para cargar archivo */}
                                        <div className="space-y-2">
                                            <label className="block text-sm text-gray-300">
                                                <i className="fas fa-file-upload mr-2"></i>
                                                Load JSON keyfile:
                                            </label>
                                            <input
                                                type="file"
                                                accept=".json,.txt"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        const reader = new FileReader();
                                                        reader.onload = (event) => {
                                                            const content = event.target?.result as string;
                                                            setMorseInput(content);
                                                        };
                                                        reader.readAsText(file);
                                                    }
                                                }}
                                                className="w-full px-3 py-2 text-sm rounded-lg bg-gray-800 border border-gray-600 text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                                                disabled={morseLoading}
                                            />
                                        </div>

                                        {/* Separador */}
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 h-px bg-gray-600"></div>
                                            <span className="text-xs text-gray-400">O</span>
                                            <div className="flex-1 h-px bg-gray-600"></div>
                                        </div>

                                        {/* Textarea para pegar JSON/clave */}
                                        <div className="space-y-2">
                                            <label className="block text-sm text-gray-300">
                                                <i className="fas fa-paste mr-2"></i>
                                                Paste JSON keyfile or private key:
                                            </label>
                                            <motion.textarea
                                                placeholder='Paste your complete JSON keyfile here:
{
  "addr": "...",
  "name": "...",
  "priv": "...",
  "pass": ""
}

O solo la clave privada hex (128 caracteres)'
                                                className="w-full px-4 py-3 rounded-xl bg-black border-2 border-gray-700 focus:border-blue-500 focus:outline-none text-white placeholder-gray-500 transition-colors duration-300 resize-none min-h-[120px] text-sm font-mono"
                                                value={morseInput}
                                                onChange={(e) => setMorseInput(e.target.value)}
                                                onFocus={() => setShowMorseWarning(true)}
                                                disabled={morseLoading}
                                                whileFocus={{ scale: 1.01 }}
                                            />
                                        </div>

                                        <motion.input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="Password (only if required by the keyfile)"
                                            className="w-full px-4 py-3 rounded-xl bg-black border-2 border-gray-700 focus:border-blue-500 focus:outline-none text-white placeholder-gray-500 transition-colors duration-300"
                                            value={morsePassword}
                                            onChange={(e) => setMorsePassword(e.target.value)}
                                            disabled={morseLoading}
                                            whileFocus={{ scale: 1.01 }}
                                        />

                                        <motion.button
                                            className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-500 hover:to-yellow-600 text-white font-medium transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                            onClick={handleMorseImport}
                                            disabled={!morseInput || morseLoading}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onFocus={() => setShowMorseWarning(true)}
                                        >
                                            {morseLoading ? (
                                                <>
                                                    <i className="fas fa-spinner fa-spin"></i>
                                                    Importando...
                                                </>
                                            ) : (
                                                <>
                                                    <i className="fas fa-download"></i>
                                                    Import Morse Wallet
                                                </>
                                            )}
                                        </motion.button>

                                        {morseError && (
                                            <motion.p
                                                className="text-red-400 text-sm mt-2"
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                            >
                                                {morseError}
                                            </motion.p>
                                        )}
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>

                {/* Shannon Section */}
                <motion.div className="relative" layout>
                    <motion.button
                        className={`w-full p-4 rounded-xl border-2 ${shannonOpen ? 'border-purple-500 bg-purple-500/10' : 'border-purple-400/30 hover:border-purple-400'
                            } transition-colors duration-300 flex justify-between items-center group`}
                        onClick={toggleShannon}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        layout
                    >
                        <span className="text-xl font-semibold text-purple-400 group-hover:text-purple-300">
                            <i className="fas fa-network-wired mr-2"></i>
                            Shannon
                            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-green-900/70 text-green-300 border border-green-700/50">
                                Recommended
                            </span>
                        </span>
                        <motion.span
                            animate={{ rotate: shannonOpen ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            ▼
                        </motion.span>
                    </motion.button>

                    <AnimatePresence mode="wait">
                        {shannonOpen && (
                            <motion.div
                                className="overflow-hidden"
                                variants={dropdownVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                layout
                            >
                                <motion.div
                                    className="mt-4 p-4 rounded-xl bg-gray-900/50"
                                    variants={contentVariants}
                                >
                                    <div className="space-y-4">
                                        <p className="text-sm text-gray-400">
                                            Import your Shannon wallet using mnemonic, private key, or JSON:
                                        </p>

                                        {/* Input para cargar archivo */}
                                        <div className="space-y-2">
                                            <label className="block text-sm text-gray-300">
                                                <i className="fas fa-file-upload mr-2"></i>
                                                Load JSON keyfile:
                                            </label>
                                            <input
                                                type="file"
                                                accept=".json,.txt"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        const reader = new FileReader();
                                                        reader.onload = (event) => {
                                                            const content = event.target?.result as string;
                                                            setShannonInput(content);
                                                        };
                                                        reader.readAsText(file);
                                                    }
                                                }}
                                                className="w-full px-3 py-2 text-sm rounded-lg bg-gray-800 border border-gray-600 text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                                                disabled={loading}
                                            />
                                        </div>

                                        {/* Separador */}
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 h-px bg-gray-600"></div>
                                            <span className="text-xs text-gray-400">O</span>
                                            <div className="flex-1 h-px bg-gray-600"></div>
                                        </div>

                                        {/* Textarea para pegar mnemónico/JSON/clave */}
                                        <div className="space-y-2">
                                            <label className="block text-sm text-gray-300">
                                                <i className="fas fa-paste mr-2"></i>
                                                Paste mnemonic or JSON:
                                            </label>
                                            <motion.textarea
                                                placeholder='Options:

1. Mnemonic (12 or 24 words):
word1 word2 word3 ... word24

2. JSON keyfile:
{
  "type": "...",
  "value": "..."
}'
                                                className="w-full px-4 py-3 rounded-xl bg-black border-2 border-gray-700 focus:border-blue-500 focus:outline-none text-white placeholder-gray-500 transition-colors duration-300 resize-none min-h-[120px] text-sm font-mono"
                                                value={shannonInput}
                                                onChange={(e) => setShannonInput(e.target.value)}
                                                disabled={loading}
                                                whileFocus={{ scale: 1.01 }}
                                            />
                                        </div>

                                        <motion.input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="Password (required for private key or keyfile)"
                                            className="w-full px-4 py-3 rounded-xl bg-black border-2 border-gray-700 focus:border-blue-500 focus:outline-none text-white placeholder-gray-500 transition-colors duration-300"
                                            value={shannonPassword}
                                            onChange={(e) => setShannonPassword(e.target.value)}
                                            disabled={loading}
                                            whileFocus={{ scale: 1.01 }}
                                        />

                                        <motion.button
                                            className={`w-full py-3 rounded-xl font-medium transition-all duration-200 ${loading
                                                ? 'bg-gray-600 cursor-not-allowed'
                                                : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:shadow-blue-500/20 hover:shadow-lg active:scale-95'
                                                }`}
                                            onClick={handleShannonImport}
                                            disabled={loading}
                                            whileHover={loading ? {} : { scale: 1.02 }}
                                            whileTap={loading ? {} : { scale: 0.98 }}
                                        >
                                            {loading ? (
                                                <div className="flex items-center justify-center space-x-2">
                                                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                                                    <span>Importing...</span>
                                                </div>
                                            ) : (
                                                'Import Wallet Shannon'
                                            )}
                                        </motion.button>

                                        {error && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-400 text-sm"
                                            >
                                                {error}
                                            </motion.div>
                                        )}

                                        <motion.button
                                            className={`w-full py-3 rounded-xl font-medium transition-all duration-200 ${loading
                                                ? 'bg-gray-600 cursor-not-allowed'
                                                : 'bg-gradient-to-r from-green-600 to-green-700 hover:shadow-green-500/20 hover:shadow-lg active:scale-95'
                                                }`}
                                            onClick={() => handleCreateWallet(shannonPassword)}
                                            disabled={loading}
                                            whileHover={loading ? {} : { scale: 1.02 }}
                                            whileTap={loading ? {} : { scale: 0.98 }}
                                        >
                                            {loading ? (
                                                <div className="flex items-center justify-center space-x-2">
                                                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                                                    <span>Creating...</span>
                                                </div>
                                            ) : (
                                                'Create New Shannon Wallet'
                                            )}
                                        </motion.button>
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </motion.div>

            <motion.div className="mt-8 text-center">
                <p className="text-gray-400 mb-3">Need help with migration?</p>
                <motion.button
                    className="px-6 py-3 bg-gradient-to-r from-purple-600/70 to-blue-600/70 rounded-xl text-white hover:from-purple-500/70 hover:to-blue-500/70"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowGuide(true)}
                >
                    <i className="fas fa-exchange-alt mr-2"></i>
                    Guide of migration Morse to Shannon
                </motion.button>
            </motion.div>

            <motion.button
                className="mt-8 mx-auto px-8 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium transition-colors duration-300 flex items-center space-x-2"
                onClick={onReturn}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                layout
            >
                <i className="fas fa-arrow-left"></i>
                <span>Return</span>
            </motion.button>

            {/* Migration Guide Modal */}
            <AnimatePresence>
                {showGuide && (
                    <motion.div
                        className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowGuide(false)}
                    >
                        <motion.div
                            className="relative bg-gradient-to-b from-gray-900 to-black p-8 rounded-2xl border-2 border-purple-500/70 max-w-3xl max-h-[85vh] overflow-y-auto shadow-xl shadow-purple-500/20"
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-purple-600/20 to-transparent rounded-t-2xl pointer-events-none"></div>

                            <h2 className="text-3xl font-bold text-center bg-gradient-to-r from-purple-400 via-blue-400 to-purple-400 bg-clip-text text-transparent mb-6">
                                Migration Guide: Morse to Shannon
                            </h2>

                            <div className="space-y-8 text-gray-300">
                                <motion.div
                                    className="p-5 bg-gradient-to-br from-gray-800/80 to-gray-900/80 rounded-xl border border-purple-500/30 shadow-lg"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 }}
                                >
                                    <h3 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400 mb-3 flex items-center">
                                        <span className="bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white w-8 h-8 rounded-full inline-flex items-center justify-center mr-3 shadow-md">1</span>
                                        Import your wallets
                                    </h3>
                                    <div className="space-y-5 pl-11">
                                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                                            <h4 className="text-lg font-medium text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-amber-400 mb-2 flex items-center">
                                                <i className="fas fa-bolt mr-2 text-yellow-400"></i>
                                                For Morse wallet:
                                            </h4>
                                            <ol className="list-decimal pl-5 space-y-2 text-sm">
                                                <li>Click on <span className="font-semibold text-yellow-300">Morse</span> dropdown above</li>
                                                <li>Upload your JSON keyfile or paste your private key</li>
                                                <li>Enter your password if required</li>
                                                <li>Click <span className="font-semibold text-yellow-300">Import Morse Wallet</span></li>
                                            </ol>
                                        </motion.div>

                                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                                            <h4 className="text-lg font-medium text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-purple-400 mb-2 flex items-center">
                                                <i className="fas fa-network-wired mr-2 text-purple-400"></i>
                                                For Shannon wallet:
                                            </h4>
                                            <ol className="list-decimal pl-5 space-y-2 text-sm">
                                                <li>Click on <span className="font-semibold text-purple-300">Shannon</span> dropdown above</li>
                                                <li>Upload your JSON keyfile or paste your mnemonic</li>
                                                <li>Enter your password if required</li>
                                                <li>Click <span className="font-semibold text-purple-300">Import Wallet Shannon</span></li>
                                            </ol>
                                        </motion.div>

                                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                                            <h4 className="text-lg font-medium text-transparent bg-clip-text bg-gradient-to-r from-green-300 to-green-400 mb-2 flex items-center">
                                                <i className="fas fa-plus-circle mr-2 text-green-400"></i>
                                                Or create a new Shannon wallet:
                                            </h4>
                                            <ol className="list-decimal pl-5 space-y-2 text-sm">
                                                <li>Click on <span className="font-semibold text-purple-300">Shannon</span> dropdown above</li>
                                                <li>Enter a password for your new wallet</li>
                                                <li>Click <span className="font-semibold text-green-300">Create New Shannon Wallet</span></li>
                                            </ol>
                                        </motion.div>
                                    </div>
                                </motion.div>

                                <motion.div
                                    className="p-5 bg-gradient-to-br from-gray-800/80 to-gray-900/80 rounded-xl border border-purple-500/30 shadow-lg"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                >
                                    <h3 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400 mb-3 flex items-center">
                                        <span className="bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white w-8 h-8 rounded-full inline-flex items-center justify-center mr-3 shadow-md">2</span>
                                        Start the migration process
                                    </h3>
                                    <div className="space-y-4 pl-11 text-sm">
                                        <p className="text-blue-100 italic">Once you have imported both wallets (Morse and Shannon), follow these steps:</p>
                                        <ol className="list-decimal pl-5 space-y-3 text-gray-200">
                                            <li>Go to the dashboard and click on <span className="font-semibold text-blue-300">Migration</span> in the main menu</li>
                                            <li>Select your <span className="font-semibold text-yellow-300">Morse wallet</span> as the source wallet</li>
                                            <li>Select your <span className="font-semibold text-purple-300">Shannon wallet</span> as the destination wallet</li>
                                            <li>Review the migration details and confirm</li>
                                            <li>Sign the transaction using your Morse wallet password</li>
                                            <li>Wait for the migration to complete - this can take several minutes</li>
                                            <li>Verify your funds in the Shannon wallet after completion</li>
                                        </ol>
                                        <div className="mt-5 bg-gradient-to-r from-yellow-900/40 to-amber-900/40 p-4 rounded-lg border border-yellow-700/50">
                                            <p className="text-yellow-200 flex items-start text-sm">
                                                <i className="fas fa-exclamation-triangle text-yellow-300 text-lg mr-3 mt-0.5"></i>
                                                <span>Remember that migration is a <span className="font-semibold">one-way process</span>. Once your funds are transferred to Shannon, they cannot be moved back to Morse. The Morse network is being phased out.</span>
                                            </p>
                                        </div>
                                    </div>
                                </motion.div>

                                <motion.div
                                    className="p-5 bg-gradient-to-br from-gray-800/80 to-gray-900/80 rounded-xl border border-purple-500/30 shadow-lg"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                >
                                    <h3 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400 mb-3 flex items-center">
                                        <span className="bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white w-8 h-8 rounded-full inline-flex items-center justify-center mr-3 shadow-md">3</span>
                                        After migration
                                    </h3>
                                    <div className="space-y-4 pl-11 text-sm">
                                        <p className="text-blue-100 italic">After a successful migration:</p>
                                        <ul className="space-y-3 text-gray-200">
                                            <li className="flex items-start">
                                                <i className="fas fa-check-circle text-green-400 mr-2 mt-1"></i>
                                                Your Shannon wallet now contains your migrated POKT tokens
                                            </li>
                                            <li className="flex items-start">
                                                <i className="fas fa-check-circle text-green-400 mr-2 mt-1"></i>
                                                You can stake, send, and manage your POKT using the Shannon network
                                            </li>
                                            <li className="flex items-start">
                                                <i className="fas fa-check-circle text-green-400 mr-2 mt-1"></i>
                                                Make sure to back up your Shannon wallet information (mnemonic and/or keyfile)
                                            </li>
                                            <li className="flex items-start">
                                                <i className="fas fa-check-circle text-green-400 mr-2 mt-1"></i>
                                                Consider using a hardware wallet for additional security
                                            </li>
                                        </ul>
                                    </div>
                                </motion.div>
                            </div>

                            <div className="mt-8 flex justify-center relative z-10">
                                <motion.button
                                    className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl text-white font-medium shadow-lg shadow-purple-500/30"
                                    onClick={() => setShowGuide(false)}
                                    whileHover={{ scale: 1.05, boxShadow: "0 10px 25px -5px rgba(168, 85, 247, 0.4)" }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    Close Guide
                                </motion.button>
                            </div>

                            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-purple-600/10 to-transparent rounded-b-2xl pointer-events-none"></div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default IndividualImport;