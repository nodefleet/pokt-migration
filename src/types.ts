import { Transaction, NetworkType, WalletManager } from './controller/WalletManager';

export interface AppState {
    walletAddress: string | null;
    showTransactions: boolean;
}

export interface HeaderProps {
    walletAddress: string | null;
    onLogout?: (network?: NetworkType) => void;
}

export interface WalletImportResult {
    address: string;
    network: NetworkType;
}

export interface MainContentProps {
    onWalletImport: (code: string, password: string, network?: NetworkType) => Promise<WalletImportResult>;
}

export interface IndividualImportProps {
    onWalletImport: (serializedWallet: string, password: string, network?: NetworkType) => Promise<WalletImportResult>;
    onCreateWallet: (password: string, network?: NetworkType) => Promise<WalletImportResult>;
    onReturn: () => void;
}

export interface BulkImportProps {
    onReturn: () => void;
    onBulkImport: () => void;
}

export interface BulkImportTableProps {
    onReturn: () => void;
    onWalletImport: (code: string, password: string, network?: NetworkType) => Promise<WalletImportResult>;
}

export interface WalletDashboardProps {
    walletAddress: string;
    balance: string;
    transactions: Transaction[];
    onSend: () => void;
    onReceive: () => void;
    onSwap: () => void;
    onStake: () => void;
    onViewTransactions: () => void;
    network: NetworkType;
    isMainnet: boolean;
    walletManager?: WalletManager;
    onLogout: (network?: NetworkType) => void;
    onNetworkChange: (network: NetworkType) => Promise<void>;
}

export interface NetworkSelectionProps {
    onNetworkSelect: (networkType: NetworkType, isMainnet: boolean) => void;
    onMigrationRequest: () => void;
    currentNetwork?: NetworkType;
    isMainnet?: boolean;
}

export interface WalletMigrationProps {
    walletService: any;
    onClose: () => void;
    onSuccess: () => void;
}

export interface ComponentProps {
    walletAddress?: string | null;
    showTransactions?: boolean;
}

export interface StoredWallet {
    serialized: string;
    network: NetworkType;
    timestamp: number;
    parsed: any;
} 