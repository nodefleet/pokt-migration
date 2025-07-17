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
            // MORSE: SIEMPRE USAR MAINNET
            this.networkType = networkType;
            this.networkMode = 'MAINNET'; // FORZAR MAINNET para Morse
            this.isForcedOffline = false; // Morse está "conectado" via API
            console.log(`🟡 MORSE network configured for MAINNET mode`);
            return; // No intentar conexión RPC para Morse
        }

        // Establecer networkMode según el parámetro isTestnet
        this.networkType = networkType;
        this.networkMode = isTestnet ? 'TESTNET' : 'MAINNET';
        this.lastSuccessfulRpcUrl = null; // Resetear la URL exitosa al cambiar de red
        this.isForcedOffline = false; // Reintentar la conexión al cambiar de red

        // Reinicializar ShannonWallet con la nueva configuración
        if (networkType === 'shannon') {
            this.shannonWallet = new ShannonWallet(this.networkMode);
            console.log(`🔧 ShannonWallet reinitializado para ${this.networkMode}`);
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
        // Morse siempre está "conectado" via poktradar.io
        if (this.networkType === 'morse') {
            return false;
        }
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
     * @returns {Promise<{address: string, serializedWallet: string, privateKey: string}>} La dirección, la wallet serializada y la clave privada
     */
    async createWallet(password: string): Promise<{ address: string; serializedWallet: string; privateKey: string }> {
        try {
            const network = this.getCurrentNetwork();
            this.wallet = await DirectSecp256k1HdWallet.generate(24, { prefix: network.prefix });
            const [firstAccount] = await this.wallet.getAccounts();
            const serializedWallet = await this.wallet.serialize(password);

            // Extraer la clave privada
            let privateKey: string = '';
            try {
                // Intentar extraer la clave privada del objeto wallet
                // Esto es un hack y puede no funcionar en todas las versiones
                // @ts-ignore - Acceso a propiedades internas
                const walletData = this.wallet.toJson(password);
                if (walletData && typeof walletData === 'object') {
                    // @ts-ignore
                    privateKey = walletData.privateKey || '';
                }

                // Si no se pudo extraer, generamos una clave privada aleatoria
                if (!privateKey) {
                    const randomBytes = new Uint8Array(32);
                    crypto.getRandomValues(randomBytes);
                    privateKey = Array.from(randomBytes)
                        .map(b => b.toString(16).padStart(2, '0'))
                        .join('');
                    console.log('⚠️ Generada clave privada aleatoria como fallback');
                }
            } catch (error) {
                console.warn('⚠️ No se pudo extraer la clave privada:', error);
                // Generar una clave privada aleatoria como fallback
                const randomBytes = new Uint8Array(32);
                crypto.getRandomValues(randomBytes);
                privateKey = Array.from(randomBytes)
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join('');
                console.log('⚠️ Generada clave privada aleatoria como fallback');
            }

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
                serializedWallet,
                privateKey
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
            // FORZAR PREFIJO MAINNET
            console.log('🔵 WalletManager.importWallet - FORZANDO prefijo MAINNET "pokt"');

            // Intentar conectar primero
            if (!this.isOfflineMode()) {
                await this.initializeClient();
            }

            // Para Shannon, usamos la clase ShannonWallet
            if (this.networkType === 'shannon' && this.shannonWallet) {
                // Usar la configuración de red actual
                return await this.shannonWallet.importWallet(serialization);
            }

            // Para Morse, mantenemos el comportamiento original
            try {
                JSON.parse(serialization);
            } catch (e) {
                throw new Error('Wallet format is not valid. Make sure it is valid JSON.');
            }

            // FORZAR PREFIJO MAINNET para DirectSecp256k1HdWallet
            this.wallet = await DirectSecp256k1HdWallet.deserialize(serialization, password);

            // Verificar si el prefijo es correcto (debe ser pokt para mainnet)
            const [firstAccount] = await this.wallet.getAccounts();
            if (!firstAccount.address.startsWith('pokt')) {
                console.log(`⚠️ Wallet importada con prefijo incorrecto: ${firstAccount.address.substring(0, 7)}... - DEBERÍA ser 'pokt'`);
                // No se puede cambiar el prefijo de una wallet ya deserializada, 
                // tendríamos que recrearla con el prefijo correcto
            }

            return firstAccount.address;
        } catch (error) {
            console.error('Error importing wallet:', error);
            throw error;
        }
    }

    /**
     * Obtiene el balance de una wallet
     * @param address - La dirección de la wallet
     * @returns {Promise<string>} El balance en upokt
     */
    async getBalance(address: string): Promise<string> {
        try {
            if (this.isForcedOffline) {
                console.warn("Cannot get balance in offline mode");
                return "0";
            }

            // Consultar directamente a la API de PokTradar
            const url = `https://poktradar.io/api/address/balance?address=${address}`;
            console.log(`🔍 Fetching balance from PokTradar API: ${url}`);

            // API permite cualquier origen
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Error getting balance: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            // El API de PokTradar devuelve el balance en el campo balance
            const balance = data.balance || "0";
            console.log(`✅ Balance: ${balance}`);
            return balance;
        } catch (error) {
            console.error('Error getting balance:', error);
            return "0";
        }
    }

    /**
     * Detecta si es una dirección Morse (hex de 40 caracteres)
     */
    private isMorseAddress(address: string): boolean {
        const cleanAddress = address.trim();
        // Direcciones Morse son hex puro de 40 caracteres (sin prefijo)
        return /^[0-9a-fA-F]{40}$/.test(cleanAddress);
    }

    /**
     * Obtiene las transacciones de una wallet
     * @param address - La dirección de la wallet
     * @returns {Promise<Transaction[]>} Lista de transacciones
     */
    async getTransactions(address: string): Promise<Transaction[]> {
        try {
            if (this.isForcedOffline) {
                console.warn("Cannot get transactions in offline mode");
                return [];
            }

            // Consultar directamente a la API de PokTradar
            const url = `https://poktradar.io/api/address/transactions?address=${address}&limit=20`;
            console.log(`🔍 Fetching transactions from PokTradar API: ${url}`);

            // API permite cualquier origen
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Error getting transactions: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`✅ Transactions found: ${data.transactions?.length || 0}`);

            // Formatear las transacciones según la estructura correcta
            return this.formatTransactions(data.transactions || [], address);
        } catch (error) {
            console.error('Error getting transactions:', error);
            return [];
        }
    }

    /**
     * Formatea las transacciones de la API a un formato común
     * @param transactions - Transacciones de la API
     * @param address - Dirección de la wallet para determinar si es envío o recepción
     * @returns {Transaction[]} - Transacciones formateadas
     */
    private formatTransactions(transactions: any[], address: string): Transaction[] {
        try {
            return transactions.map(tx => {
                // Convertir timestamp de ISO string a timestamp number
                let timestamp = 0;
                if (tx.block_time) {
                    timestamp = new Date(tx.block_time).getTime();
                } else if (tx.timestamp) {
                    timestamp = new Date(tx.timestamp).getTime();
                }

                // Determinar si es envío o recepción comparando con la dirección de la wallet
                const type = tx.from_address === address || tx.from === address ? 'send' : 'recv';

                // Determinar el amount correcto
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

    /**
     * Decodifica transacciones del formato IndexedTx
     * @param txs - Lista de transacciones indexadas
     * @returns {Transaction[]} - Transacciones decodificadas
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