// Importar polyfills necesarios
import { Buffer } from 'buffer';

// Definir process.version explícitamente para evitar el error
if (typeof process === 'undefined' || !process.version) {
    // @ts-ignore
    window.process = window.process || {};
    // @ts-ignore
    window.process.version = window.process.version || 'v16.0.0'; // Versión ficticia para que funcione slice()
    // @ts-ignore
    window.process.env = window.process.env || {};
    // @ts-ignore
    window.process.browser = true;
}

// Configuración global para Buffer
window.Buffer = Buffer;

// Polyfill para util.inherits
window.util = window.util || {
    inherits: function (ctor, superCtor) {
        if (superCtor) {
            Object.setPrototypeOf ?
                Object.setPrototypeOf(ctor.prototype, superCtor.prototype) :
                (ctor.prototype = Object.create(superCtor.prototype));
            ctor.super_ = superCtor;
        }
    }
};

// Polyfill para stream
if (typeof window.Stream === 'undefined') {
    // @ts-ignore
    window.Stream = class Stream {
        pipe() { return this; }
    };
}

// Polyfill para setImmediate
window.setImmediate = window.setImmediate || ((callback: (...args: any[]) => void, ...args: any[]) => setTimeout(callback, 0, ...args));
window.clearImmediate = window.clearImmediate || ((id: number | undefined) => clearTimeout(id));

// Exportar los objetos necesarios
export { Buffer };