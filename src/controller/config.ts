// Debug Configuration
export const DEBUG_CONFIG = {
    // Set to true to enable all console.log statements
    ENABLED: import.meta.env.VITE_DEBUG === 'true' || import.meta.env.DEBUG === 'true' || false,
    
    // Helper function to conditionally log
    log: (...args: any[]) => {
        if (DEBUG_CONFIG.ENABLED) {
            console.log(...args);
        }
    },
    
    // Helper function to conditionally log errors
    error: (...args: any[]) => {
        if (DEBUG_CONFIG.ENABLED) {
            console.error(...args);
        }
    },
    
    // Helper function to conditionally log warnings
    warn: (...args: any[]) => {
        if (DEBUG_CONFIG.ENABLED) {
            console.warn(...args);
        }
    }
};

export const NETWORKS = {
    SHANNON: {
        MAINNET: {
            name: 'Shannon Mainnet',
            rpcUrls: [
                'https://shannon-grove-rpc.mainnet.poktroll.com/',
            ],
            chainId: 'shannon-mainnet',
            symbol: 'POKT',
            decimals: 6,
            prefix: 'pokt'
        },
        TESTNET: {
            name: 'Shannon Testnet',
            rpcUrls: [
                'https://shannon-testnet-grove-rpc.beta.poktroll.com',
            ],
            chainId: 'shannon-testnet',
            symbol: 'POKT',
            decimals: 6,
            prefix: 'pokt'
        }
    },
    MORSE: {
        MAINNET: {
            name: 'Morse Mainnet',
            prefix: "pokt",
            rpcUrls: [
                "https://pokt-archival.rpc.grove.city/v1/440ae1fc"
            ],
            chainId: 'mainnet',
            symbol: 'POKT',
            decimals: 6
        },
        TESTNET: {
            name: 'Morse Mainnet',
            prefix: "pokt",
            rpcUrls: [
                "https://pokt-archival.rpc.grove.city/v1/440ae1fc"
            ],
            chainId: 'mainnet',
            symbol: 'POKT',
            decimals: 6
        }
    }
};

// Para compatibilidad con código existente
export const MAINNET = NETWORKS.SHANNON.MAINNET;
export const TESTNET = NETWORKS.SHANNON.TESTNET;

export const DEFAULT_NETWORK = NETWORKS.SHANNON.MAINNET;

export const STORAGE_KEYS = {
    WALLET_ADDRESS: 'pokt_wallet_address',
    MNEMONIC: 'pokt_mnemonic',
    NETWORK: 'pokt_network',
    NETWORK_TYPE: 'pokt_network_type' // 'shannon' o 'morse'
};

export const ERROR_MESSAGES = {
    WALLET_NOT_INITIALIZED: 'Wallet not initialized',
    INVALID_MNEMONIC: 'Invalid mnemonic phrase',
    INVALID_ADDRESS: 'Invalid address',
    INSUFFICIENT_BALANCE: 'Insufficient balance',
    TRANSACTION_FAILED: 'Transaction failed',
    NETWORK_CONNECTION_ERROR: "Could not connect to the network. Please check your internet connection and try again.",
    MORSE_DEPRECATED: 'The Morse network is in the process of migration and will be discontinued. Please migrate to Shannon as soon as possible.',
    CORS_ERROR: 'CORS error: Cannot access RPC node due to cross-origin restrictions. A CORS proxy will be used to attempt the connection.',
    WALLET_CREATION_ERROR: "An error occurred while creating the wallet. Please verify that the provided information is correct.",
    WALLET_IMPORT_ERROR: "Could not import the wallet. Please verify that the provided information is correct.",
    SEND_TRANSACTION_ERROR: "Error sending transaction. Please verify that you have sufficient balance to cover the transaction and fees.",
    INVALID_AMOUNT: "The provided amount is not valid. It must be a number greater than 0."
}; 