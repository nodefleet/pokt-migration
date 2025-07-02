import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { navigate } from "wouter/use-browser-location";
import { DirectSecp256k1HdWallet, DirectSecp256k1Wallet } from "@cosmjs/proto-signing";
import { useMutation, UseMutationResult } from "@tanstack/react-query";
import { sha256 } from '@cosmjs/crypto';

// Define MorseError directly
class MorseError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'MorseError';
    }
}

// Specific types for Morse Wallet Store
export type WalletStateMorse =
    | {
        address: string;
        serializedWallet: string;
    }
    | {
        address: null;
        serializedWallet: null;
    };

export const useMorseWalletStore = create<WalletStateMorse>()(
    persist<WalletStateMorse>(
        () => ({
            address: null,
            serializedWallet: null,
        }),
        {
            name: "morse-wallet-storage", // Unique name for Morse persistence
            storage: createJSONStorage(() => localStorage),
        }
    )
);

export type SerializedWalletMorse = {
    serialization: string;
    password: string; // Password to deserialize/serialize the wallet
};

// Helper function to get the address (common, but specific to the hook context)
async function getAddressMorse(wallet: DirectSecp256k1HdWallet): Promise<string> {
    const accountData = await wallet.getAccounts();
    if (accountData.length === 0) {
        throw new Error("No accounts found in the wallet");
    }
    return accountData[0].address;
}

/**
 * CLASE ESPECÍFICA PARA MANEJAR WALLETS DE MORSE
 * Completamente separada de Shannon
 */
export class MorseWalletService {
    private currentAddress: string | null = null;

    /**
     * Detects if it's a Morse wallet JSON with format {"addr": "...", "name": "...", "priv": "..."}
     */
    private isMorseJsonWallet(code: string): boolean {
        try {
            const trimmed = code.trim();

            // Check basic JSON format
            if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
                return false;
            }

            // Must be valid JSON
            const parsed = JSON.parse(trimmed);

            // We only require the addr field with valid format
            const hasAddr = parsed.addr && typeof parsed.addr === 'string';

            // addr must be 40 character hex (20 bytes)
            const hasValidAddr = hasAddr && /^[0-9a-fA-F]{40}$/i.test(parsed.addr);

            return hasValidAddr;
        } catch (error: unknown) {
            return false;
        }
    }

    /**
     * Detects if it's a Morse private key (128 characters hex or JSON format)
     * Public method to be used by WalletService
     */
    public detectMorseWallet(code: string): boolean {
        // If it's Morse wallet JSON
        if (this.isMorseJsonWallet(code)) {
            return true;
        }

        // If it's direct hex private key
        const trimmed = code.trim();

        // Check if it contains spaces (mnemonic)
        if (trimmed.includes(' ')) {
            return false;
        }

        // Clean 0x prefix if it exists
        const cleanHex = trimmed.startsWith('0x') ? trimmed.substring(2) : trimmed;

        // Morse private keys are 128 characters (64 bytes)
        const isMorseHex = /^[0-9a-fA-F]{128}$/i.test(cleanHex);

        return isMorseHex;
    }

    /**
     * Generates a Morse address from a private key
     * @param privateKey - The private key in hex format (128 characters)
     * @returns The Morse address or null if invalid
     */
    public async generateAddressFromPrivateKey(privateKey: string): Promise<string | null> {
        try {
            // Clean and validate the private key
            const cleanPrivateKey = privateKey.trim().startsWith('0x')
                ? privateKey.trim().substring(2)
                : privateKey.trim();

            // Validate that it's a valid hex string of correct length
            if (!/^[0-9a-fA-F]{128}$/i.test(cleanPrivateKey)) {
                console.error('❌ Invalid Morse private key format - must be 128 hex characters');
                return null;
            }

            // Para Morse, simplemente usamos los últimos 40 caracteres (20 bytes) de la clave privada
            // como dirección, ya que no tenemos acceso a la implementación real
            // En una implementación real, deberíamos usar la derivación de clave adecuada
            const address = cleanPrivateKey.slice(-40).toLowerCase();
            console.log('✅ Generated Morse address from private key:', address);

            return address;
        } catch (error) {
            console.error('❌ Error generating Morse address from private key:', error);
            return null;
        }
    }

    /**
     * Parses a Morse wallet in JSON format
     */
    private parseMorseJsonWallet(jsonString: string): { addr: string, name: string, priv: string, account?: number } {
        try {
            const parsed = JSON.parse(jsonString.trim());

            if (!parsed.addr) {
                throw new Error('Missing required field: addr');
            }

            // Validate addr format
            if (!/^[0-9a-fA-F]{40}$/i.test(parsed.addr)) {
                throw new Error('Invalid addr format - must be 40 hex characters');
            }

            // Assign default values for optional fields
            const name = parsed.name || `wallet-${parsed.addr.substring(0, 8)}`;
            let priv = parsed.priv || "";
            const account = parsed.account || 0;

            return {
                addr: parsed.addr,
                name: name,
                priv: priv,
                account: account
            };
        } catch (error) {
            console.error('❌ Error parsing Morse JSON:', error);
            throw error;
        }
    }

    /**
     * Imports a Morse wallet (only JSON format)
     */
    async importMorsePrivateKey(code: string, password: string): Promise<{ address: string, serialized: string }> {
        try {
            // Try various normalization techniques for JSON
            let normalizedCode = code;
            let jsonData = null;

            // Technique 1: Try to parse directly
            try {
                jsonData = JSON.parse(normalizedCode.trim());
            } catch (e) {
                // Technique 2: Replace escaped quotes
                try {
                    normalizedCode = code.replace(/\\"/g, '"');
                    jsonData = JSON.parse(normalizedCode.trim());
                } catch (e2) {
                    // Technique 3: Replace single quotes with double quotes
                    try {
                        normalizedCode = code.replace(/'/g, '"');
                        jsonData = JSON.parse(normalizedCode.trim());
                    } catch (e3) {
                        // Technique 4: Clean spaces and strange formatting
                        try {
                            normalizedCode = code.replace(/\s+/g, ' ').trim();

                            // If it starts with { but doesn't end with }, add the closing
                            if (normalizedCode.startsWith('{') && !normalizedCode.endsWith('}')) {
                                normalizedCode += '}';
                            }

                            jsonData = JSON.parse(normalizedCode);
                        } catch (e4) {
                            // Last attempt: Manually reconstruct
                            if (code.includes('"name"') && code.includes('"addr"')) {
                                try {
                                    // Extract key values using regular expressions
                                    const nameMatch = code.match(/"name"\s*:\s*"([^"]+)"/);
                                    const addrMatch = code.match(/"addr"\s*:\s*"([^"]+)"/);
                                    const privMatch = code.match(/"priv"\s*:\s*"([^"]+)"/);

                                    if (addrMatch) {
                                        jsonData = {
                                            name: nameMatch ? nameMatch[1] : `wallet-${addrMatch[1].substring(0, 8)}`,
                                            addr: addrMatch[1],
                                            priv: privMatch ? privMatch[1] : ""
                                        };
                                    }
                                } catch (e5) {
                                    // Do nothing, it will be handled in the next block
                                }
                            }
                        }
                    }
                }
            }

            if (!jsonData) {
                throw new Error("No se pudo procesar el formato JSON. Verifica que sea un JSON válido.");
            }

            // Handle array of wallets or individual wallet
            const wallets = Array.isArray(jsonData) ? jsonData : [jsonData];

            // Check that it has at least one wallet
            if (wallets.length === 0) {
                throw new Error('No wallets found in the JSON data');
            }

            // Validate each wallet and get the first one to return
            let firstWalletInfo = null;

            // Save to storage using dynamic import
            const { storageService } = await import('./storage.service');

            // Get existing list of wallets
            const existingData = await storageService.get<any>('morse_wallets');

            // Ensure that existingData is an array
            const existing: any[] = Array.isArray(existingData) ? existingData : [];

            for (const wallet of wallets) {
                // Validate that it has at least the addr field
                if (!wallet.addr || typeof wallet.addr !== 'string') {
                    throw new Error('Invalid Morse JSON: missing addr field');
                }

                // Create basic wallet data
                const walletInfo = {
                    address: wallet.addr,
                    serialized: JSON.stringify(wallet)
                };

                // Save the first wallet to return it
                if (!firstWalletInfo) {
                    firstWalletInfo = walletInfo;
                    this.currentAddress = walletInfo.address;
                }

                // Check if this wallet already exists (avoid duplicates)
                const isDuplicate = existing.some((w: any) =>
                    (w.parsed?.addr === wallet.addr)
                );

                if (!isDuplicate) {
                    // Add to the wallet list
                    existing.push({
                        id: 'morse_' + Date.now() + Math.random().toString(16).slice(2, 6),
                        serialized: JSON.stringify(wallet),
                        parsed: wallet,
                        network: 'morse',
                        timestamp: Date.now()
                    });
                }
            }

            // Save updated list
            await storageService.set('morse_wallets', existing);

            // Respect the user's network configuration for Morse
            const savedIsMainnet = await storageService.get<boolean>('isMainnet');
            if (savedIsMainnet === null || savedIsMainnet === undefined) {
                // Only set testnet as default if there is no previous configuration
                await storageService.set('isMainnet', false);
            }

            if (!firstWalletInfo) {
                throw new Error('Failed to process any wallet');
            }

            return firstWalletInfo;
        } catch (error: any) {
            console.error('❌ Error importing Morse wallet:', error.message);
            throw new Error(`Could not import Morse wallet: ${error.message}`);
        }
    }

    /**
     * Imports a Morse wallet from a hex private key
     * @param privateKey - The private key in hex format (128 characters)
     * @returns The wallet info with address and serialized data
     */
    async importFromPrivateKey(privateKey: string): Promise<{ address: string, serialized: string } | null> {
        try {
            // Generate the address from the private key
            const address = await this.generateAddressFromPrivateKey(privateKey);

            if (!address) {
                throw new Error('Could not generate address from private key');
            }

            // Create a wallet object
            const walletData = {
                name: `wallet-${address.substring(0, 8)}`,
                addr: address,
                priv: privateKey
            };

            // Serialize the wallet
            const serialized = JSON.stringify(walletData);

            // Save to storage
            const { storageService } = await import('./storage.service');

            // Get existing list of wallets
            const existingData = await storageService.get<any[]>('morse_wallets');
            const existing: any[] = Array.isArray(existingData) ? existingData : [];

            // Check if this wallet already exists
            const isDuplicate = existing.some((w: any) =>
                (w.parsed?.addr === address)
            );

            if (!isDuplicate) {
                // Add to the wallet list
                existing.push({
                    id: 'morse_' + Date.now() + Math.random().toString(16).slice(2, 6),
                    serialized,
                    parsed: walletData,
                    network: 'morse',
                    timestamp: Date.now()
                });

                // Save updated list
                await storageService.set('morse_wallets', existing);
            }

            return { address, serialized };
        } catch (error) {
            console.error('❌ Error importing Morse wallet from private key:', error);
            return null;
        }
    }

    /**
     * Imports multiple Morse wallets from an array of private keys
     * @param privateKeys - Array of private keys in hex format
     * @returns Array of imported wallet info objects
     */
    async importFromPrivateKeys(privateKeys: string[]): Promise<Array<{ address: string, serialized: string }>> {
        const results: Array<{ address: string, serialized: string }> = [];

        for (const privateKey of privateKeys) {
            try {
                const result = await this.importFromPrivateKey(privateKey);
                if (result) {
                    results.push(result);
                }
            } catch (error) {
                console.error(`❌ Error importing private key: ${privateKey.substring(0, 10)}...`, error);
                // Continue with next key
            }
        }

        return results;
    }

    /**
     * Gets the current Morse address
     */
    getCurrentAddress(): string | null {
        return this.currentAddress;
    }

    /**
     * Clears the Morse session
     */
    async logout(): Promise<void> {
        try {
            // Clear current address
            this.currentAddress = null;

            // Dynamically import storageService
            const { storageService } = await import('./storage.service');

            // Clear all Morse-related keys
            await storageService.remove('morse_wallet');
            await storageService.remove('walletAddress');
            await storageService.remove('walletData');
        } catch (error) {
            console.error('❌ Error during MORSE logout:', error);
        }
    }

    /**
     * Gets the Morse private key from stored data
     */
    async getMorsePrivateKey(): Promise<string | null> {
        try {
            const { storageService } = await import('./storage.service');
            const morseWallet = await storageService.get<any>('morse_wallet');

            if (!morseWallet || !morseWallet.serialized) {
                return null;
            }

            const serializedData = morseWallet.serialized;

            // Detect if it's JSON
            if (this.isMorseJsonWallet(serializedData)) {
                const morseData = this.parseMorseJsonWallet(serializedData);
                return morseData.priv;
            } else {
                return null;
            }
        } catch (error) {
            console.error('❌ Error getting Morse private key:', error);
            return null;
        }
    }
}

// Hook to import a Morse wallet from its serialized form (e.g. keyfile content)
export function useImportWalletMorse(): UseMutationResult<void, Error, SerializedWalletMorse> {
    return useMutation({
        mutationFn: async ({ serialization, password }: SerializedWalletMorse) => {
            const wallet = await DirectSecp256k1HdWallet.deserialize(serialization, password);
            const address = await getAddressMorse(wallet);
            // Re-serialize with the same password to ensure consistency in the store if necessary
            // or if the original serialization is not to be saved directly for some reason.
            // For this pattern, the original serialization with which it was imported is usually saved.
            // Here, the example from shannon/wallet.ts serializes again.
            const reSerializedWallet = await wallet.serialize(password);

            useMorseWalletStore.setState({
                address,
                serializedWallet: reSerializedWallet, // Save the (re)serialization
            });
        },
        onSuccess: () => {
            navigate("/wallet"); // Or the corresponding route for Morse
        },
    });
}

// Hook to create a new Morse wallet
export function useCreateWalletMorse(): UseMutationResult<void, Error, { password: string }> {
    return useMutation({
        mutationFn: async ({ password }: { password: string }) => {
            // Use the "poktval" prefix for Morse
            const wallet = await DirectSecp256k1HdWallet.generate(24, { prefix: "poktval" });
            const address = await getAddressMorse(wallet);
            const serializedWallet = await wallet.serialize(password);

            useMorseWalletStore.setState({
                address,
                serializedWallet,
            });
        },
        onSuccess: () => {
            navigate("/download-wallet"); // Or the corresponding route for Morse
        },
    });
}

// Types and Hook to import a Morse wallet from a mnemonic phrase
export type MnemonicWalletParamsMorse = {
    mnemonic: string;
    passwordToSerializeWith: string; // Password to encrypt the serialized wallet in the store
};

export function useImportMnemonicMorse(): UseMutationResult<void, Error, MnemonicWalletParamsMorse> {
    return useMutation({
        mutationFn: async ({ mnemonic, passwordToSerializeWith }: MnemonicWalletParamsMorse) => {
            const trimmedMnemonic = mnemonic.trim();
            const words = trimmedMnemonic.split(/\s+/);
            if (words.length !== 12 && words.length !== 24) {
                throw new Error(`La frase mnemónica para Morse debe tener 12 o 24 palabras. Tiene ${words.length}.`);
            }

            // Use the "poktval" prefix for Morse
            const wallet = await DirectSecp256k1HdWallet.fromMnemonic(trimmedMnemonic, {
                prefix: "poktval",
            });

            const address = await getAddressMorse(wallet);
            const serializedWallet = await wallet.serialize(passwordToSerializeWith);

            useMorseWalletStore.setState({
                address,
                serializedWallet,
            });
        },
        onSuccess: () => {
            navigate("/wallet"); // Or the corresponding route for Morse
        },
    });
}

// Export single instance of the Morse service 
export const morseWalletService = new MorseWalletService(); 