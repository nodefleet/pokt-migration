/**
 * Formatea una cantidad de POKT para su visualización
 * @param balanceInUpokt Balance en uPOKT (1 POKT = 1,000,000 uPOKT)
 * @returns Una cadena formateada con el balance en POKT
 */
export const formatBalance = (balanceInUpokt: string): string => {
    // Verificar que el balance sea válido
    if (!balanceInUpokt || isNaN(Number(balanceInUpokt))) {
        return '0.00';
    }

    try {
        // Convertir de uPOKT a POKT (1 POKT = 1,000,000 uPOKT)
        const balanceInPOKT = Number(balanceInUpokt) / 1_000_000;

        // Verificar que la conversión haya sido exitosa
        if (isNaN(balanceInPOKT)) {
            return '0.00';
        }

        // Formatear con separador de miles y 2 decimales mínimo, hasta 6 máximo
        return balanceInPOKT.toLocaleString('es-ES', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 6
        });
    } catch (error) {
        console.error('Error al formatear balance:', error);
        return '0.00';
    }
};

/**
 * Acorta una dirección o hash para mostrarla de forma más concisa
 * @param address La dirección o hash a acortar
 * @returns La dirección acortada (6 primeros + ... + 4 últimos caracteres)
 */
export const shortenAddress = (address: string): string => {
    if (!address || address.length < 12) {
        return address || '';
    }

    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}; 