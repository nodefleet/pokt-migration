const IndividualImport = () => {
    return `
        <div class="text-center">
            <h1 class="text-4xl font-bold mb-4 font-urbanist">Individual Import</h1>
            <p class="text-blue-500 mb-8 font-urbanist">Select a method to access your account</p>
            <div class="flex flex-col items-center space-y-4">
                <!-- Key File Dropdown -->
                <div class="w-full max-w-md">
                    <button id="keyfile-dropdown-btn" class="w-full min-w-[220px] border-2 border-blue-500 text-blue-500 bg-black font-urbanist font-bold py-2 px-6 rounded-full flex justify-between items-center transition-colors duration-200">
                        Key File
                        <span class="ml-2">&#9662;</span>
                    </button>
                    <div id="keyfile-dropdown" class="hidden flex-col mt-2 space-y-2">
                        <button class="w-full min-w-[220px] border-2 border-gray-500 text-gray-200 bg-black font-urbanist font-semibold py-2 px-6 rounded-full transition-colors duration-200 hover:bg-gray-700">Select File</button>
                        <button class="w-full min-w-[220px] border-2 border-gray-500 text-gray-200 bg-black font-urbanist font-semibold py-2 px-6 rounded-full transition-colors duration-200 hover:bg-gray-700">Keyfile Passphrase</button>
                    </div>
                </div>
                <!-- Private Key Dropdown -->
                <div class="w-full max-w-md">
                    <button id="privatekey-dropdown-btn" class="w-full min-w-[220px] border-2 border-blue-500 text-blue-500 bg-black font-urbanist font-bold py-2 px-6 rounded-full flex justify-between items-center transition-colors duration-200">
                        Private Key
                        <span class="ml-2">&#9662;</span>
                    </button>
                    <div id="privatekey-dropdown" class="hidden flex-col mt-2 space-y-2">
                        <button class="w-full min-w-[220px] border-2 border-gray-500 text-gray-200 bg-black font-urbanist font-semibold py-2 px-6 rounded-full transition-colors duration-200 hover:bg-gray-700">Private Key</button>
                        <p class="text-white text-sm my-2">Please create a temporary passphrase to encrypt your Private key during this session. It will be required to confirm transactions.</p>
                        <button class="w-full min-w-[220px] border-2 border-gray-500 text-gray-200 bg-black font-urbanist font-semibold py-2 px-6 rounded-full flex items-center justify-between transition-colors duration-200 hover:bg-gray-700">
                            Session Passphrase
                            <span class="ml-2">&#128065;</span>
                        </button>
                    </div>
                </div>
                <button id="return-btn" class="w-64 mt-6 border-2 border-gray-500 text-gray-200 bg-black font-urbanist font-semibold py-2 px-6 rounded-full flex items-center justify-center transition-colors duration-200 hover:bg-gray-700">
                    ← Return
                </button>
            </div>
        </div>
    `;
};

export default IndividualImport; 