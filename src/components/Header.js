const Header = (walletAddress = null) => {
    return `
        <header class="flex justify-between items-center p-4">
            <div class="flex items-center">
                <img src="assets/images/pokt.png" alt="POKT Logo" class="h-8">
                <span class="ml-2 text-xl font-bold">POKT</span>
            </div>
            <button class="w-56 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-6 rounded-full">
                ${walletAddress ? walletAddress : 'Import Wallet'}
            </button>
        </header>
    `;
};

export default Header;