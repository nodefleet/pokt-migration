import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { NetworkType } from '../controller/WalletManager';
import { storageService } from '../controller/storage.service';

interface NetworkSelectionProps {
    onNetworkSelect: (networkType: NetworkType, isMainnet: boolean) => void;
    onMigrationRequest: () => void;
    currentNetwork?: NetworkType;
    isMainnet?: boolean;
}

const NetworkSelection: React.FC<NetworkSelectionProps> = ({
    onNetworkSelect,
    onMigrationRequest,
    currentNetwork = 'shannon',
    isMainnet = false
}) => {
    const [selectedNetwork, setSelectedNetwork] = useState<NetworkType>(currentNetwork);
    const [selectedIsMainnet, setSelectedIsMainnet] = useState<boolean>(isMainnet === true);
    const [showMigrationInfo, setShowMigrationInfo] = useState<boolean>(false);

    useEffect(() => {
        const ism = storageService.getSync<boolean>('isMainnet');
        setSelectedIsMainnet(ism === true || isMainnet === true);
    }, [currentNetwork, isMainnet]);

    const handleNetworkChange = (networkType: NetworkType) => {
        setSelectedNetwork(networkType);
        onNetworkSelect(networkType, selectedIsMainnet);
    };

    const handleNetworkModeChange = (isMain: boolean) => {
        setSelectedIsMainnet(isMain);
        onNetworkSelect(selectedNetwork, isMain);
    };

    return (
        <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-800/50 mb-8">
            <h2 className="text-2xl font-semibold mb-6 text-blue-300">Selección de Red</h2>

            <div className="mb-6">
                <h3 className="text-lg font-medium mb-3 text-gray-300">Tipo de Red</h3>
                <div className="grid grid-cols-2 gap-4">
                    {[
                        { type: 'shannon' as NetworkType, name: 'Shannon', color: 'from-blue-600/50 to-blue-700/50', description: 'Red principal de Pocket Network (recomendada)' },
                        { type: 'morse' as NetworkType, name: 'Morse', color: 'from-purple-600/50 to-purple-700/50', description: 'Red anterior (en migración)' },
                    ].map(network => (
                        <motion.div
                            key={network.type}
                            className={`p-4 rounded-xl cursor-pointer transition-all duration-200 bg-gradient-to-r ${network.color} border ${selectedNetwork === network.type ? 'border-white' : 'border-gray-700/50'}`}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleNetworkChange(network.type)}
                        >
                            <div className="flex items-center mb-2">
                                <div className={`w-4 h-4 rounded-full ${selectedNetwork === network.type ? 'bg-white' : 'bg-gray-700'} mr-2`}></div>
                                <h4 className="text-white font-medium">{network.name}</h4>
                            </div>
                            <p className="text-sm text-gray-200">{network.description}</p>
                        </motion.div>
                    ))}
                </div>
            </div>

            <div className="mb-6">
                <h3 className="text-lg font-medium mb-3 text-gray-300">Modo de Red</h3>
                <div className="grid grid-cols-2 gap-4">
                    {[
                        { isMainnet: true, name: 'Mainnet', color: 'from-green-600/50 to-green-700/50', description: 'Mainnet with real tokens' },
                        { isMainnet: false, name: 'Testnet', color: 'from-orange-600/50 to-orange-700/50', description: 'Testnet with test tokens' },
                    ].map(mode => (
                        <motion.div
                            key={mode.name}
                            className={`p-4 rounded-xl cursor-pointer transition-all duration-200 bg-gradient-to-r ${mode.color} border ${selectedIsMainnet === mode.isMainnet ? 'border-white' : 'border-gray-700/50'}`}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleNetworkModeChange(mode.isMainnet)}
                        >
                            <div className="flex items-center mb-2">
                                <div className={`w-4 h-4 rounded-full ${selectedIsMainnet === mode.isMainnet ? 'bg-white' : 'bg-gray-700'} mr-2`}></div>
                                <h4 className="text-white font-medium">{mode.name}</h4>
                            </div>
                            <p className="text-sm text-gray-200">{mode.description}</p>
                        </motion.div>
                    ))}
                </div>
            </div>

            {selectedNetwork === 'morse' && (
                <div className="mb-6">
                    <motion.button
                        className="w-full py-3 px-4 bg-gradient-to-r from-blue-600/70 to-purple-600/70 text-white rounded-xl border border-blue-500/50 hover:from-blue-600/80 hover:to-purple-600/80 transition-colors duration-200"
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => setShowMigrationInfo(!showMigrationInfo)}
                    >
                        <i className="fas fa-exchange-alt mr-2"></i>
                        Información sobre Migración Morse a Shannon
                    </motion.button>

                    {showMigrationInfo && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700/50"
                        >
                            <h4 className="font-medium text-yellow-300 mb-2">Migration from Morse to Shannon</h4>
                            <p className="text-sm text-gray-300 mb-3">
                                Pocket Network is migrating from Morse to Shannon. You will need to migrate your funds to
                                continue using the network.
                            </p>
                            <p className="text-sm text-gray-300 mb-4">
                                The process requires you to have access to your Morse wallet and generate a new
                                wallet in Shannon.
                            </p>

                            <motion.button
                                className="w-full py-2 px-4 bg-gradient-to-r from-purple-600/70 to-blue-600/70 text-white rounded-lg border border-purple-500/50 hover:from-purple-600/80 hover:to-blue-600/80 transition-colors duration-200"
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.99 }}
                                onClick={onMigrationRequest}
                            >
                                <i className="fas fa-sync-alt mr-2"></i>
                                Start Migration Process
                            </motion.button>
                        </motion.div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NetworkSelection; 