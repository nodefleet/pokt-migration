/**
 * SIMPLE AND DIRECT STORAGE SERVICE
 * Uses only localStorage to ensure persistence
 * with memory layer for immediate access
 */
class StorageService {
  private _debug = true; // Debug mode for diagnostics

  // Cache memory for immediate access
  public memoryStorage: Record<string, string> = {};

  // Prefix for all keys in localStorage
  private readonly STORAGE_PREFIX = "moopri_";

  constructor() {
    this._logDebug("🚀 Initializing DIRECT StorageService with localStorage");

    // Clean invalid data
    this._cleanInvalidData();

    // Load data from localStorage at startup
    this._loadFromLocalStorage();

    // Check that localStorage works correctly
    this._testLocalStorage();

    // Set up storage event for synchronization between tabs
    window.addEventListener("storage", this._handleStorageEvent);

    // Set up listener to synchronize before closing the page
    window.addEventListener("beforeunload", () => {
      this._syncToLocalStorage();
    });

    // Trigger custom event to notify that storage is ready
    window.dispatchEvent(new CustomEvent("storage_ready"));
  }

  /**
   * Cleans corrupt or invalid data
   */
  private _cleanInvalidData(): void {
    try {
      // Clean potentially corrupt data (containing [object Object])
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.STORAGE_PREFIX)) {
          const value = localStorage.getItem(key);
          if (value === "[object Object]" || value?.includes("object Object")) {
            this._logDebug(`🧹 Cleaning corrupt data in [${key}]: ${value}`);
            localStorage.removeItem(key);
          } else if (value && (key.endsWith("_data") || key.includes("user"))) {
            // Verify that JSON data is valid
            try {
              if (value.startsWith("{") || value.startsWith("[")) {
                JSON.parse(value);
              }
            } catch (e) {
              this._logDebug(`🧹 Cleaning invalid JSON data in [${key}]`);
              localStorage.removeItem(key);
            }
          }
        }
      }
    } catch (error) {
      this._logDebug(`❌ Error cleaning invalid data: ${error}`);
    }
  }

  /**
   * Verifies that localStorage works correctly
   */
  private _testLocalStorage(): void {
    try {
      const testKey = `${this.STORAGE_PREFIX}__test__`;
      const testValue = `test_${Date.now()}`;

      // Test write
      localStorage.setItem(testKey, testValue);

      // Test read
      const readValue = localStorage.getItem(testKey);

      // Verify they match
      if (readValue === testValue) {
        this._logDebug("✓ localStorage works correctly");
      } else {
        this._logDebug(
          `⚠️ localStorage did not return the correct value: expected=${testValue}, received=${readValue}`
        );
      }

      // Clean up
      localStorage.removeItem(testKey);
    } catch (error) {
      this._logDebug(`❌ Error verifying localStorage: ${error}`);
    }
  }

  /**
   * Loads all data from localStorage to memory
   */
  private _loadFromLocalStorage(): void {
    try {
      this._logDebug("🔄 Loading data from localStorage to memory...");
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.STORAGE_PREFIX)) {
          const actualKey = key.substring(this.STORAGE_PREFIX.length);
          const value = localStorage.getItem(key);
          if (value !== null) {
            this.memoryStorage[actualKey] = value;
            this._logDebug(`✓ Loaded [${actualKey}] from localStorage`);
          }
        }
      }
      this._logDebug("✅ Data loaded from localStorage");
    } catch (error) {
      this._logDebug("❌ Error loading data from localStorage: " + error);
    }
  }

  /**
 * Synchronizes data from memory to localStorage
 */
  private _syncToLocalStorage(): void {
    try {
      this._logDebug("🔄 Synchronizing memory to localStorage...");
      for (const key of Object.keys(this.memoryStorage)) {
        const value = this.memoryStorage[key];
        if (value !== undefined) {
          localStorage.setItem(`${this.STORAGE_PREFIX}${key}`, value);
        }
      }
      this._logDebug("✓ Data synchronized to localStorage");
    } catch (error) {
      this._logDebug("❌ Error synchronizing to localStorage: " + error);
    }
  }

  /**
   * Handles localStorage change events (for synchronization between tabs)
   */
  private _handleStorageEvent = (event: StorageEvent): void => {
    if (event.key && event.key.startsWith(this.STORAGE_PREFIX)) {
      const actualKey = event.key.substring(this.STORAGE_PREFIX.length);

      if (event.newValue !== null) {
        // Update memory
        this.memoryStorage[actualKey] = event.newValue;
        this._logDebug(`✓ Updated [${actualKey}] from another tab`);
      } else {
        // Remove from memory
        delete this.memoryStorage[actualKey];
        this._logDebug(`✓ Removed [${actualKey}] from another tab`);
      }

      // Notify the application of the change
      window.dispatchEvent(
        new CustomEvent("storage_updated", {
          detail: { key: actualKey, value: event.newValue },
        })
      );
    }
  };

  /**
   * Safely deserializes a stored value
   */
  private _deserializeValue<T>(value: any): T | null {
    // If it's already an object or null, return it directly
    if (value === null || value === undefined) {
      return null;
    }

    // If it's an object (not string), return it directly
    if (typeof value !== "string") {
      return value as T;
    }

    // If it's "[object Object]", return an empty object
    if (value === "[object Object]") {
      return {} as T;
    }

    try {
      // If it's a valid JSON object, parse it
      if (
        (value.startsWith("{") && value.endsWith("}")) ||
        (value.startsWith("[") && value.endsWith("]"))
      ) {
        return JSON.parse(value) as T;
      }

      // Otherwise, return as is
      return value as unknown as T;
    } catch (error) {
      this._logDebug(`⚠️ Error deserializing value: ${error}`);

      // Avoid returning invalid values
      if (value.includes("object Object") || value === "") {
        return null;
      }

      return value as unknown as T;
    }
  }

  /**
 * Correctly serializes a value for storage
 */
  private _serializeValue(value: any): string {
    if (value === undefined || value === null) {
      return "";
    }

    // If it's already a string, return directly (unless it's [object Object])
    if (typeof value === "string") {
      if (value === "[object Object]") {
        return "{}";
      }
      return value;
    }

    try {
      return JSON.stringify(value);
    } catch (error) {
      this._logDebug(`⚠️ Error serializing value: ${error}`);
      // Convert to safe string to prevent [object Object]
      return typeof value === "object" ? "{}" : String(value);
    }
  }

  /**
   * Saves a value in memory and localStorage
   */
  async set(key: string, value: any): Promise<boolean> {
    try {
      // Serialize the value correctly
      const stringValue = this._serializeValue(value);

      // Don't save empty or invalid values
      if (!stringValue) {
        this._logDebug(
          `⚠️ Attempting to save empty or invalid value for [${key}]`
        );
        return false;
      }

      // 1. Save in memory immediately (faster access)
      this.memoryStorage[key] = stringValue;

      // 2. Save in localStorage
      localStorage.setItem(`${this.STORAGE_PREFIX}${key}`, stringValue);

      // 3. Verify that the value was saved correctly
      const verificationValue = localStorage.getItem(
        `${this.STORAGE_PREFIX}${key}`
      );
      if (verificationValue !== stringValue) {
        this._logDebug(
          `⚠️ Verification failed for [${key}] - Expected: ${stringValue}, Received: ${verificationValue}`
        );
        return false;
      }

      // 4. Notify the application of the change
      window.dispatchEvent(
        new CustomEvent("storage_updated", {
          detail: { key, value: stringValue },
        })
      );

      this._logDebug(`✅ Saved [${key}] in memory and localStorage`);
      return true;
    } catch (error) {
      this._logDebug(`❌ Error saving [${key}]: ${error}`);
      return false;
    }
  }

  /**
   * Gets a value from storage (first memory, then localStorage)
   */
  async get<T>(key: string, defaultValue?: T): Promise<T | null | undefined> {
    // 1. Try to get from memory first (immediate)
    const memValue = this.memoryStorage[key];
    if (memValue !== undefined) {
      const deserializedValue = this._deserializeValue<T>(memValue);
      if (deserializedValue !== null) {
        return deserializedValue;
      }
    }

    // 2. Try to get from localStorage
    try {
      const value = localStorage.getItem(`${this.STORAGE_PREFIX}${key}`);
      if (value !== null) {
        // Save in memory for future access
        this.memoryStorage[key] = value;

        const deserializedValue = this._deserializeValue<T>(value);
        if (deserializedValue !== null) {
          return deserializedValue;
        }
      }
    } catch (error) {
      this._logDebug(`❌ Error reading [${key}] from localStorage: ${error}`);
    }

    // 3. Return default value if not found
    return defaultValue ?? null;
  }

  /**
   * Gets a value synchronously (only from memory and localStorage)
   */
  getSync<T>(key: string, defaultValue?: T): T | null | undefined {
    // 1. Try to get from memory first
    const memValue = this.memoryStorage[key];
    if (memValue !== undefined) {
      const deserializedValue = this._deserializeValue<T>(memValue);
      if (deserializedValue !== null) {
        return deserializedValue;
      }
    }

    // 2. Try to get from localStorage
    try {
      const value = localStorage.getItem(`${this.STORAGE_PREFIX}${key}`);
      if (value !== null) {
        // Save in memory for future access
        this.memoryStorage[key] = value;

        const deserializedValue = this._deserializeValue<T>(value);
        if (deserializedValue !== null) {
          return deserializedValue;
        }
      }
    } catch (error) {
      this._logDebug(`❌ Error reading [${key}] from localStorage: ${error}`);
    }

    return defaultValue ?? null;
  }

  /**
   * Removes a value from memory and localStorage
     */
  async remove(key: string): Promise<void> {
    try {
      // 1. Remove from memory
      delete this.memoryStorage[key];

      // 2. Remove from localStorage
      localStorage.removeItem(`${this.STORAGE_PREFIX}${key}`);

      // 3. Notify the application of the change
      window.dispatchEvent(
        new CustomEvent("storage_updated", {
          detail: { key, value: null },
        })
      );

      this._logDebug(`✓ Removed [${key}] from memory and localStorage`);
    } catch (error) {
      this._logDebug(`❌ Error removing [${key}]: ${error}`);
    }
  }

  /**
 * Clears all storage
   */
  async clear(): Promise<void> {
    try {
      // 1. Clear memory
      this.memoryStorage = {};

      // 2. Clear localStorage (only moopri keys)
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.STORAGE_PREFIX)) {
          localStorage.removeItem(key);
        }
      }

      // 3. Notify the application of the change
      window.dispatchEvent(new CustomEvent("storage_cleared"));

      this._logDebug("✓ Storage cleared completely");
    } catch (error) {
      this._logDebug(`❌ Error clearing storage: ${error}`);
    }
  }

  /**
   * Checks authentication status
   */
  async hasValidAuth(): Promise<boolean> {
    try {
      const token = this.getSync<string>("token");
      const userId = this.getSync<string>("userId");
      return !!token && !!userId;
    } catch (error) {
      this._logDebug("❌ Error checking authentication: " + error);
      return false;
    }
  }

  /**
   * Gets all stored keys
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
      this._logDebug("❌ Error getting keys: " + error);
      return [];
    }
  }

  /**
   * Compatibility methods (equivalent to originals)
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
   * Repairs storage
   */
  async repair(): Promise<boolean> {
    try {
      this._logDebug("🔧 Starting storage repair");

      // 1. Clean invalid data
      this._cleanInvalidData();

      // 2. Reload valid data
      this._loadFromLocalStorage();

      return await this.hasValidAuth();
    } catch (error) {
      this._logDebug(`❌ Error in repair: ${error}`);
      return false;
    }
  }

  /**
   * Helper function for debug logs
   */
  private _logDebug(message: string): void {
    if (this._debug) {
      // console.log(`[Storage] ${message}`);
    }
  }
}

// Export a single instance
export const storageService = new StorageService(); 
