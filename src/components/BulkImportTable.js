const BulkImportTable = () => {
    return `
        <div class="flex flex-col items-center justify-center min-h-[70vh] font-urbanist px-4">
            <h1 class="text-3xl sm:text-5xl font-bold mb-4 text-orange-300">Bulk Import</h1>
            <p class="text-orange-300 mb-8 text-base sm:text-lg">Select a method to access your account</p>
            <div class="flex flex-col items-center space-y-6 w-full sm:max-w-xl mb-10">
                <div class="flex flex-col sm:flex-row sm:items-center w-full space-y-4 sm:space-y-0 sm:space-x-4">
                    <label class="flex-1">
                        <div class="flex items-center border-2 border-orange-400 rounded-full px-4 sm:px-6 py-2 sm:py-3 bg-black text-orange-300 font-semibold text-base sm:text-lg cursor-pointer transition-colors duration-200">
                            <span>Upload json file</span>
                            <input id="bulk-upload-input" type="file" accept=".json" class="hidden" />
                            <span class="ml-auto text-xl sm:text-2xl">⇪</span>
                        </div>
                    </label>
                    <a href="#" class="text-orange-300 underline text-sm sm:text-base hover:text-orange-400">Learn More</a>
                </div>
                <button id="bulk-migrate-btn" class="w-full sm:w-auto sm:max-w-xl bg-orange-400 hover:bg-orange-500 text-black font-bold font-urbanist py-2 sm:py-3 px-4 sm:px-6 rounded-full text-base sm:text-lg transition-colors duration-200">Bulk Migrate</button>
            </div>
            <div class="w-full sm:max-w-6xl bg-[#18191b] rounded-2xl p-4 sm:p-10 shadow-lg mb-8 overflow-x-auto">
                <table class="w-full text-left text-white font-urbanist">
                    <thead>
                        <tr class="border-b border-orange-400">
                            <th class="pb-4 sm:pb-6 px-2 sm:px-4 text-orange-300 font-urbanist text-sm sm:text-base">POKT Address</th>
                            <th class="pb-4 sm:pb-6 px-2 sm:px-4 text-orange-300 font-urbanist text-sm sm:text-base">Total POKT</th>
                            <th class="pb-4 sm:pb-6 px-2 sm:px-4 text-orange-300 font-urbanist text-sm sm:text-base">POKT (Liquid)</th>
                            <th class="pb-4 sm:pb-6 px-2 sm:px-4 text-orange-300 font-urbanist text-sm sm:text-base">POKT (Staked)</th>
                            <th class="pb-4 sm:pb-6 px-2 sm:px-4 text-orange-300 font-urbanist text-sm sm:text-base">Is App?</th>
                            <th class="pb-4 sm:pb-6 px-2 sm:px-4 text-orange-300 font-urbanist text-sm sm:text-base">Is Servicer?</th>
                            <th class="pb-4 sm:pb-6 px-2 sm:px-4 text-orange-300 font-urbanist text-sm sm:text-base">Is Validator?</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="border-b border-orange-400 font-urbanist">
                            <td class="py-2 sm:py-4 px-2 sm:px-4"><span class="border-2 border-orange-400 text-orange-300 bg-[#18191b] font-urbanist font-semibold py-1 sm:py-2 px-2 sm:px-6 rounded-full text-xs sm:text-base">00x2...2x20</span></td>
                            <td class="py-2 sm:py-4 px-2 sm:px-4 font-bold text-white font-urbanist text-sm sm:text-base">1,000 POKT</td>
                            <td class="py-2 sm:py-4 px-2 sm:px-4 font-bold text-white font-urbanist text-sm sm:text-base">1,000 POKT</td>
                            <td class="py-2 sm:py-4 px-2 sm:px-4 font-bold text-white font-urbanist text-sm sm:text-base">1,000 POKT</td>
                            <td class="py-2 sm:py-4 px-2 sm:px-4"><span class="bg-orange-400 text-black font-bold font-urbanist py-1 sm:py-2 px-2 sm:px-6 rounded-full text-xs sm:text-base">Yes</span></td>
                            <td class="py-2 sm:py-4 px-2 sm:px-4"><span class="bg-transparent border-2 border-orange-400 text-orange-300 font-bold font-urbanist py-1 sm:py-2 px-2 sm:px-6 rounded-full text-xs sm:text-base">No</span></td>
                            <td class="py-2 sm:py-4 px-2 sm:px-4"><span class="bg-transparent border-2 border-orange-400 text-orange-300 font-bold font-urbanist py-1 sm:py-2 px-2 sm:px-6 rounded-full text-xs sm:text-base">No</span></td>
                        </tr>
                        <tr class="border-b border-orange-400 font-urbanist">
                            <td class="py-2 sm:py-4 px-2 sm:px-4"><span class="border-2 border-orange-400 text-orange-300 bg-[#18191b] font-urbanist font-semibold py-1 sm:py-2 px-2 sm:px-6 rounded-full text-xs sm:text-base">00x2...2x20</span></td>
                            <td class="py-2 sm:py-4 px-2 sm:px-4 font-bold text-white font-urbanist text-sm sm:text-base">1,000 POKT</td>
                            <td class="py-2 sm:py-4 px-2 sm:px-4 font-bold text-white font-urbanist text-sm sm:text-base">1,000 POKT</td>
                            <td class="py-2 sm:py-4 px-2 sm:px-4 font-bold text-white font-urbanist text-sm sm:text-base">1,000 POKT</td>
                            <td class="py-2 sm:py-4 px-2 sm:px-4"><span class="bg-orange-400 text-black font-bold font-urbanist py-1 sm:py-2 px-2 sm:px-6 rounded-full text-xs sm:text-base">Yes</span></td>
                            <td class="py-2 sm:py-4 px-2 sm:px-4"><span class="bg-transparent border-2 border-orange-400 text-orange-300 font-bold font-urbanist py-1 sm:py-2 px-2 sm:px-6 rounded-full text-xs sm:text-base">No</span></td>
                            <td class="py-2 sm:py-4 px-2 sm:px-4"><span class="bg-transparent border-2 border-orange-400 text-orange-300 font-bold font-urbanist py-1 sm:py-2 px-2 sm:px-6 rounded-full text-xs sm:text-base">No</span></td>
                        </tr>
                        <tr class="border-b border-orange-400 font-urbanist">
                            <td class="py-2 sm:py-4 px-2 sm:px-4"><span class="border-2 border-orange-400 text-orange-300 bg-[#18191b] font-urbanist font-semibold py-1 sm:py-2 px-2 sm:px-6 rounded-full text-xs sm:text-base">00x2...2x20</span></td>
                            <td class="py-2 sm:py-4 px-2 sm:px-4 font-bold text-white font-urbanist text-sm sm:text-base">1,000 POKT</td>
                            <td class="py-2 sm:py-4 px-2 sm:px-4 font-bold text-white font-urbanist text-sm sm:text-base">1,000 POKT</td>
                            <td class="py-2 sm:py-4 px-2 sm:px-4 font-bold text-white font-urbanist text-sm sm:text-base">1,000 POKT</td>
                            <td class="py-2 sm:py-4 px-2 sm:px-4"><span class="bg-transparent border-2 border-orange-400 text-orange-300 font-bold font-urbanist py-1 sm:py-2 px-2 sm:px-6 rounded-full text-xs sm:text-base">No</span></td>
                            <td class="py-2 sm:py-4 px-2 sm:px-4"><span class="bg-orange-400 text-black font-bold font-urbanist py-1 sm:py-2 px-2 sm:px-6 rounded-full text-xs sm:text-base">Yes</span></td>
                            <td class="py-2 sm:py-4 px-2 sm:px-4"><span class="bg-transparent border-2 border-orange-400 text-orange-300 font-bold font-urbanist py-1 sm:py-2 px-2 sm:px-6 rounded-full text-xs sm:text-base">No</span></td>
                        </tr>
                        <tr class="border-b border-orange-400 font-urbanist">
                            <td class="py-2 sm:py-4 px-2 sm:px-4"><span class="border-2 border-orange-400 text-orange-300 bg-[#18191b] font-urbanist font-semibold py-1 sm:py-2 px-2 sm:px-6 rounded-full text-xs sm:text-base">00x2...2x20</span></td>
                            <td class="py-2 sm:py-4 px-2 sm:px-4 font-bold text-white font-urbanist text-sm sm:text-base">1,000 POKT</td>
                            <td class="py-2 sm:py-4 px-2 sm:px-4 font-bold text-white font-urbanist text-sm sm:text-base">1,000 POKT</td>
                            <td class="py-2 sm:py-4 px-2 sm:px-4 font-bold text-white font-urbanist text-sm sm:text-base">1,000 POKT</td>
                            <td class="py-2 sm:py-4 px-2 sm:px-4"><span class="bg-orange-400 text-black font-bold font-urbanist py-1 sm:py-2 px-2 sm:px-6 rounded-full text-xs sm:text-base">Yes</span></td>
                            <td class="py-2 sm:py-4 px-2 sm:px-4"><span class="bg-transparent border-2 border-orange-400 text-orange-300 font-bold font-urbanist py-1 sm:py-2 px-2 sm:px-6 rounded-full text-xs sm:text-base">No</span></td>
                            <td class="py-2 sm:py-4 px-2 sm:px-4"><span class="bg-transparent border-2 border-orange-400 text-orange-300 font-bold font-urbanist py-1 sm:py-2 px-2 sm:px-6 rounded-full text-xs sm:text-base">No</span></td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <button id="bulk-return-btn" class="w-full sm:w-64 mt-6 mb-10 border-2 border-orange-400 text-orange-300 bg-black font-urbanist font-semibold py-2 px-4 sm:px-6 rounded-full flex items-center justify-center transition-colors duration-200 hover:bg-orange-500 hover:text-black">
                ← Return
            </button>
        </div>
    `;
};

export default BulkImportTable;