import React, { useState, useMemo } from 'react';

interface StakeDialogProps {
  balance: number; // in POKT
  onClose: () => void;
  onStake: (nodes: number) => void;
}

const NODE_COST = 60005;
const MIN_STAKE = 60010;

const StakeDialog: React.FC<StakeDialogProps> = ({ balance, onClose, onStake }) => {
  // Calculate max nodes user can stake
  const maxNodes = useMemo(() => Math.floor(balance / NODE_COST), [balance]);
  const [nodesToStake, setNodesToStake] = useState(1);

  const canStake = balance >= MIN_STAKE && maxNodes > 0;
  const requiredPokt = nodesToStake * NODE_COST;

  const handleChange = (val: number) => {
    if (val < 1) return;
    if (val > maxNodes) return;
    setNodesToStake(val);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl p-8 border-2 border-gray-700 shadow-xl max-w-md w-full text-center">
        <h2 className="text-2xl font-bold mb-4">Stake Nodes</h2>
        <p className="mb-2 text-gray-300">Wallet Balance: <span className="font-mono text-blue-300">{balance.toLocaleString()} POKT</span></p>
        <p className="mb-4 text-gray-400">You can stake up to <span className="font-bold text-pink-400">{maxNodes}</span> node{maxNodes !== 1 ? 's' : ''} (1 node = 60,005 POKT)</p>
        <div className="flex items-center justify-center gap-4 mb-4">
          <button
            className="px-3 py-1 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xl font-bold"
            onClick={() => handleChange(nodesToStake - 1)}
            disabled={nodesToStake <= 1}
          >-</button>
          <input
            type="number"
            min={1}
            max={maxNodes}
            value={nodesToStake}
            onChange={e => handleChange(Number(e.target.value))}
            className="w-20 text-center px-2 py-1 rounded-lg bg-gray-800 text-white border border-gray-600 text-xl font-mono"
            disabled={!canStake}
          />
          <button
            className="px-3 py-1 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xl font-bold"
            onClick={() => handleChange(nodesToStake + 1)}
            disabled={nodesToStake >= maxNodes}
          >+</button>
        </div>
        <p className="mb-4 text-gray-400">Required: <span className="font-mono text-red-300">{requiredPokt.toLocaleString()} POKT</span></p>
        {!canStake && (
          <p className="mb-4 text-red-400 font-semibold">You need at least 60,010 POKT to stake.</p>
        )}
        <div className="flex justify-center gap-4 mt-6">
          <button
            className="px-6 py-2 rounded-lg bg-gradient-to-r from-red-600/80 to-pink-500/80 text-white font-semibold shadow-lg disabled:opacity-60"
            onClick={() => onStake(nodesToStake)}
            disabled={!canStake || nodesToStake < 1 || nodesToStake > maxNodes}
          >
            Stake {nodesToStake} Node{nodesToStake !== 1 ? 's' : ''}
          </button>
          <button
            className="px-6 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default StakeDialog; 