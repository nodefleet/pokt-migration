import { NETWORKS } from './config';

/**
 * Convierte una cantidad de POKT a upokt
 * @param amount - Cantidad en POKT
 * @param decimals - Decimales de la red (por defecto 6 para POKT)
 * @returns {string} Cantidad en upokt
 */
export function toUpokt(amount: string | number, decimals: number = 6): string {
    const multiplier = Math.pow(10, decimals);
    return (Number(amount) * multiplier).toString();
}

/**
 * Convierte una cantidad de upokt a POKT
 * @param upokt - Cantidad en upokt
 * @param decimals - Decimales de la red (por defecto 6 para POKT)
 * @returns {string} Cantidad en POKT
 */
export function fromUpokt(upokt: string | number, decimals: number = 6): string {
    const divisor = Math.pow(10, decimals);
    return (Number(upokt) / divisor).toString();
}

/**
 * Valida si una dirección es válida
 * @param address - Dirección a validar
 * @returns {boolean} true si la dirección es válida
 */
export function isValidAddress(address: string): boolean {
    // Las direcciones de POKT comienzan con 'pokt' y tienen una longitud específica
    return address.startsWith('pokt') && address.length === 40;
}

/**
 * Formatea una dirección para mostrarla
 * @param address - Dirección a formatear
 * @returns {string} Dirección formateada (ej: pokt1...abcd)
 */
export function formatAddress(address: string): string {
    if (!isValidAddress(address)) return 'Invalid Address';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Formatea un timestamp a fecha legible
 * @param timestamp - Timestamp en segundos
 * @returns {string} Fecha formateada
 */
export function formatDate(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleString();
}

/**
 * Formatea un balance para mostrarlo
 * @param balance - Balance en upokt
 * @param network - Red a usar para los decimales
 * @returns {string} Balance formateado
 */
export function formatBalance(balance: string, network = NETWORKS.SHANNON.TESTNET): string {
    const amount = fromUpokt(balance, network.decimals);
    return `${amount} ${network.symbol}`;
} 