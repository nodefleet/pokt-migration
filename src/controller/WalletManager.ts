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
        this.networkMode = 'MAINNET'; // FORZAR MAINNET SIEMPRE

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

        // CORREGIR: Establecer networkMode ANTES de crear ShannonWallet
        this.networkType = networkType;
        this.networkMode = 'MAINNET'; // FORZAR MAINNET SIEMPRE
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
            // FORZAR PREFIJO MAINNET
            console.log('🔵 WalletManager.importWallet - FORZANDO prefijo MAINNET "pokt"');

            // Intentar conectar primero
            if (!this.isOfflineMode()) {
                await this.initializeClient();
            }

            // Para Shannon, usamos la clase ShannonWallet
            if (this.networkType === 'shannon' && this.shannonWallet) {
                // Hack para forzar mainnet - el método original usa la red configurada
                this.networkMode = 'MAINNET'; // FORZAR MAINNET
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
     * Obtiene el balance de la wallet
     * @param address - La dirección de la wallet
     * @returns {Promise<string>} El balance en upokt
     */
    async getBalance(address: string): Promise<string> {
        try {
            // DETECCIÓN AUTOMÁTICA por formato de dirección
            if (this.isMorseAddress(address)) {
                console.log(`🟡 Auto-detected Morse address format, using Morse balance function`);
                return await this.getMorseBalance(address);
            }

            // SHANNON: Usar ShannonWallet que maneja mainnet/testnet correctamente
            if (this.networkType === 'shannon' && this.shannonWallet) {
                return await this.shannonWallet.getBalance(address);
            }

            // MORSE: Usar función específica de Morse (independiente del cliente genérico)
            if (this.networkType === 'morse') {
                console.log(`🟡 Using dedicated Morse balance function for ${this.networkMode}`);
                return await this.getMorseBalance(address);
            }

            // FALLBACK: Cliente genérico solo para casos especiales
            if (this.isForcedOffline) {
                console.warn("Operating in offline mode. Balance not available.");
                return '0';
            }

            if (!this.client) {
                const reconnected = await this.tryReconnect();
                if (!reconnected) {
                    console.warn("Could not connect to network to get balance. Using '0' as default value.");
                    return '0';
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
            return '0';
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
        console.log(`🔍 Getting transactions for ${this.networkType} ${this.networkMode} - Address: ${address}`);

        try {
            // SHANNON: Usar ShannonWallet que ya maneja mainnet/testnet correctamente
            if (this.networkType === 'shannon' && this.shannonWallet) {
                console.log(`🔵 Using Shannon wallet for transactions (${this.networkMode})`);
                return await this.shannonWallet.getTransactions(address);
            }

            // MORSE: Usar función específica de Morse (independiente del cliente genérico)
            if (this.networkType === 'morse') {
                console.log(`🟡 Using dedicated Morse transactions function for ${this.networkMode}`);
                return await this.getMorseTransactions(address);
            }

            // FALLBACK: Usar cliente genérico solo para casos especiales
            if (this.isForcedOffline) {
                console.warn("Operating in offline mode. Transactions not available.");
                return [];
            }

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
            return [];
        }
    }

    /**
     * Obtiene el balance de una dirección Morse usando el endpoint REST API
     */
    private async getMorseBalance(address: string): Promise<string> {
        console.log(`🟡 Getting MORSE balance for ${address} using new Tango API`);

        // Usar el proxy local configurado en vite.config.ts que apunta a Tango
        const API_URL = '/api/tango/v1/query/balance';

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ address: address })
            });

            if (!response.ok) {
                console.error(`❌ Tango balance API error (${response.status})`);
                return '0';
            }

            const data = await response.json();
            console.log('✅ Tango balance response:', data);

            // El API de Tango devuelve el balance en el campo balance
            if (data.balance !== undefined && data.balance !== null) {
                const balanceInPokt = data.balance;
                console.log(`💰 Morse balance: ${balanceInPokt} POKT`);
                return balanceInPokt.toString();
            } else {
                console.warn('⚠️ No balance field in Tango response');
                return '0';
            }
        } catch (error) {
            console.error('❌ Error getting Morse balance from Tango API:', error);
            return '0';
        }
    }

    /**
     * Obtiene las transacciones de una dirección Morse usando el endpoint REST API
     */
    private async getMorseTransactions(address: string): Promise<Transaction[]> {
        console.log(`🟡 Getting MORSE MAINNET transactions for ${address} using poktradar.io API`);

        // Usar el proxy local configurado en vite.config.ts que apunta a poktradar.io
        const API_BASE_URL = '/api/poktradar';

        try {
            const response = await fetch(`${API_BASE_URL}/address/transactions?address=${address}&limit=20`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                console.error(`❌ Poktradar transactions API error (${response.status})`);
                // No devolver array vacío, devolver mensaje de error claro
                console.log('🔄 Poktradar API temporarily unavailable, but Morse network is connected');
                return [];
            }

            const data = await response.json();
            console.log('✅ Poktradar transactions response:', data);

            // Procesar las transacciones de poktradar.io
            const transactions = data.transactions || [];

            if (transactions.length === 0) {
                console.log('📭 No transactions found for this Morse address');
                return [];
            }

            // Convertir al formato esperado usando la estructura real de poktradar
            const formattedTransactions: Transaction[] = transactions.map((tx: any) => {
                // Convertir timestamp de ISO string a timestamp number
                let timestamp = 0;
                if (tx.block_time) {
                    timestamp = new Date(tx.block_time).getTime();
                }

                // Determinar el amount correcto según el tipo de transacción
                let amountInPokt = '0';

                if (tx.type === 'send' && tx.amount && typeof tx.amount === 'number') {
                    // Para transacciones send, usar amount en uPOKT y convertir a POKT
                    amountInPokt = tx.amount;
                } else if ((tx.type === 'proof' || tx.type === 'claim') && tx.total_pokt) {
                    // Para proof y claim, usar total_pokt que ya está en POKT
                    amountInPokt = tx.total_pokt.toString();
                } else {
                    // Para otros tipos (stake_validator, begin_unstake_validator, etc.) usar 0
                    amountInPokt = '0';
                }

                // Determinar el tipo de transacción para la UI
                let displayType: 'send' | 'recv';

                if (tx.type === 'send') {
                    // Para transacciones send, determinar si es send o recv basado en direcciones
                    displayType = tx.from_address === address ? 'send' : 'recv';
                } else {
                    // Para otros tipos (proof, claim, stake, etc.), siempre mostrar como 'recv' (ingresos)
                    displayType = 'recv';
                }

                // Determinar status basado en result_code y tipo
                let status: 'pending' | 'confirmed' | 'failed';
                if (tx.result_code === 0) {
                    status = 'confirmed';
                } else if (tx.result_code === 110) {
                    // Código 110 típicamente indica transacción fallida
                    status = 'failed';
                } else {
                    status = 'failed';
                }

                return {
                    hash: tx.hash || '',
                    from: tx.from_address || '',
                    to: tx.to_address || tx.type || '', // Para tipos especiales, mostrar el tipo en lugar de to_address
                    value: amountInPokt,
                    timestamp: timestamp,
                    status: status,
                    type: displayType,
                    height: tx.height || 0
                };
            });

            // Ordenar por altura (más recientes primero)
            const sortedTransactions = formattedTransactions.sort((a, b) => b.height - a.height);

            console.log(`✅ MORSE MAINNET transactions processed: ${sortedTransactions.length} transactions`);
            return sortedTransactions;
        } catch (error) {
            console.error('❌ Error getting Morse transactions from poktradar:', error);
            // Morse sigue funcionando aunque haya errores de red temporales
            console.log('🔄 Temporary network error, but Morse network remains connected');
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