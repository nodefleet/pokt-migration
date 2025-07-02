import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
// import { navigate } from "wouter/use-browser-location"; // No longer used here
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { useMutation, UseMutationResult } from "@tanstack/react-query";
import { SigningStargateClient, StargateClient } from "@cosmjs/stargate";
import { IndexedTx } from "@cosmjs/stargate";
import { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";
import { Tx } from "cosmjs-types/cosmos/tx/v1beta1/tx.js";
import { NETWORKS } from "./config";
import { storageService } from './storage.service';
// import { useNavigate } from "react-router-dom"; // No longer used directly in hooks for navigation

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

interface WalletState {
    address: string | null;
    serialized: string | null;
}

interface WalletStore extends WalletState {
    setWallet: (wallet: WalletState) => void;
}

// Create safe storage wrapper to handle "Access to storage is not allowed" errors
const safeStorage = {
    getItem: (name: string): string | null => {
        try {
            const result = storageService.getSync(name);
            return typeof result === 'string' ? result : null;
        } catch {
            return null;
        }
    },
    setItem: (name: string, value: string) => {
        try {
            storageService.set(name, value);
        } catch {
            // Silently fail on storage errors
        }
    },
    removeItem: (name: string) => {
        try {
            storageService.remove(name);
        } catch {
            // Silently fail on storage errors
        }
    }
};

const useShannonWalletStore = create<WalletStore>()(
    persist(
        (set) => ({
            address: null,
            serialized: null,
            setWallet: (wallet) => set(wallet),
        }),
        {
            name: "shannon_wallet",
            storage: createJSONStorage(() => safeStorage),
        }
    )
);

type SerializedWalletParams = {
    serialization: string;
    password: string;
};

/**
 * Function to automatically detect if a serialized wallet is mainnet or testnet
 * RESPECTS THE SAVED CONFIGURATION GUARDED IN PLACE OF USING THE PREFIX
 */
async function detectAndDeserializeWallet(serialization: string, password: string): Promise<{ wallet: DirectSecp256k1HdWallet, address: string, isMainnet: boolean }> {
    console.log('🔍 Detecting Shannon wallet network...');

    // FIRST: Respect the user's saved configuration
    const savedIsMainnet = await storageService.get<boolean>('isMainnet');
    if (savedIsMainnet !== null && savedIsMainnet !== undefined) {
        console.log('🎯 RESPECTING saved isMainnet configuration:', savedIsMainnet);
        const prefix = savedIsMainnet === true ? NETWORKS.SHANNON.MAINNET.prefix : NETWORKS.SHANNON.TESTNET.prefix;

        try {
            const wallet = await DirectSecp256k1HdWallet.deserialize(serialization, password);
            const [account] = await wallet.getAccounts();

            if (account) {
                console.log(`✅ Wallet deserialized with saved config (${savedIsMainnet === true ? 'mainnet' : 'testnet'}):`, account.address);
                return { wallet, address: account.address, isMainnet: savedIsMainnet };
            }
        } catch (error) {
            console.log('❌ Deserialization with saved config failed:', (error as Error).message);
        }
    }

    // ONLY if there is no saved configuration, try detection (but default to testnet)
    console.log('🔧 No saved config found, attempting deserialization with TESTNET default...');

    try {
        const wallet = await DirectSecp256k1HdWallet.deserialize(serialization, password);
        const [account] = await wallet.getAccounts();

        if (account) {
            console.log('✅ Wallet deserialized with TESTNET default:', account.address);
            // Save default configuration
            await storageService.set('isMainnet', false);
            return { wallet, address: account.address, isMainnet: false };
        }
    } catch (error) {
        console.log('❌ Testnet deserialization failed:', (error as Error).message);
    }

    throw new Error('Could not deserialize Shannon wallet');
}

/**
 * Function to import wallet from mnemonic respecting saved configuration
 */
async function importFromMnemonic(mnemonic: string, password: string): Promise<{ wallet: DirectSecp256k1HdWallet, address: string, isMainnet: boolean }> {
    console.log('🔍 Importing Shannon wallet from mnemonic...');

    const trimmedMnemonic = mnemonic.trim();
    const words = trimmedMnemonic.split(/\s+/);
    if (words.length !== 12 && words.length !== 24) {
        throw new Error(`Mnemonic phrase must have exactly 12 or 24 words. Currently has ${words.length} words.`);
    }

    // FIRST: Respect the user's saved configuration
    const savedIsMainnet = await storageService.get<boolean>('isMainnet');
    if (savedIsMainnet !== null && savedIsMainnet !== undefined) {
        console.log('🎯 RESPECTING saved isMainnet configuration for mnemonic:', savedIsMainnet);
        const prefix = savedIsMainnet === true ? NETWORKS.SHANNON.MAINNET.prefix : NETWORKS.SHANNON.TESTNET.prefix;

        try {
            const wallet = await DirectSecp256k1HdWallet.fromMnemonic(trimmedMnemonic, { prefix });
            const [account] = await wallet.getAccounts();

            if (account) {
                console.log(`✅ Mnemonic wallet created with saved config (${savedIsMainnet === true ? 'mainnet' : 'testnet'}):`, account.address);
                return { wallet, address: account.address, isMainnet: savedIsMainnet };
            }
        } catch (error) {
            console.log('❌ Mnemonic import with saved config failed:', (error as Error).message);
        }
    }

    // ONLY if there is no saved configuration, use TESTNET by default
    console.log('🔧 No saved config found, using TESTNET default for mnemonic...');

    try {
        const wallet = await DirectSecp256k1HdWallet.fromMnemonic(trimmedMnemonic, {
            prefix: NETWORKS.SHANNON.TESTNET.prefix
        });
        const [account] = await wallet.getAccounts();

        if (account) {
            console.log('✅ Mnemonic wallet created with TESTNET default:', account.address);
            // Save default configuration
            await storageService.set('isMainnet', false);
            return { wallet, address: account.address, isMainnet: false };
        }
    } catch (error) {
        console.log('❌ Testnet mnemonic creation failed:', (error as Error).message);
    }

    throw new Error('Could not create Shannon wallet from mnemonic');
}

// Hook to import wallet from serialization
export function useImportWallet(): UseMutationResult<{ address: string; serialized: string; isMainnet: boolean }, Error, SerializedWalletParams> {
    const setWallet = useShannonWalletStore((state) => state.setWallet);
    return useMutation({
        mutationFn: async ({ serialization, password }: SerializedWalletParams) => {
            const { wallet, isMainnet } = await detectAndDeserializeWallet(serialization, password);
            const address = await getAddress(wallet);
            const serializedWallet = await wallet.serialize(password);
            setWallet({ address, serialized: serializedWallet });
            return { address, serialized: serializedWallet, isMainnet };
        },
    });
}

// Hook to create a new wallet
export const useCreateWallet = (): UseMutationResult<{ address: string; serialized: string; isMainnet: boolean }, Error, { password: string; isMainnet?: boolean }> => {
    const setWallet = useShannonWalletStore((state) => state.setWallet);
    return useMutation({
        mutationFn: async ({ password, isMainnet = false }: { password: string; isMainnet?: boolean }) => {
            console.log("Creating new Shannon wallet...");
            try {
                const prefix = isMainnet === true ? NETWORKS.SHANNON.MAINNET.prefix : NETWORKS.SHANNON.TESTNET.prefix;
                console.log(`Using prefix: ${prefix} (${isMainnet === true ? 'mainnet' : 'testnet'})`);

                const wallet = await DirectSecp256k1HdWallet.generate(24, {
                    prefix: prefix
                });
                console.log("Wallet generated successfully with prefix:", prefix);

                const serializedWallet = await wallet.serialize(password);
                console.log("Wallet serialized successfully");

                const address = await getAddress(wallet);
                console.log("Address obtained:", address);

                // Update global state
                setWallet({ address, serialized: serializedWallet });
                console.log("Wallet saved in store");

                // Also save in localStorage for persistence
                await storageService.set('shannon_wallet', {
                    serialized: serializedWallet,
                    network: 'shannon',
                    timestamp: Date.now(),
                    parsed: { address }
                });
                console.log("Wallet saved in localStorage");

                return { address, serialized: serializedWallet, isMainnet };
            } catch (error) {
                console.error("Error creating wallet:", error);
                throw error;
            }
        }
    });
};

async function getAddress(wallet: DirectSecp256k1HdWallet): Promise<string> {
    const [account] = await wallet.getAccounts();
    if (account === undefined) {
        throw new Error("No accounts");
    }
    return account.address;
}

type MnemonicWalletParams = {
    mnemonic: string;
    passwordToSerializeWith: string;
};

// Hook to import wallet from mnemonic
export function useImportMnemonic(): UseMutationResult<{ address: string; serialized: string; isMainnet: boolean }, Error, MnemonicWalletParams> {
    const setWallet = useShannonWalletStore((state) => state.setWallet);
    return useMutation({
        mutationFn: async ({ mnemonic, passwordToSerializeWith }: MnemonicWalletParams) => {
            const { wallet, address, isMainnet } = await importFromMnemonic(mnemonic, passwordToSerializeWith);
            const serializedWallet = await wallet.serialize(passwordToSerializeWith);
            setWallet({ address, serialized: serializedWallet });
            return { address, serialized: serializedWallet, isMainnet };
        }
    });
}

export class ShannonWallet {
    private client: StargateClient | null = null;
    private signingClient: SigningStargateClient | null = null;
    private wallet: DirectSecp256k1HdWallet | null = null;
    private networkMode: 'MAINNET' | 'TESTNET';
    private connectionAttempts: number = 0;
    private readonly maxConnectionAttempts: number = 3;
    private lastSuccessfulRpcUrl: string | null = null;
    private isOfflineMode: boolean = false;

    constructor(networkMode: 'MAINNET' | 'TESTNET' = 'TESTNET') {
        this.networkMode = networkMode;
        // Don't call initializeClient in the constructor to avoid blocking during import
        // It will be initialized when needed
    }

    private async initializeClient() {
        if (this.isOfflineMode) {
            console.log('⚡ Shannon wallet in offline mode - skipping connection attempt');
            return;
        }

        const rpcUrls = this.networkMode === 'MAINNET'
            ? NETWORKS.SHANNON.MAINNET.rpcUrls
            : NETWORKS.SHANNON.TESTNET.rpcUrls;

        for (const rpcUrl of rpcUrls) {
            try {
                console.log(`Attempting to connect to: ${rpcUrl}`);
                this.client = await StargateClient.connect(rpcUrl);
                this.lastSuccessfulRpcUrl = rpcUrl;
                console.log(`✅ Successful connection to: ${rpcUrl}`);
                this.connectionAttempts = 0; // Reset counter on success
                return;
            } catch (error) {
                console.error(`Error connecting to ${rpcUrl}:`, error);
                this.connectionAttempts++;
            }
        }

        // If we get here, we couldn't connect to any RPC
        console.warn(`Could not connect to SHANNON network.`);
        this.isOfflineMode = true;
        throw new Error('Could not connect to the network. Please check your internet connection and try again. - Will operate in offline mode. Try with another CORS proxy or later.');
    }

    async importWallet(mnemonic: string): Promise<string> {
        // Normalize the mnemonic phrase
        const normalizedMnemonic = mnemonic.trim().toLowerCase();

        // Verify that the phrase has 12 or 24 words
        const words = normalizedMnemonic.split(/\s+/);
        if (words.length !== 12 && words.length !== 24) {
            throw new Error(`Mnemonic phrase must have exactly 12 or 24 words. Has ${words.length} words.`);
        }

        // FORCE MAINNET with prefix "pokt"
        console.log('🔵 ShannonWallet.importWallet - FORZANDO prefijo MAINNET "pokt"');
        const prefix = "pokt"; // ALWAYS FORCE mainnet prefix

        this.wallet = await DirectSecp256k1HdWallet.fromMnemonic(normalizedMnemonic, {
            prefix: prefix // Use forced mainnet prefix
        });

        // Get the address (doesn't require network connection)
        const [account] = await this.wallet.getAccounts();
        if (!account) {
            throw new Error("Could not obtain wallet account");
        }

        console.log(`✅ Shannon wallet importada con prefijo MAINNET: ${account.address}`);

        // Try to initialize the client, but don't fail if it can't connect
        if (!this.client && !this.isOfflineMode) {
            try {
                await this.initializeClient();
            } catch (error) {
                console.warn('Could not connect during wallet import, operating in offline mode:', error);
                this.isOfflineMode = true;
            }
        }

        return account.address;
    }

    async getBalance(address: string): Promise<string> {
        if (this.isOfflineMode) {
            console.warn("Shannon wallet in offline mode. Balance not available.");
            return '0';
        }

        if (!this.client) {
            try {
                await this.initializeClient();
            } catch (error) {
                console.warn("Could not connect to get balance:", error);
                return '0';
            }
        }

        try {
            const balance = await this.client!.getBalance(address, "upokt");
            return balance.amount;
        } catch (error) {
            console.error("Error getting balance:", error);
            return '0';
        }
    }

    async getTransactions(address: string): Promise<Transaction[]> {
        if (this.isOfflineMode) {
            console.warn("Shannon wallet in offline mode. Transactions not available.");
            return [];
        }

        console.log(`🔍 Getting transactions for Shannon ${this.networkMode} - Address: ${address}`);

        if (!this.client) {
            try {
                await this.initializeClient();
            } catch (error) {
                console.warn("Could not connect to get transactions:", error);
                return [];
            }
        }

        try {
            console.log(`📡 Searching transactions on Shannon ${this.networkMode} network...`);

            // Search for sent transactions
            const sentTxs = await this.client!.searchTx(`message.sender='${address}'`);
            console.log(`📤 Found ${sentTxs.length} sent transactions`);

            // Search for received transactions
            const receivedTxs = await this.client!.searchTx(`transfer.recipient='${address}'`);
            console.log(`📥 Found ${receivedTxs.length} received transactions`);

            const allTxs = [...sentTxs, ...receivedTxs];
            const decodedTransactions = this.decodeTransactions(allTxs, address);
            console.log(receivedTxs, sentTxs);

            console.log(`✅ Successfully decoded ${decodedTransactions.length} total transactions for Shannon ${this.networkMode}`);
            return decodedTransactions;
        } catch (error) {
            console.error(`❌ Error getting transactions for Shannon ${this.networkMode}:`, error);
            return [];
        }
    }

    private decodeTransactions(txs: IndexedTx[], address: string): Transaction[] {
        console.log(`🔧 Decoding ${txs.length} transactions for address: ${address}`);

        const transactions: Transaction[] = [];

        for (let i = 0; i < txs.length; i++) {
            const tx = txs[i];

            try {
                console.log(`🔍 Processing transaction ${i + 1}/${txs.length}:`, {
                    hash: tx.hash,
                    height: tx.height,
                    code: tx.code
                });

                // Decode the transaction first
                const decodedTx = Tx.decode(tx.tx);

                // Verify if it has the expected basic structure
                if (!decodedTx.body || !decodedTx.body.messages || decodedTx.body.messages.length === 0) {
                    console.warn(`⚠️ Transaction ${tx.hash} has invalid structure:`, {
                        hasBody: !!decodedTx.body,
                        hasMessages: !!decodedTx.body?.messages,
                        messagesLength: decodedTx.body?.messages?.length || 0
                    });
                    continue;
                }

                // Get the first message
                const firstMessage = decodedTx.body.messages[0];
                console.log(`📨 First message structure:`, {
                    typeUrl: firstMessage.typeUrl,
                    hasValue: !!firstMessage.value
                });

                // Verify that it's a MsgSend
                if (firstMessage.typeUrl !== "/cosmos.bank.v1beta1.MsgSend") {
                    console.log(`ℹ️ Skipping non-send transaction type: ${firstMessage.typeUrl}`);
                    continue;
                }

                // Decode the message
                const decodedMessage = MsgSend.decode(firstMessage.value);
                console.log(`🔓 Decoded message:`, {
                    fromAddress: decodedMessage.fromAddress,
                    toAddress: decodedMessage.toAddress,
                    amount: decodedMessage.amount
                });

                // Verify that it has the necessary fields
                if (!decodedMessage.fromAddress || !decodedMessage.toAddress || !decodedMessage.amount) {
                    console.warn(`⚠️ Transaction ${tx.hash} missing required fields:`, {
                        hasFromAddress: !!decodedMessage.fromAddress,
                        hasToAddress: !!decodedMessage.toAddress,
                        hasAmount: !!decodedMessage.amount
                    });
                    continue;
                }

                // Look for the amount in upokt
                let amount = null;
                for (const coin of decodedMessage.amount) {
                    if (coin.denom === "upokt") {
                        amount = coin.amount;
                        break;
                    }
                }

                if (!amount) {
                    console.warn(`⚠️ Transaction ${tx.hash} does not have upokt amount`);
                    continue;
                }

                // Determine the transaction type
                const isSent = decodedMessage.fromAddress === address;
                const status: 'pending' | 'confirmed' | 'failed' = tx.code === 0 ? 'confirmed' : 'failed';
                const type: 'send' | 'recv' = isSent ? 'send' : 'recv';

                const transaction: Transaction = {
                    hash: tx.hash,
                    from: decodedMessage.fromAddress,
                    to: decodedMessage.toAddress,
                    value: amount,
                    timestamp: tx.height,
                    status,
                    type,
                    height: tx.height
                };

                transactions.push(transaction);
                console.log(`✅ Successfully decoded transaction ${i + 1}: ${type} ${amount} upokt`);

            } catch (error) {
                console.error(`❌ Error decoding transaction ${i + 1} (${tx.hash}):`, error);
                console.error(`📋 Transaction structure:`, tx);
                // Continue with the next transaction instead of failing
                continue;
            }
        }

        const sortedTransactions = transactions.sort((a, b) => b.height - a.height);
        console.log(`🎯 Final result: ${sortedTransactions.length} successfully decoded transactions`);

        return sortedTransactions;
    }

    async sendTransaction(toAddress: string, amount: string): Promise<string> {
        if (!this.wallet || !this.client) {
            throw new Error('Wallet not initialized');
        }

        const [account] = await this.wallet.getAccounts();
        if (!account) {
            throw new Error('No se pudo obtener la cuenta');
        }

        const signingClient = await SigningStargateClient.connectWithSigner(
            this.lastSuccessfulRpcUrl!,
            this.wallet
        );

        const msg = {
            typeUrl: "/cosmos.bank.v1beta1.MsgSend",
            value: MsgSend.fromPartial({
                fromAddress: account.address,
                toAddress: toAddress,
                amount: [{
                    denom: "upokt",
                    amount: amount
                }]
            })
        };

        const fee = {
            amount: [{
                denom: "upokt",
                amount: "10000"
            }],
            gas: "200000"
        };

        const result = await signingClient.signAndBroadcast(account.address, [msg], fee);
        return result.transactionHash;
    }
} 