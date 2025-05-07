const Header = (walletAddress = null) => {
    return `
        <header class="flex flex-col sm:flex-row sm:justify-between sm:items-center p-2 sm:p-4 space-y-4 sm:space-y-0">
            <div class="flex items-center">
                <img src="assets/images/pokt.png" alt="POKT Logo" class="h-6 sm:h-8">
                <span class="ml-2 text-lg sm:text-xl font-bold">POKT</span>
            </div>
            <button class="w-full sm:w-56 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-1 sm:py-2 px-4 sm:px-6 rounded-full text-sm sm:text-base">
                ${walletAddress ? walletAddress : 'Import Wallet'}
            </button>
        </header>
    `;
};

export default Header;