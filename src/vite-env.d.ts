/// <reference types="vite/client" />

// Declarar variables globales para polyfills
interface Window {
    Buffer: typeof Buffer;
    process: {
        env: Record<string, any>;
        nextTick: (callback: Function) => void;
        browser: boolean;
        version: string;
        platform: string;
    };
    Stream: any;
    util: {
        inherits: (ctor: any, superCtor: any) => void;
    };
    setImmediate: (callback: Function, ...args: any[]) => number;
    clearImmediate: (id: number) => void;
} 