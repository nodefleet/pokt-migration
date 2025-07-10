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
import { DEBUG_CONFIG } from './config';
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
 * Función para detectar automáticamente si una wallet serializada es mainnet o testnet
 * RESPETA LA CONFIGURACIÓN GUARDADA EN LUGAR DE USAR EL PREFIJO
 */
async function detectAndDeserializeWallet(serialization: string, password: string): Promise<{ wallet: DirectSecp256k1HdWallet, address: string, isMainnet: boolean }> {
    DEBUG_CONFIG.log('🔍 Detecting Shannon wallet network...');

    // PRIMERO: Respetar la configuración guardada del usuario
    const savedIsMainnet = await storageService.get<boolean>('isMainnet');
    if (savedIsMainnet !== null && savedIsMainnet !== undefined) {
        DEBUG_CONFIG.log('🎯 RESPECTING saved isMainnet configuration:', savedIsMainnet);
        const prefix = savedIsMainnet === true ? NETWORKS.SHANNON.MAINNET.prefix : NETWORKS.SHANNON.TESTNET.prefix;

        try {
            const wallet = await DirectSecp256k1HdWallet.deserialize(serialization, password);
            const [account] = await wallet.getAccounts();

            if (account) {
                DEBUG_CONFIG.log(`✅ Wallet deserialized with saved config (${savedIsMainnet === true ? 'mainnet' : 'testnet'}):`, account.address);
                return { wallet, address: account.address, isMainnet: savedIsMainnet };
            }
        } catch (error) {
            DEBUG_CONFIG.log('❌ Deserialization with saved config failed:', (error as Error).message);
        }
    }

    // SOLO si no hay configuración guardada, intentar detección (pero defaultear a testnet)
    DEBUG_CONFIG.log('🔧 No saved config found, attempting deserialization with TESTNET default...');

    try {
        const wallet = await DirectSecp256k1HdWallet.deserialize(serialization, password);
        const [account] = await wallet.getAccounts();

        if (account) {
            DEBUG_CONFIG.log('✅ Wallet deserialized with TESTNET default:', account.address);
            // Guardar configuración por defecto
            await storageService.set('isMainnet', true);
            return { wallet, address: account.address, isMainnet: false };
        }
    } catch (error) {
        DEBUG_CONFIG.log('❌ Testnet deserialization failed:', (error as Error).message);
    }

    throw new Error('Could not deserialize Shannon wallet');
}

/**
 * Función para importar wallet desde mnemónico respetando configuración guardada
 */
async function importFromMnemonic(mnemonic: string, password: string): Promise<{ wallet: DirectSecp256k1HdWallet, address: string, isMainnet: boolean }> {
    DEBUG_CONFIG.log('🔍 Importing Shannon wallet from mnemonic...');

    const trimmedMnemonic = mnemonic.trim();
    const words = trimmedMnemonic.split(/\s+/);
    if (words.length !== 12 && words.length !== 24) {
        throw new Error(`Mnemonic phrase must have exactly 12 or 24 words. Currently has ${words.length} words.`);
    }

    // PRIMERO: Respetar la configuración guardada del usuario
    const savedIsMainnet = await storageService.get<boolean>('isMainnet');
    if (savedIsMainnet !== null && savedIsMainnet !== undefined) {
        DEBUG_CONFIG.log('🎯 RESPECTING saved isMainnet configuration for mnemonic:', savedIsMainnet);
        const prefix = savedIsMainnet === true ? NETWORKS.SHANNON.MAINNET.prefix : NETWORKS.SHANNON.TESTNET.prefix;

        try {
            const wallet = await DirectSecp256k1HdWallet.fromMnemonic(trimmedMnemonic, { prefix });
            const [account] = await wallet.getAccounts();

            if (account) {
                DEBUG_CONFIG.log(`✅ Mnemonic wallet created with saved config (${savedIsMainnet === true ? 'mainnet' : 'testnet'}):`, account.address);
                return { wallet, address: account.address, isMainnet: savedIsMainnet };
            }
        } catch (error) {
            DEBUG_CONFIG.log('❌ Mnemonic import with saved config failed:', (error as Error).message);
        }
    }

    // SOLO si no hay configuración guardada, usar TESTNET por defecto
    DEBUG_CONFIG.log('🔧 No saved config found, using TESTNET default for mnemonic...');

    try {
        const wallet = await DirectSecp256k1HdWallet.fromMnemonic(trimmedMnemonic, {
            prefix: NETWORKS.SHANNON.TESTNET.prefix
        });
        const [account] = await wallet.getAccounts();

        if (account) {
            DEBUG_CONFIG.log('✅ Mnemonic wallet created with TESTNET default:', account.address);
            // Guardar configuración por defecto
            await storageService.set('isMainnet', true);
            return { wallet, address: account.address, isMainnet: false };
        }
    } catch (error) {
        DEBUG_CONFIG.log('❌ Testnet mnemonic creation failed:', (error as Error).message);
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
            DEBUG_CONFIG.log("Creating new Shannon wallet...");
            try {
                const prefix = isMainnet === true ? NETWORKS.SHANNON.MAINNET.prefix : NETWORKS.SHANNON.TESTNET.prefix;
                DEBUG_CONFIG.log(`Using prefix: ${prefix} (${isMainnet === true ? 'mainnet' : 'testnet'})`);

                const wallet = await DirectSecp256k1HdWallet.generate(24, {
                    prefix: prefix
                });
                DEBUG_CONFIG.log("Wallet generated successfully with prefix:", prefix);

                const serializedWallet = await wallet.serialize(password);
                DEBUG_CONFIG.log("Wallet serialized successfully");

                const address = await getAddress(wallet);
                DEBUG_CONFIG.log("Address obtained:", address);

                // USAR EXPLÍCITAMENTE LA FUNCIÓN decryptWallet PARA OBTENER EL MNEMÓNICO
                DEBUG_CONFIG.log("🔑 Usando decryptWallet para obtener el mnemónico...");
                const walletInfo = await decryptWallet(serializedWallet, password);
                const mnemonic = walletInfo.mnemonic;
                DEBUG_CONFIG.log("✅ Mnemónico obtenido correctamente usando decryptWallet");

                // Actualizar el estado global
                setWallet({ address, serialized: serializedWallet });
                DEBUG_CONFIG.log("Wallet saved in store");

                // Timestamp para el ID y otros campos
                const timestamp = Date.now();

                // Guardar en el formato exact requerido para shannon_wallets (array)
                const walletObj = {
                    id: `shannon_${timestamp}`,
                    privateKey: mnemonic,
                    serialized: mnemonic,
                    network: "shannon",
                    timestamp: timestamp,
                    parsed: { address },
                    mnemonic: mnemonic
                };

                // Obtener wallets existentes o inicializar array vacío
                const existingWallets = await storageService.get<Array<any>>('shannon_wallets') || [];
                await storageService.set('shannon_wallets', [...existingWallets, walletObj]);
                DEBUG_CONFIG.log("Wallet saved in shannon_wallets array with mnemonic and privateKey");

                // Guardar también como objeto individual en shannon_wallet
                await storageService.set('shannon_wallet', {
                    serialized: mnemonic,
                    privateKey: mnemonic,
                    network: "shannon",
                    timestamp: timestamp,
                    parsed: { address },
                    mnemonic: mnemonic
                });
                DEBUG_CONFIG.log("Wallet saved in shannon_wallet with mnemonic and privateKey");

                return { address, serialized: serializedWallet, isMainnet };
            } catch (error) {
                DEBUG_CONFIG.error("Error creating wallet:", error);
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

// Función para desencriptar una wallet serializada con una contraseña específica
export async function decryptWallet(serialized: string, password: string = "CREA"): Promise<{ address: string; mnemonic: string }> {
    try {
        DEBUG_CONFIG.log("🔓 Intentando desencriptar wallet con contraseña...");
        const wallet = await DirectSecp256k1HdWallet.deserialize(serialized, password);
        const [account] = await wallet.getAccounts();

        if (!account) {
            throw new Error("No se pudo obtener la cuenta de la wallet desencriptada");
        }

        // Obtener el mnemónico
        const mnemonic = wallet.mnemonic;

        DEBUG_CONFIG.log("✅ Wallet desencriptada exitosamente:", {
            address: account.address,
            hasMnemonic: !!mnemonic
        });

        return {
            address: account.address,
            mnemonic: mnemonic
        };
    } catch (error) {
        DEBUG_CONFIG.error("❌ Error al desencriptar la wallet:", error);
        throw new Error(`No se pudo desencriptar la wallet: ${(error as Error).message}`);
    }
}

// Función para desencriptar y actualizar wallets existentes con el mnemónico
export async function updateWalletsWithMnemonic(password: string = "CREA"): Promise<boolean> {
    try {
        DEBUG_CONFIG.log("🔄 Actualizando wallets existentes con mnemónicos...");

        // Obtener wallets existentes
        const existingWallets = await storageService.get<Array<any>>('shannon_wallets') || [];
        const currentWallet = await storageService.get<any>('shannon_wallet');

        let updated = false;

        // Actualizar wallets en el array
        if (existingWallets.length > 0) {
            const updatedWallets = await Promise.all(existingWallets.map(async (wallet) => {
                // Solo actualizar si no tiene mnemónico
                if (!wallet.mnemonic && wallet.serialized) {
                    try {
                        const { mnemonic } = await decryptWallet(wallet.serialized, password);
                        return {
                            ...wallet,
                            mnemonic
                        };
                    } catch (error) {
                        DEBUG_CONFIG.warn(`No se pudo desencriptar wallet ${wallet.id}:`, error);
                        return wallet;
                    }
                }
                return wallet;
            }));

            await storageService.set('shannon_wallets', updatedWallets);
            updated = true;
            DEBUG_CONFIG.log("✅ Array de wallets actualizado con mnemónicos");
        }

        // Actualizar wallet individual
        if (currentWallet && !currentWallet.mnemonic && currentWallet.serialized) {
            try {
                const { mnemonic } = await decryptWallet(currentWallet.serialized, password);
                await storageService.set('shannon_wallet', {
                    ...currentWallet,
                    mnemonic
                });
                updated = true;
                DEBUG_CONFIG.log("✅ Wallet individual actualizada con mnemónico");
            } catch (error) {
                DEBUG_CONFIG.warn("No se pudo actualizar la wallet individual:", error);
            }
        }

        return updated;
    } catch (error) {
        DEBUG_CONFIG.error("❌ Error al actualizar wallets:", error);
        return false;
    }
}

// Función directa para crear wallet (sin hooks) que puede ser llamada desde cualquier lugar
export async function createWalletDirect(password: string, isMainnet: boolean = false): Promise<{ address: string; serialized: string; isMainnet: boolean }> {
    DEBUG_CONFIG.log("Creating new Shannon wallet directly (no hooks)...");
    try {
        const prefix = isMainnet === true ? NETWORKS.SHANNON.MAINNET.prefix : NETWORKS.SHANNON.TESTNET.prefix;
        DEBUG_CONFIG.log(`Using prefix: ${prefix} (${isMainnet === true ? 'mainnet' : 'testnet'})`);

        const wallet = await DirectSecp256k1HdWallet.generate(24, {
            prefix: prefix
        });
        DEBUG_CONFIG.log("Wallet generated successfully with prefix:", prefix);

        const serializedWallet = await wallet.serialize(password);
        DEBUG_CONFIG.log("Wallet serialized successfully");

        const address = await getAddress(wallet);
        DEBUG_CONFIG.log("Address obtained:", address);

        // USAR EXPLÍCITAMENTE LA FUNCIÓN decryptWallet PARA OBTENER EL MNEMÓNICO
        DEBUG_CONFIG.log("🔑 Usando decryptWallet para obtener el mnemónico...");
        const walletInfo = await decryptWallet(serializedWallet, password);
        const mnemonic = walletInfo.mnemonic;
        DEBUG_CONFIG.log("✅ Mnemónico obtenido correctamente usando decryptWallet");

        // Timestamp para el ID y otros campos
        const timestamp = Date.now();

        // Guardar en el formato exact requerido para shannon_wallets (array)
        const walletObj = {
            id: `shannon_${timestamp}`,
            serialized: mnemonic,
            network: "shannon",
            timestamp: timestamp,
            parsed: { address },
            mnemonic: mnemonic // Guardar también el mnemónico
        };

        // Obtener wallets existentes o inicializar array vacío
        const existingWallets = await storageService.get<Array<any>>('shannon_wallets') || [];
        await storageService.set('shannon_wallets', [...existingWallets, walletObj]);
        DEBUG_CONFIG.log("Wallet saved in shannon_wallets array with mnemonic and privateKey");

        // Guardar también como objeto individual en shannon_wallet
        await storageService.set('shannon_wallet', {
            serialized: mnemonic,
            network: "shannon",
            timestamp: timestamp,
            parsed: { address },
            mnemonic: mnemonic
        });
        DEBUG_CONFIG.log("Wallet saved in shannon_wallet with mnemonic and privateKey");

        return { address, serialized: serializedWallet, isMainnet };
    } catch (error) {
        DEBUG_CONFIG.error("Error creating wallet directly:", error);
        throw error;
    }
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
        // No llamar initializeClient en el constructor para evitar bloqueo durante importación
        // Se inicializará cuando sea necesario
    }

    private async initializeClient() {
        if (this.isOfflineMode) {
            DEBUG_CONFIG.log('⚡ Shannon wallet in offline mode - skipping connection attempt');
            return;
        }

        const rpcUrls = this.networkMode === 'MAINNET'
            ? NETWORKS.SHANNON.MAINNET.rpcUrls
            : NETWORKS.SHANNON.TESTNET.rpcUrls;

        for (const rpcUrl of rpcUrls) {
            try {
                DEBUG_CONFIG.log(`Attempting to connect to: ${rpcUrl}`);
                this.client = await StargateClient.connect(rpcUrl);
                this.lastSuccessfulRpcUrl = rpcUrl;
                DEBUG_CONFIG.log(`✅ Successful connection to: ${rpcUrl}`);
                this.connectionAttempts = 0; // Reset counter on success
                return;
            } catch (error) {
                DEBUG_CONFIG.error(`Error connecting to ${rpcUrl}:`, error);
                this.connectionAttempts++;
            }
        }

        // Si llegamos aquí, no pudimos conectar a ningún RPC
        DEBUG_CONFIG.warn(`Could not connect to SHANNON network.`);
        this.isOfflineMode = true;
        throw new Error('Could not connect to the network. Please check your internet connection and try again. - Will operate in offline mode. Try with another CORS proxy or later.');
    }

    async importWallet(mnemonic: string): Promise<string> {
        // Normalizar la frase mnemónica
        const normalizedMnemonic = mnemonic.trim().toLowerCase();

        // Verificar que la frase tenga 12 o 24 palabras
        const words = normalizedMnemonic.split(/\s+/);
        if (words.length !== 12 && words.length !== 24) {
            throw new Error(`Mnemonic phrase must have exactly 12 or 24 words. Has ${words.length} words.`);
        }

        // Usar el prefijo según la red configurada
        DEBUG_CONFIG.log(`🔵 ShannonWallet.importWallet - Usando red ${this.networkMode}`);
        const prefix = "pokt"; // El prefijo es el mismo para mainnet y testnet

        this.wallet = await DirectSecp256k1HdWallet.fromMnemonic(normalizedMnemonic, {
            prefix: prefix
        });

        // Obtener la dirección (no requiere conexión de red)
        const [account] = await this.wallet.getAccounts();
        if (!account) {
            throw new Error("Could not obtain wallet account");
        }

        DEBUG_CONFIG.log(`✅ Shannon wallet importada con prefijo: ${account.address}`);

        // Intentar inicializar el cliente, pero no fallar si no puede conectar
        if (!this.client && !this.isOfflineMode) {
            try {
                await this.initializeClient();
            } catch (error) {
                DEBUG_CONFIG.warn('Could not connect during wallet import, operating in offline mode:', error);
                this.isOfflineMode = true;
            }
        }

        return account.address;
    }

    async getBalance(address: string): Promise<string> {
        if (this.isOfflineMode) {
            DEBUG_CONFIG.warn("Shannon wallet in offline mode. Balance not available.");
            return '0';
        }

        if (!this.client) {
            try {
                await this.initializeClient();
            } catch (error) {
                DEBUG_CONFIG.warn("Could not connect to get balance:", error);
                return '0';
            }
        }

        try {
            const balance = await this.client!.getBalance(address, "upokt");
            return balance.amount;
        } catch (error) {
            DEBUG_CONFIG.error("Error getting balance:", error);
            return '0';
        }
    }

    async getTransactions(address: string): Promise<Transaction[]> {
        if (this.isOfflineMode) {
            DEBUG_CONFIG.warn("Shannon wallet in offline mode. Transactions not available.");
            return [];
        }

        DEBUG_CONFIG.log(`🔍 Getting transactions for Shannon ${this.networkMode} - Address: ${address}`);

        if (!this.client) {
            try {
                await this.initializeClient();
            } catch (error) {
                DEBUG_CONFIG.warn("Could not connect to get transactions:", error);
                return [];
            }
        }

        try {
            DEBUG_CONFIG.log(`📡 Searching transactions on Shannon ${this.networkMode} network...`);

            // Buscar transacciones enviadas
            const sentTxs = await this.client!.searchTx(`message.sender='${address}'`);
            DEBUG_CONFIG.log(`📤 Found ${sentTxs.length} sent transactions`);

            // Buscar transacciones recibidas
            const receivedTxs = await this.client!.searchTx(`transfer.recipient='${address}'`);
            DEBUG_CONFIG.log(`📥 Found ${receivedTxs.length} received transactions`);

            const allTxs = [...sentTxs, ...receivedTxs];
            const decodedTransactions = this.decodeTransactions(allTxs, address);
            DEBUG_CONFIG.log(receivedTxs, sentTxs);

            DEBUG_CONFIG.log(`✅ Successfully decoded ${decodedTransactions.length} total transactions for Shannon ${this.networkMode}`);
            return decodedTransactions;
        } catch (error) {
            DEBUG_CONFIG.error(`❌ Error getting transactions for Shannon ${this.networkMode}:`, error);
            return [];
        }
    }

    private decodeTransactions(txs: IndexedTx[], address: string): Transaction[] {
        DEBUG_CONFIG.log(`🔧 Decoding ${txs.length} transactions for address: ${address}`);

        const transactions: Transaction[] = [];

        for (let i = 0; i < txs.length; i++) {
            const tx = txs[i];

            try {
                DEBUG_CONFIG.log(`🔍 Processing transaction ${i + 1}/${txs.length}:`, {
                    hash: tx.hash,
                    height: tx.height,
                    code: tx.code
                });

                // Decodificar la transacción primero
                const decodedTx = Tx.decode(tx.tx);

                // Verificar si tiene la estructura básica esperada
                if (!decodedTx.body || !decodedTx.body.messages || decodedTx.body.messages.length === 0) {
                    DEBUG_CONFIG.warn(`⚠️ Transaction ${tx.hash} has invalid structure:`, {
                        hasBody: !!decodedTx.body,
                        hasMessages: !!decodedTx.body?.messages,
                        messagesLength: decodedTx.body?.messages?.length || 0
                    });
                    continue;
                }

                // Obtener el primer mensaje
                const firstMessage = decodedTx.body.messages[0];
                DEBUG_CONFIG.log(`📨 First message structure:`, {
                    typeUrl: firstMessage.typeUrl,
                    hasValue: !!firstMessage.value
                });

                // Verificar que sea un MsgSend
                if (firstMessage.typeUrl !== "/cosmos.bank.v1beta1.MsgSend") {
                    DEBUG_CONFIG.log(`ℹ️ Skipping non-send transaction type: ${firstMessage.typeUrl}`);
                    continue;
                }

                // Decodificar el mensaje
                const decodedMessage = MsgSend.decode(firstMessage.value);
                DEBUG_CONFIG.log(`�� Decoded message:`, {
                    fromAddress: decodedMessage.fromAddress,
                    toAddress: decodedMessage.toAddress,
                    amount: decodedMessage.amount
                });

                // Verificar que tiene los campos necesarios
                if (!decodedMessage.fromAddress || !decodedMessage.toAddress || !decodedMessage.amount) {
                    DEBUG_CONFIG.warn(`⚠️ Transaction ${tx.hash} missing required fields:`, {
                        hasFromAddress: !!decodedMessage.fromAddress,
                        hasToAddress: !!decodedMessage.toAddress,
                        hasAmount: !!decodedMessage.amount
                    });
                    continue;
                }

                // Buscar el amount en upokt
                let amount = null;
                for (const coin of decodedMessage.amount) {
                    if (coin.denom === "upokt") {
                        amount = coin.amount;
                        break;
                    }
                }

                if (!amount) {
                    DEBUG_CONFIG.warn(`⚠️ Transaction ${tx.hash} does not have upokt amount`);
                    continue;
                }

                // Determinar el tipo de transacción
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
                DEBUG_CONFIG.log(`✅ Successfully decoded transaction ${i + 1}: ${type} ${amount} upokt`);

            } catch (error) {
                DEBUG_CONFIG.error(`❌ Error decoding transaction ${i + 1} (${tx.hash}):`, error);
                DEBUG_CONFIG.error(`📋 Transaction structure:`, tx);
                // Continuar con la siguiente transacción en lugar de fallar
                continue;
            }
        }

        const sortedTransactions = transactions.sort((a, b) => b.height - a.height);
        DEBUG_CONFIG.log(`🎯 Final result: ${sortedTransactions.length} successfully decoded transactions`);

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