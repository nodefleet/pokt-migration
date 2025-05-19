import React from 'react';
import { BulkImportTableProps } from '../types';

const BulkImportTable: React.FC<BulkImportTableProps> = ({ onReturn }) => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] font-kumbh-sans px-2 overflow-visible">
            <h1 className="text-2xl sm:text-5xl font-bold mb-4 text-orange-300">Bulk Import</h1>
            <p className="text-orange-300 mb-8 text-sm sm:text-lg">Select a method to access your account</p>
            <div className="flex flex-col items-center space-y-6 w-full sm:max-w-xl mb-10">
                <div className="flex flex-col sm:flex-row sm:items-center w-full space-y-4 sm:space-y-0 sm:space-x-4">
                    <label className="flex-1">
                        <div className="flex items-center border-2 border-orange-400 rounded-full px-3 sm:px-6 py-1 sm:py-3 bg-black text-orange-300 font-semibold text-sm sm:text-lg cursor-pointer transition-colors duration-200">
                            <span>Upload json file</span>
                            <input id="bulk-upload-input" type="file" accept=".json" className="hidden" />
                            <span className="ml-auto text-lg sm:text-2xl">⇪</span>
                        </div>
                    </label>
                    <a href="#" className="text-orange-300 underline text-xs sm:text-base hover:text-orange-400">Learn More</a>
                </div>
                <button id="bulk-migrate-btn" className="w-full sm:w-auto sm:max-w-xl bg-orange-400 hover:bg-orange-500 text-black font-bold font-kumbh-sans py-1 sm:py-3 px-3 sm:px-6 rounded-full text-sm sm:text-lg transition-colors duration-200">Bulk Migrate</button>
            </div>
            <div className="w-full max-w-full overflow-x-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-900 p-3 sm:p-10 bg-[#18191b] rounded-2xl shadow-lg mb-8 mx-auto">
                <table className="w-full text-left text-white font-kumbh-sans min-w-[450px] inline-block">
                    <thead>
                        <tr className="border-b border-orange-400">
                            <th className="pb-3 sm:pb-6 px-1 sm:px-4 text-orange-300 font-kumbh-sans text-xs sm:text-base whitespace-nowrap">POKT Address</th>
                            <th className="pb-3 sm:pb-6 px-1 sm:px-4 text-orange-300 font-kumbh-sans text-xs sm:text-base whitespace-nowrap">Total POKT</th>
                            <th className="pb-3 sm:pb-6 px-1 sm:px-4 text-orange-300 font-kumbh-sans text-xs sm:text-base whitespace-nowrap">POKT (Liquid)</th>
                            <th className="pb-3 sm:pb-6 px-1 sm:px-4 text-orange-300 font-kumbh-sans text-xs sm:text-base whitespace-nowrap">POKT (Staked)</th>
                            <th className="pb-3 sm:pb-6 px-1 sm:px-4 text-orange-300 font-kumbh-sans text-xs sm:text-base whitespace-nowrap">Is App?</th>
                            <th className="pb-3 sm:pb-6 px-1 sm:px-4 text-orange-300 font-kumbh-sans text-xs sm:text-base whitespace-nowrap">Is Servicer?</th>
                            <th className="pb-3 sm:pb-6 px-1 sm:px-4 text-orange-300 font-kumbh-sans text-xs sm:text-base whitespace-nowrap">Is Validator?</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-b border-orange-400 font-kumbh-sans">
                            <td className="py-1 sm:py-4 px-1 sm:px-4"><span className="border-2 border-orange-400 text-orange-300 bg-[#18191b] font-kumbh-sans font-semibold py-0.5 sm:py-2 px-1 sm:px-6 rounded-full text-[10px] sm:text-base text-ellipsis overflow-hidden whitespace-nowrap max-w-[100px] inline-block">00x2...2x20</span></td>
                            <td className="py-1 sm:py-4 px-1 sm:px-4 font-bold text-white font-kumbh-sans text-xs sm:text-base whitespace-nowrap">1,000 POKT</td>
                            <td className="py-1 sm:py-4 px-1 sm:px-4 font-bold text-white font-kumbh-sans text-xs sm:text-base whitespace-nowrap">1,000 POKT</td>
                            <td className="py-1 sm:py-4 px-1 sm:px-4 font-bold text-white font-kumbh-sans text-xs sm:text-base whitespace-nowrap">1,000 POKT</td>
                            <td className="py-1 sm:py-4 px-1 sm:px-4"><span className="bg-orange-400 text-black font-bold font-kumbh-sans py-0.5 sm:py-2 px-1 sm:px-6 rounded-full text-[10px] sm:text-base truncate">Yes</span></td>
                            <td className="py-1 sm:py-4 px-1 sm:px-4"><span className="bg-transparent border-2 border-orange-400 text-orange-300 font-bold font-kumbh-sans py-0.5 sm:py-2 px-1 sm:px-6 rounded-full text-[10px] sm:text-base truncate">No</span></td>
                            <td className="py-1 sm:py-4 px-1 sm:px-4"><span className="bg-transparent border-2 border-orange-400 text-orange-300 font-bold font-kumbh-sans py-0.5 sm:py-2 px-1 sm:px-6 rounded-full text-[10px] sm:text-base truncate">No</span></td>
                        </tr>
                        <tr className="border-b border-orange-400 font-kumbh-sans">
                            <td className="py-1 sm:py-4 px-1 sm:px-4"><span className="border-2 border-orange-400 text-orange-300 bg-[#18191b] font-kumbh-sans font-semibold py-0.5 sm:py-2 px-1 sm:px-6 rounded-full text-[10px] sm:text-base text-ellipsis overflow-hidden whitespace-nowrap max-w-[100px] inline-block">00x2...2x20</span></td>
                            <td className="py-1 sm:py-4 px-1 sm:px-4 font-bold text-white font-kumbh-sans text-xs sm:text-base whitespace-nowrap">1,000 POKT</td>
                            <td className="py-1 sm:py-4 px-1 sm:px-4 font-bold text-white font-kumbh-sans text-xs sm:text-base whitespace-nowrap">1,000 POKT</td>
                            <td className="py-1 sm:py-4 px-1 sm:px-4 font-bold text-white font-kumbh-sans text-xs sm:text-base whitespace-nowrap">1,000 POKT</td>
                            <td className="py-1 sm:py-4 px-1 sm:px-4"><span className="bg-orange-400 text-black font-bold font-kumbh-sans py-0.5 sm:py-2 px-1 sm:px-6 rounded-full text-[10px] sm:text-base truncate">Yes</span></td>
                            <td className="py-1 sm:py-4 px-1 sm:px-4"><span className="bg-transparent border-2 border-orange-400 text-orange-300 font-bold font-kumbh-sans py-0.5 sm:py-2 px-1 sm:px-6 rounded-full text-[10px] sm:text-base truncate">No</span></td>
                            <td className="py-1 sm:py-4 px-1 sm:px-4"><span className="bg-transparent border-2 border-orange-400 text-orange-300 font-bold font-kumbh-sans py-0.5 sm:py-2 px-1 sm:px-6 rounded-full text-[10px] sm:text-base truncate">No</span></td>
                        </tr>
                        <tr className="border-b border-orange-400 font-kumbh-sans">
                            <td className="py-1 sm:py-4 px-1 sm:px-4"><span className="border-2 border-orange-400 text-orange-300 bg-[#18191b] font-kumbh-sans font-semibold py-0.5 sm:py-2 px-1 sm:px-6 rounded-full text-[10px] sm:text-base text-ellipsis overflow-hidden whitespace-nowrap max-w-[100px] inline-block">00x2...2x20</span></td>
                            <td className="py-1 sm:py-4 px-1 sm:px-4 font-bold text-white font-kumbh-sans text-xs sm:text-base whitespace-nowrap">1,000 POKT</td>
                            <td className="py-1 sm:py-4 px-1 sm:px-4 font-bold text-white font-kumbh-sans text-xs sm:text-base whitespace-nowrap">1,000 POKT</td>
                            <td className="py-1 sm:py-4 px-1 sm:px-4 font-bold text-white font-kumbh-sans text-xs sm:text-base whitespace-nowrap">1,000 POKT</td>
                            <td className="py-1 sm:py-4 px-1 sm:px-4"><span className="bg-transparent border-2 border-orange-400 text-orange-300 font-bold font-kumbh-sans py-0.5 sm:py-2 px-1 sm:px-6 rounded-full text-[10px] sm:text-base truncate">No</span></td>
                            <td className="py-1 sm:py-4 px-1 sm:px-4"><span className="bg-orange-400 text-black font-bold font-kumbh-sans py-0.5 sm:py-2 px-1 sm:px-6 rounded-full text-[10px] sm:text-base truncate">Yes</span></td>
                            <td className="py-1 sm:py-4 px-1 sm:px-4"><span className="bg-transparent border-2 border-orange-400 text-orange-300 font-bold font-kumbh-sans py-0.5 sm:py-2 px-1 sm:px-6 rounded-full text-[10px] sm:text-base truncate">No</span></td>
                        </tr>
                        <tr className="border-b border-orange-400 font-kumbh-sans">
                            <td className="sm: py-4 px-1 sm:px-4"><span className="border-2 border-orange-400 text-orange-300 bg-[#18191b] font-kumbh-sans font-semibold py-0.5 sm:py-2 px-1 sm:px-6 rounded-full text-[10px] sm:text-base text-ellipsis overflow-hidden whitespace-nowrap max-w-[100px] inline-block">00x2...2x20</span></td>
                            <td className="py-1 sm:py-4 px-1 sm:px-4 font-bold text-white font-kumbh-sans text-xs sm:text-base whitespace-nowrap">1,000 POKT</td>
                            <td className="py-1 sm:py-4 px-1 sm:px-4 font-bold text-white font-kumbh-sans text-xs sm:text-base whitespace-nowrap">1,000 POKT</td>
                            <td className="py-1 sm:py-4 px-1 sm:px-4 font-bold text-white font-kumbh-sans text-xs sm:text-base whitespace-nowrap">1,000 POKT</td>
                            <td className="py-1 sm:py-4 px-1 sm:px-4"><span className="bg-orange-400 text-black font-bold font-kumbh-sans py-0.5 sm:py-2 px-1 sm:px-6 rounded-full text-[10px] sm:text-base truncate">Yes</span></td>
                            <td className="py-1 sm:py-4 px-1 sm:px-4"><span className="bg-transparent border-2 border-orange-400 text-orange-300 font-bold font-kumbh-sans py-0.5 sm:py-2 px-1 sm:px-6 rounded-full text-[10px] sm:text-base truncate">No</span></td>
                            <td className="py-1 sm:py-4 px-1 sm:px-4"><span className="bg-transparent border-2 border-orange-400 text-orange-300 font-bold font-kumbh-sans py-0.5 sm:py-2 px-1 sm:px-6 rounded-full text-[10px] sm:text-base truncate">No</span></td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <button
                id="bulk-return-btn"
                className="w-full sm:w-64 mt-6 mb-10 border-2 border-orange-400 text-orange-300 bg-black font-kumbh-sans font-semibold py-1 sm:py-2 px-3 sm:px-6 rounded-full flex items-center justify-center transition-colors duration-200 hover:bg-orange-500 hover:text-black text-sm sm:text-base"
                onClick={onReturn}
            >
                ← Return
            </button>
        </div>
    );
};

export default BulkImportTable; 