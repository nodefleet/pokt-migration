import { WalletManager, Transaction, NetworkType } from './WalletManager';
import { NETWORKS, STORAGE_KEYS } from './config';
import { morseWalletService } from './MorseWallet';
import { storageService } from './storage.service';
import { useImportMnemonic, useImportWallet } from './ShannonWallet';

export interface WalletInfo {
    address: string;
    balance: string;
    network: NetworkType;
    isMainnet: boolean;
}

export class WalletService {
    private walletManager: WalletManager;
    private currentWalletAddress: string | null = null;
    private serializedWallet: string | null = null;
    private networkType: NetworkType = 'shannon';
    private isMainnet: boolean = false;

    constructor() {
        // Verificar configuración guardada antes de inicializar WalletManager
        const savedIsMainnet = storageService.getSync<boolean>('isMainnet');
        const savedNetworkType = storageService.getSync<NetworkType>(STORAGE_KEYS.NETWORK_TYPE) || 'shannon';

        // Configurar los valores internos basados en lo guardado
        this.networkType = savedNetworkType;
        console.log('🔍 WalletService: savedNetworkType:', savedIsMainnet);
        this.isMainnet = savedIsMainnet === true; // Explícito para testnet por defecto

        console.log(`🚀 WalletService initialized with: Network=${this.networkType}, IsMainnet=${this.isMainnet}`);

        // Inicializar WalletManager con la configuración correcta
        // isTestnet = !isMainnet (Si isMainnet es false, entonces isTestnet es true)
        const isTestnet = this.isMainnet !== true;
        console.log(`🔍 WalletService constructor: isMainnet=${this.isMainnet}, isTestnet=${isTestnet}`);
        this.walletManager = new WalletManager(this.networkType, isTestnet);
    }

    public async init(): Promise<void> {
        if (!this.walletManager) {
            // Si por alguna razón no existe, recrear con configuración actual
            const isTestnet = this.isMainnet !== true;
            console.log(`🔍 WalletService init: isMainnet=${this.isMainnet}, isTestnet=${isTestnet}`);
            this.walletManager = new WalletManager(this.networkType, isTestnet);
        }

        // Inicializar wallets existentes
        await this.validateAndCleanWallets();
    }

    /**
     * Detecta si es una clave privada de Morse (128 caracteres hex o formato JSON)
     */
    private isMorsePrivateKey(code: string): boolean {
        // Usar el detector mejorado del MorseWalletService
        return morseWalletService.detectMorseWallet(code);
    }

    /**
     * Detecta si es una clave privada de Shannon (64 caracteres hex)
     */
    private isShannonPrivateKey(code: string): boolean {
        const trimmed = code.trim();

        // Verificar si es JSON
        try {
            JSON.parse(trimmed);
            return false; // Es JSON, no es clave privada hex
        } catch {
            // No es JSON, continuar
        }

        // Verificar si contiene espacios (mnemónico)
        if (trimmed.includes(' ')) {
            return false;
        }

        const cleanHex = trimmed.startsWith('0x') ? trimmed.substring(2) : trimmed;

        // Las claves privadas de Shannon son de 64 caracteres (32 bytes)
        const isShannonHex = /^[0-9a-fA-F]{64}$/.test(cleanHex);
        console.log('🔍 Checking if Shannon 64-char key:', isShannonHex, 'Length:', cleanHex.length);

        return isShannonHex;
    }

    /**
     * Crea una nueva wallet
     * @param password - Contraseña para encriptar la wallet
     * @param network - Tipo de red (shannon por defecto)
     * @param isMainnet - Si es mainnet (false por defecto para Shannon Testnet)
     * @returns Promise<WalletInfo> - Información de la wallet creada
     */
    async createWallet(password: string, network: NetworkType = 'shannon', isMainnet: boolean = false): Promise<WalletInfo> {
        try {
            // Guardar configuración de red
            this.networkType = network;
            this.isMainnet = isMainnet;
            storageService.set(STORAGE_KEYS.NETWORK_TYPE, network);
            // NO SOBRESCRIBIR la selección manual del usuario
            // storageService.set(STORAGE_KEYS.NETWORK, isMainnet === true ? 'mainnet' : 'testnet');

            // CORREGIR: El WalletManager espera isTestnet, no isMainnet
            const isTestnet = isMainnet === false; // Si es false (testnet), entonces isTestnet = true
            console.log(`🔍 DEBUG createWallet: isMainnet=${isMainnet}, isTestnet=${isTestnet}`);

            // Cambiar a la red adecuada
            await this.walletManager.switchNetwork(network, isTestnet);

            // Crear la wallet
            const { address, serializedWallet } = await this.walletManager.createWallet(password);

            // Verificar que la dirección coincida con la configuración de red
            const detectedConfig = this.detectNetworkFromAddress(address);
            if (detectedConfig.network !== network || detectedConfig.isMainnet !== isMainnet) {
                console.warn(`Address prefix mismatch. Expected ${network} ${isMainnet === true ? 'mainnet' : 'testnet'}, got address with prefix for ${detectedConfig.network} ${detectedConfig.isMainnet === true ? 'mainnet' : 'testnet'}`);
            }

            // Guardar la dirección y la wallet serializada
            this.currentWalletAddress = address;
            this.serializedWallet = serializedWallet;

            // Guardar en localStorage
            storageService.set(STORAGE_KEYS.WALLET_ADDRESS, address);

            // Obtener balance
            const balance = await this.getBalance(address);

            return {
                address,
                balance,
                network,
                isMainnet
            };
        } catch (error) {
            console.error('Error creating wallet:', error);
            throw new Error(`Could not create wallet: ${error}`);
        }
    }

    /**
     * Detecta el tipo de red y configuración basándose SOLO en la configuración guardada, NO en el prefijo
     */
    private detectNetworkFromAddress(address: string): { network: NetworkType, isMainnet: boolean } {
        // SIEMPRE RESPETAR la configuración guardada por el usuario - NUNCA usar el prefijo
        const savedIsMainnet = storageService.getSync<boolean>('isMainnet');
        const savedNetworkType = storageService.getSync<NetworkType>('pokt_network_type') || 'shannon';

        // Si hay configuración guardada, USARLA SIEMPRE
        if (savedIsMainnet !== null && savedIsMainnet !== undefined) {
            return {
                network: savedNetworkType,
                isMainnet: savedIsMainnet
            };
        }

        // Solo si NO HAY configuración previa, usar TESTNET por defecto para Shannon
        return {
            network: 'shannon',
            isMainnet: false
        };
    }

    /**
     * Valida si una dirección es compatible con la configuración de red actual
     * @param address - Dirección de la wallet
     * @param network - Red objetivo
     * @param isMainnet - Si es mainnet
     * @returns boolean - true si es compatible
     */
    private isAddressCompatible(address: string, network: NetworkType, isMainnet: boolean): boolean {
        const detected = this.detectNetworkFromAddress(address);
        return detected.network === network && detected.isMainnet === isMainnet;
    }

    /**
     * Limpia y valida la configuración de wallets almacenadas
     * Verifica que las wallets guardadas sean compatibles con sus redes configuradas
     */
    async validateAndCleanWallets(): Promise<void> {
        try {
            const storedAddress = storageService.getSync<string>(STORAGE_KEYS.WALLET_ADDRESS);
            const storedNetworkType = storageService.getSync<NetworkType>(STORAGE_KEYS.NETWORK_TYPE);
            const storedNetwork = storageService.getSync<string>(STORAGE_KEYS.NETWORK);

            if (storedAddress && storedNetworkType && storedNetwork) {
                const isMainnet = storedNetwork === 'mainnet';

                // Verificar si la dirección es compatible con la red configurada
                if (!this.isAddressCompatible(storedAddress, storedNetworkType, isMainnet)) {
                    console.log('Incompatible wallet detected. Auto-configuring network based on address prefix...');

                    // Detectar la configuración correcta basándose en la dirección
                    const correctConfig = this.detectNetworkFromAddress(storedAddress);

                    // Actualizar la configuración de red SOLO SI ES NECESARIO
                    this.networkType = correctConfig.network;

                    // RESPETAR la configuración isMainnet EXISTENTE - NO CAMBIARLA
                    const currentIsMainnet = await storageService.get<boolean>('isMainnet');
                    let finalIsMainnet: boolean;

                    if (currentIsMainnet !== null && currentIsMainnet !== undefined) {
                        finalIsMainnet = Boolean(currentIsMainnet === true); // FORZAR booleano válido
                        this.isMainnet = finalIsMainnet;
                        console.log(`🎯 validateAndCleanWallets: RESPECTING existing configuration: ${finalIsMainnet === true ? 'mainnet' : 'testnet'}`);
                    } else {
                        // Solo si NO hay configuración existente, usar detección
                        finalIsMainnet = Boolean(correctConfig.isMainnet === true); // FORZAR booleano válido
                        this.isMainnet = finalIsMainnet;
                        await storageService.set('isMainnet', finalIsMainnet);
                        console.log(`🔧 validateAndCleanWallets: NO existing config - setting from detection: ${finalIsMainnet === true ? 'mainnet' : 'testnet'}`);
                    }

                    // Actualizar localStorage
                    storageService.set(STORAGE_KEYS.NETWORK_TYPE, correctConfig.network);

                    console.log(`🔧 Network validated: ${correctConfig.network} ${finalIsMainnet === true ? 'mainnet' : 'testnet'}`);

                    // CORREGIR: El WalletManager espera isTestnet, no isMainnet
                    const isTestnet = !finalIsMainnet; // Negar directamente - más simple y confiable
                    console.log(`🔍 DEBUG validateAndCleanWallets: finalIsMainnet=${finalIsMainnet}, isTestnet=${isTestnet} (types: ${typeof finalIsMainnet}, ${typeof isTestnet}) - EXPECTED: ${isTestnet ? 'TESTNET' : 'MAINNET'}`);

                    // Cambiar a la red usando la configuración FINAL
                    await this.walletManager.switchNetwork(correctConfig.network, isTestnet);
                } else {
                    console.log('🎯 validateAndCleanWallets: Wallet configuration is already compatible - no changes needed');
                }
            }
        } catch (error) {
            console.error('Error validating wallets:', error);
        }
    }

    /**
     * Importa una wallet existente y detecta automáticamente la red
     * @param code - Mnemónico, privateKey hex o wallet serializada para importar
     * @param password - Contraseña para desencriptar la wallet
     * @param network - Tipo de red (opcional, se detectará automáticamente)
     * @param isMainnet - Si es mainnet (opcional, se detectará automáticamente)
     * @returns Promise<WalletInfo> - Información de la wallet importada
     */
    async importWallet(code: string, password: string, network?: NetworkType, isMainnet?: boolean): Promise<WalletInfo> {
        try {
            console.log('🔄 Starting wallet import process...');
            console.log('Input code length:', code.length, 'Network:', network, 'IsMainnet:', isMainnet);

            // SEPARACIÓN COMPLETA: Detectar si es Morse o Shannon
            if (this.isMorsePrivateKey(code)) {
                console.log('🟡 DETECTED MORSE PRIVATE KEY - Using MorseWalletService');

                // Usar la clase específica de Morse
                const morseResult = await morseWalletService.importMorsePrivateKey(code, password);

                console.log('✅ MORSE wallet imported:', morseResult.address);

                return {
                    address: morseResult.address,
                    balance: '0', // Las wallets de Morse no tienen balance verificable directamente
                    network: 'morse', // Es una wallet Morse
                    isMainnet: isMainnet !== undefined ? isMainnet : false // Respetar la configuración del usuario
                };
            }
            else if (this.isShannonPrivateKey(code)) {
                console.log('🔵 DETECTED SHANNON PRIVATE KEY - Using Shannon logic');

                // Lógica específica para Shannon (64 caracteres)
                return await this.importShannonPrivateKey(code, password, network, isMainnet);
            }
            else {
                console.log('📄 DETECTED MNEMONIC/JSON - Using standard Shannon import');

                // Mnemónicos y wallets serializadas van por Shannon
                return await this.importShannonWallet(code, password, network, isMainnet);
            }
        } catch (error) {
            console.error('❌ Error importing wallet:', error);
            throw new Error(`Could not import wallet: ${error}`);
        }
    }

    /**
     * Importa una clave privada específica de Shannon (64 caracteres)
     */
    private async importShannonPrivateKey(code: string, password: string, network?: NetworkType, isMainnet?: boolean): Promise<WalletInfo> {
        try {
            let address: string;
            let detectedConfig: { network: NetworkType, isMainnet: boolean };

            // USAR TESTNET POR DEFECTO SIEMPRE para Shannon
            const useMainnet = isMainnet === true; // Solo usar mainnet si se especifica explícitamente
            const prefix = useMainnet ? 'pokt' : 'poktval';
            const networkLabel = useMainnet ? 'mainnet' : 'testnet';

            console.log(`🔵 Importing Shannon private key as ${networkLabel} (prefix: ${prefix})`);

            try {
                address = await this.createShannonWalletFromPrivateKey(code, password, prefix);
                detectedConfig = this.detectNetworkFromAddress(address);
                console.log(`✅ Shannon ${networkLabel} import success:`, address);
            } catch (error) {
                console.error(`❌ Failed to import Shannon ${networkLabel}:`, error);
                throw new Error(`Shannon private key import failed for ${networkLabel}: ${error}`);
            }

            const finalNetwork = network || 'shannon';
            const finalIsMainnet = detectedConfig.isMainnet;

            // Configurar red Shannon
            this.networkType = finalNetwork;
            this.isMainnet = finalIsMainnet;
            storageService.set(STORAGE_KEYS.NETWORK_TYPE, finalNetwork);
            // NO SOBRESCRIBIR la selección manual del usuario
            // storageService.set(STORAGE_KEYS.NETWORK, finalIsMainnet === true ? 'mainnet' : 'testnet');

            // CORREGIR: El WalletManager espera isTestnet, no isMainnet
            const isTestnet = !finalIsMainnet; // Negar directamente - más simple y confiable
            console.log(`🔍 DEBUG importShannonPrivateKey: finalIsMainnet=${finalIsMainnet}, isTestnet=${isTestnet} - EXPECTED: ${isTestnet ? 'TESTNET' : 'MAINNET'}`);

            await this.walletManager.switchNetwork(finalNetwork, isTestnet);

            this.currentWalletAddress = address;
            storageService.set(STORAGE_KEYS.WALLET_ADDRESS, address);

            let balance = '0';
            try {
                balance = await this.getBalance(address);
            } catch (balanceError) {
                console.warn('Could not get balance:', balanceError);
            }

            console.log(`🎯 Shannon wallet configured: ${finalNetwork} ${finalIsMainnet === true ? 'mainnet' : 'testnet'}`);

            return {
                address,
                balance,
                network: finalNetwork,
                isMainnet: finalIsMainnet
            };
        } catch (error) {
            console.error('Error importing Shannon private key:', error);
            throw error;
        }
    }

    /**
     * Crea una wallet Shannon desde clave privada (64 caracteres hex)
     */
    private async createShannonWalletFromPrivateKey(privateKeyHex: string, password: string, prefix: string): Promise<string> {
        try {
            const { DirectSecp256k1Wallet } = await import('@cosmjs/proto-signing');

            // Limpiar el hex (remover 0x si está presente)
            let cleanHex = privateKeyHex.trim().startsWith('0x')
                ? privateKeyHex.trim().substring(2)
                : privateKeyHex.trim();

            // Validar que sea exactamente 64 caracteres para Shannon
            if (cleanHex.length !== 64) {
                throw new Error(`Shannon private key must be 64 characters, got ${cleanHex.length}`);
            }

            // Validar que solo contenga caracteres hex válidos
            if (!/^[0-9a-fA-F]{64}$/.test(cleanHex)) {
                throw new Error(`Invalid private key format: contains non-hex characters`);
            }

            // Convertir hex a Uint8Array
            const privateKeyBytes = new Uint8Array(cleanHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

            // Crear wallet desde la clave privada
            const wallet = await DirectSecp256k1Wallet.fromKey(privateKeyBytes, prefix);
            const [firstAccount] = await wallet.getAccounts();

            console.log(`✓ Shannon wallet created with address: ${firstAccount.address}`);

            return firstAccount.address;
        } catch (error) {
            console.error('Error creating Shannon wallet from private key:', error);
            throw error;
        }
    }

    /**
     * Importa wallets serializadas JSON o mnemónicos (Shannon)
     */
    private async importShannonWallet(code: string, password: string, network?: NetworkType, isMainnet?: boolean): Promise<WalletInfo> {
        try {
            console.log('🚀 Importing Shannon wallet...');

            let address: string;
            let detectedIsMainnet: boolean = false;

            // PRIMERO: Si el usuario especifica isMainnet, respetarlo
            if (isMainnet !== undefined) {
                console.log('🎯 User manually specified isMainnet:', isMainnet);
                detectedIsMainnet = isMainnet;
            } else {
                // SEGUNDO: Respetar la configuración guardada
                const savedIsMainnet = await storageService.get<boolean>('isMainnet');
                if (savedIsMainnet !== null && savedIsMainnet !== undefined) {
                    console.log('🎯 RESPECTING saved isMainnet configuration:', savedIsMainnet);
                    detectedIsMainnet = savedIsMainnet;
                } else {
                    // TERCERO: Solo si no hay configuración guardada, defaultear a testnet
                    console.log('🔧 No saved config found, defaulting to TESTNET');
                    detectedIsMainnet = false;
                    await storageService.set('isMainnet', false);
                }
            }

            const prefix = detectedIsMainnet === true ? 'pokt' : 'poktval';
            console.log(`🔧 Using prefix: ${prefix} (${detectedIsMainnet === true ? 'mainnet' : 'testnet'})`);

            // Detectar si es wallet serializada o mnemónico
            const isSerializedWallet = code.trim().startsWith('{') || code.includes('"type"');

            if (isSerializedWallet) {
                console.log('📦 Detected serialized wallet - using deserialization');
                const { DirectSecp256k1HdWallet } = await import('@cosmjs/proto-signing');

                try {
                    const wallet = await DirectSecp256k1HdWallet.deserialize(code, password);
                    const [account] = await wallet.getAccounts();

                    if (account) {
                        address = account.address;
                        console.log(`✅ Serialized wallet imported with ${detectedIsMainnet === true ? 'mainnet' : 'testnet'}:`, address);
                    } else {
                        throw new Error('Could not get account from serialized wallet');
                    }
                } catch (error) {
                    console.error('❌ Failed to deserialize wallet:', error);
                    throw new Error('Could not deserialize Shannon wallet');
                }
            } else {
                console.log('🎯 Detected mnemonic - using mnemonic import');
                const { DirectSecp256k1HdWallet } = await import('@cosmjs/proto-signing');
                const trimmedMnemonic = code.trim();
                const words = trimmedMnemonic.split(/\s+/);

                if (words.length !== 12 && words.length !== 24) {
                    throw new Error(`Mnemonic phrase must have exactly 12 or 24 words. Currently has ${words.length} words.`);
                }

                try {
                    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(trimmedMnemonic, {
                        prefix: prefix
                    });
                    const [account] = await wallet.getAccounts();

                    if (account) {
                        address = account.address;
                        console.log(`✅ Mnemonic wallet created with ${detectedIsMainnet === true ? 'mainnet' : 'testnet'}:`, address);
                    } else {
                        throw new Error('Could not get account from mnemonic');
                    }
                } catch (error) {
                    console.error('❌ Failed to create wallet from mnemonic:', error);
                    throw new Error('Could not create Shannon wallet from mnemonic');
                }
            }

            // Usar la configuración detectada o la especificada por el usuario
            const finalNetwork = network || 'shannon';
            const finalIsMainnet = detectedIsMainnet;

            console.log(`🎯 Using final config: ${finalNetwork} ${finalIsMainnet === true ? 'mainnet' : 'testnet'}`);

            // Configurar el servicio
            this.networkType = finalNetwork;
            this.isMainnet = finalIsMainnet;
            await storageService.set(STORAGE_KEYS.NETWORK_TYPE, finalNetwork);
            await storageService.set('isMainnet', finalIsMainnet);

            // CORREGIR: El WalletManager espera isTestnet, no isMainnet
            const isTestnet = !finalIsMainnet; // Negar directamente - más simple y confiable
            console.log(`🔍 DEBUG importShannonWallet: finalIsMainnet=${finalIsMainnet}, isTestnet=${isTestnet}`);

            // Configurar WalletManager con la red detectada
            await this.walletManager.switchNetwork(finalNetwork, isTestnet);

            // Importar la wallet usando el WalletManager configurado
            const finalAddress = await this.walletManager.importWallet(code, password);

            if (address !== finalAddress) {
                console.warn(`Address mismatch: detected=${address}, final=${finalAddress}`);
                // Usar la dirección final del WalletManager
                address = finalAddress;
            }

            this.currentWalletAddress = address;
            await storageService.set(STORAGE_KEYS.WALLET_ADDRESS, address);

            let balance = '0';
            try {
                balance = await this.getBalance(address);
            } catch (balanceError) {
                console.warn('Could not get balance:', balanceError);
            }

            console.log(`✅ Shannon wallet import completed: ${address} (${finalNetwork} ${finalIsMainnet === true ? 'mainnet' : 'testnet'})`);

            return {
                address,
                balance,
                network: finalNetwork,
                isMainnet: finalIsMainnet
            };
        } catch (error) {
            console.error('Error importing Shannon wallet:', error);
            throw error;
        }
    }

    /**
     * Migra una wallet de Morse a Shannon
     * @param morseAddress - Dirección de la wallet Morse
     * @param shannonAddress - Dirección de la wallet Shannon
     * @returns Promise<boolean> - true si la migración fue exitosa
     */
    async migrateFromMorseToShannon(morseAddress: string, shannonAddress: string): Promise<boolean> {
        try {
            // Implementar la lógica de migración según la documentación de Pocket Network
            console.log(`Migrating wallet from Morse (${morseAddress}) to Shannon (${shannonAddress})`);

            // Aquí iría el código de migración real
            // Por ahora solo devolvemos true para simular éxito
            return true;
        } catch (error) {
            console.error('Error migrating wallet:', error);
            return false;
        }
    }

    /**
     * Obtiene el balance de una dirección
     * @param address - Dirección de la wallet (opcional, usa la actual por defecto)
     * @returns Promise<string> - Balance en POKT
     */
    async getBalance(address?: string): Promise<string> {
        try {
            const walletAddress = address || this.currentWalletAddress;

            if (!walletAddress) {
                throw new Error('No active wallet');
            }

            const balanceInUpokt = await this.walletManager.getBalance(walletAddress);

            // Asegurarnos de que balanceInUpokt sea un número válido
            const balanceValue = parseInt(balanceInUpokt);

            // Verificar si es un número válido
            if (isNaN(balanceValue)) {
                console.warn('Invalid balance received:', balanceInUpokt);
                return '0';
            }

            // Convertir de upokt a POKT (dividir por 1,000,000)
            const balanceInPokt = (balanceValue / 1_000_000).toString();

            return balanceInPokt;
        } catch (error) {
            console.error('Error getting balance:', error);
            return '0';
        }
    }

    /**
     * Obtiene el historial de transacciones
     * @param address - Dirección de la wallet (opcional, usa la actual por defecto)
     * @returns Promise<Transaction[]> - Lista de transacciones
     */
    async getTransactions(address?: string): Promise<Transaction[]> {
        try {
            const walletAddress = address || this.currentWalletAddress;

            if (!walletAddress) {
                throw new Error('No active wallet');
            }

            const transactions = await this.walletManager.getTransactions(walletAddress);
            return transactions;
        } catch (error) {
            console.error('Error getting transactions:', error);
            return [];
        }
    }

    /**
     * Envía una transacción
     * @param toAddress - Dirección de destino
     * @param amount - Cantidad a enviar en POKT (se convertirá a upokt)
     * @returns Promise<string> - Hash de la transacción
     */
    async sendTransaction(toAddress: string, amount: string): Promise<string> {
        try {
            if (!this.currentWalletAddress) {
                throw new Error('No active wallet');
            }

            // Convertir de POKT a upokt (multiplicar por 1,000,000)
            const amountInUpokt = (parseFloat(amount) * 1_000_000).toString();

            const txHash = await this.walletManager.sendTransaction(toAddress, amountInUpokt);
            return txHash;
        } catch (error) {
            console.error('Error sending transaction:', error);
            throw new Error(`Could not send transaction: ${error}`);
        }
    }

    /**
     * Cambia la red actual
     * @param network - Tipo de red (morse o shannon)
     * @param isMainnet - Si es mainnet (true) o testnet (false)
     */
    async switchNetwork(network: NetworkType, isMainnet: boolean = false): Promise<void> {
        try {
            // FORZAR conversión a booleano para evitar problemas de tipo
            const isMainnetBool = Boolean(isMainnet === true);

            this.networkType = network;
            this.isMainnet = isMainnetBool;
            storageService.set(STORAGE_KEYS.NETWORK_TYPE, network);
            // NO SOBRESCRIBIR la selección manual del usuario
            // storageService.set(STORAGE_KEYS.NETWORK, isMainnet === true ? 'mainnet' : 'testnet');

            // CORREGIR: El WalletManager espera isTestnet, no isMainnet
            const isTestnet = !isMainnetBool; // Negar directamente - más simple y confiable
            console.log(`🔍 DEBUG switchNetwork: isMainnet=${isMainnetBool}, isTestnet=${isTestnet} (types: ${typeof isMainnetBool}, ${typeof isTestnet})`);
            console.log(`🔍 DEBUG switchNetwork: About to call walletManager.switchNetwork(${network}, ${isTestnet})`);

            // Permitir que todas las redes (incluido Morse) usen sus funciones específicas
            await this.walletManager.switchNetwork(network, isTestnet);
        } catch (error) {
            console.error('Error switching network:', error);
            // No relanzar el error para evitar bloqueos en la UI
            console.warn('Network switch failed, continuing in offline mode');
        }
    }

    /**
     * Devuelve la instancia actual del WalletManager
     * @returns WalletManager - La instancia del WalletManager
     */
    public getWalletManager(): WalletManager {
        return this.walletManager;
    }

    /**
     * Cierra la sesión actual
     */
    logout(): void {
        try {
            console.log('🔄 Starting WalletService logout...');

            // Limpiar propiedades internas
            this.currentWalletAddress = null;
            this.serializedWallet = null;
            this.networkType = 'shannon';
            this.isMainnet = false;

            // Limpiar localStorage usando las claves legacy
            storageService.remove(STORAGE_KEYS.WALLET_ADDRESS);
            storageService.remove(STORAGE_KEYS.NETWORK_TYPE);
            storageService.remove(STORAGE_KEYS.NETWORK);

            console.log('✅ WalletService logout completed');
        } catch (error) {
            console.error('❌ Error during WalletService logout:', error);
        }
    }

    /**
     * Verifica si hay una wallet activa
     * @returns boolean - true si hay una wallet activa
     */
    isLoggedIn(): boolean {
        return !!this.currentWalletAddress;
    }

    /**
     * Obtiene la información de la wallet actual
     * @returns WalletInfo | null - Información de la wallet actual o null si no hay ninguna
     */
    async getCurrentWalletInfo(): Promise<WalletInfo | null> {
        if (!this.currentWalletAddress) {
            return null;
        }

        const balance = await this.getBalance();

        return {
            address: this.currentWalletAddress,
            balance,
            network: this.networkType,
            isMainnet: this.isMainnet
        };
    }

    /**
     * Detecta la configuración de red desde una dirección (método público)
     * @param address - Dirección de la wallet
     * @returns Configuración de red detectada
     */
    public async detectNetworkConfig(address: string): Promise<{ network: NetworkType, isMainnet: boolean }> {
        // Primero verificar si es una wallet de Morse guardada
        const morseWallet = await storageService.get<any>('morse_wallet');
        if (morseWallet && morseWallet.parsed?.address === address) {
            console.log('🟡 Address detected as MORSE wallet from storage');
            return { network: 'morse', isMainnet: false };
        }

        // Si no es Morse, usar la detección por prefijo para Shannon
        return this.detectNetworkFromAddress(address);
    }

    /**
     * Versión síncrona para compatibilidad (deprecated)
     */
    public detectNetworkConfigSync(address: string): { network: NetworkType, isMainnet: boolean } {
        return this.detectNetworkFromAddress(address);
    }
}

// Exportar una instancia única
export const walletService = new WalletService(); 