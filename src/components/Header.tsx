import React from 'react';
import { motion } from 'framer-motion';
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
                    <Link to="/">
                        <img
                            src={nodefleetLogo}
                            alt="NodeFleet Logo"
                            className="h-10 w-auto"
                        />
                    </Link>
                    <img
                        src={poktLogo}
                        alt="POKT Network"
                        className="h-8 w-auto"
                    />
                </motion.div>

                {walletAddress && (
                    <motion.div
                        className="flex items-center space-x-4"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        {/* Wallet Selector */}
                        <WalletSelector
                            currentAddress={walletAddress}
                            currentNetwork={currentNetwork}
                            isMainnet={isMainnet}
                            onWalletChange={handleWalletChange}
                            onNetworkChange={handleNetworkChange}
                            onMainnetChange={handleMainnetChange}
                            onImportNew={handleImportNew}
                        />

                        {onLogout && (
                            <motion.button
                                onClick={onLogout}
                                className="bg-red-600/30 hover:bg-red-600/50 px-4 py-2 rounded-xl text-white border border-red-500/30 transition-colors duration-200"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <i className="fas fa-sign-out-alt mr-2"></i>
                                Logout
                            </motion.button>
                        )}
                    </motion.div>
                )}
            </div>
        </motion.header>
    );
};

export default Header; 