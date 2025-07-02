import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { Transaction, WalletManager, NetworkType } from './WalletManager';
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
        // Verify saved configuration before initializing WalletManager
        const savedIsMainnet = storageService.getSync<boolean>('isMainnet');
        const savedNetworkType = storageService.getSync<NetworkType>(STORAGE_KEYS.NETWORK_TYPE) || 'shannon';

        // Configure internal values based on what's saved
        this.networkType = savedNetworkType;
        console.log('🔍 WalletService: savedNetworkType:', savedIsMainnet);
        this.isMainnet = true; // ALWAYS FORCE MAINNET

        console.log(`🚀 WalletService initialized with: Network=${this.networkType}, IsMainnet=${this.isMainnet}`);

        // Initialize WalletManager with the correct configuration
        // isTestnet = !isMainnet (If isMainnet is false, then isTestnet is true)
        const isTestnet = false; // ALWAYS FORCE MAINNET
        console.log(`🔍 WalletService constructor: isMainnet=${this.isMainnet}, isTestnet=${isTestnet}`);
        this.walletManager = new WalletManager(this.networkType, isTestnet);
    }

    public async init(): Promise<void> {
        if (!this.walletManager) {
            // If for some reason it doesn't exist, recreate with current configuration
            const isTestnet = this.isMainnet !== true;
            console.log(`🔍 WalletService init: isMainnet=${this.isMainnet}, isTestnet=${isTestnet}`);
            this.walletManager = new WalletManager(this.networkType, isTestnet);
        }

        // Initialize existing wallets
        await this.validateAndCleanWallets();
    }

    /**
     * Use the improved detector from MorseWalletService
     */
    private isMorsePrivateKey(code: string): boolean {
        // Use the improved detector from MorseWalletService
        return morseWalletService.detectMorseWallet(code);
    }

    /**
     * Check if it's JSON
     */
    private isShannonPrivateKey(code: string): boolean {
        const trimmed = code.trim();

        // Check if it's JSON
        try {
            JSON.parse(trimmed);
            return false; // It's JSON, not a hex private key
        } catch {
            // It's not JSON, continue
        }

        // Check if it contains spaces (mnemonic)
        if (trimmed.includes(' ')) {
            return false;
        }

        const cleanHex = trimmed.startsWith('0x') ? trimmed.substring(2) : trimmed;

        // Shannon private keys are 64 characters (32 bytes)
        const isShannonHex = /^[0-9a-fA-F]{64}$/.test(cleanHex);
        console.log('🔍 Checking if Shannon 64-char key:', isShannonHex, 'Length:', cleanHex.length);

        return isShannonHex;
    }

    /**
     * Create a new wallet
     * @param password - Password to encrypt the wallet
     * @param network - Network type (shannon by default)
     * @param isMainnet - If it's mainnet (false by default for Shannon Testnet)
     * @returns Promise<WalletInfo> - Information about the created wallet
     */
    async createWallet(password: string, network: NetworkType = 'shannon', isMainnet: boolean = false): Promise<WalletInfo> {
        try {
            // Save network configuration
            this.networkType = network;
            this.isMainnet = isMainnet;
            storageService.set(STORAGE_KEYS.NETWORK_TYPE, network);
            // DO NOT OVERWRITE the user's manual selection
            // storageService.set(STORAGE_KEYS.NETWORK, isMainnet === true ? 'mainnet' : 'testnet');

            // FIX: WalletManager expects isTestnet, not isMainnet
            const isTestnet = isMainnet === false; // If it's false (testnet), then isTestnet = true
            console.log(`🔍 DEBUG createWallet: isMainnet=${isMainnet}, isTestnet=${isTestnet}`);

            // Change to the appropriate network
            await this.walletManager.switchNetwork(network, isTestnet);

            // Create the wallet
            const { address, serializedWallet, privateKey } = await this.walletManager.createWallet(password);

            // Verify that the address matches the network configuration
            const detectedConfig = this.detectNetworkFromAddress(address);
            if (detectedConfig.network !== network || detectedConfig.isMainnet !== isMainnet) {
                console.warn(`Address prefix mismatch. Expected ${network} ${isMainnet === true ? 'mainnet' : 'testnet'}, got address with prefix for ${detectedConfig.network} ${detectedConfig.isMainnet === true ? 'mainnet' : 'testnet'}`);
            }

            // Save the address and the serialized wallet
            this.currentWalletAddress = address;
            this.serializedWallet = serializedWallet;

            // Save in localStorage with the private key
            await storageService.set(STORAGE_KEYS.WALLET_ADDRESS, address);

            // Save complete wallet with private key
            if (network === 'shannon') {
                await storageService.set('shannon_wallet', {
                    serialized: serializedWallet,
                    privateKey: privateKey, // Save the private key
                    network: 'shannon',
                    timestamp: Date.now(),
                    parsed: { address }
                });

                // Also save in the wallets array if it exists
                const shannonWallets = await storageService.get<any[]>('shannon_wallets') || [];
                if (Array.isArray(shannonWallets)) {
                    // Add new wallet
                    shannonWallets.push({
                        id: `shannon_${Date.now()}`,
                        serialized: serializedWallet,
                        privateKey: privateKey, // Save the private key
                        network: 'shannon',
                        timestamp: Date.now(),
                        parsed: { address }
                    });

                    await storageService.set('shannon_wallets', shannonWallets);
                }
            }

            // Get balance
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
     * Detects the network type and configuration based solely on the saved configuration, NOT on the prefix
     */
    private detectNetworkFromAddress(address: string): { network: NetworkType, isMainnet: boolean } {
        // ALWAYS RESPECT the user's configuration - NEVER use the prefix
        const savedIsMainnet = storageService.getSync<boolean>('isMainnet');
        const savedNetworkType = storageService.getSync<NetworkType>('pokt_network_type') || 'shannon';

        // If there's saved configuration, USE IT ALWAYS
        if (savedIsMainnet !== null && savedIsMainnet !== undefined) {
            return {
                network: savedNetworkType,
                isMainnet: savedIsMainnet
            };
        }

        // Only if THERE'S NO PREVIOUS configuration, use TESTNET by default for Shannon
        return {
            network: 'shannon',
            isMainnet: false
        };
    }

    /**
     * Validates if an address is compatible with the current network configuration
     * @param address - Wallet address
     * @param network - Target network
     * @param isMainnet - If it's mainnet
     * @returns boolean - true if it's compatible
     */
    private isAddressCompatible(address: string, network: NetworkType, isMainnet: boolean): boolean {
        const detected = this.detectNetworkFromAddress(address);
        return detected.network === network && detected.isMainnet === isMainnet;
    }

    /**
     * Cleans and validates the configuration of stored wallets
     * Verifies that the stored wallets are compatible with their configured networks
     */
    async validateAndCleanWallets(): Promise<void> {
        try {
            const storedAddress = storageService.getSync<string>(STORAGE_KEYS.WALLET_ADDRESS);
            const storedNetworkType = storageService.getSync<NetworkType>(STORAGE_KEYS.NETWORK_TYPE);
            const storedNetwork = storageService.getSync<string>(STORAGE_KEYS.NETWORK);

            if (storedAddress && storedNetworkType && storedNetwork) {
                const isMainnet = storedNetwork === 'mainnet';

                // Verify if the address is compatible with the configured network
                if (!this.isAddressCompatible(storedAddress, storedNetworkType, isMainnet)) {
                    console.log('Incompatible wallet detected. Auto-configuring network based on address prefix...');

                    // Detect the correct configuration based on the address
                    const correctConfig = this.detectNetworkFromAddress(storedAddress);

                    // Update network configuration ONLY IF NECESSARY
                    this.networkType = correctConfig.network;

                    // RESPECT the existing configuration - DO NOT CHANGE IT
                    const currentIsMainnet = await storageService.get<boolean>('isMainnet');
                    let finalIsMainnet: boolean;

                    if (currentIsMainnet !== null && currentIsMainnet !== undefined) {
                        finalIsMainnet = Boolean(currentIsMainnet === true); // FORCE BOOLEAN VALID
                        this.isMainnet = finalIsMainnet;
                        console.log(`🎯 validateAndCleanWallets: RESPECTING existing configuration: ${finalIsMainnet === true ? 'mainnet' : 'testnet'}`);
                    } else {
                        // Only if THERE'S NO existing configuration, use detection
                        finalIsMainnet = Boolean(correctConfig.isMainnet === true); // FORCE BOOLEAN VALID
                        this.isMainnet = finalIsMainnet;
                        await storageService.set('isMainnet', finalIsMainnet);
                        console.log(`🔧 validateAndCleanWallets: NO existing config - setting from detection: ${finalIsMainnet === true ? 'mainnet' : 'testnet'}`);
                    }

                    // Update localStorage
                    storageService.set(STORAGE_KEYS.NETWORK_TYPE, correctConfig.network);

                    console.log(`🔧 Network validated: ${correctConfig.network} ${finalIsMainnet === true ? 'mainnet' : 'testnet'}`);

                    // FIX: WalletManager expects isTestnet, not isMainnet
                    const isTestnet = !finalIsMainnet; // Negate directly - simpler and more reliable
                    console.log(`🔍 DEBUG validateAndCleanWallets: finalIsMainnet=${finalIsMainnet}, isTestnet=${isTestnet} (types: ${typeof finalIsMainnet}, ${typeof isTestnet}) - EXPECTED: ${isTestnet ? 'TESTNET' : 'MAINNET'}`);

                    // Change to the network using the FINAL configuration
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
     * Imports an existing wallet and automatically detects the network
     * @param code - Mnemonic, privateKey hex or serialized wallet to import
     * @param password - Password to decrypt the wallet
     * @param network - Network type (optional, will be auto-detected)
     * @param isMainnet - If it's mainnet (optional, will be auto-detected)
     * @returns Promise<WalletInfo> - Information about the imported wallet
     */
    async importWallet(code: string, password: string, network?: NetworkType, isMainnet?: boolean): Promise<WalletInfo> {
        try {
            // IMPORTANT: Use the parameter network to determine the type of wallet, without auto-detection
            if (network === 'morse') {
                const morseResult = await morseWalletService.importMorsePrivateKey(code, password);

                
                return {
                    address: morseResult.address,
                    balance: '0',
                    network: 'morse', // It's a Morse wallet
                    isMainnet: isMainnet !== undefined ? isMainnet : false // Respect the user's configuration
                };
            }
            else if (network === 'shannon') {
                if (this.isShannonPrivateKey(code)) {
                    console.log('🔑 Detected Shannon 64-char private key format - FORZANDO MAINNET');
                    return await this.importShannonPrivateKey(code, password, network, true); // FORCE MAINNET
                } else {
                    console.log('📄 Using standard Shannon import for mnemonic/JSON - FORZANDO MAINNET');
                    return await this.importShannonWallet(code, password, network, true); // FORCE MAINNET
                }
            }
            else {
                console.log('⚠️ No network specified, defaulting to Shannon MAINNET');
                // Default a Shannon MAINNET if no network is specified
                return await this.importShannonWallet(code, password, 'shannon', true); // FORCE MAINNET
            }
        } catch (error) {
            console.error('❌ Error importing wallet:', error);
            throw new Error(`Could not import wallet: ${error}`);
        }
    }

    /**
     * Imports a specific Shannon private key (64 characters)
     */
    private async importShannonPrivateKey(code: string, password: string, network?: NetworkType, isMainnet?: boolean): Promise<WalletInfo> {
        try {
            let address: string;
            let detectedConfig: { network: NetworkType, isMainnet: boolean };

            // FORCE MAINNET ALWAYS
            const useMainnet = true; // FORCE MAINNET
            const prefix = "pokt"; // FORCE prefix of mainnet
            const networkLabel = "mainnet"; // FORCE label of mainnet

            console.log(`🔵 Importing Shannon private key directly as ${networkLabel} (prefix: ${prefix}) - FORZADO MAINNET`);

            // Clean the private key (remove 0x if present)
            let cleanPrivateKey = code.trim().startsWith('0x')
                ? code.trim().substring(2)
                : code.trim();

            try {
                // No pre-validation of format, attempt to create the wallet directly
                address = await this.createShannonWalletFromPrivateKey(cleanPrivateKey, password, prefix);
                detectedConfig = {
                    network: 'shannon',
                    isMainnet: true // FORCE MAINNET ALWAYS
                };
                console.log(`✅ Shannon ${networkLabel} import success:`, address);

                // IMPORTANT: Save the private key in the wallet object
                await storageService.set('shannon_wallet', {
                    privateKey: cleanPrivateKey, // Save the private key directly
                    serialized: cleanPrivateKey, // Also in serialized for compatibility
                    network: 'shannon',
                    timestamp: Date.now(),
                    parsed: { address }
                });
                console.log('✅ Private key saved in shannon_wallet object');

                // Also save in the wallets array if it exists
                const shannonWallets = await storageService.get<any[]>('shannon_wallets') || [];
                if (Array.isArray(shannonWallets)) {
                    // Verify if there's already a wallet with this address
                    const existingIndex = shannonWallets.findIndex(w => w.parsed?.address === address);

                    if (existingIndex >= 0) {
                        // Update the existing wallet
                        shannonWallets[existingIndex].privateKey = cleanPrivateKey;
                        shannonWallets[existingIndex].serialized = cleanPrivateKey;
                        shannonWallets[existingIndex].timestamp = Date.now();
                    } else {
                        // Add new wallet
                        shannonWallets.push({
                            id: `shannon_${Date.now()}`,
                            privateKey: cleanPrivateKey,
                            serialized: cleanPrivateKey,
                            network: 'shannon',
                            timestamp: Date.now(),
                            parsed: { address }
                        });
                    }

                    await storageService.set('shannon_wallets', shannonWallets);
                    console.log('✅ Private key saved in shannon_wallets array');
                }
            } catch (error) {
                console.error(`❌ Failed to import Shannon ${networkLabel}:`, error);
                throw new Error(`Shannon private key import failed for ${networkLabel}: ${error}`);
            }

            const finalNetwork = network || 'shannon';
            const finalIsMainnet = true; // FORCE MAINNET ALWAYS

            // Configure Shannon network
            this.networkType = finalNetwork;
            this.isMainnet = finalIsMainnet;
            storageService.set(STORAGE_KEYS.NETWORK_TYPE, finalNetwork);
            // GUARDAR LA EXPLICIT SELECTION OF THE USER
            storageService.set('isMainnet', finalIsMainnet);

            // FIX: WalletManager expects isTestnet, not isMainnet
            const isTestnet = false; // FORCE MAINNET ALWAYS
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
     * Creates a Shannon wallet from private key (64 characters hex)
     */
    private async createShannonWalletFromPrivateKey(privateKeyHex: string, password: string, prefix: string): Promise<string> {
        try {
            const { DirectSecp256k1Wallet } = await import('@cosmjs/proto-signing');

            // Clean the hex (remove 0x if present)
            let cleanHex = privateKeyHex.trim().startsWith('0x')
                ? privateKeyHex.trim().substring(2)
                : privateKeyHex.trim();

            // Validate format more flexibly
            if (!/^[0-9a-fA-F]+$/.test(cleanHex)) {
                console.log(`⚠️ Input not valid hexadecimal (${cleanHex.length} chars). Attempting normalization.`);

                // If not hex, attempt to generate a hash of the input as a fallback
                const encoder = new TextEncoder();
                const data = encoder.encode(privateKeyHex);
                const hashBuffer = await crypto.subtle.digest('SHA-256', data);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                cleanHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
                console.log(`🔧 Generated hex from input: ${cleanHex.substring(0, 16)}...`);
            }

            // Adjust length if necessary
            if (cleanHex.length > 64) {
                console.log(`⚠️ Private key too long (${cleanHex.length}), truncating to 64 chars`);
                cleanHex = cleanHex.substring(0, 64);
            } else if (cleanHex.length < 64) {
                console.log(`⚠️ Private key too short (${cleanHex.length}), padding to 64 chars`);
                cleanHex = cleanHex.padEnd(64, '0');
            }

            console.log(`🔵 Using Shannon private key: ${cleanHex.substring(0, 8)}... (length: ${cleanHex.length})`);

            // Convert hex to Uint8Array
            const privateKeyBytes = new Uint8Array(cleanHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

            // Create wallet from private key
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
     * Imports serialized JSON or mnemonics (Shannon)
     */
    private async importShannonWallet(code: string, password: string, network?: NetworkType, isMainnet?: boolean): Promise<WalletInfo> {
        try {
            console.log('🚀 Importing Shannon wallet...');

            let address: string;
            // FORCE MAINNET ALWAYS
            const detectedIsMainnet = true; // FORCE MAINNET ALWAYS

            console.log('🎯 FORZANDO Shannon MAINNET - ignoring configuration');

            const prefix = "pokt"; // FORCE prefix of mainnet
            console.log(`🔧 Using prefix: ${prefix} (MAINNET FORZADO)`);

            // Detect if it's serialized wallet or mnemonic
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
                        prefix: prefix // FORCE prefix of mainnet
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

            // Use the detected configuration or the one specified by the user
            const finalNetwork = network || 'shannon';
            const finalIsMainnet = true; // FORCE MAINNET ALWAYS

            console.log(`🎯 Using final config: ${finalNetwork} MAINNET FORZADO`);

            // Configure the service
            this.networkType = finalNetwork;
            this.isMainnet = finalIsMainnet;
            await storageService.set(STORAGE_KEYS.NETWORK_TYPE, finalNetwork);
            await storageService.set('isMainnet', finalIsMainnet);

            // FIX: WalletManager expects isTestnet, not isMainnet
            const isTestnet = false; // FORCE MAINNET ALWAYS
            console.log(`🔍 DEBUG importShannonWallet: finalIsMainnet=${finalIsMainnet}, isTestnet=${isTestnet} (FORZADO MAINNET)`);

            // Configure WalletManager with the detected network
            await this.walletManager.switchNetwork(finalNetwork, isTestnet);

            // Import the wallet using the configured WalletManager
            const finalAddress = await this.walletManager.importWallet(code, password);

            if (address !== finalAddress) {
                console.warn(`Address mismatch: detected=${address}, final=${finalAddress}`);
                // Use the final address from the WalletManager
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
     * Migrates a wallet from Morse to Shannon
     * @param morseAddress - Morse wallet address
     * @param shannonAddress - Shannon wallet address
     * @returns Promise<boolean> - true if migration was successful
     */
    async migrateFromMorseToShannon(morseAddress: string, shannonAddress: string): Promise<boolean> {
        try {
            console.log(`Migrating wallet from Morse (${morseAddress}) to Shannon (${shannonAddress})`);

            // Get the data from the Morse wallet
            const morseWalletData = await storageService.get<any>('morse_wallet');
            if (!morseWalletData || !morseWalletData.serialized) {
                throw new Error('No Morse wallet data found');
            }

            // Prepare data for backend
            let morsePrivateKey: string;
            let morseWalletJson: any = null;

            try {
                // Try parsing as JSON first
                morseWalletJson = JSON.parse(morseWalletData.serialized);
                if (morseWalletJson && morseWalletJson.priv) {
                    console.log('📋 Detected Morse wallet in JSON format');
                    // Extract private key for alternate use
                    morsePrivateKey = morseWalletJson.priv;
                } else {
                    throw new Error('Morse wallet format not recognized');
                }
            } catch (e) {
                // If not JSON, use directly as private key
                console.log('�� Using Morse wallet directly as private key');
                morsePrivateKey = morseWalletData.serialized;
                morseWalletJson = null;
            }

            // Ensure the private key doesn't have 0x prefix
            const cleanPrivateKey = morsePrivateKey.startsWith('0x')
                ? morsePrivateKey.substring(2)
                : morsePrivateKey;

            console.log('Morse private key obtained, sending to migration service...');

            // Verify if we have access to the backend migration service
            const backendUrl = 'http://localhost:3001'; // URL of the migration backend
            const migrationEndpoint = `${backendUrl}/api/migration/migrate`;
            const shannon = await storageService.get<any>('shannon_wallet');

            // Prepare payload for backend
            let payload: any = {};

            // If we have the complete JSON object, send it with preference
            if (morseWalletJson) {
                // Send the complete JSON object of the Morse wallet
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
                // Send only the private key
                payload = {
                    morsePrivateKey: cleanPrivateKey,
                    shannonAddress: {
                        address: shannonAddress,
                        signature: shannon.serialized
                    }
                };
            }

            // Verify backend before sending
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

            // Send request to backend
            const response = await fetch(migrationEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                // Try to get error details
                let errorMessage = `Error ${response.status}: ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.details || errorData.error || errorMessage;
                } catch (e) { }

                console.error('Error in migration:', errorMessage);

                // Specific error messages based on the type of error
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

            // Process successful response
            const result = await response.json();
            console.log('Migration result:', result);

            // Verify both communication success and actual migration result
            const migrationSuccess = result.success && result.data?.result?.success !== false;

            if (!migrationSuccess) {
                // Migration failed - extract error message from internal result
                const errorMessage = result.data?.result?.error ||
                    result.data?.error ||
                    result.error ||
                    'Migration process failed';

                throw new Error(`Migration failed: ${errorMessage}`);
            }

            console.log('✅ Migration completed successfully');
            return true;

        } catch (error) {
            console.error('Error migrating wallet:', error);
            throw error; // Relaunch to let the component handle it
        }
    }

    /**
     * Gets the balance of an address
     * @param address - Wallet address (optional, uses the current one by default)
     * @returns Promise<string> - Balance in POKT
     */
    async getBalance(address: string): Promise<string> {
        try {
            console.log(`🔍 WalletService.getBalance: Fetching balance for ${address}`);

            if (!this.walletManager) {
                console.warn('⚠️ WalletManager not initialized in getBalance');
                await this.init();
                if (!this.walletManager) {
                    throw new Error('No se pudo inicializar WalletManager');
                }
            }

            // Get balance directly
            const balance = await this.walletManager.getBalance(address);
            console.log(`💰 WalletService.getBalance: Balance for ${address}: ${balance}`);

            return balance;
        } catch (error) {
            console.error('❌ Error getting balance:', error);
            return '0';
        }
    }

    /**
     * Gets the transaction history
     * @param address - Wallet address (optional, uses the current one by default)
     * @returns Promise<Transaction[]> - List of transactions
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
     * Sends a transaction
     * @param toAddress - Destination address
     * @param amount - Amount to send in POKT (will be converted to upokt)
     * @returns Promise<string> - Transaction hash
     */
    async sendTransaction(toAddress: string, amount: string): Promise<string> {
        try {
            if (!this.currentWalletAddress) {
                throw new Error('No active wallet');
            }

            // Convert from POKT to upokt (multiply by 1,000,000)
            const amountInUpokt = (parseFloat(amount) * 1_000_000).toString();

            const txHash = await this.walletManager.sendTransaction(toAddress, amountInUpokt);
            return txHash;
        } catch (error) {
            console.error('Error sending transaction:', error);
            throw new Error(`Could not send transaction: ${error}`);
        }
    }

    /**
     * Changes the current network
     * @param network - Network type (morse or shannon)
     * @param isMainnet - If it's mainnet (true) or testnet (false)
     */
    async switchNetwork(network: NetworkType, isMainnet: boolean = false): Promise<void> {
        try {
            // FORCE conversion to boolean to avoid type issues
            const isMainnetBool = Boolean(isMainnet === true);

            this.networkType = network;
            this.isMainnet = isMainnetBool;
            storageService.set(STORAGE_KEYS.NETWORK_TYPE, network);
            // DO NOT OVERWRITE the user's manual selection
            // storageService.set(STORAGE_KEYS.NETWORK, isMainnet === true ? 'mainnet' : 'testnet');

            // FIX: WalletManager expects isTestnet, not isMainnet
            const isTestnet = !isMainnetBool; // Negate directly - simpler and more reliable
            console.log(`🔍 DEBUG switchNetwork: isMainnet=${isMainnetBool}, isTestnet=${isTestnet} (types: ${typeof isMainnetBool}, ${typeof isTestnet})`);
            console.log(`🔍 DEBUG switchNetwork: About to call walletManager.switchNetwork(${network}, ${isTestnet})`);

            // Allow all networks (including Morse) to use their specific functions
            await this.walletManager.switchNetwork(network, isTestnet);
        } catch (error) {
            console.error('Error switching network:', error);
            // No relaunch the error to avoid blocking the UI
            console.warn('Network switch failed, continuing in offline mode');
        }
    }

    /**
     * Returns the current instance of the WalletManager
     * @returns WalletManager - The WalletManager instance
     */
    public getWalletManager(): WalletManager {
        return this.walletManager;
    }

    /**
     * Closes the current session
     */
    logout(): void {
        try {
            console.log('🔄 Starting WalletService logout...');

            // Clean internal properties
            this.currentWalletAddress = null;
            this.serializedWallet = null;
            this.networkType = 'shannon';
            this.isMainnet = false;

            // Clean localStorage using legacy keys
            storageService.remove(STORAGE_KEYS.WALLET_ADDRESS);
            storageService.remove(STORAGE_KEYS.NETWORK_TYPE);
            storageService.remove(STORAGE_KEYS.NETWORK);

            console.log('✅ WalletService logout completed');
        } catch (error) {
            console.error('❌ Error during WalletService logout:', error);
        }
    }

    /**
     * Checks if there's an active wallet
     * @returns boolean - true if there's an active wallet
     */
    isLoggedIn(): boolean {
        return !!this.currentWalletAddress;
    }

    /**
     * Gets the information about the current wallet
     * @returns WalletInfo | null - Information about the current wallet or null if there's none
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
     * Detects the network configuration from an address (public method)
     * @param address - Wallet address
     * @returns Detected network configuration
     */
    public async detectNetworkConfig(address: string): Promise<{ network: NetworkType, isMainnet: boolean }> {
        // First verify if it's a saved Morse wallet
        const morseWallet = await storageService.get<any>('morse_wallet');
        if (morseWallet && morseWallet.parsed?.address === address) {
            console.log('🟡 Address detected as MORSE wallet from storage');
            return { network: 'morse', isMainnet: false };
        }

        // If it's not Morse, use prefix detection for Shannon
        return this.detectNetworkFromAddress(address);
    }

    /**
     * Synchronous version for compatibility (deprecated)
     */
    public detectNetworkConfigSync(address: string): { network: NetworkType, isMainnet: boolean } {
        return this.detectNetworkFromAddress(address);
    }

    /**
     * Gets the Shannon private key from stored data
     * @returns Promise<string | null> - Private key in hex format or null if not found
     */
    async getShannonPrivateKey(): Promise<string | null> {
        try {
            // Try to get the Shannon wallet from storage
            const shannonWallet = await storageService.get<any>('shannon_wallet');

            if (!shannonWallet) {
                console.warn('❌ No Shannon wallet found in storage');
                return null;
            }

            // Verify if there's a direct private key in the object
            if (shannonWallet.privateKey) {
                console.log('✅ Found Shannon private key in the wallet object');
                return shannonWallet.privateKey;
            }

            // Verify if it's in the serialized field as direct private key (64 characters hex)
            if (shannonWallet.serialized && this.isShannonPrivateKey(shannonWallet.serialized)) {
                console.log('✅ Found Shannon private key in hex format');
                return shannonWallet.serialized;
            }

            // Try searching in shannon_wallets also
            const shannonWallets = await storageService.get<any[]>('shannon_wallets');
            if (Array.isArray(shannonWallets) && shannonWallets.length > 0) {
                // Search in each wallet if it has privateKey
                for (const wallet of shannonWallets) {
                    if (wallet.privateKey && this.isShannonPrivateKey(wallet.privateKey)) {
                        console.log('✅ Found Shannon private key in shannon_wallets');
                        return wallet.privateKey;
                    }

                    if (wallet.serialized && this.isShannonPrivateKey(wallet.serialized)) {
                        console.log('✅ Found Shannon private key in hex format in shannon_wallets');
                        return wallet.serialized;
                    }
                }
            }

            // If we don't find the private key, return the serialized wallet object
            console.warn('⚠️ No Shannon private key found, returning wallet object');
            return JSON.stringify(shannonWallet, null, 2);
        } catch (error) {
            console.error('❌ Error getting Shannon private key:', error);
            return null;
        }
    }

    /**
     * Gets the Morse private key from stored data
     * @returns Promise<string | null> - Private key in hex format or null if not found
     */
    async getMorsePrivateKey(): Promise<string | null> {
        try {
            // Use the Morse service to get the private key
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
     * Gets all available wallets with their data
     * @returns Promise<{shannon: any[], morse: any[]}> - Available wallets
     */
    async getAllWallets(): Promise<{ shannon: any[], morse: any[] }> {
        try {
            // Get Shannon wallets
            const shannonArr = await storageService.get<any[]>('shannon_wallets') || [];
            const rawShannonWallets = Array.isArray(shannonArr) ? shannonArr : [];

            // Add legacy Shannon wallet if it exists
            const legacyShannon = await storageService.get<any>('shannon_wallet');
            if (legacyShannon && !rawShannonWallets.some(w => w.id === 'shannon_legacy')) {
                rawShannonWallets.push({ ...legacyShannon, id: 'shannon_legacy' });
            }

            // Remove duplicates by address
            const shannonSeen = new Set<string>();
            const shannonWallets = rawShannonWallets.filter((w: any) => {
                const addr: string | undefined = w.parsed?.address;
                if (addr) {
                    if (shannonSeen.has(addr)) return false;
                    shannonSeen.add(addr);
                }
                return true;
            });

            // Get Morse wallets
            const morseArr = await storageService.get<any[]>('morse_wallets') || [];
            const rawMorseWallets = Array.isArray(morseArr) ? morseArr : [];

            // Add legacy Morse wallet if it exists
            const legacyMorse = await storageService.get<any>('morse_wallet');
            if (legacyMorse && !rawMorseWallets.some(w => w.id === 'morse_legacy')) {
                rawMorseWallets.push({ ...legacyMorse, id: 'morse_legacy' });
            }

            // Remove duplicates by address
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
            console.error('❌ Error getting all wallets:', error);
            return { shannon: [], morse: [] };
        }
    }

    /**
     * Gets the wallet by its address
     * @param address - Wallet address to search for
     * @returns Promise<any | null> - Wallet data or null if not found
     */
    async getWalletByAddress(address: string): Promise<any | null> {
        try {
            const allWallets = await this.getAllWallets();

            // Search in Shannon wallets
            const shannonWallet = allWallets.shannon.find(w =>
                w.parsed?.address === address
            );

            if (shannonWallet) {
                return {
                    ...shannonWallet,
                    network: 'shannon'
                };
            }

            // Search in Morse wallets
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
            console.error('❌ Error searching for wallet by address:', error);
            return null;
        }
    }
}

// Export a single instance
export const walletService = new WalletService(); 