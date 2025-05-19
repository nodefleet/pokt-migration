import React from 'react';
import { motion } from 'framer-motion';
import { HeaderProps } from '../types';
import nodefleetLogo from '../assets/images/nodefleet.png';
import poktLogo from '../assets/images/pokt.png';

const Header: React.FC<HeaderProps> = ({ walletAddress }) => {
    return (
        <motion.header
            className="bg-gradient-to-r from-gray-900 via-blue-900 to-gray-900 text-white shadow-lg"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            <div className="container mx-auto px-4 py-4 flex justify-between items-center">
                <motion.div
                    className="flex items-center space-x-4"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <img
                        src={nodefleetLogo}
                        alt="NodeFleet Logo"
                        className="h-10 w-auto"
                    />
                    <img
                        src={poktLogo}
                        alt="POKT Network"
                        className="h-8 w-auto"
                    />
                </motion.div>

                {walletAddress && (
                    <motion.div
                        className="flex items-center space-x-2 bg-black/20 px-4 py-2 rounded-xl border border-blue-500/20"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        <span className="text-blue-400">Wallet:</span>
                        <span className="text-gray-300 font-mono">
                            {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                        </span>
                    </motion.div>
                )}
            </div>
        </motion.header>
    );
};

export default Header; 