import Header from './components/Header.js';
import MainContent from './components/MainContent.js';
import Footer from './components/Footer.js';
import IndividualImport from './components/IndividualImport.js';
import WalletDashboard from './components/WalletDashboard.js';
import BulkImport from './components/BulkImport.js';
import BulkImportTable from './components/BulkImportTable.js';

let walletAddress = null;
let showTransactions = false;

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
    document.getElementById('main-content').innerHTML = BulkImport();
  
    // Existing event listeners
    const uploadInput = document.getElementById('bulk-upload-input');
    const migrateBtn = document.getElementById('bulk-migrate-btn');
    if (uploadInput) {
      uploadInput.addEventListener('change', () => {
        renderBulkImportTable();
      });
    }
    if (migrateBtn) {
      migrateBtn.addEventListener('click', () => {
        renderBulkImportTable();
      });
    }
  
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

    // Add event listener for Select File option
    const selectFileOption = keyfileDropdown.querySelector('button');
    if (selectFileOption) {
        selectFileOption.addEventListener('click', () => {
            walletAddress = '061a3...xaf39';
            showTransactions = false;
            renderWalletDashboard();
        });
    }

    // Add event listener for Private Key option
    const privateKeyOption = privatekeyDropdown.querySelector('button');
    if (privateKeyOption) {
        privateKeyOption.addEventListener('click', () => {
            walletAddress = '061a3...xaf39';
            showTransactions = false;
            renderWalletDashboard();
        });
    }

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