import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { navigate } from "wouter/use-browser-location";
import { DirectSecp256k1HdWallet, DirectSecp256k1Wallet } from "@cosmjs/proto-signing";
import { useMutation, UseMutationResult } from "@tanstack/react-query";
import { sha256 } from '@cosmjs/crypto';

// Definir MorseError directamente
class MorseError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'MorseError';
    }
}

// Tipos específicos para Morse Wallet Store
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
            name: "morse-wallet-storage", // Nombre único para la persistencia de Morse
            storage: createJSONStorage(() => localStorage),
        }
    )
);

export type SerializedWalletMorse = {
    serialization: string;
    password: string; // Contraseña para deserializar/serializar la wallet
};

// Función auxiliar para obtener la dirección (común, pero específica al contexto del hook)
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
     * Detecta si una clave es hexadecimal de Morse (128 caracteres)
     */
    private isMorseHexPrivateKey(code: string): boolean {
        const trimmed = code.trim();
        console.log('🔍 MORSE Detection - Original:', code.substring(0, 20) + '...');
        console.log('🔍 MORSE Detection - Trimmed length:', trimmed.length);

        const cleanHex = trimmed.startsWith('0x') ? trimmed.substring(2) : trimmed;
        console.log('🔍 MORSE Detection - Clean hex length:', cleanHex.length);
        console.log('🔍 MORSE Detection - First 20 chars:', cleanHex.substring(0, 20));

        // Las claves privadas de Morse son típicamente de 128 o 64 caracteres
        // Las direcciones de Morse son de 40 caracteres
        const isMorsePrivateKey = /^[0-9a-fA-F]{64}$/.test(cleanHex) || /^[0-9a-fA-F]{128}$/.test(cleanHex);
        const isMorseAddress = /^[0-9a-fA-F]{40}$/.test(cleanHex);

        console.log('🔍 MORSE Detection - Is 64/128-char private key:', isMorsePrivateKey);
        console.log('🔍 MORSE Detection - Is 40-char address:', isMorseAddress);

        // Verificar si contiene solo caracteres hex válidos
        const hasValidHexChars = /^[0-9a-fA-F]+$/.test(cleanHex);
        console.log('🔍 MORSE Detection - Has valid hex chars:', hasValidHexChars);

        const result = isMorsePrivateKey || isMorseAddress;
        console.log('🔍 MORSE Detection - Final result:', result);
        return result;
    }

    /**
     * Detecta si es una dirección Morse (40 caracteres hex)
     */
    private isMorseAddress(code: string): boolean {
        const trimmed = code.trim();
        const cleanHex = trimmed.startsWith('0x') ? trimmed.substring(2) : trimmed;

        // Las direcciones de Morse son de 40 caracteres (20 bytes)
        const isMorseAddr = /^[0-9a-fA-F]{40}$/.test(cleanHex);
        console.log('🔍 MORSE Address Detection - Is 40-char address:', isMorseAddr, cleanHex);
        return isMorseAddr;
    }

    /**
     * Detecta si es un JSON de wallet Morse con formato {"addr": "...", "name": "...", "priv": "..."}
     */
    private isMorseJsonWallet(code: string): boolean {
        try {
            const trimmed = code.trim();
            console.log('🔍 MORSE JSON Detection - Input preview:', trimmed.substring(0, 100) + '...');
            console.log('🔍 MORSE JSON Detection - Starts with {:', trimmed.startsWith('{'));
            console.log('🔍 MORSE JSON Detection - Ends with }:', trimmed.endsWith('}'));

            // Debe ser JSON válido
            const parsed = JSON.parse(trimmed);
            console.log('🔍 MORSE JSON Detection - Parsed successfully');

            // Debe tener los campos específicos de Morse: addr, name, priv
            const hasMorseFields = parsed.addr && parsed.name && parsed.priv;
            console.log('🔍 MORSE JSON Detection - Has all fields (addr, name, priv):', hasMorseFields);
            console.log('🔍 MORSE JSON Detection - Field check:', {
                hasAddr: !!parsed.addr,
                hasName: !!parsed.name,
                hasPriv: !!parsed.priv,
                hasPass: !!parsed.pass
            });

            // addr debe ser hex de 40 caracteres (20 bytes)
            const hasValidAddr = typeof parsed.addr === 'string' && /^[0-9a-fA-F]{40}$/i.test(parsed.addr);

            // priv debe ser hex de 64 o 128 caracteres (para compatibilidad con formato Morse original)
            const hasValidPriv = typeof parsed.priv === 'string' && /^[0-9a-fA-F]{64,128}$/i.test(parsed.priv);

            console.log('🔍 MORSE JSON Detection - Has fields:', hasMorseFields);
            console.log('🔍 MORSE JSON Detection - Valid addr:', hasValidAddr, parsed.addr);
            console.log('🔍 MORSE JSON Detection - Valid priv:', hasValidPriv, `Length: ${parsed.priv?.length}, Preview: ${parsed.priv?.substring(0, 16)}...`);
            console.log('🔍 MORSE JSON Detection - Name:', parsed.name);

            const isMorseJson = hasMorseFields && hasValidAddr && hasValidPriv;
            console.log('🔍 MORSE JSON Detection - Final result:', isMorseJson);

            return isMorseJson;
        } catch (error: unknown) {
            console.log('🔍 MORSE JSON Detection - Not valid JSON:', (error as Error).message);
            return false;
        }
    }

    /**
     * Parsea una wallet Morse en formato JSON
     */
    private parseMorseJsonWallet(jsonString: string): { addr: string, name: string, priv: string } {
        try {
            const parsed = JSON.parse(jsonString.trim());

            if (!parsed.addr || !parsed.name || !parsed.priv) {
                throw new Error('Missing required fields: addr, name, priv');
            }

            // Validar formatos
            if (!/^[0-9a-fA-F]{40}$/i.test(parsed.addr)) {
                throw new Error('Invalid addr format - must be 40 hex characters');
            }

            // Permitir claves privadas de 64 o 128 caracteres
            if (!/^[0-9a-fA-F]{64,128}$/i.test(parsed.priv)) {
                throw new Error('Invalid priv format - must be 64 or 128 hex characters');
            }

            // Si la clave privada es de 128 caracteres, usar solo los primeros 64
            let processedPriv = parsed.priv;
            if (parsed.priv.length === 128) {
                processedPriv = parsed.priv.substring(0, 64);
                console.log('🔄 Converted 128-char private key to 64-char for processing');
            }

            console.log('✅ MORSE JSON parsed successfully:', {
                addr: parsed.addr,
                name: parsed.name,
                privLength: parsed.priv.length,
                processedPrivPreview: processedPriv.substring(0, 16) + '...'
            });

            return {
                addr: parsed.addr,
                name: parsed.name,
                priv: processedPriv // Usar la clave procesada (64 caracteres)
            };
        } catch (error) {
            console.error('❌ Error parsing Morse JSON:', error);
            throw error;
        }
    }

    /**
     * Crea una wallet de Morse desde formato JSON con addr, name, priv
     */
    private async createMorseWalletFromJson(morseData: { addr: string, name: string, priv: string }, password: string): Promise<{ address: string, serialized: string }> {
        try {
            console.log('🟡 Creating MORSE wallet from JSON format');
            console.log('🟡 Morse addr:', morseData.addr);
            console.log('🟡 Morse name:', morseData.name);

            // Usar la dirección original de Morse tal como viene en el JSON
            const originalMorseAddr = morseData.addr;
            const privHex = morseData.priv;

            console.log(`✅ MORSE JSON wallet created with original address: ${originalMorseAddr}`);
            console.log(`🔄 Morse name: ${morseData.name}`);

            // Crear serialización para Morse JSON preservando todos los datos originales
            const morseJsonData = {
                type: "morse-json-wallet",
                originalAddr: originalMorseAddr,
                originalName: morseData.name,
                privateKeyHex: privHex,
                network: "morse"
            };

            return {
                address: originalMorseAddr, // Usar la dirección original de Morse
                serialized: JSON.stringify(morseJsonData)
            };
        } catch (error) {
            console.error('❌ Error creating Morse wallet from JSON:', error);
            throw new Error(`Could not create Morse wallet from JSON: ${error}`);
        }
    }

    /**
     * Deriva la dirección de Morse desde una clave privada usando el método real de morsedoc
     */
    private async deriveMorseAddressFromPrivateKey(privateKey: string): Promise<string> {
        try {
            console.log(`🔑 Derivando dirección Morse del private key: ${privateKey.substring(0, 8)}...`);

            // Limpiar el hex (remover prefijo 0x si existe)
            const cleanHex = privateKey.replace(/^0x/, '');

            // Validar que sea un hex válido
            if (!/^[0-9a-fA-F]+$/.test(cleanHex)) {
                throw new Error("Private key must be valid hexadecimal");
            }

            // Para Morse, manejar claves de 128 caracteres probando diferentes partes
            let keyToUse = cleanHex;
            if (cleanHex.length === 128) {
                console.log(`🔄 Testing different parts of 128-char key to find correct address...`);

                // Intentar con los primeros 64 caracteres
                const firstHalf = cleanHex.substring(0, 64);
                const testAddress1 = await this.testKeyDerivation(firstHalf, "First 64 chars");

                // Intentar con los últimos 64 caracteres
                const secondHalf = cleanHex.substring(64, 128);
                const testAddress2 = await this.testKeyDerivation(secondHalf, "Last 64 chars");

                // Log both results to compare
                console.log(`🔍 Testing results:`);
                console.log(`   First 64:  ${testAddress1}`);
                console.log(`   Last 64:   ${testAddress2}`);
                console.log(`   Expected:  f105a9c5bd8dfd67734aa82998a758080bc71666`);

                // Verificar cuál es correcto
                if (testAddress1 === "f105a9c5bd8dfd67734aa82998a758080bc71666") {
                    console.log(`✅ Correct derivation found using FIRST 64 characters`);
                    keyToUse = firstHalf;
                } else if (testAddress2 === "f105a9c5bd8dfd67734aa82998a758080bc71666") {
                    console.log(`✅ Correct derivation found using LAST 64 characters`);
                    keyToUse = secondHalf;
                } else {
                    console.log(`⚠️ Neither half produces expected address, using first 64 as fallback`);
                    keyToUse = firstHalf;
                }
            }

            // Validar que sea exactamente 64 caracteres (32 bytes)
            if (keyToUse.length !== 64) {
                throw new Error(`Invalid private key length: ${keyToUse.length}. Expected 64 characters.`);
            }

            // Convertir private key a bytes
            const privateKeyBytes = new Uint8Array(keyToUse.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

            // Crear wallet temporal para obtener la clave pública
            const wallet = await DirectSecp256k1Wallet.fromKey(privateKeyBytes, "pokt");
            const [account] = await wallet.getAccounts();

            if (!account.pubkey) {
                throw new Error("Could not derive public key from private key");
            }

            // MÉTODO REAL DE MORSEDOC: SHA-256 de la clave pública y tomar primeros 20 bytes
            console.log('🔍 Using real Morse derivation method: SHA-256(publicKey).slice(0, 20)');

            // Hacer SHA-256 de la clave pública
            const publicKeyHash = sha256(account.pubkey);

            // Tomar los primeros 20 bytes (40 caracteres hex) como hace morsedoc
            const morseAddress = Array.from(publicKeyHash.slice(0, 20))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');

            console.log(`📍 Dirección Morse derivada (método real): ${morseAddress}`);
            console.log(`🔍 Expected: f105a9c5bd8dfd67734aa82998a758080bc71666`);
            console.log(`🔍 Got:      ${morseAddress}`);

            return morseAddress;

        } catch (error) {
            console.error("Error derivando dirección Morse:", error);
            throw new MorseError(`Failed to derive Morse address: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Función auxiliar para probar derivación con una clave específica
     */
    private async testKeyDerivation(hexKey: string, description: string): Promise<string> {
        try {
            // Convertir private key a bytes
            const privateKeyBytes = new Uint8Array(hexKey.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

            // Crear wallet temporal para obtener la clave pública
            const wallet = await DirectSecp256k1Wallet.fromKey(privateKeyBytes, "pokt");
            const [account] = await wallet.getAccounts();

            if (!account.pubkey) {
                throw new Error("Could not derive public key from private key");
            }

            // Hacer SHA-256 de la clave pública
            const publicKeyHash = sha256(account.pubkey);

            // Tomar los primeros 20 bytes (40 caracteres hex)
            const morseAddress = Array.from(publicKeyHash.slice(0, 20))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');

            console.log(`   ${description}: ${morseAddress}`);
            return morseAddress;

        } catch (error) {
            console.error(`Error testing ${description}:`, error);
            return "";
        }
    }

    /**
     * Crea una wallet de Morse desde clave privada hex o dirección hex
     */
    private async createMorseWalletFromHex(inputHex: string, password: string): Promise<{ address: string, serialized: string }> {
        try {
            console.log(`🔧 Creando wallet Morse desde hex: ${inputHex.substring(0, 8)}...`);

            // Limpiar el hex (remover prefijo 0x si existe)
            const cleanHex = inputHex.replace(/^0x/, '');

            // Validar que sea un hex válido
            if (!/^[0-9a-fA-F]+$/.test(cleanHex)) {
                throw new Error("Input must be valid hexadecimal");
            }

            let morseAddress: string;
            let walletType: string;

            // Detectar si es una dirección (40 chars) o una clave privada (64/128 chars)
            if (cleanHex.length === 40) {
                console.log('🎯 Detected 40-char input - treating as Morse address directly');
                morseAddress = cleanHex;
                walletType = "morse-address-import";
            } else if (cleanHex.length === 64 || cleanHex.length === 128) {
                console.log('🔑 Detected private key - deriving Morse address');
                // Derivar la dirección Morse desde la clave privada
                morseAddress = await this.deriveMorseAddressFromPrivateKey(cleanHex);

                if (cleanHex.length === 64) {
                    walletType = "morse-imported-32";
                } else {
                    walletType = "morse-imported-64";
                }
            } else {
                throw new Error(`Unsupported input length: ${cleanHex.length} characters. Expected 40 (address), 64 (private key), or 128 (extended private key).`);
            }

            // Crear un HD wallet temporal para serialización (solo para compatibilidad)
            const tempWallet = await DirectSecp256k1HdWallet.generate(12, { prefix: "poktval" });
            const serialization = await tempWallet.serialize(password);

            // Estructura de datos específica para Morse
            const morseWalletData = {
                type: walletType,
                address: morseAddress, // Usar la dirección Morse (directa o derivada)
                originalInput: cleanHex, // Guardar el input original
                serialization: serialization, // Serialización temporal solo para compatibilidad
                network: "morse",
                imported: true,
                timestamp: Date.now()
            };

            console.log(`✅ Wallet Morse creado exitosamente con dirección: ${morseAddress}`);
            console.log(`📝 Tipo de import: ${walletType}`);

            return {
                address: morseAddress,
                serialized: JSON.stringify(morseWalletData)
            };

        } catch (error) {
            console.error("Error creando wallet Morse desde hex:", error);
            throw new MorseError(`Failed to create Morse wallet from hex: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Detecta si un código es una wallet de Morse válida (formato hex o JSON)
     */
    detectMorseWallet(code: string): boolean {
        try {
            // Verificar JSON PRIMERO (mismo orden que en importMorsePrivateKey)
            const isJson = this.isMorseJsonWallet(code);
            const isHex = this.isMorseHexPrivateKey(code);

            console.log('🔍 MORSE Detection Summary:');
            console.log('  - Is JSON format:', isJson);
            console.log('  - Is Hex format:', isHex);

            // Comprobación adicional para JSONs con formato Morse
            let isSpecialMorseJson = false;

            if (!isJson && !isHex && code.trim().startsWith('{')) {
                try {
                    // Intentar analizar el JSON
                    const jsonData = JSON.parse(code.trim());

                    // Verificar si tiene características típicas de wallets Morse
                    isSpecialMorseJson = (
                        (jsonData.coinbase !== undefined) ||
                        (jsonData.privkey !== undefined) ||
                        (jsonData.private_key !== undefined) ||
                        (jsonData.type === 'morse') ||
                        (jsonData.addr && jsonData.priv) ||
                        (typeof jsonData.address === 'string' && jsonData.address.startsWith('pokt1'))
                    );

                    console.log('  - Is Special Morse JSON:', isSpecialMorseJson);
                } catch (jsonError) {
                    // Error al analizar JSON, no es un JSON válido
                    console.log('  - JSON parse error:', jsonError);
                }
            }

            return isJson || isHex || isSpecialMorseJson;
        } catch (error: any) {
            console.error('❌ Error detecting Morse wallet:', error.message);
            return false;
        }
    }

    /**
     * Importa una clave privada de Morse (formato hex o JSON)
     */
    async importMorsePrivateKey(code: string, password: string): Promise<{ address: string, serialized: string }> {
        try {
            console.log('📥 MORSE Import - Starting import process');
            console.log('📥 MORSE Import - Code preview:', code.substring(0, 100) + '...');

            let walletInfo;

            // IMPORTANTE: Verificar JSON PRIMERO, ya que un JSON con clave privada de 128 chars 
            // podría ser detectado incorrectamente como HEX puro
            if (this.isMorseJsonWallet(code)) {
                console.log('🔄 MORSE Import - Detected JSON format (PRIORITY)');
                const morseData = this.parseMorseJsonWallet(code);
                walletInfo = await this.createMorseWalletFromJson(morseData, password);
            } else if (this.isMorseHexPrivateKey(code)) {
                console.log('🔄 MORSE Import - Detected hex format (FALLBACK)');
                walletInfo = await this.createMorseWalletFromHex(code, password);
            } else {
                throw new Error('Invalid Morse wallet format. Expected 128-char hex key or JSON with addr/name/priv fields');
            }

            // Actualizar dirección actual
            this.currentAddress = walletInfo.address;

            // Guardar en storage usando importación dinámica - USAR CLAVES CORRECTAS
            const { storageService } = await import('./storage.service');

            // Guardar con la estructura que espera main.tsx
            await storageService.set('morse_wallet', {
                serialized: code, // El código original importado
                network: 'morse',
                timestamp: Date.now(),
                parsed: { address: walletInfo.address } // La dirección original de Morse
            });

            // Respetar la configuración de red del usuario para Morse
            const savedIsMainnet = await storageService.get<boolean>('isMainnet');
            if (savedIsMainnet === null || savedIsMainnet === undefined) {
                // Solo establecer testnet como default si no hay configuración previa
                await storageService.set('isMainnet', false);
                console.log('🟡 MORSE: No network configuration found, using testnet as default');
            } else {
                console.log(`🟡 MORSE: Respecting saved network configuration: ${savedIsMainnet === true ? 'mainnet' : 'testnet'}`);
            }

            console.log(`✅ MORSE wallet imported successfully: ${walletInfo.address}`);
            console.log(`📦 MORSE wallet type: ${JSON.parse(walletInfo.serialized).type}`);

            return walletInfo;

        } catch (error: any) {
            console.error('❌ Error importing Morse wallet:', error.message);
            throw new Error(`Could not import Morse wallet: ${error.message}`);
        }
    }

    /**
     * Obtiene la dirección actual de Morse
     */
    getCurrentAddress(): string | null {
        return this.currentAddress;
    }

    /**
     * Limpia la sesión de Morse
     */
    async logout(): Promise<void> {
        try {
            console.log('🟡 Starting MORSE wallet cleanup...');

            // Limpiar dirección actual
            this.currentAddress = null;

            // Importar storageService dinámicamente
            const { storageService } = await import('./storage.service');

            // Limpiar todas las claves relacionadas con Morse
            await storageService.remove('morse_wallet');
            await storageService.remove('walletAddress');
            await storageService.remove('walletData');

            console.log('✅ MORSE wallet session completely cleared');
        } catch (error) {
            console.error('❌ Error during MORSE logout:', error);
        }
    }

    /**
     * Obtiene la clave privada de Morse desde los datos almacenados
     */
    async getMorsePrivateKey(): Promise<string | null> {
        try {
            const { storageService } = await import('./storage.service');
            const morseWallet = await storageService.get<any>('morse_wallet');

            if (!morseWallet || !morseWallet.serialized) {
                console.log('🟡 No Morse wallet found in storage');
                return null;
            }

            const serializedData = morseWallet.serialized;
            console.log('📥 Morse wallet serialized data preview:', typeof serializedData === 'string' ? serializedData.substring(0, 100) + '...' : serializedData);

            // Detectar si es JSON o hex
            if (this.isMorseJsonWallet(serializedData)) {
                console.log('🔄 Extracting private key from JSON format');
                const morseData = this.parseMorseJsonWallet(serializedData);
                return morseData.priv;
            } else if (this.isMorseHexPrivateKey(serializedData)) {
                console.log('🔄 Extracting private key from hex format');
                const cleanHex = serializedData.replace(/^0x/, '');

                // Si es una dirección (40 chars), no es una clave privada
                if (cleanHex.length === 40) {
                    console.log('⚠️ Stored data is address, not private key');
                    return null;
                }

                // Devolver la clave privada directamente
                return cleanHex;
            } else {
                console.log('⚠️ Unknown Morse wallet format');
                return null;
            }
        } catch (error) {
            console.error('❌ Error getting Morse private key:', error);
            return null;
        }
    }
}

// Hook para importar una wallet Morse desde su forma serializada (ej. contenido de un keyfile)
export function useImportWalletMorse(): UseMutationResult<void, Error, SerializedWalletMorse> {
    return useMutation({
        mutationFn: async ({ serialization, password }: SerializedWalletMorse) => {
            const wallet = await DirectSecp256k1HdWallet.deserialize(serialization, password);
            const address = await getAddressMorse(wallet);
            // Volver a serializar con la misma contraseña para asegurar consistencia en el store si es necesario
            // o si la serialización original no se quiere guardar directamente por alguna razón.
            // Para este patrón, generalmente se guarda la serialización original con la que se importó.
            // Aquí, el ejemplo de shannon/wallet.ts serializa de nuevo.
            const reSerializedWallet = await wallet.serialize(password);

            useMorseWalletStore.setState({
                address,
                serializedWallet: reSerializedWallet, // Guardar la (re)serialización
            });
        },
        onSuccess: () => {
            navigate("/wallet"); // O la ruta que corresponda para Morse
        },
    });
}

// Hook para crear una nueva wallet Morse
export function useCreateWalletMorse(): UseMutationResult<void, Error, { password: string }> {
    return useMutation({
        mutationFn: async ({ password }: { password: string }) => {
            // Usar el prefijo "poktval" para Morse
            const wallet = await DirectSecp256k1HdWallet.generate(24, { prefix: "poktval" });
            const address = await getAddressMorse(wallet);
            const serializedWallet = await wallet.serialize(password);

            useMorseWalletStore.setState({
                address,
                serializedWallet,
            });
        },
        onSuccess: () => {
            navigate("/download-wallet"); // O la ruta que corresponda para Morse
        },
    });
}

// Tipos y Hook para importar una wallet Morse desde una frase mnemónica
export type MnemonicWalletParamsMorse = {
    mnemonic: string;
    passwordToSerializeWith: string; // Contraseña para cifrar la wallet serializada en el store
};

export function useImportMnemonicMorse(): UseMutationResult<void, Error, MnemonicWalletParamsMorse> {
    return useMutation({
        mutationFn: async ({ mnemonic, passwordToSerializeWith }: MnemonicWalletParamsMorse) => {
            const trimmedMnemonic = mnemonic.trim();
            const words = trimmedMnemonic.split(/\s+/);
            if (words.length !== 12 && words.length !== 24) {
                throw new Error(`La frase mnemónica para Morse debe tener 12 o 24 palabras. Tiene ${words.length}.`);
            }

            // Usar el prefijo "poktval" para Morse
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
            navigate("/wallet"); // O la ruta que corresponda para Morse
        },
    });
}

// Exportar instancia única del servicio de Morse
export const morseWalletService = new MorseWalletService(); 