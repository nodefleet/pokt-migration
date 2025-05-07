import Header from './components/Header.js';
import MainContent from './components/MainContent.js';
import Footer from './components/Footer.js';
import IndividualImport from './components/IndividualImport.js';
import WalletDashboard from './components/WalletDashboard.js';
import BulkImport from './components/BulkImport.js';
import BulkImportTable from './components/BulkImportTable.js';

let walletAddress = null;
let showTransactions = false;

// Remove existing event listeners to prevent duplicates
function removeEventListeners() {
    const mainContent = document.getElementById('main-content');
    const newMainContent = mainContent.cloneNode(true);
    mainContent.parentNode.replaceChild(newMainContent, mainContent);
}

function renderMainContent() {
    document.getElementById('main-content').innerHTML = MainContent();
    // Add event listener for Individual Import button
    const individualBtn = document.getElementById('individual-import-btn');
    if (individualBtn) {
        individualBtn.addEventListener('click', renderIndividualImport);
    }
    // Add event listener for Bulk Import button
    const bulkBtn = document.getElementById('bulk-import-btn');
    if (bulkBtn) {
        bulkBtn.addEventListener('click', renderBulkImport);
    }
}

function renderBulkImport() {
    removeEventListeners(); // Clean up old listeners
    document.getElementById('main-content').innerHTML = BulkImport();

    // Event delegation for "Upload json file" inputs (targets all instances)
    document.getElementById('main-content').addEventListener('change', (event) => {
        if (event.target.matches('input[id^="bulk-upload-input"]')) {
            console.log('File input changed:', event.target.id);
            renderBulkImportTable();
        }
    });

    // Event delegation for "Bulk Migrate" buttons (targets all instances)
    document.getElementById('main-content').addEventListener('click', (event) => {
        if (event.target.classList.contains('bulk-migrate-btn')) {
            console.log('Bulk Migrate button clicked:', event.target.textContent);
            renderBulkImportTable();
        }
    });

    // Add event listener for Return button
    const returnBtnBulk = document.getElementById('return-btn-bulk');
    if (returnBtnBulk) {
        returnBtnBulk.addEventListener('click', () => {
            document.getElementById('header').innerHTML = Header();
            renderMainContent();
        });
    }
}

function renderBulkImportTable() {
    removeEventListeners(); // Clean up old listeners
    document.getElementById('main-content').innerHTML = BulkImportTable();
    // Add event listener for return button
    const returnBtn = document.getElementById('bulk-return-btn');
    if (returnBtn) {
        returnBtn.addEventListener('click', () => {
            renderBulkImport();
        });
    }
}

function renderIndividualImport() {
    removeEventListeners(); // Clean up old listeners
    document.getElementById('main-content').innerHTML = IndividualImport();
    // Dropdown logic
    const keyfileBtn = document.getElementById('keyfile-dropdown-btn');
    const keyfileDropdown = document.getElementById('keyfile-dropdown');
    const privatekeyBtn = document.getElementById('privatekey-dropdown-btn');
    const privatekeyDropdown = document.getElementById('privatekey-dropdown');

    keyfileBtn.addEventListener('click', () => {
        const isOpen = !keyfileDropdown.classList.contains('hidden');
        keyfileDropdown.classList.toggle('hidden');
        if (!isOpen) privatekeyDropdown.classList.add('hidden');
    });
    privatekeyBtn.addEventListener('click', () => {
        const isOpen = !privatekeyDropdown.classList.contains('hidden');
        privatekeyDropdown.classList.toggle('hidden');
        if (!isOpen) keyfileDropdown.classList.add('hidden');
    });

    // Event delegation for "Select File" buttons (targets all instances)
    document.getElementById('main-content').addEventListener('click', (event) => {
        if (event.target.classList.contains('select-file-btn')) {
            console.log('Select File button clicked:', event.target.textContent);
            walletAddress = '061a3...xaf39';
            showTransactions = false;
            renderWalletDashboard();
        }
    });

    // Event delegation for "Keyfile Passphrase" buttons (targets all instances)
    document.getElementById('main-content').addEventListener('click', (event) => {
        if (event.target.classList.contains('keyfile-passphrase-btn')) {
            console.log('Keyfile Passphrase button clicked:', event.target.textContent);
            walletAddress = '061a3...xaf39';
            showTransactions = false;
            renderWalletDashboard();
        }
    });

    // Event delegation for "Private Key" buttons (targets all instances)
    document.getElementById('main-content').addEventListener('click', (event) => {
        if (event.target.matches('#privatekey-dropdown button:not(:last-child)')) {
            console.log('Private Key button clicked:', event.target.textContent);
            walletAddress = '061a3...xaf39';
            showTransactions = false;
            renderWalletDashboard();
        }
    });

    // Event delegation for "Session Passphrase" buttons (targets all instances)
    document.getElementById('main-content').addEventListener('click', (event) => {
        if (event.target.matches('#privatekey-dropdown button:last-child')) {
            console.log('Session Passphrase button clicked:', event.target.textContent);
            walletAddress = '061a3...xaf39';
            showTransactions = false;
            renderWalletDashboard();
        }
    });

    // Add event listener for Return button
    const returnBtn = document.getElementById('return-btn');
    if (returnBtn) {
        returnBtn.addEventListener('click', () => {
            walletAddress = null;
            showTransactions = false;
            document.getElementById('header').innerHTML = Header();
            renderMainContent();
        });
    }
}

function renderWalletDashboard() {
    removeEventListeners(); // Clean up old listeners
    document.getElementById('header').innerHTML = Header(walletAddress);
    document.getElementById('main-content').innerHTML = WalletDashboard(walletAddress, showTransactions);
    // Add event listener for return button
    const returnBtn = document.getElementById('return-btn');
    if (returnBtn) {
        returnBtn.addEventListener('click', () => {
            walletAddress = null;
            showTransactions = false;
            document.getElementById('header').innerHTML = Header();
            renderIndividualImport();
        });
    }
    // Add event listener for view transactions button
    const viewTxBtn = document.getElementById('view-transactions-btn');
    if (viewTxBtn) {
        viewTxBtn.addEventListener('click', () => {
            showTransactions = !showTransactions;
            renderWalletDashboard();
        });
    }
}

// Render components
document.getElementById('header').innerHTML = Header();
renderMainContent();
document.getElementById('footer').innerHTML = Footer();