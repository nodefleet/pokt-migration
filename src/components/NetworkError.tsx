import React from 'react';
import { motion } from 'framer-motion';
import { NetworkType } from '../controller/WalletManager';
import { ERROR_MESSAGES } from '../controller/config';

interface NetworkErrorProps {
    network: NetworkType;
    error: string;
    onRetry: () => void;
    onSwitchNetwork: () => void;
}

const NetworkError: React.FC<NetworkErrorProps> = ({
    network,
    error,
    onRetry,
    onSwitchNetwork
}) => {
    return (
        <motion.div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <motion.div
                className="bg-gray-900 rounded-2xl border border-red-800/50 shadow-xl w-full max-w-md"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
            >
                <div className="p-6 border-b border-red-800/50">
                    <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-semibold text-red-400">
                            <i className="fas fa-exclamation-triangle mr-2"></i>
                            Connection Error
                        </h2>
                    </div>
                </div>

                <div className="p-6">
                    <div className="mb-6 flex flex-col items-center">
                        <div className="w-20 h-20 rounded-full bg-red-900/30 flex items-center justify-center mb-4">
                            <i className="fas fa-plug text-4xl text-red-400"></i>
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">
                            Could not connect to {network.toUpperCase()} network
                        </h3>
                        <p className="text-gray-400 text-center mb-4">
                            {error || ERROR_MESSAGES.NETWORK_CONNECTION_ERROR}
                        </p>

                        {network === 'morse' && (
                            <div className="bg-yellow-900/30 p-3 rounded-lg border border-yellow-800/50 mb-4 w-full">
                                <p className="text-yellow-300 text-sm">
                                    <i className="fas fa-info-circle mr-2"></i>
                                    {ERROR_MESSAGES.MORSE_DEPRECATED}
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <motion.button
                            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center justify-center"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={onRetry}
                        >
                            <i className="fas fa-sync-alt mr-2"></i>
                            Try again
                        </motion.button>

                        {network === 'morse' && (
                            <motion.button
                                className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg transition-colors flex items-center justify-center"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={onSwitchNetwork}
                            >
                                <i className="fas fa-exchange-alt mr-2"></i>
                                Switch to Shannon Network
                            </motion.button>
                        )}
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default NetworkError; 