const IndividualImport = () => {
    return `
        <div class="text-center px-4">
            <h1 class="text-2xl sm:text-4xl font-bold mb-4 font-urbanist">Individual Import</h1>
            <p class="text-blue-500 mb-8 font-urbanist text-sm sm:text-base">Select a method to access your account</p>
            <div class="flex flex-col items-center space-y-4">
                <!-- Key File Dropdown -->
                <div class="w-full sm:max-w-md">
                    <button id="keyfile-dropdown-btn" class="w-full border-2 border-blue-500 text-blue-500 bg-black font-urbanist font-bold py-1 sm:py-2 px-4 sm:px-6 rounded-full flex justify-between items-center transition-colors duration-200 text-base sm:text-lg">
                        Key File
                        <span class="ml-2">▾</span>
                    </button>
                    <div id="keyfile-dropdown" class="hidden flex-col mt-2 space-y-2">
                        <button class="w-full border-2 border-gray-500 text-gray-200 bg-black font-urbanist font-semibold py-1 sm:py-2 px-4 sm:px-6 rounded-full transition-colors duration-200 hover:bg-gray-700 text-sm sm:text-base">Select File</button>
                        <button class="w-full border-2 border-gray-500 text-gray-200 bg-black font-urbanist font-semibold py-1 sm:py-2 px-4 sm:px-6 rounded-full transition-colors duration-200 hover:bg-gray-700 text-sm sm:text-base">Keyfile Passphrase</button>
                    </div>
                </div>
                <!-- Private Key Dropdown -->
                <div class="w-full sm:max-w-md">
                    <button id="privatekey-dropdown-btn" class="w-full border-2 border-blue-500 text-blue-500 bg-black font-urbanist font-bold py-1 sm:py-2 px-4 sm:px-6 rounded-full flex justify-between items-center transition-colors duration-200 text-base sm:text-lg">
                        Private Key
                        <span class="ml-2">▾</span>
                    </button>
                    <div id="privatekey-dropdown" class="hidden flex-col mt-2 space-y-2">
                        <button class="w-full border-2 border-gray-500 text-gray-200 bg-black font-urbanist font-semibold py-1 sm:py-2 px-4 sm:px-6 rounded-full transition-colors duration-200 hover:bg-gray-700 text-sm sm:text-base">Private Key</button>
                        <p class="text-white text-xs sm:text-sm my-2">Please create a temporary passphrase to encrypt your Private key during this session. It will be required to confirm transactions.</p>
                        <button class="w-full border-2 border-gray-500 text-gray-200 bg-black font-urbanist font-semibold py-1 sm:py-2 px-4 sm:px-6 rounded-full flex items-center justify-between transition-colors duration-200 hover:bg-gray-700 text-sm sm:text-base">
                            Session Passphrase
                            <span class="ml-2">👁</span>
                        </button>
                    </div>
                </div>
                <button id="return-btn" class="w-full sm:w-64 mt-6 border-2 border-gray-500 text-gray-200 bg-black font-urbanist font-semibold py-1 sm:py-2 px-4 sm:px-6 rounded-full flex items-center justify-center transition-colors duration-200 hover:bg-gray-700 text-sm sm:text-base">
                    ← Return
                </button>
            </div>
        </div>
    `;
};

export default IndividualImport;