export const NETWORKS = {
    MAINNET: {
        name: 'POKT Mainnet',
        rpcUrl: 'https://mainnet-rpc.pokt.network',
        chainId: 'mainnet',
        symbol: 'POKT',
        decimals: 6,
        prefix: 'pokt'
    },
    TESTNET: {
        name: 'POKT Testnet',
        rpcUrl: 'https://testnet-rpc.pokt.network',
        chainId: 'testnet',
        symbol: 'POKT',
        decimals: 6,
        prefix: 'pokt'
    }
};

export const DEFAULT_NETWORK = NETWORKS.TESTNET;

export const STORAGE_KEYS = {
    WALLET_ADDRESS: 'pokt_wallet_address',
    MNEMONIC: 'pokt_mnemonic',
    NETWORK: 'pokt_network'
};

export const ERROR_MESSAGES = {
    WALLET_NOT_INITIALIZED: 'Wallet no inicializada',
    INVALID_MNEMONIC: 'Frase mnemónica inválida',
    INVALID_ADDRESS: 'Dirección inválida',
    INSUFFICIENT_BALANCE: 'Balance insuficiente',
    TRANSACTION_FAILED: 'La transacción falló'
}; 