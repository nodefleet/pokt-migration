import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WalletDashboardProps } from '../types';

const WalletDashboard: React.FC<WalletDashboardProps> = ({
    walletAddress,
    showTransactions,
    onReturn,
    onViewTransactions
}) => {
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                duration: 0.5,
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.4
            }
        }
    };

    return (
        <motion.div
            className="flex flex-col min-h-screen bg-gradient-to-b from-gray-900 to-black text-white"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
        >
            <motion.header
                className="p-6 border-b border-gray-800/50"
                variants={itemVariants}
            >
                <div className="container mx-auto">
                    <div className="flex justify-between items-center">
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                            Wallet Dashboard
                        </h1>
                        <motion.button
                            onClick={onReturn}
                            className="bg-gray-800/50 hover:bg-gray-700/50 text-white px-6 py-3 rounded-xl transition-all duration-200 border border-gray-700/50 hover:border-gray-600/50"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            Return
                        </motion.button>
                    </div>
                </div>
            </motion.header>

            <main className="flex-grow container mx-auto p-6">
                <motion.section
                    className="bg-gray-900/50 backdrop-blur-sm rounded-2xl p-8 mb-8 border border-gray-800/50"
                    variants={itemVariants}
                >
                    <h2 className="text-2xl font-semibold mb-6 text-blue-300">Wallet Details</h2>
                    <div className="flex flex-wrap -mx-4">
                        <div className="w-full md:w-1/2 px-4 mb-6">
                            <div className="p-6 bg-gray-800/50 rounded-xl border border-gray-700/50">
                                <h3 className="text-sm font-medium text-gray-400 mb-2">Address</h3>
                                <p className="text-lg font-mono break-all bg-gray-900/50 p-3 rounded-lg">
                                    {walletAddress}
                                </p>
                            </div>
                        </div>
                        <div className="w-full md:w-1/2 px-4 mb-6">
                            <div className="p-6 bg-gray-800/50 rounded-xl border border-gray-700/50">
                                <h3 className="text-sm font-medium text-gray-400 mb-2">Balance</h3>
                                <p className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                                    1,250 POKT
                                </p>
                            </div>
                        </div>
                    </div>
                </motion.section>

                <motion.section
                    className="mb-8"
                    variants={itemVariants}
                >
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-semibold text-blue-300">Actions</h2>
                        <motion.button
                            onClick={onViewTransactions}
                            className="bg-blue-600/50 hover:bg-blue-600/70 text-white px-6 py-3 rounded-xl transition-all duration-200 border border-blue-500/50 hover:border-blue-400/50"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            {showTransactions ? 'Hide Transactions' : 'View Transactions'}
                        </motion.button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {[
                            { icon: '💸', label: 'Send', color: 'from-blue-600/50 to-blue-700/50' },
                            { icon: '📥', label: 'Receive', color: 'from-green-600/50 to-green-700/50' },
                            { icon: '📋', label: 'Stake', color: 'from-purple-600/50 to-purple-700/50' },
                            { icon: '🔄', label: 'Unstake', color: 'from-orange-600/50 to-orange-700/50' }
                        ].map((action, index) => (
                            <motion.button
                                key={action.label}
                                className={`p-6 bg-gradient-to-r ${action.color} rounded-xl text-center transition-all duration-200 border border-gray-700/50 hover:border-gray-600/50`}
                                whileHover={{ scale: 1.02, y: -2 }}
                                whileTap={{ scale: 0.98 }}
                                variants={itemVariants}
                            >
                                <span className="block text-3xl mb-3">{action.icon}</span>
                                <span className="text-lg font-medium">{action.label}</span>
                            </motion.button>
                        ))}
                    </div>
                </motion.section>

                <AnimatePresence>
                    {showTransactions && (
                        <motion.section
                            className="bg-gray-900/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-800/50"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <h2 className="text-2xl font-semibold mb-6 text-blue-300">Transaction History</h2>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-700/50">
                                    <thead>
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                                Transaction
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                                Amount
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                                Date
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                                Status
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700/50">
                                        <tr className="hover:bg-gray-800/30 transition-colors duration-200">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm">Sent to 00x3...2a41</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-red-400">-250 POKT</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm">2023-06-12</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="px-3 py-1 text-xs rounded-full bg-green-900/50 text-green-300 border border-green-700/50">
                                                    Confirmed
                                                </span>
                                            </td>
                                        </tr>
                                        <tr className="hover:bg-gray-800/30 transition-colors duration-200">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm">Received from 00x5...7f33</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-green-400">+500 POKT</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm">2023-06-10</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="px-3 py-1 text-xs rounded-full bg-green-900/50 text-green-300 border border-green-700/50">
                                                    Confirmed
                                                </span>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </motion.section>
                    )}
                </AnimatePresence>
            </main>
        </motion.div>
    );
};

export default WalletDashboard; 