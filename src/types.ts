export interface AppState {
    walletAddress: string | null;
    showTransactions: boolean;
}

export interface HeaderProps {
    walletAddress: string | null;
}

export interface MainContentProps {
    onWalletImport: (code: string, network: 'morse' | 'shannon') => void;
}

export interface IndividualImportProps {
    onReturn: () => void;
    onWalletImport: (code: string, network: 'morse' | 'shannon') => void;
    onCreateWallet: (network: 'morse' | 'shannon') => void;
}

export interface BulkImportProps {
    onReturn: () => void;
    onBulkImport: () => void;
}

export interface BulkImportTableProps {
    onReturn: () => void;
    onWalletImport: (code: string, network: 'morse' | 'shannon') => void;
}

export interface WalletDashboardProps {
    onReturn: () => void;
    walletAddress: string;
    showTransactions?: boolean;
    onViewTransactions?: () => void;
}

export interface ComponentProps {
    walletAddress?: string | null;
    showTransactions?: boolean;
} 