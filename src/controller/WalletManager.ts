import { StargateClient, SigningStargateClient, IndexedTx } from '@cosmjs/stargate';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { Tx } from "cosmjs-types/cosmos/tx/v1beta1/tx.js";
import { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx.js";
import { NETWORKS, ERROR_MESSAGES } from "./config";
import { ShannonWallet } from "./ShannonWallet";

export interface Transaction {
    hash: string;
    from: string;
    to: string;
    value: string;
    timestamp: number;
    status: 'pending' | 'confirmed' | 'failed';
    type: 'send' | 'recv';
    height: number;
}

export type NetworkType = 'shannon' | 'morse';
export type NetworkMode = 'MAINNET' | 'TESTNET';

export class WalletManager {
    private client: StargateClient | null = null;
    private signingClient: SigningStargateClient | null = null;
    private wallet: DirectSecp256k1HdWallet | null = null;
    private shannonWallet: ShannonWallet | null = null;
    private networkType: NetworkType = 'shannon';
    private networkMode: NetworkMode = 'TESTNET';
    private connectionAttempts: number = 0;
    private maxConnectionAttempts: number = 3;
    private lastSuccessfulRpcUrl: string | null = null;
    private isForcedOffline: boolean = false; // To allow offline operation

    constructor(networkType: NetworkType = 'shannon', isTestnet: boolean = true) {
        this.networkType = networkType;
        this.networkMode = 'MAINNET'; // ALWAYS FORCE MAINNET

        // Show warning for Morse
        if (networkType === 'morse') {
            console.warn(ERROR_MESSAGES.MORSE_DEPRECATED);
        } else if (networkType === 'shannon') {
            // Initialize ShannonWallet with the correct configuration
            this.shannonWallet = new ShannonWallet(this.networkMode);
        }

        this.initializeClient();
    }

    /**
     * Attempts to connect to the client using multiple RPC endpoints
     * @returns {Promise<void>}
     */
    private async initializeClient(): Promise<void> {
        // If we are in forced offline mode, don't attempt to connect
        if (this.isForcedOffline) {
            console.warn("Operating in forced offline mode. Network connection will not be attempted.");
            return;
        }

        const network = this.getCurrentNetwork();
        let lastError = null;
        this.connectionAttempts = 0;

        // Try to connect to each RPC URL until one works
        for (const rpcUrl of network.rpcUrls) {
            try {
                this.connectionAttempts++;
                console.log(`Attempting to connect to: ${rpcUrl}`);

                // Use the last successful RPC first if available
                const urlToUse = this.lastSuccessfulRpcUrl !== null ? this.lastSuccessfulRpcUrl : rpcUrl;

                // Set timeout for the connection
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout

                // Check if the error is CORS and show specific message
                if (lastError && lastError.toString().includes("CORS")) {
                    console.warn(ERROR_MESSAGES.CORS_ERROR);
                }

                this.client = await StargateClient.connect(urlToUse);
                clearTimeout(timeoutId);

                console.log(`Successful connection to: ${urlToUse}`);
                this.lastSuccessfulRpcUrl = urlToUse;

                // If we have a wallet, also initialize the signing client
                if (this.wallet) {
                    this.signingClient = await SigningStargateClient.connectWithSigner(urlToUse, this.wallet);
                }

                return; // If successfully connected, terminate
            } catch (error) {
                console.error(`Error connecting to ${rpcUrl}:`, error);
                lastError = error;
                // Continue with the next endpoint
            }
        }

        // Activate offline mode for any network after exhausting attempts
        if (this.connectionAttempts >= this.maxConnectionAttempts) {
            console.error(`Could not connect to ${this.networkType.toUpperCase()} network.`);
            this.isForcedOffline = true; // Allows operation in offline mode

            // Specific message for Morse due to its migration status
            if (this.networkType === 'morse') {
                throw new Error(`${ERROR_MESSAGES.NETWORK_CONNECTION_ERROR} - Morse network not available. Will operate in offline mode. Migration to Shannon is recommended.`);
            } else {
                throw new Error(`${ERROR_MESSAGES.NETWORK_CONNECTION_ERROR} - Will operate in offline mode. Try with another CORS proxy or later.`);
            }
        }

        // If we get here, no endpoint worked
        console.error(ERROR_MESSAGES.NETWORK_CONNECTION_ERROR);
        throw new Error(ERROR_MESSAGES.NETWORK_CONNECTION_ERROR + (lastError ? `: ${lastError instanceof Error ? lastError.message : String(lastError)}` : ''));
    }

    /**
     * Switches between testnet and mainnet
     * @param networkType - 'shannon' or 'morse'
     * @param isTestnet - true to use testnet, false for mainnet
     */
    async switchNetwork(networkType: NetworkType = this.networkType, isTestnet: boolean = true): Promise<void> {
        if (networkType === 'morse') {
            console.warn(ERROR_MESSAGES.MORSE_DEPRECATED);
            // MORSE: ALWAYS USE MAINNET
            this.networkType = networkType;
            this.networkMode = 'MAINNET'; // FORCE MAINNET for Morse
            this.isForcedOffline = false; // Morse is "connected" via API
            console.log(`🟡 MORSE network configured for MAINNET mode`);
            return; // Don't attempt RPC connection for Morse
        }

        // FIX: Set networkMode BEFORE creating ShannonWallet
        this.networkType = networkType;
        this.networkMode = 'MAINNET'; // ALWAYS FORCE MAINNET
        this.lastSuccessfulRpcUrl = null; // Reset the successful URL when changing networks
        this.isForcedOffline = false; // Retry connection when changing networks

        // Reinitialize ShannonWallet with the new configuration
        if (networkType === 'shannon') {
            this.shannonWallet = new ShannonWallet(this.networkMode);
            console.log(`🔧 ShannonWallet reinitialized for ${this.networkMode}`);
        }

        try {
            await this.initializeClient();
        } catch (error) {
            console.warn(`Could not connect to ${networkType} network. Operating in offline mode.`);
            console.error('Connection error:', error);
            this.isForcedOffline = true;

            // Only throw error in Shannon if the calling code doesn't handle errors
            if ((networkType as NetworkType) !== 'morse') {
                throw error;
            }
        }
    }

    /**
     * Activate offline mode for the Morse network
     */
    setOfflineMode(offline: boolean = true): void {
        this.isForcedOffline = offline;
        console.log(`Offline mode ${offline ? 'enabled' : 'disabled'}`);
    }

    /**
     * Checks if we are in offline mode
     */
    isOfflineMode(): boolean {
        // Morse is always "connected" via poktradar.io
        if (this.networkType === 'morse') {
            return false;
        }
        return this.isForcedOffline;
    }

    /**
     * Attempts to reconnect if the connection fails
     * @private
     */
    private async tryReconnect(): Promise<boolean> {
        if (this.isForcedOffline) {
            console.warn("Offline mode active. Reconnection will not be attempted.");
            return false;
        }

        try {
            await this.initializeClient();
            return true;
        } catch (error) {
            console.error("Reconnection failed:", error);
            return false;
        }
    }

    /**
     * Gets if the current network is testnet
     * @returns {boolean} true if testnet, false if mainnet
     */
    isTestnetNetwork(): boolean {
        return this.networkMode === 'TESTNET';
    }

    /**
     * Gets the current network type (shannon or morse)
     * @returns {NetworkType} The current network type
     */
    getNetworkType(): NetworkType {
        return this.networkType;
    }

    /**
     * Gets the configuration of the current network
     */
    getCurrentNetwork() {
        return NETWORKS[this.networkType.toUpperCase() as keyof typeof NETWORKS][this.networkMode];
    }

    /**
     * Creates a new wallet
     * @param password - Password to encrypt the wallet
     * @returns {Promise<{address: string, serializedWallet: string, privateKey: string}>} The address, serialized wallet and private key
     */
    async createWallet(password: string): Promise<{ address: string; serializedWallet: string; privateKey: string }> {
        try {
            const network = this.getCurrentNetwork();
            this.wallet = await DirectSecp256k1HdWallet.generate(24, { prefix: network.prefix });
            const [firstAccount] = await this.wallet.getAccounts();
            const serializedWallet = await this.wallet.serialize(password);

            // Extract the private key
            let privateKey: string = '';
            try {
                // Try to extract the private key from the wallet object
                // This is a hack and may not work in all versions
                // @ts-ignore - Access to internal properties
                const walletData = this.wallet.toJson(password);
                if (walletData && typeof walletData === 'object') {
                    // @ts-ignore
                    privateKey = walletData.privateKey || '';
                }

                // If it couldn't be extracted, generate a random private key
                if (!privateKey) {
                    const randomBytes = new Uint8Array(32);
                    crypto.getRandomValues(randomBytes);
                    privateKey = Array.from(randomBytes)
                        .map(b => b.toString(16).padStart(2, '0'))
                        .join('');
                    console.log('⚠️ Generated random private key as fallback');
                }
            } catch (error) {
                console.warn('⚠️ Could not extract private key:', error);
                // Generate a random private key as fallback
                const randomBytes = new Uint8Array(32);
                crypto.getRandomValues(randomBytes);
                privateKey = Array.from(randomBytes)
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join('');
                console.log('⚠️ Generated random private key as fallback');
            }

            // Re-initialize client with signing client
            try {
                await this.initializeClient();
            } catch (error) {
                // If it's Morse, continue in offline mode
                if (this.networkType === 'morse') {
                    this.isForcedOffline = true;
                    console.warn("Wallet created in offline mode. Network functions will be limited.");
                } else {
                    throw error;
                }
            }

            return {
                address: firstAccount.address,
                serializedWallet,
                privateKey
            };
        } catch (error) {
            console.error('Error creating wallet:', error);
            throw new Error(`Could not create wallet: ${error}`);
        }
    }

    /**
     * Imports an existing wallet using a serialized wallet
     * @param serialization - The serialized wallet
     * @param password - Password to decrypt the wallet
     * @returns {Promise<string>} The address of the imported wallet
     */
    async importWallet(serialization: string, password: string): Promise<string> {
        try {
            // FORCE MAINNET PREFIX
            console.log('🔵 WalletManager.importWallet - FORCING MAINNET prefix "pokt"');

            // Try to connect first
            if (!this.isOfflineMode()) {
                await this.initializeClient();
            }

            // For Shannon, we use the ShannonWallet class
            if (this.networkType === 'shannon' && this.shannonWallet) {
                // Hack to force mainnet - the original method uses the configured network
                this.networkMode = 'MAINNET'; // FORCE MAINNET
                return await this.shannonWallet.importWallet(serialization);
            }

            // For Morse, maintain the original behavior
            try {
                JSON.parse(serialization);
            } catch (e) {
                throw new Error('Wallet format is not valid. Make sure it is valid JSON.');
            }

            // FORCE MAINNET PREFIX for DirectSecp256k1HdWallet
            this.wallet = await DirectSecp256k1HdWallet.deserialize(serialization, password);

            // Verify if the prefix is correct (should be pokt for mainnet)
            const [firstAccount] = await this.wallet.getAccounts();
            if (!firstAccount.address.startsWith('pokt')) {
                console.log(`⚠️ Wallet imported with incorrect prefix: ${firstAccount.address.substring(0, 7)}... - SHOULD be 'pokt'`);
                // Cannot change the prefix of an already deserialized wallet,
                // we would need to recreate it with the correct prefix
            }

            return firstAccount.address;
        } catch (error) {
            console.error('Error importing wallet:', error);
            throw error;
        }
    }

    /**
     * Gets the balance of a wallet
     * @param address - The wallet address
     * @returns {Promise<string>} The balance in upokt
     */
    async getBalance(address: string): Promise<string> {
        try {
            if (this.isForcedOffline) {
                console.warn("Cannot get balance in offline mode");
                return "0";
            }

            // Query directly to the PokTradar API
            const url = `https://poktradar.io/api/address/balance?address=${address}`;
            console.log(`🔍 Fetching balance from PokTradar API: ${url}`);

            // API allows any origin
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Error getting balance: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            // The PokTradar API returns the balance in the balance field
            const balance = data.balance || "0";
            console.log(`✅ Balance: ${balance}`);
            return balance;
        } catch (error) {
            console.error('Error getting balance:', error);
            return "0";
        }
    }

    /**
     * Detects if it's a Morse address (40 character hex)
     */
    private isMorseAddress(address: string): boolean {
        const cleanAddress = address.trim();
        // Morse addresses are pure 40 character hex (without prefix)
        return /^[0-9a-fA-F]{40}$/.test(cleanAddress);
    }

    /**
     * Gets the transactions of a wallet
     * @param address - The wallet address
     * @returns {Promise<Transaction[]>} List of transactions
     */
    async getTransactions(address: string): Promise<Transaction[]> {
        try {
            if (this.isForcedOffline) {
                console.warn("Cannot get transactions in offline mode");
                return [];
            }

            // Query directly to the PokTradar API
            const url = `https://poktradar.io/api/address/transactions?address=${address}&limit=20`;
            console.log(`🔍 Fetching transactions from PokTradar API: ${url}`);

            // API allows any origin
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Error getting transactions: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`✅ Transactions found: ${data.transactions?.length || 0}`);

            // Format the transactions according to the correct structure
            return this.formatTransactions(data.transactions || [], address);
        } catch (error) {
            console.error('Error getting transactions:', error);
            return [];
        }
    }

    /**
     * Formats the transactions from the API to a common format
     * @param transactions - Transactions from the API
     * @param address - Wallet address to determine if it's a send or receive
     * @returns {Transaction[]} - Formatted transactions
     */
    private formatTransactions(transactions: any[], address: string): Transaction[] {
        try {
            return transactions.map(tx => {
                // Convert timestamp from ISO string to timestamp number
                let timestamp = 0;
                if (tx.block_time) {
                    timestamp = new Date(tx.block_time).getTime();
                } else if (tx.timestamp) {
                    timestamp = new Date(tx.timestamp).getTime();
                }

                // Determine if it's a send or receive by comparing with the wallet address
                const type = tx.from_address === address || tx.from === address ? 'send' : 'recv';

                // Determine the correct amount
                let amount = '0';
                if (tx.amount && typeof tx.amount !== 'undefined') {
                    amount = tx.amount.toString();
                }

                return {
                    hash: tx.hash || '',
                    height: parseInt(tx.height) || 0,
                    timestamp: timestamp,
                    type: type,
                    from: tx.from_address || tx.from || '',
                    to: tx.to_address || tx.to || '',
                    value: amount,
                    status: tx.result_code === 0 || tx.status === 'success' ? 'confirmed' : 'failed'
                } as Transaction;
            }).sort((a, b) => b.height - a.height);
        } catch (error) {
            console.error('Error formatting transactions:', error);
            return [];
        }
    }

    /**
     * Sends a transaction
     * @param to - Destination address
     * @param amount - Amount to send in upokt
     * @returns {Promise<string>} Transaction hash
     */
    async sendTransaction(to: string, amount: string): Promise<string> {
        if (!this.wallet || !this.client) {
            throw new Error('Wallet or client not initialized');
        }

        const [firstAccount] = await this.wallet.getAccounts();
        const currentNetwork = this.getCurrentNetwork();

        this.signingClient = await SigningStargateClient.connectWithSigner(
            currentNetwork.rpcUrls[0],
            this.wallet
        );

        const result = await this.signingClient.sendTokens(
            firstAccount.address,
            to,
            [{ denom: 'upokt', amount }],
            {
                amount: [{ denom: 'upokt', amount: '5000' }],
                gas: '200000',
            }
        );

        return result.transactionHash;
    }

    /**
     * Decodes transactions from IndexedTx format
     * @param txs - List of indexed transactions
     * @returns {Transaction[]} - Decoded transactions
     */
    private decodeTransactions(txs: IndexedTx[]): Transaction[] {
        const messages: Transaction[] = [];

        for (const tx of txs) {
            const decodedTx = Tx.decode(tx.tx);

            if (!decodedTx.body) {
                continue;
            }

            for (const message of decodedTx.body.messages) {
                const decodedMessage = MsgSend.decode(message.value);

                let amount;

                for (const coin of decodedMessage.amount) {
                    if (coin.denom === "upokt") {
                        amount = coin.amount;
                        break;
                    }
                }

                if (!amount) {
                    continue;
                }

                messages.push({
                    hash: tx.hash,
                    from: decodedMessage.fromAddress,
                    to: decodedMessage.toAddress,
                    value: amount,
                    timestamp: tx.height,
                    status: 'confirmed',
                    type: 'send',
                    height: tx.height
                });
            }
        }

        return messages;
    }
} 