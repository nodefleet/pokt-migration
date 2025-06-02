/**
 * SERVICIO DE ALMACENAMIENTO SIMPLE Y DIRECTO
 * Utiliza únicamente localStorage para garantizar persistencia
 * con capa de memoria para acceso inmediato
 */
class StorageService {
  private _debug = true; // Modo debug para diagnósticos

  // Memoria caché para acceso inmediato
  public memoryStorage: Record<string, string> = {};

  // Prefijo para todas las claves en localStorage
  private readonly STORAGE_PREFIX = "moopri_";

  constructor() {
    this._logDebug("🚀 Inicializando StorageService DIRECTO con localStorage");

    // Limpiar datos inválidos
    this._cleanInvalidData();

    // Cargar datos desde localStorage al iniciar
    this._loadFromLocalStorage();

    // Comprobar que localStorage funciona correctamente
    this._testLocalStorage();

    // Configurar evento de storage para sincronización entre pestañas
    window.addEventListener("storage", this._handleStorageEvent);

    // Configurar listener para sincronizar antes de cerrar la página
    window.addEventListener("beforeunload", () => {
      this._syncToLocalStorage();
    });

    // Disparar evento personalizado para notificar que el almacenamiento está listo
    window.dispatchEvent(new CustomEvent("storage_ready"));
  }

  /**
   * Limpia datos corruptos o inválidos
   */
  private _cleanInvalidData(): void {
    try {
      // Limpiar datos potencialmente corruptos (que contienen [object Object])
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.STORAGE_PREFIX)) {
          const value = localStorage.getItem(key);
          if (value === "[object Object]" || value?.includes("object Object")) {
            this._logDebug(`🧹 Limpiando dato corrupto en [${key}]: ${value}`);
            localStorage.removeItem(key);
          } else if (value && (key.endsWith("_data") || key.includes("user"))) {
            // Verificar que los datos JSON son válidos
            try {
              if (value.startsWith("{") || value.startsWith("[")) {
                JSON.parse(value);
              }
            } catch (e) {
              this._logDebug(`🧹 Limpiando dato JSON inválido en [${key}]`);
              localStorage.removeItem(key);
            }
          }
        }
      }
    } catch (error) {
      this._logDebug(`❌ Error al limpiar datos inválidos: ${error}`);
    }
  }

  /**
   * Verifica que localStorage funciona correctamente
   */
  private _testLocalStorage(): void {
    try {
      const testKey = `${this.STORAGE_PREFIX}__test__`;
      const testValue = `test_${Date.now()}`;

      // Probar escritura
      localStorage.setItem(testKey, testValue);

      // Probar lectura
      const readValue = localStorage.getItem(testKey);

      // Verificar que coincidan
      if (readValue === testValue) {
        this._logDebug("✓ localStorage funciona correctamente");
      } else {
        this._logDebug(
          `⚠️ localStorage no devolvió el valor correcto: esperado=${testValue}, recibido=${readValue}`
        );
      }

      // Limpiar
      localStorage.removeItem(testKey);
    } catch (error) {
      this._logDebug(`❌ Error verificando localStorage: ${error}`);
    }
  }

  /**
   * Carga todos los datos de localStorage a memoria
   */
  private _loadFromLocalStorage(): void {
    try {
      this._logDebug("🔄 Cargando datos desde localStorage a memoria...");
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.STORAGE_PREFIX)) {
          const actualKey = key.substring(this.STORAGE_PREFIX.length);
          const value = localStorage.getItem(key);
          if (value !== null) {
            this.memoryStorage[actualKey] = value;
            this._logDebug(`✓ Cargado [${actualKey}] desde localStorage`);
          }
        }
      }
      this._logDebug("✅ Datos cargados desde localStorage");
    } catch (error) {
      this._logDebug("❌ Error al cargar datos desde localStorage: " + error);
    }
  }

  /**
 * Sincroniza datos desde memoria a localStorage
 */
  private _syncToLocalStorage(): void {
    try {
      this._logDebug("🔄 Sincronizando memoria a localStorage...");
      for (const key of Object.keys(this.memoryStorage)) {
        const value = this.memoryStorage[key];
        if (value !== undefined) {
          localStorage.setItem(`${this.STORAGE_PREFIX}${key}`, value);
        }
      }
      this._logDebug("✓ Datos sincronizados a localStorage");
    } catch (error) {
      this._logDebug("❌ Error al sincronizar a localStorage: " + error);
    }
  }

  /**
   * Maneja eventos de cambio en localStorage (para sincronización entre pestañas)
   */
  private _handleStorageEvent = (event: StorageEvent): void => {
    if (event.key && event.key.startsWith(this.STORAGE_PREFIX)) {
      const actualKey = event.key.substring(this.STORAGE_PREFIX.length);

      if (event.newValue !== null) {
        // Actualizar memoria
        this.memoryStorage[actualKey] = event.newValue;
        this._logDebug(`✓ Actualizado [${actualKey}] desde otra pestaña`);
      } else {
        // Eliminar de memoria
        delete this.memoryStorage[actualKey];
        this._logDebug(`✓ Eliminado [${actualKey}] desde otra pestaña`);
      }

      // Notificar a la aplicación del cambio
      window.dispatchEvent(
        new CustomEvent("storage_updated", {
          detail: { key: actualKey, value: event.newValue },
        })
      );
    }
  };

  /**
   * Desarializa de manera segura un valor almacenado
   */
  private _deserializeValue<T>(value: any): T | null {
    // Si ya es un objeto o null, devolverlo directamente
    if (value === null || value === undefined) {
      return null;
    }

    // Si es un objeto (no string), devolverlo directamente
    if (typeof value !== "string") {
      return value as T;
    }

    // Si es "[object Object]", devolver un objeto vacío
    if (value === "[object Object]") {
      return {} as T;
    }

    try {
      // Si es un objeto JSON válido, parsearlo
      if (
        (value.startsWith("{") && value.endsWith("}")) ||
        (value.startsWith("[") && value.endsWith("]"))
      ) {
        return JSON.parse(value) as T;
      }

      // De lo contrario, devolver como está
      return value as unknown as T;
    } catch (error) {
      this._logDebug(`⚠️ Error deserializando valor: ${error}`);

      // Evitar devolver valores inválidos
      if (value.includes("object Object") || value === "") {
        return null;
      }

      return value as unknown as T;
    }
  }

  /**
 * Serializa correctamente un valor para almacenamiento
 */
  private _serializeValue(value: any): string {
    if (value === undefined || value === null) {
      return "";
    }

    // Si ya es string, devolver directamente (a menos que sea [object Object])
    if (typeof value === "string") {
      if (value === "[object Object]") {
        return "{}";
      }
      return value;
    }

    try {
      return JSON.stringify(value);
    } catch (error) {
      this._logDebug(`⚠️ Error serializando valor: ${error}`);
      // Convertir a string seguro para prevenir [object Object]
      return typeof value === "object" ? "{}" : String(value);
    }
  }

  /**
   * Guarda un valor en memoria y localStorage
   */
  async set(key: string, value: any): Promise<boolean> {
    try {
      // Serializar el valor correctamente
      const stringValue = this._serializeValue(value);

      // No guardar valores vacíos o inválidos
      if (!stringValue) {
        this._logDebug(
          `⚠️ Intentando guardar valor vacío o inválido para [${key}]`
        );
        return false;
      }

      // 1. Guardar en memoria inmediatamente (acceso más rápido)
      this.memoryStorage[key] = stringValue;

      // 2. Guardar en localStorage
      localStorage.setItem(`${this.STORAGE_PREFIX}${key}`, stringValue);

      // 3. Verificar que el valor se guardó correctamente
      const verificationValue = localStorage.getItem(
        `${this.STORAGE_PREFIX}${key}`
      );
      if (verificationValue !== stringValue) {
        this._logDebug(
          `⚠️ Verificación fallida para [${key}] - Esperado: ${stringValue}, Recibido: ${verificationValue}`
        );
        return false;
      }

      // 4. Notificar a la aplicación del cambio
      window.dispatchEvent(
        new CustomEvent("storage_updated", {
          detail: { key, value: stringValue },
        })
      );

      this._logDebug(`✅ Guardado [${key}] en memoria y localStorage`);
      return true;
    } catch (error) {
      this._logDebug(`❌ Error al guardar [${key}]: ${error}`);
      return false;
    }
  }

  /**
   * Obtiene un valor del almacenamiento (primero memoria, luego localStorage)
   */
  async get<T>(key: string, defaultValue?: T): Promise<T | null | undefined> {
    // 1. Intentar obtener de memoria primero (inmediato)
    const memValue = this.memoryStorage[key];
    if (memValue !== undefined) {
      const deserializedValue = this._deserializeValue<T>(memValue);
      if (deserializedValue !== null) {
        return deserializedValue;
      }
    }

    // 2. Intentar obtener de localStorage
    try {
      const value = localStorage.getItem(`${this.STORAGE_PREFIX}${key}`);
      if (value !== null) {
        // Guardar en memoria para acceso futuro
        this.memoryStorage[key] = value;

        const deserializedValue = this._deserializeValue<T>(value);
        if (deserializedValue !== null) {
          return deserializedValue;
        }
      }
    } catch (error) {
      this._logDebug(`❌ Error al leer [${key}] de localStorage: ${error}`);
    }

    // 3. Devolver valor por defecto si no se encuentra
    return defaultValue ?? null;
  }

  /**
   * Obtiene un valor sincrónicamente (solo de memoria y localStorage)
   */
  getSync<T>(key: string, defaultValue?: T): T | null | undefined {
    // 1. Intentar obtener de memoria primero
    const memValue = this.memoryStorage[key];
    if (memValue !== undefined) {
      const deserializedValue = this._deserializeValue<T>(memValue);
      if (deserializedValue !== null) {
        return deserializedValue;
      }
    }

    // 2. Intentar obtener de localStorage
    try {
      const value = localStorage.getItem(`${this.STORAGE_PREFIX}${key}`);
      if (value !== null) {
        // Guardar en memoria para acceso futuro
        this.memoryStorage[key] = value;

        const deserializedValue = this._deserializeValue<T>(value);
        if (deserializedValue !== null) {
          return deserializedValue;
        }
      }
    } catch (error) {
      this._logDebug(`❌ Error al leer [${key}] de localStorage: ${error}`);
    }

    return defaultValue ?? null;
  }

  /**
   * Elimina un valor de memoria y localStorage
     */
  async remove(key: string): Promise<void> {
    try {
      // 1. Eliminar de memoria
      delete this.memoryStorage[key];

      // 2. Eliminar de localStorage
      localStorage.removeItem(`${this.STORAGE_PREFIX}${key}`);

      // 3. Notificar a la aplicación del cambio
      window.dispatchEvent(
        new CustomEvent("storage_updated", {
          detail: { key, value: null },
        })
      );

      this._logDebug(`✓ Eliminado [${key}] de memoria y localStorage`);
    } catch (error) {
      this._logDebug(`❌ Error al eliminar [${key}]: ${error}`);
    }
  }

  /**
 * Limpia todo el almacenamiento
   */
  async clear(): Promise<void> {
    try {
      // 1. Limpiar memoria
      this.memoryStorage = {};

      // 2. Limpiar localStorage (solo las claves de moopri)
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.STORAGE_PREFIX)) {
          localStorage.removeItem(key);
        }
      }

      // 3. Notificar a la aplicación del cambio
      window.dispatchEvent(new CustomEvent("storage_cleared"));

      this._logDebug("✓ Almacenamiento limpiado completamente");
    } catch (error) {
      this._logDebug(`❌ Error al limpiar almacenamiento: ${error}`);
    }
  }

  /**
   * Verifica el estado de autenticación
   */
  async hasValidAuth(): Promise<boolean> {
    try {
      const token = this.getSync<string>("token");
      const userId = this.getSync<string>("userId");
      return !!token && !!userId;
    } catch (error) {
      this._logDebug("❌ Error verificando autenticación: " + error);
      return false;
    }
  }

  /**
   * Obtiene todas las claves almacenadas
   */
  async keys(): Promise<string[]> {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.STORAGE_PREFIX)) {
          keys.push(key.substring(this.STORAGE_PREFIX.length));
        }
      }
      return keys;
    } catch (error) {
      this._logDebug("❌ Error al obtener claves: " + error);
      return [];
    }
  }

  /**
   * Métodos de compatibilidad (equivalentes a los originales)
   */
  setMemory = this.set;
  removeMemory = this.remove;
  clearMemory = this.clear;

  async enforceAuthPersistence(): Promise<boolean> {
    return this.hasValidAuth();
  }

  async forceFullRestore(): Promise<boolean> {
    this._loadFromLocalStorage();
    return this.hasValidAuth();
  }

  /**
   * Reparar almacenamiento
   */
  async repair(): Promise<boolean> {
    try {
      this._logDebug("🔧 Iniciando reparación de almacenamiento");

      // 1. Limpiar datos inválidos
      this._cleanInvalidData();

      // 2. Recargar datos válidos
      this._loadFromLocalStorage();

      return await this.hasValidAuth();
    } catch (error) {
      this._logDebug(`❌ Error en reparación: ${error}`);
      return false;
    }
  }

  /**
   * Función auxiliar para logs en modo debug
   */
  private _logDebug(message: string): void {
    if (this._debug) {
     // console.log(`[Storage] ${message}`);
    }
  }
}

// Exportar una instancia única
export const storageService = new StorageService(); 
