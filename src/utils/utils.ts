/**
 * Formats a balance of POKT for display
 * @param balanceInUpokt Balance in uPOKT (1 POKT = 1,000,000 uPOKT)
 * @returns A formatted string with the balance in POKT
 */
export const formatBalance = (balanceInUpokt: string): string => {
    // Check that the balance is valid
    if (!balanceInUpokt || isNaN(Number(balanceInUpokt))) {
        return '0.00';
    }

    try {
        // Convert from uPOKT to POKT (1 POKT = 1,000,000 uPOKT)
        const balanceInPOKT = Number(balanceInUpokt) / 1_000_000;

        // Verify that the conversion was successful
        if (isNaN(balanceInPOKT)) {
            return '0.00';
        }

        // Format with thousands separator and minimum 2 decimals, up to 6 maximum
        return balanceInPOKT.toLocaleString('es-ES', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 6
        });
    } catch (error) {
        console.error('Error formatting balance:', error);
        return '0.00';
    }
};

/**
 * Shortens an address or hash for display in a more concise format
 * @param address The address or hash to shorten
 * @returns The shortened address (first 6 + ... + last 4 characters)
 */
export const shortenAddress = (address: string): string => {
    if (!address || address.length < 12) {
        return address || '';
    }

    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}; 