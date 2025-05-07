const WalletDashboard = (walletAddress = '061a3...xaf39', showTransactions = false) => {
    return `
        <div class="flex flex-col items-center justify-center min-h-[70vh] px-4">
            <h1 class="text-3xl sm:text-5xl font-bold font-kumbh-sans mb-8">18,024.24 POKT</h1>
            <hr class="w-full sm:max-w-lg border-gray-500 mb-8">
            <div class="w-full sm:max-w-lg flex flex-col space-y-6">
                <div class="flex flex-col sm:flex-row sm:items-center border-2 border-gray-500 rounded-full overflow-hidden space-y-2 sm:space-y-0 sm:space-x-2">
                    <input type="number" class="flex-1 bg-black text-white font-kumbh-sans px-2 sm:px-6 py-1 sm:py-2 outline-none text-sm sm:text-base" placeholder="0.00">
                    <span class="px-2 sm:px-6 py-1 sm:py-2 text-gray-300 font-kumbh-sans text-sm sm:text-base">POKT</span>
                </div>
                <button class="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold font-kumbh-sans py-2 px-4 sm:px-6 rounded-full transition-colors duration-200 text-sm sm:text-base">Migrate</button>
                <div class="text-left">
                    <div class="text-gray-300 mb-2 font-kumbh-sans text-sm sm:text-base">Address</div>
                    <div class="flex items-center border-2 border-gray-500 rounded-full px-2 sm:px-4 py-1 sm:py-2 bg-black">
                        <span class="flex-1 text-white font-kumbh-sans text-xs sm:text-sm break-all">${walletAddress}</span>
                        <button class="ml-2 text-gray-400 hover:text-white" title="Copy"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 sm:w-5 h-4 sm:h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16h8a2 2 0 002-2V8a2 2 0 00-2-2H8a2 2 0 00-2 2v6a2 2 0 002 2z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" /></svg></button>
                    </div>
                </div>
                <button id="view-transactions-btn" class="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold font-kumbh-sans py-2 px-4 sm:px-6 rounded-full flex items-center justify-center transition-colors duration-200 text-sm sm:text-base">
                    View Transactions
                    <span class="ml-2">▾</span>
                </button>
                <button id="return-btn" class="w-full mt-2 border-2 border-gray-500 text-gray-200 bg-black font-kumbh-sans font-semibold py-2 px-4 sm:px-6 rounded-full flex items-center justify-center transition-colors duration-200 hover:bg-gray-700 text-sm sm:text-base">
                    ← Return
                </button>
            </div>
            ${showTransactions ? `
            <div class="w-full sm:max-w-6xl mt-10 bg-[#18191b] rounded-2xl p-4 sm:p-10 shadow-lg overflow-x-auto">
                <table class="w-full text-left text-white font-kumbh-sans min-w-[600px]">
                    <thead>
                        <tr class="border-b border-gray-700">
                            <th class="pb-4 sm:pb-6 px-2 sm:px-4 text-gray-400 text-sm sm:text-base">Status</th>
                            <th class="pb-4 sm:pb-6 px-2 sm:px-4 text-gray-400 text-sm sm:text-base">Block</th>
                            <th class="pb-4 sm:pb-6 px-2 sm:px-4 text-gray-400 text-sm sm:text-base">Transaction Hash</th>
                            <th class="pb-4 sm:pb-6 px-2 sm:px-4 text-gray-400 text-sm sm:text-base">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="border-b border-gray-700">
                            <td class="py-2 sm:py-4 px-2 sm:px-4"><button class="bg-blue-500 text-white font-bold font-kumbh-sans py-1 sm:py-2 px-4 sm:px-8 rounded-full text-xs sm:text-base">Pending</button></td>
                            <td class="py-2 sm:py-4 px-2 sm:px-4 font-kumbh-sans font-bold text-gray-300 text-sm sm:text-base">809212</td>
                            <td class="py-2 sm:py-4 px-2 sm:px-4">
                                <div class="flex flex-col sm:flex-row sm:space-x-4 space-y-2 sm:space-y-0">
                                    <div>
                                        <div class="text-gray-400 text-xs sm:text-sm mb-1">Morse</div>
                                        <button class="border-2 border-blue-500 text-blue-500 bg-[#18191b] font-kumbh-sans font-semibold py-1 sm:py-2 px-2 sm:px-6 rounded-full text-xs sm:text-base">00x2...2x20</button>
                                    </div>
                                    <div>
                                        <div class="text-gray-400 text-xs sm:text-sm mb-1">Shannon</div>
                                        <button class="border-2 border-blue-500 text-blue-500 bg-[#18191b] font-kumbh-sans font-semibold py-1 sm:py-2 px-2 sm:px-6 rounded-full text-xs sm:text-base">POKT00x2...2x20</button>
                                    </div>
                                </div>
                            </td>
                            <td class="py-2 sm:py-4 px-2 sm:px-4 font-kumbh-sans font-bold text-gray-300 text-sm sm:text-base">1,000 POKT</td>
                        </tr>
                        <tr class="border-b border-gray-700">
                            <td class="py-2 sm:py-4 px-2 sm:px-4"><button class="bg-blue-500 text-white font-bold font-kumbh-sans py-1 sm:py-2 px-4 sm:px-8 rounded-full text-xs sm:text-base">Pending</button></td>
                            <td class="py-2 sm:py-4 px-2 sm:px-4 font-kumbh-sans font-bold text-gray-300 text-sm sm:text-base">809212</td>
                            <td class="py-2 sm:py-4 px-2 sm:px-4">
                                <div class="flex flex-col sm:flex-row sm:space-x-4 space-y-2 sm:space-y-0">
                                    <div>
                                        <div class="text-gray-400 text-xs sm:text-sm mb-1">Morse</div>
                                        <button class="border-2 border-blue-500 text-blue-500 bg-[#18191b] font-kumbh-sans font-semibold py-1 sm:py-2 px-2 sm:px-6 rounded-full text-xs sm:text-base">00x2...2x20</button>
                                    </div>
                                    <div>
                                        <div class="text-gray-400 text-xs sm:text-sm mb-1">Shannon</div>
                                        <button class="border-2 border-blue-500 text-blue-500 bg-[#18191b] font-kumbh-sans font-semibold py-1 sm:py-2 px-2 sm:px-6 rounded-full text-xs sm:text-base">POKT00x2...2x20</button>
                                    </div>
                                </div>
                            </td>
                            <td class="py-2 sm:py-4 px-2 sm:px-4 font-kumbh-sans font-bold text-gray-300 text-sm sm:text-base">1,000 POKT</td>
                        </tr>
                        <tr class="border-b border-gray-700">
                            <td class="py-2 sm:py-4 px-2 sm:px-4"><button class="bg-blue-500 text-white font-bold font-kumbh-sans py-1 sm:py-2 px-4 sm:px-8 rounded-full text-xs sm:text-base">Pending</button></td>
                            <td class="py-2 sm:py-4 px-2 sm:px-4 font-kumbh-sans font-bold text-gray-300 text-sm sm:text-base">809212</td>
                            <td class="py-2 sm:py-4 px-2 sm:px-4">
                                <div class="flex flex-col sm:flex-row sm:space-x-4 space-y-2 sm:space-y-0">
                                    <div>
                                        <div class="text-gray-400 text-xs sm:text-sm mb-1">Morse</div>
                                        <button class="border-2 border-blue-500 text-blue-500 bg-[#18191b] font-kumbh-sans font-semibold py-1 sm:py-2 px-2 sm:px-6 rounded-full text-xs sm:text-base">00x2...2x20</button>
                                    </div>
                                    <div>
                                        <div class="text-gray-400 text-xs sm:text-sm mb-1">Shannon</div>
                                        <button class="border-2 border-blue-500 text-blue-500 bg-[#18191b] font-kumbh-sans font-semibold py-1 sm:py-2 px-2 sm:px-6 rounded-full text-xs sm:text-base">POKT00x2...2x20</button>
                                    </div>
                                </div>
                            </td>
                            <td class="py-2 sm:py-4 px-2 sm:px-4 font-kumbh-sans font-bold text-gray-300 text-sm sm:text-base">1,000 POKT</td>
                        </tr>
                        <tr class="border-b border-gray-700">
                            <td class="py-2 sm:py-4 px-2 sm:px-4"><button class="bg-blue-500 text-white font-bold font-kumbh-sans py-1 sm:py-2 px-4 sm:px-8 rounded-full text-xs sm:text-base">Sent</button></td>
                            <td class="py-2 sm:py-4 px-2 sm:px-4 font-kumbh-sans font-bold text-gray-300 text-sm sm:text-base">809212</td>
                            <td class="py-2 sm:py-4 px-2 sm:px-4">
                                <div class="flex flex-col sm:flex-row sm:space-x-4 space-y-2 sm:space-y-0">
                                    <div>
                                        <div class="text-gray-400 text-xs sm:text-sm mb-1">Morse</div>
                                        <button class="border-2 border-blue-500 text-blue-500 bg-[#18191b] font-kumbh-sans font-semibold py-1 sm:py-2 px-2 sm:px-6 rounded-full text-xs sm:text-base">00x2...2x20</button>
                                    </div>
                                    <div>
                                        <div class="text-gray-400 text-xs sm:text-sm mb-1">Shannon</div>
                                        <button class="border-2 border-blue-500 text-blue-500 bg-[#18191b] font-kumbh-sans font-semibold py-1 sm:py-2 px-2 sm:px-6 rounded-full text-xs sm:text-base">POKT00x2...2x20</button>
                                    </div>
                                </div>
                            </td>
                            <td class="py-2 sm:py-4 px-2 sm:px-4 font-kumbh-sans font-bold text-gray-300 text-sm sm:text-base">1,000 POKT</td>
                        </tr>
                        <tr class="border-b border-gray-700">
                            <td class="py-2 sm:py-4 px-2 sm:px-4"><button class="bg-blue-500 text-white font-bold font-kumbh-sans py-1 sm:py-2 px-4 sm:px-8 rounded-full text-xs sm:text-base">Sent</button></td>
                            <td class="py-2 sm:py-4 px-2 sm:px-4 font-kumbh-sans font-bold text-gray-300 text-sm sm:text-base">809212</td>
                            <td class="py-2 sm:py-4 px-2 sm:px-4">
                                <div class="flex flex-col sm:flex-row sm:space-x-4 space-y-2 sm:space-y-0">
                                    <div>
                                        <div class="text-gray-400 text-xs sm:text-sm mb-1">Morse</div>
                                        <button class="border-2 border-blue-500 text-blue-500 bg-[#18191b] font-kumbh-sans font-semibold py-1 sm:py-2 px-2 sm:px-6 rounded-full text-xs sm:text-base">00x2...2x20</button>
                                    </div>
                                    <div>
                                        <div class="text-gray-400 text-xs sm:text-sm mb-1">Shannon</div>
                                        <button class="border-2 border-blue-500 text-blue-500 bg-[#18191b] font-kumbh-sans font-semibold py-1 sm:py-2 px-2 sm:px-6 rounded-full text-xs sm:text-base">POKT00x2...2x20</button>
                                    </div>
                                </div>
                            </td>
                            <td class="py-2 sm:py-4 px-2 sm:px-4 font-kumbh-sans font-bold text-gray-300 text-sm sm:text-base">1,000 POKT</td>
                        </tr>
                        <tr class="border-b border-gray-700">
                            <td class="py-2 sm:py-4 px-2 sm:px-4"><button class="bg-blue-500 text-white font-bold font-kumbh-sans py-1 sm:py-2 px-4 sm:px-8 rounded-full text-xs sm:text-base">Sent</button></td>
                            <td class="py-2 sm:py-4 px-2 sm:px-4 font-kumbh-sans font-bold text-gray-300 text-sm sm:text-base">809212</td>
                            <td class="py-2 sm:py-4 px-2 sm:px-4">
                                <div class="flex flex-col sm:flex-row sm:space-x-4 space-y-2 sm:space-y-0">
                                    <div>
                                        <div class="text-gray-400 text-xs sm:text-sm mb-1">Morse</div>
                                        <button class="border-2 border-blue-500 text-blue-500 bg-[#18191b] font-kumbh-sans font-semibold py-1 sm:py-2 px-2 sm:px-6 rounded-full text-xs sm:text-base">00x2...2x20</button>
                                    </div>
                                    <div>
                                        <div class="text-gray-400 text-xs sm:text-sm mb-1">Shannon</div>
                                        <button class="border-2 border-blue-500 text-blue-500 bg-[#18191b] font-kumbh-sans font-semibold py-1 sm:py-2 px-2 sm:px-6 rounded-full text-xs sm:text-base">POKT00x2...2x20</button>
                                    </div>
                                </div>
                            </td>
                            <td class="py-2 sm:py-4 px-2 sm:px-4 font-kumbh-sans font-bold text-gray-300 text-sm sm:text-base">1,000 POKT</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            ` : ''}
        </div>
    `;
};

export default WalletDashboard;