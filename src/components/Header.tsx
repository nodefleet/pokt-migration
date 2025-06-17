import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HeaderProps } from '../types';
import { NetworkType } from '../controller/WalletManager';
import nodefleetLogo from '../assets/images/nodefleet.png';
import poktLogo from '../assets/images/pokt.png';
import { Link, useNavigate } from 'react-router-dom';
import WalletSelector from './WalletSelector';

interface ExtendedHeaderProps extends HeaderProps {
    currentNetwork?: NetworkType;
    isMainnet?: boolean;
    onWalletChange?: (address: string, network: NetworkType, isMainnet?: boolean) => void;
    onNetworkChange?: (network: NetworkType) => void;
    onMainnetChange?: (isMainnet: boolean) => void;
}

const Header: React.FC<ExtendedHeaderProps> = ({
    walletAddress,
    onLogout,
    currentNetwork = 'shannon',
    isMainnet = false,
    onWalletChange,
    onNetworkChange,
    onMainnetChange
}) => {
    const navigate = useNavigate();
    const [showNetworkBadge, setShowNetworkBadge] = useState(true);

    const handleWalletChange = (address: string, network: NetworkType, isMainnet?: boolean) => {
        if (onWalletChange) {
            onWalletChange(address, network, isMainnet);
        }
    };

    const handleNetworkChange = (network: NetworkType) => {
        if (onNetworkChange) {
            onNetworkChange(network);
        }
    };

    const handleMainnetChange = (isMainnet: boolean) => {
        if (onMainnetChange) {
            onMainnetChange(isMainnet);
        }
    };

    const handleImportNew = () => {
        navigate('/import/individual');
    };

    return (
        <motion.div
            className="relative"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >


            <motion.header
                className="backdrop-blur-md bg-gradient-to-r from-blue-900/80 via-indigo-900/80 to-purple-900/80 text-white shadow-xl border-b border-indigo-500/20 glass-effect z-header"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                style={{ position: 'relative', zIndex: 'var(--header-z-index)' }}
            >
                <div className="container mx-auto px-4 py-4">
                    <div className="flex justify-between items-center">
                        <motion.div
                            className="flex items-center space-x-6"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 }}
                        >
                            <Link to="/" className="group">
                                <div className="relative overflow-hidden rounded-md p-1">
                                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-md"></div>
                                    <img
                                        src={nodefleetLogo}
                                        alt="NodeFleet Logo"
                                        className="h-10 w-auto relative z-10 transition-transform duration-300 group-hover:scale-105"
                                    />
                                </div>
                            </Link>
                            <div className="h-8 w-px bg-gradient-to-b from-transparent via-indigo-500/50 to-transparent"></div>
                            <img
                                src={poktLogo}
                                alt="POKT Network"
                                className="h-8 w-auto hover:opacity-80 transition-opacity duration-200"
                            />
                        </motion.div>

                        {walletAddress && (
                            <motion.div
                                className="flex items-center space-x-4"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3 }}
                            >
                                {/* Wallet Selector - enhanced styling */}
                                <div className="relative group">
                                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600/30 to-purple-600/30 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                    <WalletSelector
                                        currentAddress={walletAddress}
                                        currentNetwork={currentNetwork}
                                        isMainnet={isMainnet}
                                        onWalletChange={handleWalletChange}
                                        onNetworkChange={handleNetworkChange}
                                        onMainnetChange={handleMainnetChange}
                                        onImportNew={handleImportNew}
                                    />
                                </div>

                                {onLogout && (
                                    <motion.button
                                        onClick={onLogout}
                                        className="relative overflow-hidden bg-gradient-to-r from-red-600/40 to-red-700/40 hover:from-red-600/60 hover:to-red-700/60 px-5 py-2 rounded-xl text-white border border-red-500/30 transition-all duration-300 group"
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                    >
                                        <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-red-500/0 via-red-500/30 to-red-500/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></span>
                                        <span className="relative flex items-center justify-center">
                                            <i className="fas fa-sign-out-alt mr-2"></i>
                                            <span>Logout</span>
                                        </span>
                                    </motion.button>
                                )}
                            </motion.div>
                        )}
                    </div>
                </div>
            </motion.header>
        </motion.div>
    );
};

export default Header; 