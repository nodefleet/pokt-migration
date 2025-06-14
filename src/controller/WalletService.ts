import { WalletManager, Transaction, NetworkType } from './WalletManager';
import { NETWORKS, STORAGE_KEYS } from './config';
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
        const savedNetworkType = storageService.getSync<NetworkType>(STORAGE_KEYS.NETWORK_TYPE) || 'shannon';

        // Configurar los valores internos basados en lo guardado
        this.networkType = savedNetworkType;
        console.log('🔍 WalletService: savedNetworkType:', savedIsMainnet);
        this.isMainnet = true; // FORZAR MAINNET SIEMPRE

        console.log(`🚀 WalletService initialized with: Network=${this.networkType}, IsMainnet=${this.isMainnet}`);

        // Inicializar WalletManager con la configuración correcta
        // isTestnet = !isMainnet (Si isMainnet es false, entonces isTestnet es true)
        const isTestnet = false; // FORZAR MAINNET SIEMPRE
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

            // IMPORTANTE: Usar el parámetro network para determinar el tipo de wallet, sin detección automática
            if (network === 'morse') {
                console.log('🟡 USING MORSE IMPORT - Based on explicit network selection');

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
            else if (network === 'shannon') {
                console.log('🔵 USING SHANNON IMPORT - Based on explicit network selection - FORZANDO MAINNET');

                // FORZAR MAINNET PARA SHANNON (ignorar el parámetro isMainnet)
                // Verificar si es un private key de 64 caracteres para importarlo de manera específica
                if (this.isShannonPrivateKey(code)) {
                    console.log('🔑 Detected Shannon 64-char private key format - FORZANDO MAINNET');
                    return await this.importShannonPrivateKey(code, password, network, true); // FORZAR MAINNET
                } else {
                    console.log('📄 Using standard Shannon import for mnemonic/JSON - FORZANDO MAINNET');
                    return await this.importShannonWallet(code, password, network, true); // FORZAR MAINNET
                }
            }
            else {
                console.log('⚠️ No network specified, defaulting to Shannon MAINNET');
                // Default a Shannon MAINNET si no se especifica la red
                return await this.importShannonWallet(code, password, 'shannon', true); // FORZAR MAINNET
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

            // FORZAR MAINNET SIEMPRE
            const useMainnet = true; // FORZAR MAINNET
            const prefix = "pokt"; // FORZAR prefix de mainnet
            const networkLabel = "mainnet"; // FORZAR label de mainnet

            console.log(`🔵 Importing Shannon private key directly as ${networkLabel} (prefix: ${prefix}) - FORZADO MAINNET`);

            try {
                // No hacer validación previa del formato, intentar directamente crear la wallet
                address = await this.createShannonWalletFromPrivateKey(code, password, prefix);
                detectedConfig = {
                    network: 'shannon',
                    isMainnet: true // FORZAR MAINNET SIEMPRE
                };
                console.log(`✅ Shannon ${networkLabel} import success:`, address);
            } catch (error) {
                console.error(`❌ Failed to import Shannon ${networkLabel}:`, error);
                throw new Error(`Shannon private key import failed for ${networkLabel}: ${error}`);
            }

            const finalNetwork = network || 'shannon';
            const finalIsMainnet = true; // FORZAR MAINNET SIEMPRE

            // Configurar red Shannon
            this.networkType = finalNetwork;
            this.isMainnet = finalIsMainnet;
            storageService.set(STORAGE_KEYS.NETWORK_TYPE, finalNetwork);
            // GUARDAR LA SELECCIÓN EXPLÍCITA DEL USUARIO
            storageService.set('isMainnet', finalIsMainnet);

            // CORREGIR: El WalletManager espera isTestnet, no isMainnet
            const isTestnet = false; // FORZAR MAINNET SIEMPRE
            console.log(`🔍 DEBUG importShannonPrivateKey: finalIsMainnet=${finalIsMainnet}, isTestnet=${isTestnet} - EXPECTED: MAINNET`);

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
            console.log('🚀 Importing Shannon wallet...');

            let address: string;
            // FORZAR MAINNET SIEMPRE
            const detectedIsMainnet = true; // FORZAR MAINNET SIEMPRE

            console.log('🎯 FORZANDO Shannon MAINNET - ignorando configuración');

            const prefix = "pokt"; // FORZAR prefix de mainnet
            console.log(`🔧 Using prefix: ${prefix} (MAINNET FORZADO)`);

            // Detectar si es wallet serializada o mnemónico
            const isSerializedWallet = code.trim().startsWith('{') || code.includes('"type"');

            if (isSerializedWallet) {
                console.log('📦 Detected serialized wallet - using deserialization (MAINNET FORZADO)');
                const { DirectSecp256k1HdWallet } = await import('@cosmjs/proto-signing');

                try {
                    const wallet = await DirectSecp256k1HdWallet.deserialize(code, password);
                    const [account] = await wallet.getAccounts();

                    if (account) {
                        address = account.address;
                        console.log(`✅ Serialized wallet imported with MAINNET FORZADO:`, address);
                    } else {
                        throw new Error('Could not get account from serialized wallet');
                    }
                } catch (error) {
                    console.error('❌ Failed to deserialize wallet:', error);
                    throw new Error('Could not deserialize Shannon wallet');
                }
            } else {
                console.log('🎯 Detected mnemonic - using mnemonic import (MAINNET FORZADO)');
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
                        console.log(`✅ Mnemonic wallet created with MAINNET FORZADO:`, address);
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
            const finalIsMainnet = true; // FORZAR MAINNET SIEMPRE

            console.log(`🎯 Using final config: ${finalNetwork} MAINNET FORZADO`);

            // Configurar el servicio
            this.networkType = finalNetwork;
            this.isMainnet = finalIsMainnet;
            await storageService.set(STORAGE_KEYS.NETWORK_TYPE, finalNetwork);
            await storageService.set('isMainnet', finalIsMainnet);

            // CORREGIR: El WalletManager espera isTestnet, no isMainnet
            const isTestnet = false; // FORZAR MAINNET SIEMPRE
            console.log(`🔍 DEBUG importShannonWallet: finalIsMainnet=${finalIsMainnet}, isTestnet=${isTestnet} (FORZADO MAINNET)`);

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

            console.log(`✅ Shannon wallet import completed: ${address} (${finalNetwork} MAINNET FORZADO)`);

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
            console.log(`Migrando wallet desde Morse (${morseAddress}) a Shannon (${shannonAddress})`);

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
                    console.log('📋 Detectado wallet Morse en formato JSON');
                    // Extraer clave privada para uso alternativo
                    morsePrivateKey = morseWalletJson.priv;
                } else {
                    throw new Error('Formato de wallet Morse no reconocido');
                }
            } catch (e) {
                // Si no es JSON, usar directamente como clave privada
                console.log('📋 Usando wallet Morse como clave privada directa');
                morsePrivateKey = morseWalletData.serialized;
                morseWalletJson = null;
            }

            // Asegurar que la clave privada no tenga prefijo 0x
            const cleanPrivateKey = morsePrivateKey.startsWith('0x')
                ? morsePrivateKey.substring(2)
                : morsePrivateKey;

            console.log('Clave privada Morse obtenida, enviando al servicio de migración...');

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

                console.log('✅ Migration backend service is ready');
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
            console.log('Resultado de la migración:', result);

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

            console.log('✅ Migración completada con éxito');
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