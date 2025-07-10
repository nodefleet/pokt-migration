import { DEBUG_CONFIG } from '../controller/config';

/**
 * Debug utility functions
 * 
 * Usage:
 * - Replace console.log with DEBUG_CONFIG.log
 * - Replace console.error with DEBUG_CONFIG.error  
 * - Replace console.warn with DEBUG_CONFIG.warn
 * 
 * To disable all debug output:
 * - Set VITE_DEBUG=false in your .env file
 * - Or set DEBUG=false in your .env file
 */

export const debug = {
    log: DEBUG_CONFIG.log,
    error: DEBUG_CONFIG.error,
    warn: DEBUG_CONFIG.warn,
    
    // Helper to check if debug is enabled
    isEnabled: () => DEBUG_CONFIG.ENABLED,
    
    // Helper to conditionally execute code only when debug is enabled
    when: (callback: () => void) => {
        if (DEBUG_CONFIG.ENABLED) {
            callback();
        }
    }
};

// Export the config for direct access
export { DEBUG_CONFIG }; 