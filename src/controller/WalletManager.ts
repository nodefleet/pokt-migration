import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { SigningStargateClient, StargateClient, IndexedTx } from "@cosmjs/stargate";
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
    private isForcedOffline: boolean = false; // Para permitir operación offline

    constructor(networkType: NetworkType = 'shannon', isTestnet: boolean = true) {
        this.networkType = networkType;
        this.networkMode = isTestnet ? 'TESTNET' : 'MAINNET';

        // Mostrar warning para Morse
        if (networkType === 'morse') {
            console.warn(ERROR_MESSAGES.MORSE_DEPRECATED);
        } else if (networkType === 'shannon') {
            // Inicializar ShannonWallet con la configuración correcta
            this.shannonWallet = new ShannonWallet(this.networkMode);
        }

        this.initializeClient();
    }

    /**
     * Intenta conectar al cliente usando múltiples endpoints RPC
     * @returns {Promise<void>}
     */
    private async initializeClient(): Promise<void> {
        // Si estamos en modo forzado offline, no intentar conectar
        if (this.isForcedOffline) {
            console.warn("Operating in forced offline mode. Network connection will not be attempted.");
            return;
        }

        const network = this.getCurrentNetwork();
        let lastError = null;
        this.connectionAttempts = 0;

        // Intentar conectar a cada RPC URL hasta que uno funcione
        for (const rpcUrl of network.rpcUrls) {
            try {
                this.connectionAttempts++;
                console.log(`Attempting to connect to: ${rpcUrl}`);

                // Usar el último RPC exitoso primero si está disponible
                const urlToUse = this.lastSuccessfulRpcUrl !== null ? this.lastSuccessfulRpcUrl : rpcUrl;

                // Establecer timeout para la conexión
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos timeout

                // Verificar si el error es de CORS y mostrar mensaje específico
                if (lastError && lastError.toString().includes("CORS")) {
                    console.warn(ERROR_MESSAGES.CORS_ERROR);
                }

                this.client = await StargateClient.connect(urlToUse);
                clearTimeout(timeoutId);

                console.log(`Successful connection to: ${urlToUse}`);
                this.lastSuccessfulRpcUrl = urlToUse;

                // Si tenemos una wallet, también inicializar el signing client
                if (this.wallet) {
                    this.signingClient = await SigningStargateClient.connectWithSigner(urlToUse, this.wallet);
                }

                return; // Si se conectó con éxito, terminar
            } catch (error) {
                console.error(`Error connecting to ${rpcUrl}:`, error);
                lastError = error;
                // Continuar con el siguiente endpoint
            }
        }

        // Activar modo offline para cualquier red después de agotar los intentos
        if (this.connectionAttempts >= this.maxConnectionAttempts) {
            console.error(`Could not connect to ${this.networkType.toUpperCase()} network.`);
            this.isForcedOffline = true; // Permite operar en modo offline

            // Mensaje específico para Morse debido a su estado de migración
            if (this.networkType === 'morse') {
                throw new Error(`${ERROR_MESSAGES.NETWORK_CONNECTION_ERROR} - Morse network not available. Will operate in offline mode. Migration to Shannon is recommended.`);
            } else {
                throw new Error(`${ERROR_MESSAGES.NETWORK_CONNECTION_ERROR} - Will operate in offline mode. Try with another CORS proxy or later.`);
            }
        }

        // Si llegamos aquí, ningún endpoint funcionó
        console.error(ERROR_MESSAGES.NETWORK_CONNECTION_ERROR);
        throw new Error(ERROR_MESSAGES.NETWORK_CONNECTION_ERROR + (lastError ? `: ${lastError instanceof Error ? lastError.message : String(lastError)}` : ''));
    }

    /**
     * Cambia entre testnet y mainnet
     * @param networkType - 'shannon' o 'morse'
     * @param isTestnet - true para usar testnet, false para mainnet
     */
    async switchNetwork(networkType: NetworkType = this.networkType, isTestnet: boolean = true): Promise<void> {
        if (networkType === 'morse') {
            console.warn(ERROR_MESSAGES.MORSE_DEPRECATED);
            // Para Morse, configurar la red pero permitir que funcione
            this.networkType = networkType;
            this.networkMode = isTestnet ? 'TESTNET' : 'MAINNET';
            // No forzar offline automáticamente - permitir que Morse funcione
            this.isForcedOffline = false;
            console.log(`🟡 MORSE network configured for ${this.networkMode} mode`);

            // Intentar inicializar cliente para Morse también
            try {
                await this.initializeClient();
                console.log('✅ MORSE network connection successful');
            } catch (error) {
                console.warn('⚠️ MORSE network connection failed, operating in offline mode');
                this.isForcedOffline = true;
            }
            return;
        }

        // CORREGIR: Establecer networkMode ANTES de crear ShannonWallet
        this.networkType = networkType;
        this.networkMode = isTestnet ? 'TESTNET' : 'MAINNET';
        this.lastSuccessfulRpcUrl = null; // Resetear la URL exitosa al cambiar de red
        this.isForcedOffline = false; // Reintentar la conexión al cambiar de red

        // Reinicializar ShannonWallet con la nueva configuración
        if (networkType === 'shannon') {
            this.shannonWallet = new ShannonWallet(this.networkMode);
            console.log(`🔧 ShannonWallet reinitializado para ${this.networkMode} (isTestnet: ${isTestnet})`);
        }

        try {
            await this.initializeClient();
        } catch (error) {
            console.warn(`Could not connect to ${networkType} network. Operating in offline mode.`);
            console.error('Connection error:', error);
            this.isForcedOffline = true;

            // Solo lanzar error en Shannon si el código que llama no maneja errores
            if ((networkType as NetworkType) !== 'morse') {
                throw error;
            }
        }
    }

    /**
     * Activar modo offline para la red Morse
     */
    setOfflineMode(offline: boolean = true): void {
        this.isForcedOffline = offline;
        console.log(`Offline mode ${offline ? 'enabled' : 'disabled'}`);
    }

    /**
     * Verifica si estamos en modo offline
     */
    isOfflineMode(): boolean {
        return this.isForcedOffline;
    }

    /**
     * Intenta reconectar si la conexión falla
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
     * Obtiene si la red actual es testnet
     * @returns {boolean} true si es testnet, false si es mainnet
     */
    isTestnetNetwork(): boolean {
        return this.networkMode === 'TESTNET';
    }

    /**
     * Obtiene el tipo de red actual (shannon o morse)
     * @returns {NetworkType} El tipo de red actual
     */
    getNetworkType(): NetworkType {
        return this.networkType;
    }

    /**
     * Obtiene la configuración de la red actual
     */
    getCurrentNetwork() {
        return NETWORKS[this.networkType.toUpperCase() as keyof typeof NETWORKS][this.networkMode];
    }

    /**
     * Crea una nueva wallet
     * @param password - Contraseña para encriptar la wallet
     * @returns {Promise<{address: string, serializedWallet: string}>} La dirección y la wallet serializada
     */
    async createWallet(password: string): Promise<{ address: string; serializedWallet: string }> {
        try {
            const network = this.getCurrentNetwork();
            this.wallet = await DirectSecp256k1HdWallet.generate(24, { prefix: network.prefix });
            const [firstAccount] = await this.wallet.getAccounts();
            const serializedWallet = await this.wallet.serialize(password);

            // Re-inicializar cliente con signing client
            try {
                await this.initializeClient();
            } catch (error) {
                // Si es Morse, continuamos en modo offline
                if (this.networkType === 'morse') {
                    this.isForcedOffline = true;
                    console.warn("Wallet created in offline mode. Network functions will be limited.");
                } else {
                    throw error;
                }
            }

            return {
                address: firstAccount.address,
                serializedWallet
            };
        } catch (error) {
            console.error('Error creating wallet:', error);
            throw new Error(`Could not create wallet: ${error}`);
        }
    }

    /**
     * Importa una wallet existente usando una wallet serializada
     * @param serialization - La wallet serializada
     * @param password - Contraseña para desencriptar la wallet
     * @returns {Promise<string>} La dirección de la wallet importada
     */
    async importWallet(serialization: string, password: string): Promise<string> {
        try {
            // Intentar conectar primero
            if (!this.isOfflineMode()) {
                await this.initializeClient();
            }

            // Para Shannon, usamos la clase ShannonWallet
            if (this.networkType === 'shannon' && this.shannonWallet) {
                return await this.shannonWallet.importWallet(serialization);
            }

            // Para Morse, mantenemos el comportamiento original
            try {
                JSON.parse(serialization);
            } catch (e) {
                throw new Error('Wallet format is not valid. Make sure it is valid JSON.');
            }

            this.wallet = await DirectSecp256k1HdWallet.deserialize(serialization, password);
            const [firstAccount] = await this.wallet.getAccounts();

            return firstAccount.address;
        } catch (error) {
            console.error('Error importing wallet:', error);
            throw error;
        }
    }

    /**
     * Obtiene el balance de la wallet
     * @param address - La dirección de la wallet
     * @returns {Promise<string>} El balance en upokt
     */
    async getBalance(address: string): Promise<string> {
        if (this.isForcedOffline) {
            console.warn("Operating in offline mode. Balance not available.");
            return '0';
        }

        // MORSE: Intentar obtener balance si no está en modo offline
        if ((this.networkType as NetworkType) === 'morse') {
            if (this.isForcedOffline) {
                console.log("🟡 MORSE wallet in offline mode - returning balance 0");
                return '0';
            }
            console.log("🟡 MORSE wallet - attempting to get balance from network");
            // Continuar con la lógica normal para intentar obtener balance
        }

        try {
            if (this.networkType === 'shannon' && this.shannonWallet) {
                return await this.shannonWallet.getBalance(address);
            }

            if (!this.client) {
                const reconnected = await this.tryReconnect();
                if (!reconnected) {
                    if ((this.networkType as NetworkType) === 'morse') {
                        console.warn("Could not connect to Morse network to get balance. Using '0' as default value.");
                        return '0';
                    }
                    throw new Error('Client not initialized and could not reconnect');
                }
            }

            if (!address || address.trim() === '') {
                console.error('Invalid wallet address');
                return '0';
            }

            const result = await this.client?.getBalance(address, "upokt");

            if (!result || typeof result.amount !== 'string') {
                console.error('Invalid balance response:', result);
                return '0';
            }

            return result.amount;
        } catch (error) {
            console.error('Error getting balance:', error);

            if ((this.networkType as NetworkType) === 'morse') {
                console.warn("Error getting balance on Morse network. The network may be under migration.");
                this.isForcedOffline = true;
            }

            return '0';
        }
    }

    /**
     * Obtiene las transacciones de una wallet
     * @param address - La dirección de la wallet
     * @returns {Promise<Transaction[]>} Lista de transacciones
     */
    async getTransactions(address: string): Promise<Transaction[]> {
        if (this.isForcedOffline) {
            console.warn("Operating in offline mode. Transactions not available.");
            return [];
        }

        console.log(`🔍 Getting transactions for ${this.networkType} ${this.networkMode} - Address: ${address}`);

        try {
            // SHANNON: Usar ShannonWallet que ya maneja mainnet/testnet correctamente
            if (this.networkType === 'shannon' && this.shannonWallet) {
                console.log(`🔵 Using Shannon wallet for transactions (${this.networkMode})`);
                return await this.shannonWallet.getTransactions(address);
            }

            // MORSE: Implementar obtención de transacciones
            if (this.networkType === 'morse') {
                console.log(`🟡 Getting MORSE transactions for ${this.networkMode}`);
                return await this.getMorseTransactions(address);
            }

            // FALLBACK: Usar cliente genérico (principalmente para Shannon si no hay ShannonWallet)
            console.log(`📡 Using generic client for ${this.networkType} ${this.networkMode}`);

            if (!this.client) {
                const reconnected = await this.tryReconnect();
                if (!reconnected) {
                    console.warn(`❌ Could not connect to ${this.networkType} ${this.networkMode} network`);
                    return [];
                }
            }

            const sendTx = await this.client!.searchTx(`message.sender='${address}'`);
            const sendTransactions: Transaction[] = this.decodeTransactions(sendTx).map((message) => ({
                ...message,
                type: "send",
            }));

            const recvTx = await this.client!.searchTx(`transfer.recipient='${address}'`);
            const recvTransactions: Transaction[] = this.decodeTransactions(recvTx).map((message) => ({
                ...message,
                type: "recv",
            }));

            const transactions = [...sendTransactions, ...recvTransactions];
            console.log(`✅ Found ${transactions.length} transactions for ${this.networkType} ${this.networkMode}`);
            return transactions.sort((a, b) => b.height - a.height);
        } catch (error) {
            console.error(`❌ Error getting transactions for ${this.networkType} ${this.networkMode}:`, error);
            if (this.networkType === 'morse') {
                this.isForcedOffline = true;
                console.log(`🟡 Setting MORSE to offline mode due to transaction error`);
            }
            return [];
        }
    }

    /**
     * Obtiene transacciones específicamente para la red MORSE
     * @param address - La dirección de la wallet
     * @returns {Promise<Transaction[]>} Lista de transacciones de Morse
     */
    private async getMorseTransactions(address: string): Promise<Transaction[]> {
        try {
            // Para MORSE, por ahora retornamos array vacío pero con logging apropiado
            // TODO: Implementar API específica de MORSE cuando esté disponible
            console.log(`🟡 MORSE transactions: Network=${this.networkMode}, Address=${address}`);
            console.log(`🟡 MORSE transaction queries not implemented yet - returning empty array`);

            // Aquí se podría implementar llamadas a la API de MORSE
            // usando las URLs de NETWORKS.MORSE[this.networkMode].rpcUrls

            return [];
        } catch (error) {
            console.error(`❌ Error getting MORSE transactions:`, error);
            return [];
        }
    }

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

    /**
     * Envía una transacción
     * @param to - Dirección destino
     * @param amount - Cantidad a enviar en upokt
     * @returns {Promise<string>} Hash de la transacción
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
} 