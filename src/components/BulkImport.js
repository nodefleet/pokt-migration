const BulkImport = () => {
    return `
        <div class="flex flex-col items-center justify-center min-h-[70vh] font-urbanist bg-black px-4">
            <h1 class="text-3xl sm:text-5xl font-bold mb-4 text-white">Bulk Import</h1>
            <p class="text-orange-400 mb-8 text-base sm:text-lg">Select a method to access your account</p>
            <div class="flex flex-col items-center space-y-6 w-full sm:max-w-xl">
                <div class="flex flex-col sm:flex-row sm:items-center w-full space-y-4 sm:space-y-0 sm:space-x-4">
                    <label class="flex-1">
                        <div class="flex items-center border-2 border-orange-400 rounded-full px-4 sm:px-6 py-2 sm:py-3 bg-black text-orange-400 font-semibold text-base sm:text-lg cursor-pointer transition-colors duration-200">
                            <span>Upload json file</span>
                            <input id="bulk-upload-input" type="file" accept=".json" class="hidden" />
                            <span class="ml-auto text-xl sm:text-2xl">⇪</span>
                        </div>
                    </label>
                    <a href="#" class="text-orange-400 underline text-sm sm:text-base hover:text-orange-500">Learn More</a>
                </div>
                <button id="bulk-migrate-btn" class="w-full sm:w-auto sm:max-w-xl bg-orange-400 hover:bg-orange-500 text-black font-bold font-urbanist py-2 sm:py-3 px-4 sm:px-6 rounded-full text-base sm:text-lg transition-colors duration-200">Bulk Migrate</button>
            </div>
            <button id="return-btn-bulk" class="w-full sm:w-64 mt-6 mb-10 border-2 border-orange-400 text-orange-300 bg-black font-urbanist font-semibold py-2 px-4 sm:px-6 rounded-full flex items-center justify-center transition-colors duration-200 hover:bg-orange-500 hover:text-black">
                ← Return
            </button>
        </div>
    `;
};

export default BulkImport;