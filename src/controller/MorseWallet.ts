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
     * Detecta si es un JSON de wallet Morse con formato {"addr": "...", "name": "...", "priv": "..."}
     */
    private isMorseJsonWallet(code: string): boolean {
        try {
            const trimmed = code.trim();

            // Verificar formato básico JSON
            if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
                return false;
            }

            // Debe ser JSON válido
            const parsed = JSON.parse(trimmed);

            // Solo requerimos el campo addr con formato válido
            const hasAddr = parsed.addr && typeof parsed.addr === 'string';

            // addr debe ser hex de 40 caracteres (20 bytes)
            const hasValidAddr = hasAddr && /^[0-9a-fA-F]{40}$/i.test(parsed.addr);

            return hasValidAddr;
        } catch (error: unknown) {
            return false;
        }
    }

    /**
     * Detecta si es una clave privada de Morse (128 caracteres hex o formato JSON)
     * Método público para ser utilizado por WalletService
     */
    public detectMorseWallet(code: string): boolean {
        // Si es JSON de wallet Morse
        if (this.isMorseJsonWallet(code)) {
            return true;
        }

        // Si es clave privada hex directa
        const trimmed = code.trim();

        // Verificar si contiene espacios (mnemónico)
        if (trimmed.includes(' ')) {
            return false;
        }

        // Limpiar prefijo 0x si existe
        const cleanHex = trimmed.startsWith('0x') ? trimmed.substring(2) : trimmed;

        // Las claves privadas de Morse son de 128 caracteres (64 bytes)
        const isMorseHex = /^[0-9a-fA-F]{128}$/i.test(cleanHex);

        return isMorseHex;
    }

    /**
     * Parsea una wallet Morse en formato JSON
     */
    private parseMorseJsonWallet(jsonString: string): { addr: string, name: string, priv: string, account?: number } {
        try {
            const parsed = JSON.parse(jsonString.trim());

            if (!parsed.addr) {
                throw new Error('Missing required field: addr');
            }

            // Validar formato de addr
            if (!/^[0-9a-fA-F]{40}$/i.test(parsed.addr)) {
                throw new Error('Invalid addr format - must be 40 hex characters');
            }

            // Asignar valores por defecto para campos opcionales
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
     * Importa una wallet de Morse (solo formato JSON)
     */
    async importMorsePrivateKey(code: string, password: string): Promise<{ address: string, serialized: string }> {
        try {
            // Intentar varias técnicas de normalización para el JSON
            let normalizedCode = code;
            let jsonData = null;

            // Técnica 1: Intentar parsear directamente
            try {
                jsonData = JSON.parse(normalizedCode.trim());
            } catch (e) {
                // Técnica 2: Reemplazar comillas escapadas
                try {
                    normalizedCode = code.replace(/\\"/g, '"');
                    jsonData = JSON.parse(normalizedCode.trim());
                } catch (e2) {
                    // Técnica 3: Reemplazar comillas simples por dobles
                    try {
                        normalizedCode = code.replace(/'/g, '"');
                        jsonData = JSON.parse(normalizedCode.trim());
                    } catch (e3) {
                        // Técnica 4: Limpiar espacios y formateo extraño
                        try {
                            normalizedCode = code.replace(/\s+/g, ' ').trim();

                            // Si comienza con { pero no termina con }, añadir el cierre
                            if (normalizedCode.startsWith('{') && !normalizedCode.endsWith('}')) {
                                normalizedCode += '}';
                            }

                            jsonData = JSON.parse(normalizedCode);
                        } catch (e4) {
                            // Último intento: Reconstruir manualmente
                            if (code.includes('"name"') && code.includes('"addr"')) {
                                try {
                                    // Extraer valores clave usando expresiones regulares
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
                                    // No hacer nada, se manejará en el siguiente bloque
                                }
                            }
                        }
                    }
                }
            }

            if (!jsonData) {
                throw new Error("No se pudo procesar el formato JSON. Verifica que sea un JSON válido.");
            }

            // Manejar array de wallets o wallet individual
            const wallets = Array.isArray(jsonData) ? jsonData : [jsonData];

            // Verificar que al menos tenga una wallet
            if (wallets.length === 0) {
                throw new Error('No wallets found in the JSON data');
            }

            // Validar cada wallet y obtener la primera para retornar
            let firstWalletInfo = null;

            // Guardar en storage usando importación dinámica
            const { storageService } = await import('./storage.service');

            // Obtener lista existente de wallets
            const existingData = await storageService.get<any>('morse_wallets');

            // Asegurar que existingData sea un array
            const existing: any[] = Array.isArray(existingData) ? existingData : [];

            for (const wallet of wallets) {
                // Validar que tenga al menos el campo addr
                if (!wallet.addr || typeof wallet.addr !== 'string') {
                    throw new Error('Invalid Morse JSON: missing addr field');
                }

                // Crear datos básicos de la wallet
                const walletInfo = {
                    address: wallet.addr,
                    serialized: JSON.stringify(wallet)
                };

                // Guardar la primera wallet para retornarla
                if (!firstWalletInfo) {
                    firstWalletInfo = walletInfo;
                    this.currentAddress = walletInfo.address;
                }

                // Comprobar si ya existe esta wallet (evitar duplicados)
                const isDuplicate = existing.some((w: any) =>
                    (w.parsed?.addr === wallet.addr)
                );

                if (!isDuplicate) {
                    // Añadir a la lista de wallets
                    existing.push({
                        id: 'morse_' + Date.now() + Math.random().toString(16).slice(2, 6),
                        serialized: JSON.stringify(wallet),
                        parsed: wallet,
                        network: 'morse',
                        timestamp: Date.now()
                    });
                }
            }

            // Guardar lista actualizada
            await storageService.set('morse_wallets', existing);

            // Respetar la configuración de red del usuario para Morse
            const savedIsMainnet = await storageService.get<boolean>('isMainnet');
            if (savedIsMainnet === null || savedIsMainnet === undefined) {
                // Solo establecer testnet como default si no hay configuración previa
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
            // Limpiar dirección actual
            this.currentAddress = null;

            // Importar storageService dinámicamente
            const { storageService } = await import('./storage.service');

            // Limpiar todas las claves relacionadas con Morse
            await storageService.remove('morse_wallet');
            await storageService.remove('walletAddress');
            await storageService.remove('walletData');
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
                return null;
            }

            const serializedData = morseWallet.serialized;

            // Detectar si es JSON
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