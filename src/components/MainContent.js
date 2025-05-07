const MainContent = () => {
    return `
        <div class="text-center">
            <h1 class="text-4xl font-bold mb-4 font-kumbh-sans">Welcome to Pokt Shannon</h1>
            <p class="text-blue-500 mb-8 font-kumbh-sans">This is an open-source interface to provide easy access<br>and management of your POKT cryptocurrency.</p>
            <div class="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4">
                <button class="w-full sm:w-56 border-2 border-blue-500 text-blue-500 hover:bg-blue-600 font-kumbh-sans font-bold py-2 px-6 rounded-full transition-colors duration-200">
                    Create Wallet
                </button>
                <button id="individual-import-btn" class="w-full sm:w-56 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-6 rounded-full">
                    Individual Import
                </button>
                <button id="bulk-import-btn" class="w-full sm:w-56 bg-orange-400 hover:bg-orange-500 text-black font-semibold py-2 px-6 rounded-full">
                    Bulk Import
                </button>
            </div>
        </div>
    `;
};

export default MainContent;