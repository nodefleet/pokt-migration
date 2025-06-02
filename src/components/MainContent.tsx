import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MainContentProps } from '../types';
import { NetworkType } from '../controller/WalletManager';
import { useNavigate } from 'react-router-dom';

const MainContent: React.FC<MainContentProps> = ({ onWalletImport }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const handleWalletImport = async (code: string, password: string, network: NetworkType) => {
        try {
            setLoading(true);
            setError(null);
            const result = await onWalletImport(code, password, network);
            if (result?.address) {
                navigate('/wallet');
            }
        } catch (error) {
            console.error('Error importing wallet:', error);
            setError(error instanceof Error ? error.message : 'Error al importar la wallet');
        } finally {
            setLoading(false);
        }
    };

    const buttonVariants = {
        hover: { scale: 1.02, transition: { duration: 0.2 } },
        tap: { scale: 0.98 },
        initial: { scale: 1 }
    };

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-4">
            {loading && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
                        <p className="text-white mt-4">Procesando...</p>
                    </div>
                </div>
            )}

            {error && (
                <div className="fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-xl shadow-lg z-50">
                    {error}
                </div>
            )}

            <motion.div
                className="text-center max-w-4xl mx-auto p-8 rounded-2xl bg-gradient-to-b from-gray-900 to-black shadow-2xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
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
                        onClick={() => navigate('/import/individual')}
                        variants={buttonVariants}
                        whileHover="hover"
                        whileTap="tap"
                    >
                        Individual Import
                    </motion.button>
                    <motion.button
                        className="w-full sm:w-64 px-8 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 text-white font-medium shadow-lg hover:shadow-purple-500/20"
                        onClick={() => navigate('/import/bulk')}
                        variants={buttonVariants}
                        whileHover="hover"
                        whileTap="tap"
                    >
                        Bulk Import
                    </motion.button>
                </motion.div>
            </motion.div>
        </div>
    );
};

export default MainContent; 