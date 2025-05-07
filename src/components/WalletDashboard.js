const WalletDashboard = (walletAddress = '061a3...xaf39', showTransactions = false) => {
    return `
        <div class="flex flex-col items-center justify-center min-h-[70vh]">
            <h1 class="text-5xl font-bold font-urbanist mb-8">18,024.24 POKT</h1>
            <hr class="w-full max-w-lg border-gray-500 mb-8">
            <div class="w-full max-w-lg flex flex-col space-y-6">
                <div class="flex items-center border-2 border-gray-500 rounded-full overflow-hidden">
                    <input type="number" class="flex-1 bg-black text-white font-urbanist px-6 py-2 outline-none" placeholder="0.00">
                    <span class="px-6 py-2 text-gray-300 font-urbanist">POKT</span>
                </div>
                <button class="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold font-urbanist py-2 px-6 rounded-full transition-colors duration-200">Migrate</button>
                <div class="text-left">
                    <div class="text-gray-300 mb-2 font-urbanist">Address</div>
                    <div class="flex items-center border-2 border-gray-500 rounded-full px-4 py-2 bg-black">
                        <span class="flex-1 text-white font-mono text-sm break-all">${walletAddress}</span>
                        <button class="ml-2 text-gray-400 hover:text-white" title="Copy"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16h8a2 2 0 002-2V8a2 2 0 00-2-2H8a2 2 0 00-2 2v6a2 2 0 002 2z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" /></svg></button>
                    </div>
                </div>
                <button id="view-transactions-btn" class="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold font-urbanist py-2 px-6 rounded-full flex items-center justify-center transition-colors duration-200">
                    View Transactions
                    <span class="ml-2">▾</span>
                </button>
                <button id="return-btn" class="w-full mt-2 border-2 border-gray-500 text-gray-200 bg-black font-urbanist font-semibold py-2 px-6 rounded-full flex items-center justify-center transition-colors duration-200 hover:bg-gray-700">
                    ← Return
                </button>
            </div>
            ${showTransactions ? `
            <div class="w-full max-w-6xl mt-10 bg-[#18191b] rounded-2xl p-10 shadow-lg">
                <table class="w-full text-left text-white font-urbanist">
                    <thead>
                        <tr class="border-b border-gray-700">
                            <th class="pb-6 px-4 text-gray-400">Status</th>
                            <th class="pb-6 px-4 text-gray-400">Block</th>
                            <th class="pb-6 px-4 text-gray-400">Transaction Hash</th>
                            <th class="pb-6 px-4 text-gray-400">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="border-b border-gray-700">
                            <td class="py-4 px-4"><button class="bg-blue-500 text-white font-bold font-urbanist py-2 px-8 rounded-full">Pending</button></td>
                            <td class="py-4 px-4 font-mono font-bold text-gray-300">809212</td>
                            <td class="py-4 px-4">
                                <div class="flex space-x-4">
                                    <div>
                                        <div class="text-gray-400 text-sm mb-1">Morse</div>
                                        <button class="border-2 border-blue-500 text-blue-500 bg-[#18191b] font-urbanist font-semibold py-2 px-6 rounded-full">00x2...2x20</button>
                                    </div>
                                    <div>
                                        <div class="text-gray-400 text-sm mb-1">Shannon</div>
                                        <button class="border-2 border-blue-500 text-blue-500 bg-[#18191b] font-urbanist font-semibold py-2 px-6 rounded-full">POKT00x2...2x20</button>
                                    </div>
                                </div>
                            </td>
                            <td class="py-4 px-4 font-mono font-bold text-gray-300">1,000 POKT</td>
                        </tr>
                        <tr class="border-b border-gray-700">
                            <td class="py-4 px-4"><button class="bg-blue-500 text-white font-bold font-urbanist py-2 px-8 rounded-full">Pending</button></td>
                            <td class="py-4 px-4 font-mono font-bold text-gray-300">809212</td>
                            <td class="py-4 px-4">
                                <div class="flex space-x-4">
                                    <div>
                                        <div class="text-gray-400 text-sm mb-1">Morse</div>
                                        <button class="border-2 border-blue-500 text-blue-500 bg-[#18191b] font-urbanist font-semibold py-2 px-6 rounded-full">00x2...2x20</button>
                                    </div>
                                    <div>
                                        <div class="text-gray-400 text-sm mb-1">Shannon</div>
                                        <button class="border-2 border-blue-500 text-blue-500 bg-[#18191b] font-urbanist font-semibold py-2 px-6 rounded-full">POKT00x2...2x20</button>
                                    </div>
                                </div>
                            </td>
                            <td class="py-4 px-4 font-mono font-bold text-gray-300">1,000 POKT</td>
                        </tr>
                        <tr class="border-b border-gray-700">
                            <td class="py-4 px-4"><button class="bg-blue-500 text-white font-bold font-urbanist py-2 px-8 rounded-full">Pending</button></td>
                            <td class="py-4 px-4 font-mono font-bold text-gray-300">809212</td>
                            <td class="py-4 px-4">
                                <div class="flex space-x-4">
                                    <div>
                                        <div class="text-gray-400 text-sm mb-1">Morse</div>
                                        <button class="border-2 border-blue-500 text-blue-500 bg-[#18191b] font-urbanist font-semibold py-2 px-6 rounded-full">00x2...2x20</button>
                                    </div>
                                    <div>
                                        <div class="text-gray-400 text-sm mb-1">Shannon</div>
                                        <button class="border-2 border-blue-500 text-blue-500 bg-[#18191b] font-urbanist font-semibold py-2 px-6 rounded-full">POKT00x2...2x20</button>
                                    </div>
                                </div>
                            </td>
                            <td class="py-4 px-4 font-mono font-bold text-gray-300">1,000 POKT</td>
                        </tr>
                        <tr class="border-b border-gray-700">
                            <td class="py-4 px-4"><button class="bg-blue-500 text-white font-bold font-urbanist py-2 px-8 rounded-full">Sent</button></td>
                            <td class="py-4 px-4 font-mono font-bold text-gray-300">809212</td>
                            <td class="py-4 px-4">
                                <div class="flex space-x-4">
                                    <div>
                                        <div class="text-gray-400 text-sm mb-1">Morse</div>
                                        <button class="border-2 border-blue-500 text-blue-500 bg-[#18191b] font-urbanist font-semibold py-2 px-6 rounded-full">00x2...2x20</button>
                                    </div>
                                    <div>
                                        <div class="text-gray-400 text-sm mb-1">Shannon</div>
                                        <button class="border-2 border-blue-500 text-blue-500 bg-[#18191b] font-urbanist font-semibold py-2 px-6 rounded-full">POKT00x2...2x20</button>
                                    </div>
                                </div>
                            </td>
                            <td class="py-4 px-4 font-mono font-bold text-gray-300">1,000 POKT</td>
                        </tr>
                        <tr class="border-b border-gray-700">
                            <td class="py-4 px-4"><button class="bg-blue-500 text-white font-bold font-urbanist py-2 px-8 rounded-full">Sent</button></td>
                            <td class="py-4 px-4 font-mono font-bold text-gray-300">809212</td>
                            <td class="py-4 px-4">
                                <div class="flex space-x-4">
                                    <div>
                                        <div class="text-gray-400 text-sm mb-1">Morse</div>
                                        <button class="border-2 border-blue-500 text-blue-500 bg-[#18191b] font-urbanist font-semibold py-2 px-6 rounded-full">00x2...2x20</button>
                                    </div>
                                    <div>
                                        <div class="text-gray-400 text-sm mb-1">Shannon</div>
                                        <button class="border-2 border-blue-500 text-blue-500 bg-[#18191b] font-urbanist font-semibold py-2 px-6 rounded-full">POKT00x2...2x20</button>
                                    </div>
                                </div>
                            </td>
                            <td class="py-4 px-4 font-mono font-bold text-gray-300">1,000 POKT</td>
                        </tr>
                        <tr class="border-b border-gray-700">
                            <td class="py-4 px-4"><button class="bg-blue-500 text-white font-bold font-urbanist py-2 px-8 rounded-full">Sent</button></td>
                            <td class="py-4 px-4 font-mono font-bold text-gray-300">809212</td>
                            <td class="py-4 px-4">
                                <div class="flex space-x-4">
                                    <div>
                                        <div class="text-gray-400 text-sm mb-1">Morse</div>
                                        <button class="border-2 border-blue-500 text-blue-500 bg-[#18191b] font-urbanist font-semibold py-2 px-6 rounded-full">00x2...2x20</button>
                                    </div>
                                    <div>
                                        <div class="text-gray-400 text-sm mb-1">Shannon</div>
                                        <button class="border-2 border-blue-500 text-blue-500 bg-[#18191b] font-urbanist font-semibold py-2 px-6 rounded-full">POKT00x2...2x20</button>
                                    </div>
                                </div>
                            </td>
                            <td class="py-4 px-4 font-mono font-bold text-gray-300">1,000 POKT</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            ` : ''}
        </div>
    `;
};

export default WalletDashboard;