import './styles.css';
import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import MainContent from './components/MainContent';
import Footer from './components/Footer';
import IndividualImport from './components/IndividualImport';
import WalletDashboard from './components/WalletDashboard';
import BulkImport from './components/BulkImport';
import BulkImportTable from './components/BulkImportTable';
import { AppState } from './types';
import { WalletManager } from './controller/WalletManager';
import { NETWORKS } from './controller/config';

const App: React.FC = () => {
    // Estado para manejar la navegación y los datos de la aplicación
    const [state, setState] = useState<AppState>({
        walletAddress: '',
        showTransactions: false
    });

    // Estado para manejar qué pantalla mostrar
    const [currentScreen, setCurrentScreen] = useState<'main' | 'individual' | 'bulk' | 'bulkTable' | 'wallet'>('main');

    const [walletManager] = useState(() => new WalletManager(NETWORKS.TESTNET.rpcUrl));

    // Manejadores de eventos para la navegación
    const handleIndividualImport = () => {
        setCurrentScreen('individual');
    };

    const handleBulkImport = () => {
        setCurrentScreen('bulk');
    };

    const handleBulkTable = () => {
        setCurrentScreen('bulkTable');
    };

    const handleWalletImport = async (code: string, network: 'morse' | 'shannon') => {
        try {
            if (code) {
                // Importar wallet existente
                const address = await walletManager.importWallet(code, 'password');
                setState({
                    walletAddress: address,
                    showTransactions: false
                });
            } else {
                // Crear nueva wallet
                const { address } = await walletManager.createWallet('password');
                setState({
                    walletAddress: address,
                    showTransactions: false
                });
            }
        } catch (error) {
            console.error('Error al importar/crear wallet:', error);
            // Aquí podrías mostrar un mensaje de error al usuario
        }
    };

    const handleReturn = () => {
        // Si estamos en la pantalla de wallet, limpiamos el address
        if (currentScreen === 'wallet') {
            setState({
                walletAddress: '',
                showTransactions: false
            });
        }

        // Lógica para volver a la pantalla anterior
        if (currentScreen === 'individual' || currentScreen === 'bulk') {
            setCurrentScreen('main');
        } else if (currentScreen === 'bulkTable') {
            setCurrentScreen('bulk');
        } else if (currentScreen === 'wallet') {
            // Vuelve a la pantalla de importación individual
            setCurrentScreen('individual');
        }
    };

    const handleViewTransactions = () => {
        setState(prevState => ({
            ...prevState,
            showTransactions: !prevState.showTransactions
        }));
    };

    const handleCreateWallet = (network: 'morse' | 'shannon') => {
        handleWalletImport('', network);
    };

    const { walletAddress, showTransactions } = state;

    return (
        <BrowserRouter>
            <div className="min-h-screen flex flex-col bg-black text-white">
                <Header walletAddress={walletAddress} />
                <main className="flex-grow container mx-auto px-4 py-8">
                    <Routes>
                        <Route path="/" element={
                            <MainContent
                                onWalletImport={handleWalletImport}
                            />
                        } />
                        <Route path="/wallet" element={
                            walletAddress ? (
                                <WalletDashboard
                                    walletAddress={walletAddress}
                                    showTransactions={showTransactions}
                                    onReturn={handleReturn}
                                    onViewTransactions={handleViewTransactions}
                                />
                            ) : (
                                <Navigate to="/" replace />
                            )
                        } />
                        <Route path="/import/individual" element={
                            <IndividualImport
                                onReturn={handleReturn}
                                onWalletImport={handleWalletImport}
                                onCreateWallet={handleCreateWallet}
                            />
                        } />
                        <Route path="/import/bulk" element={
                            <BulkImport
                                onReturn={handleReturn}
                                onBulkImport={handleBulkTable}
                            />
                        } />
                        <Route path="/import/bulk/table" element={
                            <BulkImportTable
                                onReturn={handleReturn}
                                onWalletImport={handleWalletImport}
                            />
                        } />
                    </Routes>
                </main>
                <Footer />
            </div>
        </BrowserRouter>
    );
};

const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
);

root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
); 