import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IndividualImportProps } from '../types';

const IndividualImport: React.FC<IndividualImportProps> = ({ onReturn, onWalletImport, onCreateWallet }) => {
    const [keyfileOpen, setKeyfileOpen] = useState(false);
    const [privateKeyOpen, setPrivateKeyOpen] = useState(false);
    const [morseCode, setMorseCode] = useState('');
    const [shannonCode, setShannonCode] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const toggleKeyfile = () => {
        setKeyfileOpen(!keyfileOpen);
        if (!keyfileOpen) setPrivateKeyOpen(false);
    };

    const togglePrivateKey = () => {
        setPrivateKeyOpen(!privateKeyOpen);
        if (!privateKeyOpen) setKeyfileOpen(false);
    };

    const handleMorseImport = () => {
        if (morseCode) {
            onWalletImport(morseCode, 'morse');
        }
    };

    const handleShannonImport = () => {
        if (shannonCode) {
            onWalletImport(shannonCode, 'shannon');
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
                                        <h3 className="text-lg font-medium text-gray-300 mb-3 flex items-center gap-2">
                                            <i className="fas fa-bolt text-yellow-400"></i>
                                            Morse
                                        </h3>
                                        <motion.input
                                            type="text"
                                            placeholder="Enter Morse code"
                                            className="w-full px-4 py-3 rounded-xl bg-black border-2 border-gray-700 focus:border-blue-500 focus:outline-none text-white placeholder-gray-500 transition-colors duration-300"
                                            value={morseCode}
                                            onChange={(e) => setMorseCode(e.target.value)}
                                            whileFocus={{ scale: 1.01 }}
                                        />
                                        <motion.button
                                            className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-medium transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                            onClick={handleMorseImport}
                                            disabled={!morseCode}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                        >
                                            <i className="fas fa-download"></i>
                                            Import Morse Wallet
                                        </motion.button>
                                    </div>

                                    {/* Shannon Section */}
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-medium text-gray-300 mb-3 flex items-center gap-2">
                                            <i className="fas fa-network-wired text-purple-400"></i>
                                            Shannon
                                        </h3>
                                        <motion.input
                                            type="text"
                                            placeholder="Enter Shannon code"
                                            className="w-full px-4 py-3 rounded-xl bg-black border-2 border-gray-700 focus:border-blue-500 focus:outline-none text-white placeholder-gray-500 transition-colors duration-300"
                                            value={shannonCode}
                                            onChange={(e) => setShannonCode(e.target.value)}
                                            whileFocus={{ scale: 1.01 }}
                                        />
                                        <motion.button
                                            className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-medium transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                            onClick={handleShannonImport}
                                            disabled={!shannonCode}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                        >
                                            <i className="fas fa-download"></i>
                                            Import Shannon Wallet
                                        </motion.button>
                                        <motion.button
                                            className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white font-medium transition-colors duration-300 flex items-center justify-center gap-2"
                                            onClick={() => onCreateWallet('shannon')}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                        >
                                            <i className="fas fa-plus-circle"></i>
                                            Create Shannon Wallet
                                        </motion.button>
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