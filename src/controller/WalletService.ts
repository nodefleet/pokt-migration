import { WalletManager, Transaction, NetworkType } from './WalletManager';
import { STORAGE_KEYS, ERROR_MESSAGES, DEBUG_CONFIG } from './config';
import { morseWalletService } from './MorseWallet';
import { storageService } from './storage.service';
import { useImportMnemonic, useImportWallet } from './ShannonWallet';
import { address } from 'framer-motion/client';

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
        DEBUG_CONFIG.log('🔍 WalletService: savedNetworkType:', savedIsMainnet);

        // Configurar los valores internos basados en lo guardado
        this.networkType = storageService.getSync<NetworkType>(STORAGE_KEYS.NETWORK_TYPE) || 'shannon';
        this.isMainnet = savedIsMainnet !== null && savedIsMainnet !== undefined ? savedIsMainnet : true;

        DEBUG_CONFIG.log(`🚀 WalletService initialized with: Network=${this.networkType}, IsMainnet=${this.isMainnet}`);

        // Inicializar WalletManager con la configuración correcta
        // isTestnet = !isMainnet (Si isMainnet es false, entonces isTestnet es true)
        const isTestnet = !this.isMainnet;
        DEBUG_CONFIG.log(`🔍 WalletService constructor: isMainnet=${this.isMainnet}, isTestnet=${isTestnet}`);
        this.walletManager = new WalletManager(this.networkType, isTestnet);
    }

    public async init(): Promise<void> {
        if (!this.walletManager) {
            // Si por alguna razón no existe, recrear con configuración actual
            const isTestnet = this.isMainnet !== true;
            DEBUG_CONFIG.log(`🔍 WalletService init: isMainnet=${this.isMainnet}, isTestnet=${isTestnet}`);
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
        const isShannonHex = cleanHex.length === 64 && /^[0-9a-fA-F]+$/.test(cleanHex);
        DEBUG_CONFIG.log('🔍 Checking if Shannon 64-char key:', isShannonHex, 'Length:', cleanHex.length);

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
            const isTestnet = !isMainnet; // Negar directamente - más simple y confiable
            DEBUG_CONFIG.log(`🔍 DEBUG createWallet: isMainnet=${isMainnet}, isTestnet=${isTestnet}`);

            // Crear wallet usando el WalletManager
            const walletInfo = await this.walletManager.createWallet(password);

            // Verificar que la dirección coincida con la configuración de red
            const detectedConfig = this.detectNetworkFromAddress(walletInfo.address);
            if (detectedConfig.network !== network || detectedConfig.isMainnet !== isMainnet) {
                console.warn(`Address prefix mismatch. Expected ${network} ${isMainnet === true ? 'mainnet' : 'testnet'}, got address with prefix for ${detectedConfig.network} ${detectedConfig.isMainnet === true ? 'mainnet' : 'testnet'}`);
            }

            // Guardar la dirección y la wallet serializada
            this.currentWalletAddress = walletInfo.address;
            this.serializedWallet = walletInfo.serializedWallet;

            // Guardar en localStorage con la clave privada
            await storageService.set(STORAGE_KEYS.WALLET_ADDRESS, walletInfo.address);

            // Guardar wallet completa con clave privada para que el wallet selector la detecte
            if (network === 'shannon') {
                const timestamp = Date.now();
                const storageData = {
                    serialized: walletInfo.privateKey, // Usar la clave privada/mnemónico
                    privateKey: walletInfo.privateKey, // Guardar la clave privada
                    network: 'shannon',
                    timestamp: timestamp,
                    parsed: { address: walletInfo.address },
                    mnemonic: walletInfo.privateKey, // También como mnemónico
                    walletType: 'mnemonic' // Mark as created from mnemonic
                };

                // Guardar como objeto individual
                await storageService.set('shannon_wallet', storageData);

                // También guardar en el array de wallets
                const shannonWallets = await storageService.get<any[]>('shannon_wallets') || [];
                const walletArrayItem = {
                    id: `shannon_${timestamp}`,
                    ...storageData
                };
                
                // Verificar que no esté duplicada
                const isDuplicate = shannonWallets.some(w => w.parsed?.address === walletInfo.address);
                if (!isDuplicate) {
                    shannonWallets.push(walletArrayItem);
                    await storageService.set('shannon_wallets', shannonWallets);
                }

                DEBUG_CONFIG.log('✅ Shannon wallet saved to storage for wallet selector');
                
                // Trigger storage update event for wallet selector
                window.dispatchEvent(new CustomEvent('storage_updated', {
                    detail: { key: 'shannon_wallet', value: JSON.stringify(storageData) }
                }));
            }

            // Obtener balance
            const balance = await this.getBalance(walletInfo.address);

            return {
                address: walletInfo.address,
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
                    DEBUG_CONFIG.log('Incompatible wallet detected. Auto-configuring network based on address prefix...');

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
                        DEBUG_CONFIG.log(`🎯 validateAndCleanWallets: RESPECTING existing configuration: ${finalIsMainnet === true ? 'mainnet' : 'testnet'}`);
                    } else {
                        // Solo si NO hay configuración existente, usar detección
                        finalIsMainnet = Boolean(correctConfig.isMainnet === true); // FORZAR booleano válido
                        this.isMainnet = finalIsMainnet;
                        DEBUG_CONFIG.log(`🔧 validateAndCleanWallets: NO existing config - setting from detection: ${finalIsMainnet === true ? 'mainnet' : 'testnet'}`);
                    }

                    // Actualizar localStorage
                    storageService.set(STORAGE_KEYS.NETWORK_TYPE, correctConfig.network);

                    DEBUG_CONFIG.log(`🔧 Network validated: ${correctConfig.network} ${finalIsMainnet === true ? 'mainnet' : 'testnet'}`);

                    // CORREGIR: El WalletManager espera isTestnet, no isMainnet
                    const isTestnet = !finalIsMainnet; // Negar directamente - más simple y confiable
                    DEBUG_CONFIG.log(`🔍 DEBUG validateAndCleanWallets: finalIsMainnet=${finalIsMainnet}, isTestnet=${isTestnet} (types: ${typeof finalIsMainnet}, ${typeof isTestnet}) - EXPECTED: ${isTestnet ? 'TESTNET' : 'MAINNET'}`);

                    // Cambiar a la red usando la configuración FINAL
                    await this.walletManager.switchNetwork(correctConfig.network, isTestnet);
                } else {
                    DEBUG_CONFIG.log('🎯 validateAndCleanWallets: Wallet configuration is already compatible - no changes needed');
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
            // IMPORTANTE: Usar el parámetro network para determinar el tipo de wallet, sin detección automática
            if (network === 'morse') {
                const morseResult = await morseWalletService.importMorsePrivateKey(code, password);


                return {
                    address: morseResult.address,
                    balance: '0',
                    network: 'morse', // Es una wallet Morse
                    isMainnet: isMainnet !== undefined ? isMainnet : false // Respetar la configuración del usuario
                };
            }
            else if (network === 'shannon') {
                if (this.isShannonPrivateKey(code)) {
                    DEBUG_CONFIG.log('🔑 Detected Shannon 64-char private key format');
                    return await this.importShannonPrivateKey(code, password, network, isMainnet);
                } else {
                    DEBUG_CONFIG.log('📄 Using standard Shannon import for mnemonic/JSON');
                    return await this.importShannonWallet(code, password, network, isMainnet);
                }
            }
            else {
                DEBUG_CONFIG.log('⚠️ No network specified, defaulting to Shannon');
                // Default a Shannon si no se especifica la red
                return await this.importShannonWallet(code, password, 'shannon', isMainnet);
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

            // Usar la configuración proporcionada o default a mainnet
            const useMainnet = isMainnet === true;
            const prefix = "pokt"; // El prefijo es el mismo para mainnet y testnet
            const networkLabel = useMainnet ? "mainnet" : "testnet";

            DEBUG_CONFIG.log(`🔵 Importing Shannon private key directly as ${networkLabel} (prefix: ${prefix})`);

            // Limpiar la clave privada (remover 0x si está presente)
            let cleanPrivateKey = code.trim().startsWith('0x')
                ? code.trim().substring(2)
                : code.trim();

            try {
                // No hacer validación previa del formato, intentar directamente crear la wallet
                address = await this.createShannonWalletFromPrivateKey(cleanPrivateKey, password, prefix);
                detectedConfig = {
                    network: 'shannon',
                    isMainnet: useMainnet
                };
                DEBUG_CONFIG.log(`✅ Shannon ${networkLabel} import success:`, address);

                // IMPORTANTE: Guardar la clave privada en el objeto wallet
                await storageService.set('shannon_wallet', {
                    privateKey: cleanPrivateKey, // Guardar la clave privada directamente
                    serialized: cleanPrivateKey, // También en serialized para compatibilidad
                    network: 'shannon',
                    timestamp: Date.now(),
                    parsed: { address },
                    walletType: 'private_key' // Mark as imported from private key
                });
                DEBUG_CONFIG.log('✅ Private key saved in shannon_wallet object');

                // También guardar en el array de wallets si existe
                const shannonWallets = await storageService.get<any[]>('shannon_wallets') || [];
                if (Array.isArray(shannonWallets)) {
                    // Verificar si ya existe una wallet con esta dirección
                    const existingIndex = shannonWallets.findIndex(w => w.parsed?.address === address);

                    if (existingIndex >= 0) {
                        // Actualizar la wallet existente
                        shannonWallets[existingIndex].privateKey = cleanPrivateKey;
                        shannonWallets[existingIndex].serialized = cleanPrivateKey;
                        shannonWallets[existingIndex].timestamp = Date.now();
                        shannonWallets[existingIndex].walletType = 'private_key';
                    } else {
                        // Añadir nueva wallet
                        shannonWallets.push({
                            id: `shannon_${Date.now()}`,
                            privateKey: cleanPrivateKey,
                            serialized: cleanPrivateKey,
                            network: 'shannon',
                            timestamp: Date.now(),
                            parsed: { address },
                            walletType: 'private_key' // Mark as imported from private key
                        });
                    }

                    await storageService.set('shannon_wallets', shannonWallets);
                    DEBUG_CONFIG.log('✅ Private key saved in shannon_wallets array');
                }
            } catch (error) {
                console.error(`❌ Failed to import Shannon ${networkLabel}:`, error);
                throw new Error(`Shannon private key import failed for ${networkLabel}: ${error}`);
            }

            const finalNetwork = network || 'shannon';
            const finalIsMainnet = useMainnet;

            // Configurar red Shannon
            this.networkType = finalNetwork;
            this.isMainnet = finalIsMainnet;
            storageService.set(STORAGE_KEYS.NETWORK_TYPE, finalNetwork);

            // CORREGIR: El WalletManager espera isTestnet, no isMainnet
            const isTestnet = !finalIsMainnet;
            DEBUG_CONFIG.log(`🔍 DEBUG importShannonPrivateKey: finalIsMainnet=${finalIsMainnet}, isTestnet=${isTestnet}`);

            await this.walletManager.switchNetwork(finalNetwork, isTestnet);

            this.currentWalletAddress = address;
            storageService.set(STORAGE_KEYS.WALLET_ADDRESS, address);

            let balance = '0';
            try {
                balance = await this.getBalance(address);
            } catch (balanceError) {
                console.warn('Could not get balance:', balanceError);
            }

            DEBUG_CONFIG.log(`🎯 Shannon wallet configured: ${finalNetwork} ${finalIsMainnet === true ? 'mainnet' : 'testnet'}`);

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

            // Validar formato de manera más flexible
            if (!/^[0-9a-fA-F]+$/.test(cleanHex)) {
                console.log(`⚠️ Input no es hexadecimal válido (${cleanHex.length} chars). Intentando normalizar.`);

                // Si no es hex, intentar generar un hash del input como fallback
                const encoder = new TextEncoder();
                const data = encoder.encode(privateKeyHex);
                const hashBuffer = await crypto.subtle.digest('SHA-256', data);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                cleanHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
                console.log(`🔧 Generado hex desde input: ${cleanHex.substring(0, 16)}...`);
            }

            // Ajustar longitud si es necesario
            if (cleanHex.length > 64) {
                console.log(`⚠️ Private key too long (${cleanHex.length}), truncating to 64 chars`);
                cleanHex = cleanHex.substring(0, 64);
            } else if (cleanHex.length < 64) {
                console.log(`⚠️ Private key too short (${cleanHex.length}), padding to 64 chars`);
                cleanHex = cleanHex.padEnd(64, '0');
            }

            console.log(`🔵 Using Shannon private key: ${cleanHex.substring(0, 8)}... (length: ${cleanHex.length})`);

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
            DEBUG_CONFIG.log('🚀 Importing Shannon wallet...');

            let address: string;
            // Usar la configuración proporcionada o default a false (testnet)
            const useMainnet = isMainnet === true;
            const networkLabel = useMainnet ? "mainnet" : "testnet";

            DEBUG_CONFIG.log(`🎯 Usando Shannon ${networkLabel}`);

            const prefix = "pokt"; // El prefijo es el mismo para mainnet y testnet
            DEBUG_CONFIG.log(`🔧 Using prefix: ${prefix}`);

            // Detectar si es wallet serializada o mnemónico
            const isSerializedWallet = code.trim().startsWith('{') || code.includes('"type"');

            if (isSerializedWallet) {
                DEBUG_CONFIG.log(`📦 Detected serialized wallet - using deserialization (${networkLabel})`);
                const { DirectSecp256k1HdWallet } = await import('@cosmjs/proto-signing');

                try {
                    const wallet = await DirectSecp256k1HdWallet.deserialize(code, password);
                    const [account] = await wallet.getAccounts();

                    if (account) {
                        address = account.address;
                        DEBUG_CONFIG.log(`✅ Serialized wallet imported with ${networkLabel}:`, address);
                    } else {
                        throw new Error('Could not get account from serialized wallet');
                    }
                } catch (error) {
                    console.error('❌ Failed to deserialize wallet:', error);
                    throw new Error('Could not deserialize Shannon wallet');
                }
            } else {
                DEBUG_CONFIG.log(`🎯 Detected mnemonic - using mnemonic import (${networkLabel})`);
                const { DirectSecp256k1HdWallet } = await import('@cosmjs/proto-signing');
                const trimmedMnemonic = code.trim();
                const words = trimmedMnemonic.split(/\s+/);

                if (words.length !== 12 && words.length !== 24) {
                    throw new Error(`Mnemonic phrase must have exactly 12 or 24 words. Currently has ${words.length} words.`);
                }

                try {
                    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(trimmedMnemonic, {
                        prefix: prefix // FORZAR prefix de mainnet
                    });
                    const [account] = await wallet.getAccounts();

                    if (account) {
                        address = account.address;
                        DEBUG_CONFIG.log(`✅ Mnemonic wallet created with ${networkLabel}:`, address);
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
            const finalIsMainnet = useMainnet;

            DEBUG_CONFIG.log(`🎯 Using final config: ${finalNetwork} ${networkLabel}`);

            // Configurar red Shannon
            this.networkType = finalNetwork;
            this.isMainnet = finalIsMainnet;
            storageService.set(STORAGE_KEYS.NETWORK_TYPE, finalNetwork);

            // CORREGIR: El WalletManager espera isTestnet, no isMainnet
            const isTestnet = !finalIsMainnet;
            DEBUG_CONFIG.log(`🔍 DEBUG importShannonWallet: finalIsMainnet=${finalIsMainnet}, isTestnet=${isTestnet}`);

            await this.walletManager.switchNetwork(finalNetwork, isTestnet);

            this.currentWalletAddress = address;
            storageService.set(STORAGE_KEYS.WALLET_ADDRESS, address);

            let balance = '0';
            try {
                balance = await this.getBalance(address);
            } catch (balanceError) {
                console.warn('Could not get balance:', balanceError);
            }

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
            DEBUG_CONFIG.log(`Migrando wallet desde Morse (${morseAddress}) a Shannon (${shannonAddress})`);

            // Obtener los datos del wallet Morse
            const morseWalletData = await storageService.get<any>('morse_wallet');
            if (!morseWalletData || !morseWalletData.serialized) {
                throw new Error('No se encontraron datos del wallet Morse');
            }

            // Preparar datos para el backend
            let morsePrivateKey: string;
            let morseWalletJson: any = null;

            try {
                // Intentar parsear como JSON primero
                morseWalletJson = JSON.parse(morseWalletData.serialized);
                if (morseWalletJson && morseWalletJson.priv) {
                    DEBUG_CONFIG.log('📋 Detectado wallet Morse en formato JSON');
                    // Extraer clave privada para uso alternativo
                    morsePrivateKey = morseWalletJson.priv;
                } else {
                    throw new Error('Formato de wallet Morse no reconocido');
                }
            } catch (e) {
                // Si no es JSON, usar directamente como clave privada
                DEBUG_CONFIG.log('📋 Usando wallet Morse como clave privada directa');
                morsePrivateKey = morseWalletData.serialized;
                morseWalletJson = null;
            }

            // Asegurar que la clave privada no tenga prefijo 0x
            const cleanPrivateKey = morsePrivateKey.startsWith('0x')
                ? morsePrivateKey.substring(2)
                : morsePrivateKey;

            DEBUG_CONFIG.log('Clave privada Morse obtenida, enviando al servicio de migración...');

            // Verificar si tenemos acceso al servicio de migración backend
            const backendUrl = 'http://localhost:3001'; // URL del backend de migración
            const migrationEndpoint = `${backendUrl}/api/migration/migrate`;
            const shannon = await storageService.get<any>('shannon_wallet');

            // Preparar payload para el backend
            let payload: any = {};

            // Si tenemos el objeto JSON completo, enviarlo con preferencia
            if (morseWalletJson) {
                // Enviar el objeto JSON completo de la wallet Morse
                payload = {
                    morsePrivateKey: JSON.stringify({
                        addr: morseWalletJson.address || morseAddress,
                        name: morseWalletJson.name || `wallet-${morseAddress.substring(0, 8)}`,
                        priv: morseWalletJson.priv,
                        pass: morseWalletJson.pass || "",
                        account: morseWalletJson.account || 0
                    }),
                    shannonAddress: {
                        address: shannonAddress,
                        signature: shannon.serialized
                    }
                };
            } else {
                // Solo enviar la clave privada
                payload = {
                    morsePrivateKey: cleanPrivateKey,
                    shannonAddress: {
                        address: shannonAddress,
                        signature: shannon.serialized
                    }
                };
            }

            // Verificar backend antes de enviar
            try {
                const healthResponse = await fetch(`${backendUrl}/api/migration/health`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });

                if (!healthResponse.ok) {
                    throw new Error(`Migration backend service is not responding. Status: ${healthResponse.status}`);
                }

                const healthData = await healthResponse.json();
                if (!healthData.status || healthData.status !== 'ok') {
                    throw new Error('Migration backend service is not ready');
                }

                if (healthData.pocketd && !healthData.pocketd.available) {
                    throw new Error(`Migration CLI tool is not available: ${healthData.pocketd.error || 'Unknown error'}`);
                }

                DEBUG_CONFIG.log('✅ Migration backend service is ready');
            } catch (healthError: any) {
                console.error('❌ Migration backend health check failed:', healthError);
                throw new Error(`Migration service is not available: ${healthError.message}`);
            }

            // Enviar solicitud al backend
            const response = await fetch(migrationEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                // Intentar obtener detalles del error
                let errorMessage = `Error ${response.status}: ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.details || errorData.error || errorMessage;
                } catch (e) { }

                console.error('Error en la migración:', errorMessage);

                // Mensajes de error específicos según el tipo de error
                if (errorMessage.includes('connection refused') || errorMessage.includes('Post "http://localhost:26657"')) {
                    throw new Error('Cannot connect to Shannon network node. Please try again later.');
                } else if (errorMessage.includes('Bad Gateway') || errorMessage.includes('502')) {
                    throw new Error('Shannon network node is currently unavailable. Please try again later.');
                } else if (errorMessage.includes('Usage:') || errorMessage.includes('claim-accounts')) {
                    throw new Error('Migration command configuration error. Please contact support.');
                } else {
                    throw new Error(errorMessage);
                }
            }

            // Procesar respuesta exitosa
            const result = await response.json();
            DEBUG_CONFIG.log('Resultado de la migración:', result);

            // Verificar tanto el éxito de la comunicación como el resultado real de la migración
            const migrationSuccess = result.success && result.data?.result?.success !== false;

            if (!migrationSuccess) {
                // La migración falló - extraer el mensaje de error del resultado interno
                const errorMessage = result.data?.result?.error ||
                    result.data?.error ||
                    result.error ||
                    'Migration process failed';

                throw new Error(`Migration failed: ${errorMessage}`);
            }

            DEBUG_CONFIG.log('✅ Migración completada con éxito');
            return true;

        } catch (error) {
            console.error('Error migrando wallet:', error);
            throw error; // Relanzar para que el componente pueda manejarlo
        }
    }

    /**
     * Obtiene el balance de una dirección
     * @param address - Dirección de la wallet (opcional, usa la actual por defecto)
     * @returns Promise<string> - Balance en POKT
     */
    async getBalance(address: string): Promise<string> {
        try {
            DEBUG_CONFIG.log(`🔍 WalletService.getBalance: Fetching balance for ${address}`);

            if (!this.walletManager) {
                console.warn('⚠️ WalletManager no inicializado en getBalance');
                await this.init();
                if (!this.walletManager) {
                    throw new Error('No se pudo inicializar WalletManager');
                }
            }

            // Obtener balance directamente
            const balance = await this.walletManager.getBalance(address);
            DEBUG_CONFIG.log(`💰 WalletService.getBalance: Balance for ${address}: ${balance}`);

            return balance;
        } catch (error) {
            console.error('❌ Error getting balance:', error);
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

            // CORREGIR: El WalletManager espera isTestnet, no isMainnet
            const isTestnet = !isMainnetBool; // Negar directamente - más simple y confiable
            DEBUG_CONFIG.log(`🔍 DEBUG switchNetwork: isMainnet=${isMainnetBool}, isTestnet=${isTestnet} (types: ${typeof isMainnetBool}, ${typeof isTestnet})`);
            DEBUG_CONFIG.log(`🔍 DEBUG switchNetwork: About to call walletManager.switchNetwork(${network}, ${isTestnet})`);

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
            DEBUG_CONFIG.log('🔄 Starting WalletService logout...');

            // Limpiar propiedades internas
            this.currentWalletAddress = null;
            this.serializedWallet = null;
            this.networkType = 'shannon';
            this.isMainnet = false;

            // Limpiar localStorage usando las claves legacy
            storageService.remove(STORAGE_KEYS.WALLET_ADDRESS);
            storageService.remove(STORAGE_KEYS.NETWORK_TYPE);
            storageService.remove(STORAGE_KEYS.NETWORK);

            DEBUG_CONFIG.log('✅ WalletService logout completed');
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

        const balance = await this.getBalance(this.currentWalletAddress);

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
            DEBUG_CONFIG.log('🟡 Address detected as MORSE wallet from storage');
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

    /**
     * Obtiene la clave privada de Shannon desde los datos almacenados
     * @returns Promise<string | null> - Clave privada en formato hex o null si no se encuentra
     */
    async getShannonPrivateKey(): Promise<string | null> {
        try {
            // Get Shannon wallet from storage
            const shannonWallet = await storageService.get<any>('shannon_wallet');

            if (!shannonWallet) {
                console.warn('❌ No se encontró wallet Shannon en el storage');
                return null;
            }

            // If wallet was imported from private key, explain that no mnemonic is available
            if (shannonWallet.walletType === 'private_key') {
                console.log('⚠️ Wallet was imported from hex private key - no mnemonic available');
                return "⚠️ No mnemonic phrase available\n\nThis wallet was imported using a hex private key, not a mnemonic phrase.\n\nMnemonic phrases can only be shown for wallets that were:\n• Created using wallet generation\n• Imported using a 12/24-word mnemonic phrase\n\nYour wallet is secure, but the original mnemonic phrase is not recoverable from a hex private key.";
            }

            // First, check if we already have the mnemonic stored
            if (shannonWallet.mnemonic) {
                const words = shannonWallet.mnemonic.trim().split(/\s+/);
                if (words.length === 12 || words.length === 24) {
                    console.log('✅ Found Shannon mnemonic phrase in wallet.mnemonic');
                    return shannonWallet.mnemonic;
                }
            }

            // Check if serialized field contains mnemonic (for wallets stored as mnemonic)
            if (shannonWallet.serialized) {
                const words = shannonWallet.serialized.trim().split(/\s+/);
                if (words.length === 12 || words.length === 24) {
                    console.log('✅ Found Shannon mnemonic phrase in wallet.serialized');
                    return shannonWallet.serialized;
                }

                // Check if it's encrypted JSON format (starts with '{')
                if (shannonWallet.serialized.trim().startsWith('{')) {
                    console.log('🔍 DEBUG: Found encrypted JSON wallet data, attempting decryption...');
                    
                    try {
                        const { decryptWallet } = await import('./ShannonWallet');
                        
                        // Try multiple passwords commonly used
                        const passwordsToTry = [
                            "CREA",           // Default password
                            "",               // Empty password
                            "password",       // Common password
                            "123456",         // Common password
                            "wallet"          // Common password
                        ];

                        for (const password of passwordsToTry) {
                            try {
                                console.log(`🔓 Trying password: "${password}"`);
                                const walletInfo = await decryptWallet(shannonWallet.serialized, password);
                                if (walletInfo.mnemonic) {
                                    console.log(`✅ Successfully decrypted wallet with password "${password}" and extracted mnemonic`);
                                    
                                    // Update storage with the extracted mnemonic for future use
                                    await storageService.set('shannon_wallet', {
                                        ...shannonWallet,
                                        mnemonic: walletInfo.mnemonic
                                    });
                                    
                                    return walletInfo.mnemonic;
                                }
                            } catch (passwordError) {
                                console.log(`❌ Password "${password}" failed:`, passwordError instanceof Error ? passwordError.message : String(passwordError));
                            }
                        }
                        
                        console.warn('⚠️ Could not decrypt wallet with any of the tried passwords');
                    } catch (decryptError) {
                        console.warn('⚠️ General decryption error:', decryptError);
                    }
                } else {
                    // Check if it's a hex private key (64 characters)
                    const cleanHex = shannonWallet.serialized.trim();
                    if (cleanHex.length === 64 && /^[0-9a-fA-F]+$/.test(cleanHex)) {
                        console.log('🔍 DEBUG: Detected 64-char hex private key in serialized field');
                        console.log('⚠️ This wallet was imported from a hex private key - no mnemonic available');
                        return "⚠️ No mnemonic phrase available\n\nThis wallet was imported using a hex private key, not a mnemonic phrase.\n\nMnemonic phrases can only be shown for wallets that were:\n• Created using wallet generation\n• Imported using a 12/24-word mnemonic phrase\n\nYour wallet is secure, but the original mnemonic phrase is not recoverable from a hex private key.";
                    } else {
                        console.log('🔍 DEBUG: Serialized data is not recognized format:', {
                            dataPreview: shannonWallet.serialized.substring(0, 50) + '...',
                            length: shannonWallet.serialized.length,
                            startsWithBrace: shannonWallet.serialized.startsWith('{'),
                            isHex: /^[0-9a-fA-F]+$/.test(cleanHex)
                        });
                    }
                }
            }

            // Check privateKey field for mnemonic
            if (shannonWallet.privateKey) {
                const words = shannonWallet.privateKey.trim().split(/\s+/);
                if (words.length === 12 || words.length === 24) {
                    console.log('✅ Found Shannon mnemonic phrase in wallet.privateKey');
                    return shannonWallet.privateKey;
                }
            }

            // Try shannon_wallets array as well
            const shannonWallets = await storageService.get<any[]>('shannon_wallets');
            if (Array.isArray(shannonWallets) && shannonWallets.length > 0) {
                for (const wallet of shannonWallets) {
                    // Check mnemonic field
                    if (wallet.mnemonic) {
                        const words = wallet.mnemonic.trim().split(/\s+/);
                        if (words.length === 12 || words.length === 24) {
                            console.log('✅ Found Shannon mnemonic phrase in shannon_wallets array');
                            return wallet.mnemonic;
                        }
                    }

                    // Check serialized field for mnemonic
                    if (wallet.serialized) {
                        const words = wallet.serialized.trim().split(/\s+/);
                        if (words.length === 12 || words.length === 24) {
                            console.log('✅ Found Shannon mnemonic phrase in shannon_wallets serialized');
                            return wallet.serialized;
                        }

                        // Try to decrypt this wallet too
                        try {
                            const { decryptWallet } = await import('./ShannonWallet');
                            const walletInfo = await decryptWallet(wallet.serialized, "CREA");
                            if (walletInfo.mnemonic) {
                                console.log('✅ Successfully decrypted wallet from array and extracted mnemonic');
                                return walletInfo.mnemonic;
                            }
                        } catch (decryptError) {
                            // Continue to next wallet
                        }
                    }
                }
            }

            // If we reach here, no mnemonic was found
            console.warn('⚠️ No mnemonic found for Shannon wallet');
            return "⚠️ Mnemonic not found\n\nThis wallet appears to be created from a mnemonic, but the mnemonic phrase could not be extracted.\n\nThis might happen with:\n• Older wallet imports with different passwords\n• Corrupted wallet data\n• Wallets imported in incompatible formats\n\nThe wallet is still functional, but the mnemonic phrase is not available for display.";
        } catch (error) {
            console.error('❌ Error obteniendo clave privada Shannon:', error);
            return null;
        }
    }

    /**
     * Obtiene la clave privada de Morse desde los datos almacenados
     * @returns Promise<string | null> - Clave privada en formato hex o null si no se encuentra
     */
    async getMorsePrivateKey(): Promise<string | null> {
        try {
            // Utilizar el servicio de Morse para obtener la clave privada
            const privateKey = await morseWalletService.getMorsePrivateKey();

            if (!privateKey) {
                console.warn('❌ No Morse private key found in storage');
                return null;
            }

            return privateKey;
        } catch (error) {
            console.error('❌ Error getting Morse private key:', error);
            return null;
        }
    }



    /**
     * Obtiene todas las wallets disponibles con sus datos
     * @returns Promise<{shannon: any[], morse: any[]}> - Wallets disponibles
     */
    async getAllWallets(): Promise<{ shannon: any[], morse: any[] }> {
        try {
            // Obtener wallets de Shannon
            const shannonArr = await storageService.get<any[]>('shannon_wallets') || [];
            const rawShannonWallets = Array.isArray(shannonArr) ? shannonArr : [];

            // Añadir wallet legacy de Shannon si existe
            const legacyShannon = await storageService.get<any>('shannon_wallet');
            if (legacyShannon && !rawShannonWallets.some(w => w.id === 'shannon_legacy')) {
                rawShannonWallets.push({ ...legacyShannon, id: 'shannon_legacy' });
            }

            // Eliminar duplicados por dirección
            const shannonSeen = new Set<string>();
            const shannonWallets = rawShannonWallets.filter((w: any) => {
                const addr: string | undefined = w.parsed?.address;
                if (addr) {
                    if (shannonSeen.has(addr)) return false;
                    shannonSeen.add(addr);
                }
                return true;
            });

            // Obtener wallets de Morse
            const morseArr = await storageService.get<any[]>('morse_wallets') || [];
            const rawMorseWallets = Array.isArray(morseArr) ? morseArr : [];

            // Añadir wallet legacy de Morse si existe
            const legacyMorse = await storageService.get<any>('morse_wallet');
            if (legacyMorse && !rawMorseWallets.some(w => w.id === 'morse_legacy')) {
                rawMorseWallets.push({ ...legacyMorse, id: 'morse_legacy' });
            }

            // Eliminar duplicados por dirección
            const morseSeen = new Set<string>();
            const morseWallets = rawMorseWallets.filter((w: any) => {
                const addr: string | undefined = w.parsed?.addr || w.parsed?.address;
                if (addr) {
                    if (morseSeen.has(addr)) return false;
                    morseSeen.add(addr);
                }
                return true;
            });

            return {
                shannon: shannonWallets,
                morse: morseWallets
            };
        } catch (error) {
            console.error('❌ Error obteniendo todas las wallets:', error);
            return { shannon: [], morse: [] };
        }
    }

    /**
     * Obtiene la wallet por su dirección
     * @param address - Dirección de la wallet a buscar
     * @returns Promise<any | null> - Datos de la wallet o null si no se encuentra
     */
    async getWalletByAddress(address: string): Promise<any | null> {
        try {
            const allWallets = await this.getAllWallets();

            // Buscar en wallets Shannon
            const shannonWallet = allWallets.shannon.find(w =>
                w.parsed?.address === address
            );

            if (shannonWallet) {
                return {
                    ...shannonWallet,
                    network: 'shannon'
                };
            }

            // Buscar en wallets Morse
            const morseWallet = allWallets.morse.find(w =>
                (w.parsed?.addr === address || w.parsed?.address === address)
            );

            if (morseWallet) {
                return {
                    ...morseWallet,
                    network: 'morse'
                };
            }

            return null;
        } catch (error) {
            console.error('❌ Error buscando wallet por dirección:', error);
            return null;
        }
    }
}

// Exportar una instancia única
export const walletService = new WalletService(); 