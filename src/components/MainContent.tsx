import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MainContentProps } from '../types';
import IndividualImport from './IndividualImport';
import BulkImport from './BulkImport';
import BulkImportTable from './BulkImportTable';
import WalletDashboard from './WalletDashboard';

const MainContent: React.FC<MainContentProps> = ({ onWalletImport }) => {
    const [currentScreen, setCurrentScreen] = useState<'main' | 'individual' | 'bulk' | 'bulkTable' | 'wallet'>('main');
    const [walletAddress, setWalletAddress] = useState<string>('');

    const handleIndividualImport = () => {
        setCurrentScreen('individual');
    };

    const handleBulkImport = () => {
        setCurrentScreen('bulk');
    };

    const handleBulkTable = () => {
        setCurrentScreen('bulkTable');
    };

    const handleWalletImport = (code: string, network: 'morse' | 'shannon') => {
        onWalletImport(code, network);
        setCurrentScreen('wallet');
    };

    const handleCreateWallet = (network: 'morse' | 'shannon') => {
        onWalletImport('', network);
        setCurrentScreen('wallet');
    };

    const handleReturn = () => {
        setCurrentScreen('main');
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
        },
        exit: {
            opacity: 0,
            y: -20,
            transition: {
                duration: 0.3
            }
        }
    };

    const buttonVariants = {
        hover: { scale: 1.02, transition: { duration: 0.2 } },
        tap: { scale: 0.98 },
        initial: { scale: 1 }
    };

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-4">
            <AnimatePresence mode="wait">
                {currentScreen === 'main' && (
                    <motion.div
                        className="text-center max-w-4xl mx-auto p-8 rounded-2xl bg-gradient-to-b from-gray-900 to-black shadow-2xl"
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        variants={containerVariants}
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                        >
                            <motion.h1
                                className="text-5xl font-bold mb-6 bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                            >
                                Welcome to POKT Wallet
                            </motion.h1>
                            <motion.p
                                className="text-blue-400 text-lg mb-12"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.4 }}
                            >
                                Your gateway to secure and efficient POKT cryptocurrency management
                            </motion.p>
                        </motion.div>

                        <motion.div
                            className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-6"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                        >
                            <motion.button
                                className="w-full sm:w-64 px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium shadow-lg hover:shadow-blue-500/20"
                                onClick={handleIndividualImport}
                                variants={buttonVariants}
                                whileHover="hover"
                                whileTap="tap"
                            >
                                Individual Import
                            </motion.button>
                            <motion.button
                                className="w-full sm:w-64 px-8 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 text-white font-medium shadow-lg hover:shadow-purple-500/20"
                                onClick={handleBulkImport}
                                variants={buttonVariants}
                                whileHover="hover"
                                whileTap="tap"
                            >
                                Bulk Import
                            </motion.button>
                        </motion.div>
                    </motion.div>
                )}

                {currentScreen === 'individual' && (
                    <IndividualImport
                        onReturn={handleReturn}
                        onWalletImport={handleWalletImport}
                        onCreateWallet={handleCreateWallet}
                    />
                )}

                {currentScreen === 'bulk' && (
                    <BulkImport
                        onReturn={handleReturn}
                        onBulkImport={handleBulkTable}
                    />
                )}

                {currentScreen === 'bulkTable' && (
                    <BulkImportTable
                        onReturn={handleReturn}
                        onWalletImport={handleWalletImport}
                    />
                )}

                {currentScreen === 'wallet' && (
                    <WalletDashboard
                        onReturn={handleReturn}
                        walletAddress={walletAddress}
                        showTransactions={false}
                        onViewTransactions={() => { }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default MainContent; 