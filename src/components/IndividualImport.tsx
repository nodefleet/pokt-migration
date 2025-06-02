import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IndividualImportProps, WalletImportResult } from '../types';
import { ERROR_MESSAGES } from '../controller/config';
import { NetworkType } from '../controller/WalletManager';
import { useNavigate } from 'react-router-dom';

const IndividualImport: React.FC<IndividualImportProps> = ({ onReturn, onWalletImport, onCreateWallet }) => {
    const [keyfileOpen, setKeyfileOpen] = useState(false);
    const [privateKeyOpen, setPrivateKeyOpen] = useState(false);
    const [morseInput, setMorseInput] = useState('');
    const [shannonInput, setShannonInput] = useState('');
    const [morsePassword, setMorsePassword] = useState('');
    const [shannonPassword, setShannonPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showMorseWarning, setShowMorseWarning] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('shannon');
    const [keyFileInput, setKeyFileInput] = useState('');
    const [privateKeyInput, setPrivateKeyInput] = useState('');
    const [password, setPassword] = useState('');
    const [morseError, setMorseError] = useState('');
    const [morseLoading, setMorseLoading] = useState(false);

    const navigate = useNavigate();

    const toggleKeyfile = () => {
        setKeyfileOpen(!keyfileOpen);
        if (!keyfileOpen) setPrivateKeyOpen(false);
    };

    const togglePrivateKey = () => {
        setPrivateKeyOpen(!privateKeyOpen);
        if (!privateKeyOpen) setKeyfileOpen(false);
    };

    const handleMorseImport = async () => {
        if (!morseInput.trim() || !morsePassword.trim()) {
            setMorseError('Por favor ingrese la clave privada de Morse y contraseña');
            return;
        }

        setMorseLoading(true);
        setMorseError('');
        setError('');

        try {
            console.log('🟡 Importing MORSE via main.tsx...');

            // Usar onWalletImport del main.tsx en lugar del servicio directo
            await onWalletImport(morseInput.trim(), morsePassword, 'morse');

            console.log('✅ MORSE wallet imported successfully via main.tsx');
            setError('');
            setMorseError('');

        } catch (error: any) {
            console.error('❌ Error importing Morse wallet:', error);

            // Mensajes específicos para Morse en español
            if (error.message?.includes('128 characters')) {
                setMorseError('La clave privada de Morse debe tener 128 caracteres hexadecimales');
            } else if (error.message?.includes('hex')) {
                setMorseError('La clave privada de Morse debe estar en formato hexadecimal');
            } else if (error.message?.includes('Invalid')) {
                setMorseError('Clave privada de Morse inválida. Verifique el formato.');
            } else if (error.message?.includes('password')) {
                setMorseError('Error con la contraseña. Verifique que sea correcta.');
            } else {
                setMorseError('Error al importar wallet de Morse. Verifique los datos ingresados.');
            }
        } finally {
            setMorseLoading(false);
        }
    };

    const handleShannonImport = async () => {
        setError(null);
        if (!shannonInput.trim()) {
            setError('Por favor ingrese una frase mnemónica válida');
            return;
        }
        const words = shannonInput.trim().split(/\s+/);
        if (words.length !== 12 && words.length !== 24) {
            setError(`La frase mnemónica debe tener exactamente 12 o 24 palabras. Tiene ${words.length} palabras.`);
            return;
        }

        try {
            setLoading(true);
            // Usar onWalletImport del main.tsx en lugar del hook directo
            await onWalletImport(shannonInput, shannonPassword, 'shannon');
            console.log("Shannon Wallet importada exitosamente via main.tsx");
        } catch (error: any) {
            console.error('Error importing Shannon wallet:', error);
            setError(error.message || 'Error al importar la wallet de Shannon');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateWallet = async (password: string) => {
        setError(null);
        if (!password) {
            setError('Por favor ingrese una contraseña');
            return;
        }

        try {
            setLoading(true);
            // Usar onCreateWallet del main.tsx en lugar del hook directo
            await onCreateWallet(password, 'shannon');
            console.log("Shannon Wallet creada exitosamente via main.tsx");
        } catch (error: any) {
            console.error('Error creating Shannon wallet:', error);
            setError(error.message || 'Error al crear la wallet de Shannon');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectMorse = () => {
        setShowMorseWarning(true);
    };

    const handleKeyFileImport = async () => {
        setError(null);
        if (!keyFileInput.trim() || !password.trim()) {
            setError('Por favor ingrese el contenido del archivo de claves y la contraseña para Morse.');
            return;
        }

        setMorseLoading(true);
        console.log('[IndividualImport] Iniciando importación desde key file');

        try {
            await onWalletImport(keyFileInput.trim(), password, 'morse');
            console.log('[IndividualImport] Importación desde key file exitosa');
        } catch (err: any) {
            console.error('[IndividualImport] Error en importación desde key file:', err);
            if (err.message?.includes('Invalid private key')) {
                setError('El formato del archivo de claves no es válido. Verifique que sea un archivo JSON de Morse válido.');
            } else if (err.message?.includes('password')) {
                setError('Contraseña incorrecta. Por favor verifique la contraseña.');
            } else {
                setError(err.message || 'Error al importar el archivo de claves. Verifique el formato y la contraseña.');
            }
        } finally {
            setMorseLoading(false);
        }
    };

    const handlePrivateKeyImport = async () => {
        setError(null);
        if (!privateKeyInput.trim() || !password.trim()) {
            setError('Por favor ingrese la clave privada y la contraseña');
            return;
        }

        setMorseLoading(true);
        console.log('[IndividualImport] Iniciando importación desde clave privada');

        try {
            await onWalletImport(privateKeyInput.trim(), password, 'morse');
            console.log('[IndividualImport] Importación desde clave privada exitosa');
        } catch (err: any) {
            console.error('[IndividualImport] Error en importación desde clave privada:', err);
            if (err.message?.includes('Invalid private key')) {
                setError('El formato de la clave privada no es válido. Debe ser un JSON de Morse o una clave hexadecimal.');
            } else if (err.message?.includes('password')) {
                setError('Contraseña incorrecta. Por favor verifique la contraseña.');
            } else {
                setError(err.message || 'Error al importar la clave privada. Verifique el formato y la contraseña.');
            }
        } finally {
            setMorseLoading(false);
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
            className="max-w-4xl mx-auto p-6 rounded-2xl bg-gradient-to-b from-gray-900 to-black shadow-2xl"
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
                Select a method to access your account
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
                {/* Key File Section */}
                <motion.div className="relative" layout>
                    <motion.button
                        className={`w-full p-4 rounded-xl border-2 ${keyfileOpen ? 'border-blue-500 bg-blue-500/10' : 'border-blue-400/30 hover:border-blue-400'
                            } transition-colors duration-300 flex justify-between items-center group`}
                        onClick={toggleKeyfile}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        layout
                    >
                        <span className="text-xl font-semibold text-blue-400 group-hover:text-blue-300">Key File</span>
                        <motion.span
                            animate={{ rotate: keyfileOpen ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            ▼
                        </motion.span>
                    </motion.button>

                    <AnimatePresence mode="wait">
                        {keyfileOpen && (
                            <motion.div
                                className="overflow-hidden"
                                variants={dropdownVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                layout
                            >
                                <motion.div
                                    className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-xl bg-gray-900/50"
                                    variants={contentVariants}
                                >
                                    {/* Morse Section */}
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-medium flex items-center gap-2">
                                            <i className="fas fa-bolt text-yellow-400"></i>
                                            <span className="text-gray-300">Morse</span>
                                            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-yellow-900/70 text-yellow-300 border border-yellow-700/50">
                                                En migración
                                            </span>
                                        </h3>
                                        <motion.input
                                            type="text"
                                            placeholder="Enter Morse code or private key"
                                            className="w-full px-4 py-3 rounded-xl bg-black border-2 border-gray-700 focus:border-blue-500 focus:outline-none text-white placeholder-gray-500 transition-colors duration-300"
                                            value={morseInput}
                                            onChange={(e) => setMorseInput(e.target.value)}
                                            onFocus={handleSelectMorse}
                                            disabled={morseLoading}
                                            whileFocus={{ scale: 1.01 }}
                                        />
                                        <motion.input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="Enter password"
                                            className="w-full px-4 py-3 rounded-xl bg-black border-2 border-gray-700 focus:border-blue-500 focus:outline-none text-white placeholder-gray-500 transition-colors duration-300"
                                            value={morsePassword}
                                            onChange={(e) => setMorsePassword(e.target.value)}
                                            disabled={morseLoading}
                                            whileFocus={{ scale: 1.01 }}
                                        />
                                        <motion.button
                                            className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-medium transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                            onClick={handleMorseImport}
                                            disabled={!morseInput || !morsePassword || morseLoading}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onFocus={handleSelectMorse}
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

                                    {/* Shannon Section */}
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-medium flex items-center gap-2">
                                            <i className="fas fa-network-wired text-purple-400"></i>
                                            <span className="text-gray-300">Shannon</span>
                                            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-green-900/70 text-green-300 border border-green-700/50">
                                                Recomendado
                                            </span>
                                        </h3>
                                        <motion.input
                                            type="text"
                                            placeholder="Enter Shannon code"
                                            className="w-full px-4 py-3 rounded-xl bg-black border-2 border-gray-700 focus:border-blue-500 focus:outline-none text-white placeholder-gray-500 transition-colors duration-300"
                                            value={shannonInput}
                                            onChange={(e) => setShannonInput(e.target.value)}
                                            disabled={loading || morseLoading}
                                            whileFocus={{ scale: 1.01 }}
                                        />
                                        <motion.input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="Enter password"
                                            className="w-full px-4 py-3 rounded-xl bg-black border-2 border-gray-700 focus:border-blue-500 focus:outline-none text-white placeholder-gray-500 transition-colors duration-300"
                                            value={shannonPassword}
                                            onChange={(e) => setShannonPassword(e.target.value)}
                                            disabled={loading || morseLoading}
                                            whileFocus={{ scale: 1.01 }}
                                        />
                                        <motion.button
                                            className={`w-full px-6 py-3 rounded-xl font-medium transition-all duration-200 ${loading || morseLoading
                                                ? 'bg-gray-600 cursor-not-allowed'
                                                : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:shadow-blue-500/20 hover:shadow-lg active:scale-95'
                                                }`}
                                            onClick={handleShannonImport}
                                            disabled={loading || morseLoading}
                                            whileHover={loading || morseLoading ? {} : { scale: 1.02 }}
                                            whileTap={loading || morseLoading ? {} : { scale: 0.98 }}
                                        >
                                            {loading ? (
                                                <div className="flex items-center justify-center space-x-2">
                                                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                                                    <span>Importando...</span>
                                                </div>
                                            ) : (
                                                'Importar Wallet Shannon'
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
                                            className={`w-full px-6 py-3 rounded-xl font-medium transition-all duration-200 ${loading
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
                                                    <span>Creando...</span>
                                                </div>
                                            ) : (
                                                'Crear Nueva Wallet Shannon'
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
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>

                {/* Private Key Section */}
                <motion.div className="relative" layout>
                    <motion.button
                        className={`w-full p-4 rounded-xl border-2 ${privateKeyOpen ? 'border-blue-500 bg-blue-500/10' : 'border-blue-400/30 hover:border-blue-400'
                            } transition-colors duration-300 flex justify-between items-center group`}
                        onClick={togglePrivateKey}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        layout
                    >
                        <span className="text-xl font-semibold text-blue-400 group-hover:text-blue-300">Private Key</span>
                        <motion.span
                            animate={{ rotate: privateKeyOpen ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            ▼
                        </motion.span>
                    </motion.button>

                    <AnimatePresence mode="wait">
                        {privateKeyOpen && (
                            <motion.div
                                className="overflow-hidden"
                                variants={dropdownVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                layout
                            >
                                <motion.div
                                    className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-xl bg-gray-900/50"
                                    variants={contentVariants}
                                >
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-medium text-gray-300 mb-3 flex items-center gap-2">
                                            <i className="fas fa-bolt text-yellow-400"></i>
                                            Morse
                                        </h3>
                                        <div className="space-y-3">
                                            <div className="relative">
                                                <motion.textarea
                                                    placeholder="Enter private key"
                                                    className="w-full px-4 py-3 rounded-xl bg-black border-2 border-gray-700 focus:border-blue-500 focus:outline-none text-white placeholder-gray-500 resize-none pr-10"
                                                    rows={3}
                                                    value={privateKeyInput}
                                                    onChange={(e) => setPrivateKeyInput(e.target.value)}
                                                    whileFocus={{ scale: 1.01 }}
                                                />
                                                <span className="absolute left-3 top-3 text-gray-400 pointer-events-none">
                                                    <i className="fas fa-key"></i>
                                                </span>
                                            </div>
                                            <div className="relative">
                                                <motion.textarea
                                                    placeholder="Enter passphrase"
                                                    className="w-full px-4 py-3 rounded-xl bg-black border-2 border-gray-700 focus:border-blue-500 focus:outline-none text-white placeholder-gray-500 resize-none pr-10"
                                                    rows={2}
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    whileFocus={{ scale: 1.01 }}
                                                />
                                                <span className="absolute left-3 top-3 text-gray-400 pointer-events-none">
                                                    <i className="fas fa-lock"></i>
                                                </span>
                                                <motion.button
                                                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-200"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    whileHover={{ scale: 1.1 }}
                                                    whileTap={{ scale: 0.9 }}
                                                    type="button"
                                                >
                                                    <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                                </motion.button>
                                            </div>
                                            <motion.button
                                                className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-medium transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                                onClick={handlePrivateKeyImport}
                                                disabled={!privateKeyInput || !password || morseLoading}
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                            >
                                                {morseLoading ? (
                                                    <>
                                                        <i className="fas fa-spinner fa-spin"></i>
                                                        Importando...
                                                    </>
                                                ) : (
                                                    <>
                                                        <i className="fas fa-download"></i>
                                                        Importar Clave Privada Morse
                                                    </>
                                                )}
                                            </motion.button>
                                            {error && (
                                                <motion.p
                                                    className="text-red-400 text-sm mt-2"
                                                    initial={{ opacity: 0, y: -10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                >
                                                    {error}
                                                </motion.p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-lg font-medium text-gray-300 mb-3 flex items-center gap-2">
                                            <i className="fas fa-network-wired text-purple-400"></i>
                                            Shannon
                                        </h3>
                                        <div className="space-y-3">
                                            <div className="relative">
                                                <motion.textarea
                                                    placeholder="Enter private key"
                                                    className="w-full px-4 py-3 rounded-xl bg-black border-2 border-gray-700 focus:border-blue-500 focus:outline-none text-white placeholder-gray-500 resize-none pr-10"
                                                    rows={3}
                                                    whileFocus={{ scale: 1.01 }}
                                                />
                                                <span className="absolute left-3 top-3 text-gray-400 pointer-events-none">
                                                    <i className="fas fa-key"></i>
                                                </span>
                                            </div>
                                            <div className="relative">
                                                <motion.textarea
                                                    placeholder="Enter passphrase"
                                                    className="w-full px-4 py-3 rounded-xl bg-black border-2 border-gray-700 focus:border-blue-500 focus:outline-none text-white placeholder-gray-500 resize-none pr-10"
                                                    rows={2}
                                                    whileFocus={{ scale: 1.01 }}
                                                />
                                                <span className="absolute left-3 top-3 text-gray-400 pointer-events-none">
                                                    <i className="fas fa-lock"></i>
                                                </span>
                                                <motion.button
                                                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-200"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    whileHover={{ scale: 1.1 }}
                                                    whileTap={{ scale: 0.9 }}
                                                    type="button"
                                                >
                                                    <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                                </motion.button>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </motion.div>

            <motion.div className="mt-8 text-center">
                <p className="text-gray-400 mb-3">¿Necesitas ayuda con la migración?</p>
                <motion.button
                    className="px-6 py-3 bg-gradient-to-r from-purple-600/70 to-blue-600/70 rounded-xl text-white hover:from-purple-500/70 hover:to-blue-500/70"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                >
                    <i className="fas fa-exchange-alt mr-2"></i>
                    Guía de migración Morse → Shannon
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
        </motion.div>
    );
};

export default IndividualImport;