import { storageService } from './storage.service';

export interface MorseMigrationData {
    morsePrivateKey: string;
    morseAddress: string;
}

export interface ShannonMigrationResult {
    address: string;
    privateKey?: string; // Solo si se usa --unsafe
}

export interface MigrationMapping {
    morse: {
        address: string;
        private_key?: string;
    };
    shannon: {
        address: string;
        private_key?: string;
    };
    migration_msg: {
        shannon_signing_address: string;
        shannon_dest_address: string;
        morse_public_key: string;
        morse_signature: string;
    };
    error: string;
}

export interface MigrationResult {
    mappings: MigrationMapping[];
    error: string;
    tx_hash: string;
    tx_code: number;
}

export class MigrationService {
    private readonly CLI_COMMAND = 'pocketd';

    /**
     * Verifica si el CLI pocketd está disponible
     * NOTA: En el navegador web, esto siempre retornará false
     * porque no tenemos acceso a ejecutar comandos del sistema
     */
    async isPocketdAvailable(): Promise<boolean> {
        try {
            // En el navegador web, no podemos ejecutar comandos del sistema
            console.warn('⚠️ CLI verification not available in browser environment');
            return false;
        } catch (error) {
            console.error('❌ pocketd no está disponible:', error);
            return false;
        }
    }

    /**
     * Obtiene la versión de pocketd
     * NOTA: En el navegador web, esto siempre retornará 'unknown'
     */
    async getPocketdVersion(): Promise<string> {
        try {
            // En el navegador web, no podemos ejecutar comandos del sistema
            console.warn('⚠️ CLI version check not available in browser environment');
            return 'unknown';
        } catch (error) {
            console.error('Error getting pocketd version:', error);
            return 'unknown';
        }
    }

    /**
     * Genera las instrucciones de migración manual para el usuario
     * Ya que no podemos ejecutar el CLI desde el navegador, proporcionamos
     * las instrucciones y comandos que el usuario debe ejecutar manualmente
     */
    async generateMigrationInstructions(
        morsePrivateKeys: string[],
        signingAccount: string,
        options: {
            unsafe?: boolean;
            unarmoredJson?: boolean;
            home?: string;
            keyringBackend?: string;
        } = {}
    ): Promise<{
        inputData: string;
        command: string;
        instructions: string[];
        downloadFileName: string;
    }> {
        try {
            console.log(`🔄 Generando instrucciones de migración para ${morsePrivateKeys.length} cuentas Morse → Shannon`);

            // Crear el contenido del archivo de input
            const inputData = JSON.stringify(morsePrivateKeys, null, 2);

            // Configuración por defecto
            const defaultOptions = {
                home: './localnet/pocketd',
                keyringBackend: 'test',
                ...options
            };

            // Construir el comando
            let commandParts = [
                this.CLI_COMMAND,
                'tx', 'migration', 'claim-accounts',
                '--input-file', 'morse-migration-input.json',
                '--output-file', 'morse-migration-output.json',
                '--from', signingAccount,
                '--home', defaultOptions.home,
                '--keyring-backend', defaultOptions.keyringBackend
            ];

            if (options.unsafe) {
                commandParts.push('--unsafe');
            }

            if (options.unarmoredJson) {
                commandParts.push('--unarmored-json');
            }

            const command = commandParts.join(' ');

            // Generar instrucciones paso a paso
            const instructions = [
                '🚀 **Instrucciones de Migración Manual**',
                '',
                '1. **Instalar pocketd CLI:**',
                '   ```bash',
                '   curl -sSL https://raw.githubusercontent.com/pokt-network/poktroll/main/tools/scripts/pocketd-install.sh | bash -s -- --tag v0.1.12-dev1 --upgrade',
                '   ```',
                '',
                '2. **Verificar instalación:**',
                '   ```bash',
                '   pocketd version',
                '   ```',
                '',
                '3. **Descargar archivo de input:**',
                '   - Descarga el archivo `morse-migration-input.json` desde esta interfaz',
                '   - Colócalo en tu directorio de trabajo',
                '',
                '4. **Ejecutar migración:**',
                '   ```bash',
                `   ${command}`,
                '   ```',
                '',
                '5. **Verificar resultados:**',
                '   - El archivo `morse-migration-output.json` contendrá los resultados',
                '   - Revisa el contenido para verificar que la migración fue exitosa',
                '',
                '6. **Subir resultados (opcional):**',
                '   - Puedes subir el archivo de resultados a esta interfaz para revisión'
            ];

            return {
                inputData,
                command,
                instructions,
                downloadFileName: `morse-migration-input-${Date.now()}.json`
            };

        } catch (error) {
            console.error('❌ Error generando instrucciones de migración:', error);
            throw new Error(`Error generando instrucciones: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Simula el resultado de una migración exitosa para testing/desarrollo
     * ESTO ES SOLO PARA PROPÓSITOS DE DESARROLLO
     */
    async simulateMigrationResult(
        morsePrivateKeys: string[],
        signingAccount: string
    ): Promise<MigrationResult> {
        console.warn('⚠️ USANDO SIMULACIÓN DE MIGRACIÓN - SOLO PARA DESARROLLO');

        const mappings: MigrationMapping[] = morsePrivateKeys.map((privateKey, index) => ({
            morse: {
                address: `f${'0'.repeat(38)}${index.toString().padStart(2, '0')}`, // Dirección Morse simulada
                private_key: privateKey
            },
            shannon: {
                address: `poktval1${'0'.repeat(30)}${index.toString().padStart(6, '0')}`, // Dirección Shannon simulada
                private_key: undefined // No incluir por seguridad
            },
            migration_msg: {
                shannon_signing_address: signingAccount,
                shannon_dest_address: `poktval1${'0'.repeat(30)}${index.toString().padStart(6, '0')}`,
                morse_public_key: `04${'0'.repeat(126)}`,
                morse_signature: `${'0'.repeat(128)}`
            },
            error: ''
        }));

        const result: MigrationResult = {
            mappings,
            error: '',
            tx_hash: `${'0'.repeat(64)}`, // Hash simulado
            tx_code: 0 // Éxito
        };

        // Guardar resultados simulados en storage
        await storageService.set('last_migration_result', {
            timestamp: Date.now(),
            result: result,
            isSimulated: true
        });

        return result;
    }

    /**
     * Procesa un archivo de resultados de migración subido por el usuario
     */
    async processMigrationResultFile(fileContent: string): Promise<MigrationResult> {
        try {
            const result: MigrationResult = JSON.parse(fileContent);

            // Validar estructura básica
            if (!result.mappings || !Array.isArray(result.mappings)) {
                throw new Error('Archivo de resultados inválido: falta el array de mappings');
            }

            if (typeof result.tx_hash !== 'string') {
                throw new Error('Archivo de resultados inválido: falta tx_hash');
            }

            // Guardar resultados en storage
            await storageService.set('last_migration_result', {
                timestamp: Date.now(),
                result: result,
                isUploadedFile: true
            });

            console.log(`✅ Archivo de resultados procesado: ${result.mappings.length} cuentas migradas`);
            return result;

        } catch (error) {
            console.error('❌ Error procesando archivo de resultados:', error);
            throw new Error(`Error procesando archivo: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Migra una sola cuenta (wrapper para generar instrucciones)
     */
    async migrateSingleAccount(
        morsePrivateKey: string,
        signingAccount: string,
        options?: {
            unsafe?: boolean;
            unarmoredJson?: boolean;
            home?: string;
            keyringBackend?: string;
        }
    ): Promise<{
        inputData: string;
        command: string;
        instructions: string[];
        downloadFileName: string;
    }> {
        return await this.generateMigrationInstructions([morsePrivateKey], signingAccount, options);
    }

    /**
     * Migra cuentas de Morse a Shannon usando el CLI
     */
    async migrateAccounts(
        morsePrivateKeys: string[],
        signingAccount: string,
        options: {
            unsafe?: boolean;
            unarmoredJson?: boolean;
            home?: string;
            keyringBackend?: string;
        } = {}
    ): Promise<MigrationResult> {
        try {
            console.log(`🔄 Iniciando migración de ${morsePrivateKeys.length} cuentas Morse → Shannon`);

            // Verificar que pocketd esté disponible
            const isAvailable = await this.isPocketdAvailable();
            if (!isAvailable) {
                throw new Error('pocketd CLI no está disponible. Asegúrate de que esté instalado correctamente.');
            }

            // Crear archivos temporales
            const { writeFile, readFile, unlink } = await import('fs/promises');
            const { tmpdir } = await import('os');
            const { join } = await import('path');

            const inputFile = join(tmpdir(), `morse-migration-input-${Date.now()}.json`);
            const outputFile = join(tmpdir(), `morse-migration-output-${Date.now()}.json`);

            try {
                // Escribir archivo de input
                await writeFile(inputFile, JSON.stringify(morsePrivateKeys, null, 2));
                console.log(`📝 Input file creado: ${inputFile}`);

                // Construir comando
                const defaultOptions = {
                    home: './localnet/pocketd',
                    keyringBackend: 'test',
                    ...options
                };

                let command = [
                    this.CLI_COMMAND,
                    'tx', 'migration', 'claim-accounts',
                    '--input-file', inputFile,
                    '--output-file', outputFile,
                    '--from', signingAccount,
                    '--home', defaultOptions.home,
                    '--keyring-backend', defaultOptions.keyringBackend
                ];

                if (options.unsafe) {
                    command.push('--unsafe');
                }

                if (options.unarmoredJson) {
                    command.push('--unarmored-json');
                }

                console.log('🚀 Ejecutando comando:', command.join(' '));

                // Ejecutar comando
                const { exec } = await import('child_process');
                const { promisify } = await import('util');
                const execAsync = promisify(exec);

                const { stdout, stderr } = await execAsync(command.join(' '));

                if (stderr) {
                    console.warn('⚠️ CLI stderr:', stderr);
                }

                console.log('✅ CLI stdout:', stdout);

                // Leer resultado
                const resultData = await readFile(outputFile, 'utf-8');
                const result: MigrationResult = JSON.parse(resultData);

                console.log(`✅ Migración completada: ${result.mappings.length} cuentas procesadas`);
                console.log(`📊 TX Hash: ${result.tx_hash}`);
                console.log(`📊 TX Code: ${result.tx_code}`);

                // Guardar resultados en storage para referencia
                await storageService.set('last_migration_result', {
                    timestamp: Date.now(),
                    result: result
                });

                return result;

            } finally {
                // Limpiar archivos temporales
                try {
                    await unlink(inputFile);
                    await unlink(outputFile);
                    console.log('🧹 Archivos temporales limpiados');
                } catch (cleanupError) {
                    console.warn('⚠️ Error limpiando archivos temporales:', cleanupError);
                }
            }

        } catch (error) {
            console.error('❌ Error en migración:', error);
            throw new Error(`Error en migración: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Obtiene el último resultado de migración
     */
    async getLastMigrationResult(): Promise<{ timestamp: number; result: MigrationResult } | null> {
        try {
            return await storageService.get('last_migration_result') as { timestamp: number; result: MigrationResult };
        } catch (error) {
            console.error('Error getting last migration result:', error);
            return null;
        }
    }

    /**
     * Verifica si una cuenta ya ha sido migrada
     */
    async isAccountMigrated(morseAddress: string): Promise<boolean> {
        try {
            const lastResult = await this.getLastMigrationResult();
            if (!lastResult) return false;

            return lastResult.result.mappings.some(
                mapping => mapping.morse.address === morseAddress && !mapping.error
            );
        } catch (error) {
            console.error('Error checking migration status:', error);
            return false;
        }
    }

    /**
     * Obtiene la dirección Shannon correspondiente a una dirección Morse migrada
     */
    async getShannonAddressForMorse(morseAddress: string): Promise<string | null> {
        try {
            const lastResult = await this.getLastMigrationResult();
            if (!lastResult) return null;

            const mapping = lastResult.result.mappings.find(
                m => m.morse.address === morseAddress && !m.error
            );

            return mapping ? mapping.shannon.address : null;
        } catch (error) {
            console.error('Error getting Shannon address:', error);
            return null;
        }
    }
}

// Exportar instancia única
export const migrationService = new MigrationService(); 