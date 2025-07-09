import { Buffer } from 'buffer';

// Configuración para pocket-js
export const setupPocketJSEnvironment = () => {
    // Configurar Buffer global
    if (typeof window !== 'undefined') {
        window.Buffer = window.Buffer || Buffer;
    }

    // Configurar proceso global para entorno de navegador
    if (typeof window !== 'undefined' && typeof (window as any).process === 'undefined') {
        (window as any).process = { env: {} };
    }

    // Otros polyfills que pocket-js podría necesitar
    if (typeof window !== 'undefined' && !window.crypto) {
        (window as any).crypto = {};
    }
};

// Ejecutar la configuración inmediatamente
setupPocketJSEnvironment();

// Re-exportar Buffer para uso en otros archivos
export { Buffer }; 