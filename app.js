/* ==========================================
   GLOBAL ERROR CATCHER (FOR DEBUGGING)
   ========================================== */
window.onerror = function(message, source, lineno, colno, error) {
    showVisualError("Uncaught Error: " + message + " at line " + lineno + " (col " + colno + ")");
    return false;
};
window.onunhandledrejection = function(event) {
    showVisualError("Unhandled Promise Rejection: " + event.reason);
};

function showVisualError(errText) {
    let errDiv = document.getElementById('visual-error-banner');
    if (!errDiv) {
        errDiv = document.createElement('div');
        errDiv.id = 'visual-error-banner';
        errDiv.style.position = 'fixed';
        errDiv.style.top = '0';
        errDiv.style.left = '0';
        errDiv.style.width = '100%';
        errDiv.style.backgroundColor = '#ff3333';
        errDiv.style.color = '#ffffff';
        errDiv.style.padding = '12px 20px';
        errDiv.style.zIndex = '999999';
        errDiv.style.fontFamily = 'monospace';
        errDiv.style.fontSize = '13px';
        errDiv.style.whiteSpace = 'pre-wrap';
        errDiv.style.boxShadow = '0 6px 15px rgba(0,0,0,0.6)';
        errDiv.style.borderBottom = '2px solid #ffcc00';
        document.body.appendChild(errDiv);
    }
    errDiv.textContent += errText + "\n";
}

/* ==========================================
   APP STATE & INITIAL DATA
   ========================================== */
let state = {
    transactions: [],
    loans: [],
    travels: [],
    notes: []
};

const categories = {
    masuk: ['Modal / Saldo Awal', 'Tambahan Modal', 'Gaji', 'Investasi', 'Bisnis', 'Hadiah/Bonus', 'Lainnya'],
    keluar: ['Makanan', 'Transportasi', 'Hiburan', 'Belanja', 'Kebutuhan Rumah', 'Investasi', 'Tagihan', 'Lainnya']
};

let activeCurrency = 'IDR';
let cashflowChart = null;
let categoryChart = null;

const OWNER_USERNAME = "rkd2507";
const OWNER_PASSWORD = "25071998";

/* ==========================================
   APP INIT & EVENT LISTENERS
   ========================================== */
document.addEventListener('DOMContentLoaded', () => {
    lockConsole();
    checkAuthStatus();
    setupNavigation();
    setupDefaultDates();
    updateCategoryOptions();
    populateFilterCategories();
    initChakraParticles();

    // Bind custom confirm modal buttons
    const okBtn = document.getElementById('confirm-ok-btn');
    const cancelBtn = document.getElementById('confirm-cancel-btn');
    if (okBtn) {
        okBtn.addEventListener('click', () => {
            closeModal('confirmModal');
            if (confirmCallback) {
                confirmCallback();
                confirmCallback = null;
            }
        });
    }
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            closeModal('confirmModal');
            confirmCallback = null;
        });
    }
});

function checkAuthStatus() {
    const isLogged = sessionStorage.getItem('heist_authorized');
    const loginContainer = document.getElementById('login-container');
    const appWrapper = document.getElementById('app-wrapper');

    if (isLogged === 'true') {
        if (loginContainer) loginContainer.style.display = 'none';
        if (appWrapper) appWrapper.style.display = 'block';
        loadDataFromLocalStorage();
        updateDashboardUI();
    } else {
        if (loginContainer) loginContainer.style.display = 'flex';
        if (appWrapper) appWrapper.style.display = 'none';
    }
}

function handleLogin(e) {
    e.preventDefault();
    const userVal = document.getElementById('login-user').value.trim();
    const passVal = document.getElementById('login-pass').value.trim();
    const errorMsg = document.getElementById('login-error-msg');

    if (userVal === OWNER_USERNAME && passVal === OWNER_PASSWORD) {
        if (errorMsg) errorMsg.style.display = 'none';
        sessionStorage.setItem('heist_authorized', 'true');
        checkAuthStatus();
        document.getElementById('login-form-element').reset();
    } else {
        if (errorMsg) {
            errorMsg.style.display = 'flex';
            errorMsg.style.animation = 'none';
            setTimeout(() => {
                errorMsg.style.animation = 'shakeError 0.4s ease-in-out';
            }, 10);
        }
    }
}

function handleLogout() {
    showConfirm('Keluar dari Kubah RKD Vault? Sesi Anda akan ditutup.', () => {
        sessionStorage.removeItem('heist_authorized');
        checkAuthStatus();
    });
}

const API_URL = "https://script.google.com/macros/s/AKfycby-S0rt7fsHIkmeweQtX07b0vbZwXT0AqptVeTld-pfzsmoeYaiES7db_p_v2JKNxM-/exec";
let isSyncing = false;

function showSyncStatus(message, isError = false) {
    let syncIndicator = document.getElementById('sync-indicator');
    if (!syncIndicator) {
        syncIndicator = document.createElement('div');
        syncIndicator.id = 'sync-indicator';
        syncIndicator.style.position = 'fixed';
        syncIndicator.style.bottom = '80px';
        syncIndicator.style.right = '20px';
        syncIndicator.style.backgroundColor = 'var(--bg-card)';
        syncIndicator.style.border = '1px solid var(--border-color)';
        syncIndicator.style.padding = '8px 12px';
        syncIndicator.style.borderRadius = '8px';
        syncIndicator.style.fontSize = '0.8rem';
        syncIndicator.style.zIndex = '1000';
        syncIndicator.style.display = 'flex';
        syncIndicator.style.alignItems = 'center';
        syncIndicator.style.gap = '8px';
        syncIndicator.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
        document.body.appendChild(syncIndicator);
    }
    
    syncIndicator.style.borderColor = isError ? 'var(--color-danger)' : 'var(--border-color)';
    syncIndicator.innerHTML = `
        <span class="status-dot" style="width: 8px; height: 8px; border-radius: 50%; background-color: ${isError ? 'var(--color-danger)' : (isSyncing ? 'var(--accent-gold)' : 'var(--color-success)')}; ${isSyncing ? 'animation: pulse 1s infinite alternate;' : ''}"></span>
        <span style="color: var(--text-primary);">${message}</span>
    `;

    if (!isSyncing && !isError) {
        setTimeout(() => {
            syncIndicator.style.opacity = '0';
            syncIndicator.style.transition = 'opacity 1s ease';
            setTimeout(() => {
                if (syncIndicator.parentNode) syncIndicator.parentNode.removeChild(syncIndicator);
            }, 1000);
        }, 3000);
    } else {
        syncIndicator.style.opacity = '1';
    }
}

if (!document.getElementById('sync-style')) {
    const style = document.createElement('style');
    style.id = 'sync-style';
    style.textContent = `
        @keyframes pulse {
            0% { transform: scale(0.8); opacity: 0.5; }
            100% { transform: scale(1.2); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
}

async function syncToGoogleSheets() {
    if (isSyncing) return;
    isSyncing = true;
    showSyncStatus("Menyimpan ke Google Sheets...");

    try {
        const transactionsData = state.transactions.map(t => [
            t.id,
            t.date,
            t.type,
            t.category,
            t.currency || 'IDR',
            t.amount,
            t.note || ''
        ]);

        const loansData = state.loans.map(l => {
            const interestRate = l.interestRate !== undefined ? l.interestRate : 20;
            const loanTotal = l.amount + (l.amount * (interestRate / 100));
            const totalRepaid = l.repayments.reduce((sum, r) => sum + r.amount, 0);
            const isLunas = loanTotal - totalRepaid <= 0;
            return [
                l.id,
                l.name,
                l.type,
                l.currency || 'IDR',
                l.amount,
                interestRate,
                loanTotal,
                l.tenor || 1,
                l.dueDate || '',
                isLunas ? 'Lunas' : 'Belum Lunas',
                JSON.stringify(l.repayments)
            ];
        });

        const travelsData = state.travels.map(t => [
            t.id,
            t.name,
            t.destination,
            t.budget,
            t.startDate,
            t.endDate,
            t.description || '',
            t.photo || '',
            JSON.stringify(t.expenses)
        ]);

        const notesData = state.notes.map(n => [
            n.id,
            n.title,
            n.content || '',
            n.tag || 'Lainnya',
            n.date
        ]);

        await fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'saveAll',
                sheet: 'Transaksi',
                data: transactionsData
            })
        });

        await fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'saveAll',
                sheet: 'Pinjaman',
                data: loansData
            })
        });

        await fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'saveAll',
                sheet: 'Perjalanan',
                data: travelsData
            })
        });

        await fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'saveAll',
                sheet: 'Catatan',
                data: notesData
            })
        });

        isSyncing = false;
        showSyncStatus("Cadangan data tersimpan!");
    } catch (e) {
        console.error("Gagal sinkronisasi Google Sheets:", e);
        isSyncing = false;
        showSyncStatus("Gagal sinkronisasi online!", true);
    }
}

async function loadFromGoogleSheets() {
    isSyncing = true;
    showSyncStatus("Mengunduh data online...");
    
    let errorsCount = 0;
    
    // 1. Transaksi
    try {
        const responseTx = await fetch(`${API_URL}?sheet=Transaksi`);
        const jsonTx = await responseTx.json();
        if (jsonTx.status === 'success' && jsonTx.data) {
            state.transactions = jsonTx.data.map(row => ({
                id: row[0],
                date: row[1],
                type: row[2],
                category: row[3],
                currency: row[4],
                amount: parseFloat(row[5]) || 0,
                note: row[6]
            }));
            localStorage.setItem('fina_transactions', JSON.stringify(state.transactions));
        }
    } catch (e) {
        console.error("Gagal memuat sheet Transaksi:", e);
        errorsCount++;
    }
    
    // 2. Pinjaman
    try {
        const responseLoan = await fetch(`${API_URL}?sheet=Pinjaman`);
        const jsonLoan = await responseLoan.json();
        if (jsonLoan.status === 'success' && jsonLoan.data) {
            state.loans = jsonLoan.data.map(row => ({
                id: row[0],
                name: row[1],
                type: row[2],
                currency: row[3],
                amount: parseFloat(row[4]) || 0,
                interestRate: parseFloat(row[5]) || 20,
                tenor: parseInt(row[7]) || 1,
                dueDate: row[8],
                repayments: row[10] ? JSON.parse(row[10]) : []
            }));
            localStorage.setItem('fina_loans', JSON.stringify(state.loans));
        }
    } catch (e) {
        console.error("Gagal memuat sheet Pinjaman:", e);
        errorsCount++;
    }
    
    // 3. Perjalanan
    try {
        const responseTravel = await fetch(`${API_URL}?sheet=Perjalanan`);
        const jsonTravel = await responseTravel.json();
        if (jsonTravel.status === 'success' && jsonTravel.data) {
            state.travels = jsonTravel.data.map(row => ({
                id: row[0],
                name: row[1],
                destination: row[2],
                budget: parseFloat(row[3]) || 0,
                startDate: row[4],
                endDate: row[5],
                description: row[6] || '',
                photo: row[7] || null,
                expenses: row[8] ? JSON.parse(row[8]) : []
            }));
            localStorage.setItem('fina_travels', JSON.stringify(state.travels));
        }
    } catch (e) {
        console.error("Gagal memuat sheet Perjalanan:", e);
        errorsCount++;
    }
    
    // 4. Catatan (Notepad)
    try {
        const responseNotes = await fetch(`${API_URL}?sheet=Catatan`);
        const jsonNotes = await responseNotes.json();
        if (jsonNotes.status === 'success' && jsonNotes.data) {
            state.notes = jsonNotes.data.map(row => ({
                id: row[0],
                title: row[1],
                content: row[2] || '',
                tag: row[3] || 'Lainnya',
                date: row[4]
            }));
            localStorage.setItem('fina_notes', JSON.stringify(state.notes));
        }
    } catch (e) {
        console.error("Gagal memuat sheet Catatan:", e);
        errorsCount++;
    }

    isSyncing = false;
    if (errorsCount === 4) {
        showSyncStatus("Gagal sinkron online, memuat data lokal", true);
        updateDashboardUI();
    } else if (errorsCount > 0) {
        showSyncStatus(`Sinkron sebagian (${4 - errorsCount}/4 sukses)`, false);
        updateDashboardUI();
    } else {
        showSyncStatus("Data sinkron dengan Google Sheets!");
        updateDashboardUI();
    }
    
    if (document.getElementById('travel-section')?.classList.contains('active')) {
        renderTravels();
    }
    if (document.getElementById('notes-section')?.classList.contains('active')) {
        renderNotes();
    }
}

function loadDataFromLocalStorage() {
    const savedTransactions = localStorage.getItem('fina_transactions');
    const savedLoans = localStorage.getItem('fina_loans');
    const savedTravels = localStorage.getItem('fina_travels');
    const savedNotes = localStorage.getItem('fina_notes');
    
    try {
        if (savedTransactions) state.transactions = JSON.parse(savedTransactions);
    } catch(e) {
        console.error("Gagal membaca data transaksi lokal:", e);
        state.transactions = [];
    }

    try {
        if (savedLoans) state.loans = JSON.parse(savedLoans);
    } catch(e) {
        console.error("Gagal membaca data pinjaman lokal:", e);
        state.loans = [];
    }

    try {
        if (savedTravels) state.travels = JSON.parse(savedTravels);
    } catch(e) {
        console.error("Gagal membaca data perjalanan lokal:", e);
        state.travels = [];
    }

    try {
        if (savedNotes) state.notes = JSON.parse(savedNotes);
    } catch(e) {
        console.error("Gagal membaca catatan lokal:", e);
        state.notes = [];
    }

    loadFromGoogleSheets();
}

function saveDataToLocalStorage() {
    localStorage.setItem('fina_transactions', JSON.stringify(state.transactions));
    localStorage.setItem('fina_loans', JSON.stringify(state.loans));
    localStorage.setItem('fina_travels', JSON.stringify(state.travels));
    localStorage.setItem('fina_notes', JSON.stringify(state.notes));
    syncToGoogleSheets();
}

/* ==========================================
   NAVIGATION
   ========================================== */
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const target = item.getAttribute('data-target');
            switchSection(target);
        });
    });

    const bottomNavItems = document.querySelectorAll('.bottom-nav-item');
    bottomNavItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const target = item.getAttribute('data-target');
            switchSection(target);
        });
    });
}

function switchSection(sectionId) {
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(sec => sec.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        if (item.getAttribute('data-target') === sectionId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    const bottomNavItems = document.querySelectorAll('.bottom-nav-item');
    bottomNavItems.forEach(item => {
        if (item.getAttribute('data-target') === sectionId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    if (sectionId === 'dashboard-section') {
        renderCharts();
    } else if (sectionId === 'transactions-section') {
        renderTransactionTable();
    } else if (sectionId === 'loans-section') {
        renderLoanTable();
    } else if (sectionId === 'travel-section') {
        renderTravels();
    } else if (sectionId === 'notes-section') {
        renderNotes();
    }
}

/* ==========================================
   MODALS MANAGEMENT
   ========================================== */
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    if (modalId === 'transactionModal') {
        document.getElementById('transaction-form').reset();
        document.getElementById('edit-transaction-id').value = '';
        setupDefaultDates();
    } else if (modalId === 'loanModal') {
        document.getElementById('loan-form').reset();
        setupDefaultDates();
    } else if (modalId === 'repayModal') {
        document.getElementById('repay-form').reset();
    } else if (modalId === 'travelModal') {
        document.getElementById('travel-form').reset();
        document.getElementById('edit-travel-id').value = '';
        document.querySelector('.travel-photo-preview-container').style.display = 'none';
        tempTravelPhotoBase64 = null;
        setupDefaultDates();
    } else if (modalId === 'travelDetailModal') {
        document.getElementById('travel-expense-form').reset();
    } else if (modalId === 'noteModal') {
        document.getElementById('note-form').reset();
        document.getElementById('edit-note-id').value = '';
    }
}

let confirmCallback = null;

function showConfirm(message, callback) {
    document.getElementById('confirm-message').textContent = message;
    confirmCallback = callback;
    openModal('confirmModal');
}

function setupDefaultDates() {
    const todayStr = new Date().toISOString().split('T')[0];
    const txDate = document.getElementById('tx-date');
    const loanDate = document.getElementById('loan-date');
    const repayDate = document.getElementById('repay-date');
    
    if (txDate) txDate.value = todayStr;
    if (loanDate) loanDate.value = todayStr;
    if (repayDate) repayDate.value = todayStr;

    const travelStart = document.getElementById('travel-start-date');
    const travelEnd = document.getElementById('travel-end-date');
    if (travelStart) travelStart.value = todayStr;
    if (travelEnd) travelEnd.value = todayStr;
}

function updateCategoryOptions() {
    const typeSelect = document.getElementById('tx-type');
    const catSelect = document.getElementById('tx-category');
    if (!typeSelect || !catSelect) return;

    const selectedType = typeSelect.value;
    const list = categories[selectedType];
    
    catSelect.innerHTML = '';
    list.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        catSelect.appendChild(opt);
    });
}

function populateFilterCategories() {
    const filterCat = document.getElementById('filter-category');
    if (!filterCat) return;
    
    const allCats = [...new Set([...categories.masuk, ...categories.keluar])];
    filterCat.innerHTML = '<option value="all">Semua Kategori</option>';
    allCats.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        filterCat.appendChild(opt);
    });
}

function formatInputCurrency(input) {
    let cursorPosition = input.selectionStart;
    let originalLength = input.value.length;
    
    let cleanVal = input.value.replace(/\D/g, "");
    if (!cleanVal) {
        input.value = "";
        return;
    }

    let numberVal = parseInt(cleanVal, 10);
    let formatted = new Intl.NumberFormat('id-ID').format(numberVal);
    input.value = formatted;
    
    let newLength = formatted.length;
    input.setSelectionRange(cursorPosition + (newLength - originalLength), cursorPosition + (newLength - originalLength));
}

function parseFormattedNumber(str) {
    if (!str) return 0;
    let clean = String(str).replace(/\D/g, "");
    return parseFloat(clean) || 0;
}

/* ==========================================
   FINANCIAL CALCULATIONS
   ========================================== */
function formatCurrency(number, currencyCode) {
    if (currencyCode === 'IDR') {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(number);
    } else if (currencyCode === 'USD') {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(number);
    } else if (currencyCode === 'KHR') {
        return '៛' + new Intl.NumberFormat('id-ID').format(number);
    } else if (currencyCode === 'THB') {
        return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(number);
    }
    return number;
}

function calculateFinancials(currencyCode) {
    let incomeSum = 0;
    let expenseSum = 0;
    
    state.transactions.forEach(t => {
        const tCurr = t.currency || 'IDR';
        if (tCurr === currencyCode) {
            if (t.type === 'masuk') incomeSum += t.amount;
            else if (t.type === 'keluar') expenseSum += t.amount;
        }
    });

    let activeLoans = 0;
    state.loans.forEach(loan => {
        const loanCurr = loan.currency || 'IDR';
        if (loanCurr === currencyCode) {
            const interestRate = loan.interestRate !== undefined ? loan.interestRate : 20;
            const loanTotal = loan.amount + (loan.amount * (interestRate / 100));
            const totalRepaid = loan.repayments.reduce((sum, r) => sum + r.amount, 0);
            const remaining = loanTotal - totalRepaid;
            
            if (remaining > 0) {
                activeLoans += remaining;
            }

            loan.repayments.forEach(rep => {
                if (loan.type === 'piutang') {
                    incomeSum += rep.amount;
                } else if (loan.type === 'hutang') {
                    expenseSum += rep.amount;
                }
            });

            if (loan.type === 'piutang') {
                expenseSum += loan.amount;
            } else if (loan.type === 'hutang') {
                incomeSum += loan.amount;
            }
        }
    });

    return {
        balance: incomeSum - expenseSum,
        income: incomeSum,
        expense: expenseSum,
        loans: activeLoans
    };
}

function changeDashboardCurrency(currencyCode) {
    activeCurrency = currencyCode;
    const buttons = document.querySelectorAll('.currency-tabs-container button');
    buttons.forEach(btn => btn.classList.remove('active-currency'));
    
    document.getElementById(`tab-curr-${currencyCode}`).classList.add('active-currency');

    const labels = document.querySelectorAll('.active-currency-label');
    labels.forEach(lbl => lbl.textContent = currencyCode);

    updateDashboardUI();
}

function updateDashboardUI() {
    const fin = calculateFinancials(activeCurrency);
    
    document.getElementById('total-balance').textContent = formatCurrency(fin.balance, activeCurrency);
    document.getElementById('total-income').textContent = formatCurrency(fin.income, activeCurrency);
    document.getElementById('total-expense').textContent = formatCurrency(fin.expense, activeCurrency);
    document.getElementById('total-loans').textContent = formatCurrency(fin.loans, activeCurrency);

    const balEl = document.getElementById('total-balance');
    if (fin.balance < 0) {
        balEl.style.color = 'var(--color-danger)';
    } else {
        balEl.style.color = 'var(--text-primary)';
    }

    renderRecentTransactions();
    renderRecentLoans();
    renderCharts();
}

function calculateLoanProjection() {
    const amountInput = document.getElementById('loan-amount');
    const interestSelect = document.getElementById('loan-interest');
    const currencySelect = document.getElementById('loan-currency');
    const projectionText = document.getElementById('loan-projection-text');

    if (!amountInput || !interestSelect || !currencySelect || !projectionText) return;

    const amount = parseFormattedNumber(amountInput.value) || 0;
    const interestRate = parseFloat(interestSelect.value) / 100;
    const interestAmount = amount * interestRate;
    const total = amount + interestAmount;
    const curr = currencySelect.value;

    projectionText.textContent = formatCurrency(total, curr) + ` (Pokok: ${formatCurrency(amount, curr)} + Bunga: ${formatCurrency(interestAmount, curr)})`;
}

/* ==========================================
   RENDER LISTS
   ========================================== */
function renderRecentTransactions() {
    const listEl = document.getElementById('recent-transactions');
    if (!listEl) return;

    let unifiedHistory = [];

    state.transactions.forEach(t => {
        const tCurr = t.currency || 'IDR';
        if (tCurr === activeCurrency) {
            unifiedHistory.push({
                id: t.id,
                title: t.note,
                subtitle: t.category,
                amount: t.amount,
                type: t.type,
                date: t.date,
                currency: tCurr,
                icon: t.type === 'masuk' ? 'fa-solid fa-arrow-trend-up' : 'fa-solid fa-arrow-trend-down',
                badgeClass: t.type === 'masuk' ? 'badge-income' : 'badge-expense'
            });
        }
    });

    state.loans.forEach(l => {
        const lCurr = l.currency || 'IDR';
        if (lCurr === activeCurrency) {
            unifiedHistory.push({
                id: `${l.id}-init`,
                title: l.type === 'piutang' ? `Memberi Pinjaman ke ${l.name}` : `Pinjam dari ${l.name}`,
                subtitle: 'Pinjaman Baru',
                amount: l.amount,
                type: l.type === 'piutang' ? 'keluar' : 'masuk',
                date: l.date,
                currency: lCurr,
                icon: 'fa-solid fa-handshake',
                badgeClass: 'badge-pending'
            });

            l.repayments.forEach(r => {
                unifiedHistory.push({
                    id: r.id,
                    title: l.type === 'piutang' ? `Cicilan Masuk dari ${l.name}` : `Bayar Cicilan ke ${l.name}`,
                    subtitle: 'Pengembalian Pinjaman',
                    amount: r.amount,
                    type: l.type === 'piutang' ? 'masuk' : 'keluar',
                    date: r.date,
                    currency: lCurr,
                    icon: 'fa-solid fa-rotate-left',
                    badgeClass: l.type === 'piutang' ? 'badge-income' : 'badge-expense'
                });
            });
        }
    });

    unifiedHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
    const recent = unifiedHistory.slice(0, 4);

    if (recent.length === 0) {
        listEl.innerHTML = `<li class="empty-list">Belum ada transaksi ${activeCurrency} terdaftar.</li>`;
        return;
    }

    listEl.innerHTML = '';
    recent.forEach(item => {
        const li = document.createElement('li');
        li.className = 'recent-item';
        li.innerHTML = `
            <div class="item-left">
                <div class="item-badge ${item.badgeClass}">
                    <i class="${item.icon}"></i>
                </div>
                <div class="item-details">
                    <h4>${item.title}</h4>
                    <p>${item.subtitle} • ${formatDateStr(item.date)}</p>
                </div>
            </div>
            <div class="item-right">
                <p class="item-amount ${item.type}">${item.type === 'masuk' ? '+' : '-'}${formatCurrency(item.amount, item.currency)}</p>
            </div>
        `;
        listEl.appendChild(li);
    });
}

function renderRecentLoans() {
    const listEl = document.getElementById('recent-loans');
    if (!listEl) return;

    const active = state.loans.filter(l => {
        const lCurr = l.currency || 'IDR';
        if (lCurr !== activeCurrency) return false;

        const interestRate = l.interestRate !== undefined ? l.interestRate : 20;
        const loanTotal = l.amount + (l.amount * (interestRate / 100));
        const totalRepaid = l.repayments.reduce((sum, r) => sum + r.amount, 0);
        return loanTotal - totalRepaid > 0;
    }).slice(0, 4);

    if (active.length === 0) {
        listEl.innerHTML = `<li class="empty-list">Belum ada pinjaman ${activeCurrency} aktif.</li>`;
        return;
    }

    listEl.innerHTML = '';
    active.forEach(l => {
        const interestRate = l.interestRate !== undefined ? l.interestRate : 20;
        const loanTotal = l.amount + (l.amount * (interestRate / 100));
        const totalRepaid = l.repayments.reduce((sum, r) => sum + r.amount, 0);
        const remaining = loanTotal - totalRepaid;
        const typeStr = l.type === 'piutang' ? 'Piutang' : 'Hutang';
        const amountClass = l.type === 'piutang' ? 'piutang-in' : 'hutang-in';

        const li = document.createElement('li');
        li.className = 'recent-item';
        li.innerHTML = `
            <div class="item-left">
                <div class="item-badge badge-pending">
                    <i class="fa-solid fa-clock-rotate-left"></i>
                </div>
                <div class="item-details">
                    <h4>${l.name}</h4>
                    <p>${typeStr} • Sisa Jatuh Tempo: ${l.dueDate ? formatDateStr(l.dueDate) : '-'}</p>
                </div>
            </div>
            <div class="item-right">
                <p class="item-amount ${amountClass}">${formatCurrency(remaining, activeCurrency)}</p>
                <span class="item-status badge-pending">Aktif</span>
            </div>
        `;
        listEl.appendChild(li);
    });
}

function formatDateStr(dateStr) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateStr).toLocaleDateString('id-ID', options);
}

/* ==========================================
   CHARTS RENDERING
   ========================================== */
function renderCharts() {
    const ctxCashflow = document.getElementById('cashflowChart');
    if (ctxCashflow) {
        const last6Months = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            last6Months.push({
                label: d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }),
                monthKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
                income: 0,
                expense: 0
            });
        }

        state.transactions.forEach(t => {
            const tCurr = t.currency || 'IDR';
            if (tCurr === activeCurrency) {
                const tDate = t.date || new Date().toISOString().split('T')[0];
                const mKey = tDate.substring(0, 7);
                const bucket = last6Months.find(m => m.monthKey === mKey);
                if (bucket) {
                    if (t.type === 'masuk') bucket.income += t.amount;
                    else bucket.expense += t.amount;
                }
            }
        });

        state.loans.forEach(l => {
            const lCurr = l.currency || 'IDR';
            if (lCurr === activeCurrency) {
                const lDate = l.date || l.dueDate || new Date().toISOString().split('T')[0];
                const mKeyInit = lDate.substring(0, 7);
                const bucketInit = last6Months.find(m => m.monthKey === mKeyInit);
                if (bucketInit) {
                    if (l.type === 'piutang') bucketInit.expense += l.amount;
                    else bucketInit.income += l.amount;
                }

                if (l.repayments) {
                    l.repayments.forEach(r => {
                        const rDate = r.date || new Date().toISOString().split('T')[0];
                        const mKeyRep = rDate.substring(0, 7);
                        const bucketRep = last6Months.find(m => m.monthKey === mKeyRep);
                        if (bucketRep) {
                            if (l.type === 'piutang') bucketRep.income += r.amount;
                            else bucketRep.expense += r.amount;
                        }
                    });
                }
            }
        });

        const labels = last6Months.map(m => m.label);
        const incomeData = last6Months.map(m => m.income);
        const expenseData = last6Months.map(m => m.expense);

        if (cashflowChart) cashflowChart.destroy();
        cashflowChart = new Chart(ctxCashflow, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Total Kas Masuk (' + activeCurrency + ')',
                        data: incomeData,
                        borderColor: '#ffb300',
                        backgroundColor: 'rgba(255, 179, 0, 0.05)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Total Kas Keluar (' + activeCurrency + ')',
                        data: expenseData,
                        borderColor: '#ff3333',
                        backgroundColor: 'rgba(255, 51, 51, 0.08)',
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#ffffff', font: { family: 'Outfit' } } }
                },
                scales: {
                    x: { ticks: { color: '#d9d2cb', font: { family: 'Outfit' } }, grid: { color: 'rgba(255, 69, 0, 0.05)' } },
                    y: { ticks: { color: '#d9d2cb', font: { family: 'Outfit' } }, grid: { color: 'rgba(255, 69, 0, 0.05)' } }
                }
            }
        });
    }

    const ctxCategory = document.getElementById('categoryChart');
    if (ctxCategory) {
        const catMap = {};
        state.transactions.forEach(t => {
            const tCurr = t.currency || 'IDR';
            if (tCurr === activeCurrency && t.type === 'keluar') {
                catMap[t.category] = (catMap[t.category] || 0) + t.amount;
            }
        });

        state.loans.forEach(l => {
            const lCurr = l.currency || 'IDR';
            if (lCurr === activeCurrency) {
                if (l.type === 'piutang') {
                    catMap['Pinjaman Keluar'] = (catMap['Pinjaman Keluar'] || 0) + l.amount;
                }
                l.repayments.forEach(r => {
                    if (l.type === 'hutang') {
                        catMap['Cicilan Pinjaman'] = (catMap['Cicilan Pinjaman'] || 0) + r.amount;
                    }
                });
            }
        });

        const labels = Object.keys(catMap);
        const data = Object.values(catMap);

        if (categoryChart) categoryChart.destroy();
        
        if (labels.length === 0) {
            const emptyCtx = ctxCategory.getContext('2d');
            emptyCtx.clearRect(0, 0, ctxCategory.width, ctxCategory.height);
            emptyCtx.fillStyle = '#8c827a';
            emptyCtx.font = '14px Outfit';
            emptyCtx.textAlign = 'center';
            emptyCtx.fillText(`Tidak ada data ${activeCurrency}`, ctxCategory.width / 2, ctxCategory.height / 2);
            return;
        }

        categoryChart = new Chart(ctxCategory, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        '#ff5500', '#ffaa00', '#ff3333', '#e67e22', 
                        '#ffcc00', '#e74c3c', '#d35400', '#f39c12'
                    ],
                    borderWidth: 1.5,
                    borderColor: 'var(--sidebar-bg)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { 
                        position: 'right',
                        labels: { color: '#ffffff', font: { family: 'Outfit', size: 11 } } 
                    }
                }
            }
        });
    }
}

/* ==========================================
   TRANSACTION OPERATIONS (CRUD)
   ========================================== */
function saveTransaction(e) {
    e.preventDefault();
    
    const idInput = document.getElementById('edit-transaction-id').value;
    const type = document.getElementById('tx-type').value;
    const currency = document.getElementById('tx-currency').value;
    const category = document.getElementById('tx-category').value;
    const amount = parseFormattedNumber(document.getElementById('tx-amount').value);
    const date = document.getElementById('tx-date').value;
    const note = document.getElementById('tx-note').value;

    if (idInput) {
        const idx = state.transactions.findIndex(t => t.id === idInput);
        if (idx !== -1) {
            state.transactions[idx] = { id: idInput, type, currency, category, amount, date, note };
        }
    } else {
        const newTx = {
            id: `tx-${Date.now()}`,
            type,
            currency,
            category,
            amount,
            date,
            note
        };
        state.transactions.push(newTx);
    }

    saveDataToLocalStorage();
    closeModal('transactionModal');
    changeDashboardCurrency(currency);
    
    if (document.getElementById('transactions-section').classList.contains('active')) {
        renderTransactionTable();
    }
}

function deleteTransaction(id) {
    showConfirm('Apakah Anda yakin ingin menghapus data ini?', () => {
        state.transactions = state.transactions.filter(t => t.id !== id);
        saveDataToLocalStorage();
        updateDashboardUI();
        renderTransactionTable();
    });
}

function editTransaction(id) {
    const tx = state.transactions.find(t => t.id === id);
    if (!tx) return;

    document.getElementById('edit-transaction-id').value = tx.id;
    document.getElementById('tx-type').value = tx.type;
    document.getElementById('tx-currency').value = tx.currency || 'IDR';
    updateCategoryOptions();
    document.getElementById('tx-category').value = tx.category;
    
    // Set and format the amount to have dots during edit
    const amountInput = document.getElementById('tx-amount');
    amountInput.value = tx.amount;
    formatInputCurrency(amountInput);
    
    document.getElementById('tx-date').value = tx.date;
    document.getElementById('tx-note').value = tx.note;

    openModal('transactionModal');
}

function renderTransactionTable() {
    const tbody = document.getElementById('transaction-table-body');
    if (!tbody) return;

    const query = document.getElementById('search-transaction').value.toLowerCase();
    const typeFilter = document.getElementById('filter-type').value;
    const catFilter = document.getElementById('filter-category').value;

    const filtered = state.transactions.filter(t => {
        const matchesQuery = t.note.toLowerCase().includes(query) || t.category.toLowerCase().includes(query);
        const matchesType = typeFilter === 'all' ? true : t.type === typeFilter;
        const matchesCat = catFilter === 'all' ? true : t.category === catFilter;
        return matchesQuery && matchesType && matchesCat;
    });

    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    tbody.innerHTML = '';
    
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-list" style="text-align:center;">Tidak ada transaksi ditemukan.</td></tr>`;
        return;
    }

    filtered.forEach(t => {
        const tr = document.createElement('tr');
        const badgeClass = t.type === 'masuk' ? 'badge-income' : 'badge-expense';
        const typeStr = t.type === 'masuk' ? 'Masuk' : 'Keluar';
        const tCurr = t.currency || 'IDR';

        tr.innerHTML = `
            <td data-label="Tanggal">${formatDateStr(t.date)}</td>
            <td data-label="Mata Uang"><strong>${tCurr}</strong></td>
            <td data-label="Kategori"><strong>${t.category}</strong></td>
            <td data-label="Keterangan">${t.note}</td>
            <td data-label="Tipe"><span class="badge ${badgeClass}">${typeStr}</span></td>
            <td data-label="Jumlah"><strong>${formatCurrency(t.amount, tCurr)}</strong></td>
            <td data-label="Aksi">
                <button class="btn btn-secondary btn-sm" onclick="editTransaction('${t.id}')">
                    <i class="fa-solid fa-pen-to-square"></i>
                </button>
                <button class="btn btn-danger btn-sm" onclick="deleteTransaction('${t.id}')">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterTransactions() {
    renderTransactionTable();
}

/* ==========================================
   LOANS & REPAYMENTS OPERATIONS
   ========================================== */
function saveLoan(e) {
    e.preventDefault();
    
    const type = document.getElementById('loan-type').value;
    const name = document.getElementById('loan-name').value;
    const currency = document.getElementById('loan-currency').value;
    const amount = parseFormattedNumber(document.getElementById('loan-amount').value);
    const interestRate = parseFloat(document.getElementById('loan-interest').value);
    const date = document.getElementById('loan-date').value;
    const dueDate = document.getElementById('loan-due-date').value;
    const note = document.getElementById('loan-note').value;

    const newLoan = {
        id: `loan-${Date.now()}`,
        type,
        name,
        currency,
        amount,
        interestRate,
        date,
        dueDate: dueDate || null,
        repayments: [],
        note
    };

    state.loans.push(newLoan);
    saveDataToLocalStorage();
    closeModal('loanModal');
    changeDashboardCurrency(currency);
    
    if (document.getElementById('loans-section').classList.contains('active')) {
        renderLoanTable();
    }
}

function openRepayModal(loanId) {
    const loan = state.loans.find(l => l.id === loanId);
    if (!loan) return;

    const lCurr = loan.currency || 'IDR';
    const interestRate = loan.interestRate !== undefined ? loan.interestRate : 20;
    const loanTotal = loan.amount + (loan.amount * (interestRate / 100));
    const totalRepaid = loan.repayments.reduce((sum, r) => sum + r.amount, 0);
    const remaining = loanTotal - totalRepaid;

    document.getElementById('repay-loan-id').value = loanId;
    document.getElementById('repay-info-name').textContent = loan.name + ` (${lCurr})`;
    document.getElementById('repay-info-remaining').textContent = formatCurrency(remaining, lCurr);
    
    // Set and format the repayment default amount input
    const repayAmountInput = document.getElementById('repay-amount');
    repayAmountInput.value = remaining;
    formatInputCurrency(repayAmountInput);

    setupDefaultDates();
    openModal('repayModal');
}

function saveRepayment(e) {
    e.preventDefault();
    
    const loanId = document.getElementById('repay-loan-id').value;
    const amount = parseFormattedNumber(document.getElementById('repay-amount').value);
    const date = document.getElementById('repay-date').value;

    const loanIdx = state.loans.findIndex(l => l.id === loanId);
    if (loanIdx === -1) return;

    const newRepayment = {
        id: `rep-${Date.now()}`,
        amount,
        date
    };

    state.loans[loanIdx].repayments.push(newRepayment);
    saveDataToLocalStorage();
    closeModal('repayModal');
    
    const lCurr = state.loans[loanIdx].currency || 'IDR';
    changeDashboardCurrency(lCurr);

    if (document.getElementById('loans-section').classList.contains('active')) {
        renderLoanTable();
    }
}

function deleteLoan(id) {
    showConfirm('Hapus data pinjaman ini? Semua riwayat pengembalian juga akan terhapus.', () => {
        state.loans = state.loans.filter(l => l.id !== id);
        saveDataToLocalStorage();
        updateDashboardUI();
        renderLoanTable();
    });
}

function renderLoanTable() {
    const tbody = document.getElementById('loan-table-body');
    if (!tbody) return;

    const query = document.getElementById('search-loan').value.toLowerCase();
    const typeFilter = document.getElementById('filter-loan-type').value;
    const statusFilter = document.getElementById('filter-loan-status').value;

    const filtered = state.loans.filter(l => {
        const interestRate = l.interestRate !== undefined ? l.interestRate : 20;
        const loanTotal = l.amount + (l.amount * (interestRate / 100));
        const totalRepaid = l.repayments.reduce((sum, r) => sum + r.amount, 0);
        const isLunas = loanTotal - totalRepaid <= 0;
        
        const matchesQuery = l.name.toLowerCase().includes(query) || l.note.toLowerCase().includes(query);
        const matchesType = typeFilter === 'all' ? true : l.type === typeFilter;
        
        let matchesStatus = true;
        if (statusFilter === 'belum-lunas') matchesStatus = !isLunas;
        else if (statusFilter === 'lunas') matchesStatus = isLunas;

        return matchesQuery && matchesType && matchesStatus;
    });

    tbody.innerHTML = '';
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="13" class="empty-list" style="text-align:center;">Tidak ada data pinjaman ditemukan.</td></tr>`;
        return;
    }

    filtered.forEach(l => {
        const lCurr = l.currency || 'IDR';
        const interestRate = l.interestRate !== undefined ? l.interestRate : 20;
        const interestAmount = l.amount * (interestRate / 100);
        const loanTotal = l.amount + interestAmount;
        const totalRepaid = l.repayments.reduce((sum, r) => sum + r.amount, 0);
        const remaining = loanTotal - totalRepaid;
        const isLunas = remaining <= 0;
        
        const tr = document.createElement('tr');
        const statusBadge = isLunas 
            ? `<span class="badge badge-success">Lunas</span>` 
            : `<span class="badge badge-pending">Aktif</span>`;
        const typeStr = l.type === 'piutang' ? 'Piutang' : 'Hutang';

        tr.innerHTML = `
            <td data-label="Tanggal">${formatDateStr(l.date)}</td>
            <td data-label="Pihak / Nama"><strong>${l.name}</strong><br><small style="color:var(--text-muted);">${l.note}</small></td>
            <td data-label="Mata Uang"><strong>${lCurr}</strong></td>
            <td data-label="Tipe">${typeStr}</td>
            <td data-label="Pinjaman Pokok">${formatCurrency(l.amount, lCurr)}</td>
            <td data-label="Bunga" style="color: var(--accent-gold); font-size:0.85rem;">${interestRate}% (${formatCurrency(interestAmount, lCurr)})</td>
            <td data-label="Total Tagihan" style="font-weight: 600;">${formatCurrency(loanTotal, lCurr)}</td>
            <td data-label="Terbayar" style="color:var(--color-success); font-weight: 500;">${formatCurrency(totalRepaid, lCurr)}</td>
            <td data-label="Sisa Tagihan" style="font-weight: 700; color: ${isLunas ? 'var(--color-success)' : 'var(--color-danger)'};">${formatCurrency(remaining, lCurr)}</td>
            <td data-label="Jatuh Tempo">${l.dueDate ? formatDateStr(l.dueDate) : '-'}</td>
            <td data-label="Status">${statusBadge}</td>
            <td data-label="Aksi">
                ${!isLunas ? `<button class="btn btn-primary btn-sm" onclick="openRepayModal('${l.id}')"><i class="fa-solid fa-coins"></i> Cicil</button>` : ''}
                <button class="btn btn-danger btn-sm" onclick="deleteLoan('${l.id}')">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

/* ==========================================
   CONSOLE LOCK & DEVTOOLS BLOCK
   ========================================== */
function lockConsole() {
    // Disable right click
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    // Disable developer hotkeys
    document.addEventListener('keydown', (e) => {
        if (
            e.key === 'F12' ||
            (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
            (e.ctrlKey && (e.key === 'U' || e.key === 'u'))
        ) {
            e.preventDefault();
            return false;
        }
    });

    // Disable console logging completely
    console.log = function() {};
    console.warn = function() {};
    console.error = function() {};
    console.info = function() {};
    console.clear = function() {};

    // Clear console aggressively to wipe standard messages
    setInterval(() => {
        try {
            const clear = console.clear;
            if (clear) clear();
        } catch(e){}
    }, 100);
}

/* ==========================================
   TRAVEL SECTION MANAGEMENT
   ========================================== */
let tempTravelPhotoBase64 = null;

function previewTravelPhoto(input) {
    const file = input.files[0];
    const previewContainer = document.querySelector('.travel-photo-preview-container');
    const previewImg = document.getElementById('travel-photo-preview');
    if (file) {
        if (file.size > 1500000) {
            alert('Ukuran foto terlalu besar! Harap gunakan gambar di bawah 1.5MB.');
            input.value = '';
            tempTravelPhotoBase64 = null;
            previewImg.src = "";
            previewContainer.style.display = 'none';
            return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            tempTravelPhotoBase64 = e.target.result;
            previewImg.src = tempTravelPhotoBase64;
            previewContainer.style.display = 'block';
        };
        reader.readAsDataURL(file);
    } else {
        tempTravelPhotoBase64 = null;
        previewImg.src = "";
        previewContainer.style.display = 'none';
    }
}

function saveTravel(e) {
    e.preventDefault();
    const idInput = document.getElementById('edit-travel-id').value;
    const name = document.getElementById('travel-name').value.trim();
    const destination = document.getElementById('travel-destination').value.trim();
    const budget = parseFormattedNumber(document.getElementById('travel-budget').value) || 0;
    const startDate = document.getElementById('travel-start-date').value;
    const endDate = document.getElementById('travel-end-date').value;
    const description = document.getElementById('travel-description').value.trim();
    
    if (idInput) {
        const travel = state.travels.find(t => t.id === idInput);
        if (travel) {
            travel.name = name;
            travel.destination = destination;
            travel.budget = budget;
            travel.startDate = startDate;
            travel.endDate = endDate;
            travel.description = description;
            if (tempTravelPhotoBase64) {
                travel.photo = tempTravelPhotoBase64;
            }
        }
    } else {
        const newTravel = {
            id: 'travel-' + Date.now(),
            name: name,
            destination: destination,
            budget: budget,
            startDate: startDate,
            endDate: endDate,
            description: description,
            photo: tempTravelPhotoBase64 || null,
            expenses: []
        };
        state.travels.push(newTravel);
    }
    
    saveDataToLocalStorage();
    closeModal('travelModal');
    renderTravels();
}

function renderTravels() {
    const container = document.getElementById('travel-grid-container');
    if (!container) return;
    
    const query = (document.getElementById('search-travel')?.value || '').toLowerCase().trim();
    container.innerHTML = '';
    
    const filtered = state.travels.filter(t => 
        t.name.toLowerCase().includes(query) || 
        t.destination.toLowerCase().includes(query) ||
        (t.description && t.description.toLowerCase().includes(query))
    );
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-list" style="grid-column: 1/-1;">Belum ada perjalanan terdaftar.</div>';
        return;
    }
    
    filtered.forEach(t => {
        const totalSpent = t.expenses ? t.expenses.reduce((sum, e) => sum + e.amount, 0) : 0;
        const percent = t.budget > 0 ? Math.min(100, Math.round((totalSpent / t.budget) * 100)) : 0;
        const isOver = totalSpent > t.budget;
        const progressBarColor = isOver ? 'var(--color-danger)' : 'var(--color-success)';
        
        const card = document.createElement('div');
        card.className = 'travel-card';
        
        const coverSrc = t.photo || 'naruto.jpg';
        
        card.innerHTML = `
            <div class="travel-card-img-wrapper">
                <img class="travel-card-img" src="${coverSrc}" alt="${t.name}">
                <div class="travel-card-actions">
                    <button class="travel-card-action-btn" onclick="openEditTravel('${t.id}', event)"><i class="fa-solid fa-pen"></i></button>
                    <button class="travel-card-action-btn btn-delete" onclick="deleteTravel('${t.id}', event)"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
            <div class="travel-card-content" onclick="openTravelDetail('${t.id}')" style="cursor: pointer;">
                <div class="travel-card-body">
                    <h4>${t.name}</h4>
                    <p class="travel-card-dest"><i class="fa-solid fa-location-dot"></i> ${t.destination}</p>
                    <p class="travel-card-dates"><i class="fa-solid fa-calendar-days"></i> ${formatDateStr(t.startDate)} - ${formatDateStr(t.endDate)}</p>
                    <p class="travel-card-desc">${t.description || 'Tidak ada deskripsi.'}</p>
                </div>
                <div class="travel-card-budget-section">
                    <div class="travel-progress-text">
                        <span>Budget: ${formatCurrency(t.budget, 'IDR')}</span>
                        <span style="color: ${progressBarColor};">${percent}%</span>
                    </div>
                    <div class="travel-progress-bar-bg">
                        <div class="travel-progress-bar" style="width: ${percent}%; background-color: ${progressBarColor};"></div>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function deleteTravel(id, event) {
    if (event) event.stopPropagation();
    showConfirm('Hapus catatan perjalanan ini?', () => {
        state.travels = state.travels.filter(t => t.id !== id);
        saveDataToLocalStorage();
        renderTravels();
    });
}

function openEditTravel(id, event) {
    if (event) event.stopPropagation();
    const travel = state.travels.find(t => t.id === id);
    if (!travel) return;
    
    document.getElementById('edit-travel-id').value = travel.id;
    document.getElementById('travel-name').value = travel.name;
    document.getElementById('travel-destination').value = travel.destination;
    document.getElementById('travel-budget').value = new Intl.NumberFormat('id-ID').format(travel.budget);
    document.getElementById('travel-start-date').value = travel.startDate;
    document.getElementById('travel-end-date').value = travel.endDate;
    document.getElementById('travel-description').value = travel.description || '';
    
    const previewContainer = document.querySelector('.travel-photo-preview-container');
    const previewImg = document.getElementById('travel-photo-preview');
    if (travel.photo) {
        tempTravelPhotoBase64 = travel.photo;
        previewImg.src = travel.photo;
        previewContainer.style.display = 'block';
    } else {
        tempTravelPhotoBase64 = null;
        previewImg.src = '';
        previewContainer.style.display = 'none';
    }
    
    openModal('travelModal');
}

function openTravelDetail(id) {
    const travel = state.travels.find(t => t.id === id);
    if (!travel) return;
    
    document.getElementById('te-travel-id').value = travel.id;
    document.getElementById('td-title').textContent = travel.name;
    document.getElementById('td-dest-dates').innerHTML = `<i class="fa-solid fa-location-dot"></i> ${travel.destination} <span style="font-size: 0.8rem; font-weight: normal; margin-left: 10px;"><i class="fa-solid fa-calendar-days"></i> ${formatDateStr(travel.startDate)} - ${formatDateStr(travel.endDate)}</span>`;
    document.getElementById('td-desc').textContent = travel.description || 'Tidak ada deskripsi.';
    
    const coverImg = document.getElementById('td-cover');
    coverImg.src = travel.photo || 'naruto.jpg';
    
    const totalSpent = travel.expenses ? travel.expenses.reduce((sum, e) => sum + e.amount, 0) : 0;
    const remaining = travel.budget - totalSpent;
    const percent = travel.budget > 0 ? Math.min(100, Math.round((totalSpent / travel.budget) * 100)) : 0;
    const isOver = totalSpent > travel.budget;
    
    document.getElementById('td-budget-val').textContent = formatCurrency(travel.budget, 'IDR');
    document.getElementById('td-spent-val').textContent = formatCurrency(totalSpent, 'IDR');
    document.getElementById('td-remaining-val').textContent = formatCurrency(remaining, 'IDR');
    
    const remainingEl = document.getElementById('td-remaining-val');
    if (remaining < 0) {
        remainingEl.style.color = 'var(--color-danger)';
    } else {
        remainingEl.style.color = 'var(--color-success)';
    }
    
    document.getElementById('td-progress-percent').textContent = `${percent}%`;
    const progressBar = document.getElementById('td-progress-bar');
    progressBar.style.width = `${percent}%`;
    progressBar.style.backgroundColor = isOver ? 'var(--color-danger)' : 'var(--color-success)';
    
    renderTravelExpensesTable(travel);
    openModal('travelDetailModal');
}

function addTravelExpense(e) {
    e.preventDefault();
    const travelId = document.getElementById('te-travel-id').value;
    const note = document.getElementById('te-note').value.trim();
    const category = document.getElementById('te-category').value;
    const amount = parseFormattedNumber(document.getElementById('te-amount').value) || 0;
    
    const travel = state.travels.find(t => t.id === travelId);
    if (!travel) return;
    if (!travel.expenses) travel.expenses = [];
    
    const newExpense = {
        id: 'te-' + Date.now(),
        note: note,
        category: category,
        amount: amount,
        date: new Date().toISOString().split('T')[0]
    };
    
    travel.expenses.push(newExpense);
    saveDataToLocalStorage();
    
    document.getElementById('te-note').value = '';
    document.getElementById('te-amount').value = '';
    
    openTravelDetail(travelId);
    renderTravels();
}

function deleteTravelExpense(expenseId) {
    const travelId = document.getElementById('te-travel-id').value;
    const travel = state.travels.find(t => t.id === travelId);
    if (!travel) return;
    
    showConfirm('Hapus pengeluaran ini?', () => {
        travel.expenses = travel.expenses.filter(e => e.id !== expenseId);
        saveDataToLocalStorage();
        openTravelDetail(travelId);
        renderTravels();
    });
}

function renderTravelExpensesTable(travel) {
    const tbody = document.getElementById('te-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    const expenses = travel.expenses || [];
    if (expenses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-list" style="text-align:center;">Belum ada pengeluaran dicatat.</td></tr>';
        return;
    }
    
    expenses.forEach(e => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td data-label="Keterangan">${e.note}</td>
            <td data-label="Kategori"><span class="badge badge-expense">${e.category}</span></td>
            <td data-label="Jumlah">${formatCurrency(e.amount, 'IDR')}</td>
            <td data-label="Aksi">
                <button class="btn btn-danger btn-sm" onclick="deleteTravelExpense('${e.id}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterTravels() {
    renderTravels();
}

/* ==========================================
   CHAKRA PARTICLES ANIMATION (LOGIN PAGE)
   ========================================== */
function initChakraParticles() {
    const canvas = document.getElementById('chakra-particles');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;
    
    window.addEventListener('resize', () => {
        if (!canvas) return;
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    });
    
    const particles = [];
    const maxParticles = 65;
    
    class Particle {
        constructor() {
            this.reset();
        }
        reset() {
            this.x = Math.random() * width;
            this.y = height + Math.random() * 50;
            this.size = Math.random() * 3 + 1.2;
            this.speedY = -(Math.random() * 1.6 + 0.6);
            this.speedX = (Math.random() - 0.5) * 0.8;
            this.opacity = Math.random() * 0.55 + 0.3;
            const colors = ['#ff4500', '#ff7a00', '#ffaa00', '#ff1a00'];
            this.color = colors[Math.floor(Math.random() * colors.length)];
        }
        update() {
            this.y += this.speedY;
            this.x += this.speedX;
            this.opacity -= 0.0025;
            
            if (this.y < -10 || this.opacity <= 0 || this.x < -10 || this.x > width + 10) {
                this.reset();
            }
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.shadowBlur = 12;
            ctx.shadowColor = this.color;
            ctx.globalAlpha = this.opacity;
            ctx.fill();
        }
    }
    
    for (let i = 0; i < maxParticles; i++) {
        particles.push(new Particle());
    }
    
    function animate() {
        const loginContainer = document.getElementById('login-container');
        if (!loginContainer || loginContainer.style.display === 'none') {
            requestAnimationFrame(animate);
            return;
        }
        
        ctx.clearRect(0, 0, width, height);
        ctx.shadowBlur = 0;
        
        particles.forEach(p => {
            p.update();
            p.draw();
        });
        
        requestAnimationFrame(animate);
    }
    
    animate();
}

/* ==========================================
   NOTEPAD / BUKU CATATAN MANAGEMENT
   ========================================== */
function saveNote(e) {
    e.preventDefault();
    const idInput = document.getElementById('edit-note-id').value;
    const title = document.getElementById('note-title').value.trim();
    const tag = document.getElementById('note-tag').value;
    const content = document.getElementById('note-content').value.trim();
    
    if (idInput) {
        const note = state.notes.find(n => n.id === idInput);
        if (note) {
            note.title = title;
            note.tag = tag;
            note.content = content;
            note.date = new Date().toISOString().split('T')[0];
        }
    } else {
        const newNote = {
            id: 'note-' + Date.now(),
            title: title,
            tag: tag,
            content: content,
            date: new Date().toISOString().split('T')[0]
        };
        state.notes.push(newNote);
    }
    
    saveDataToLocalStorage();
    closeModal('noteModal');
    renderNotes();
}

function renderNotes() {
    const container = document.getElementById('notes-grid-container');
    if (!container) return;
    
    const query = (document.getElementById('search-notes')?.value || '').toLowerCase().trim();
    container.innerHTML = '';
    
    const filtered = state.notes.filter(n => 
        n.title.toLowerCase().includes(query) || 
        n.content.toLowerCase().includes(query) ||
        n.tag.toLowerCase().includes(query)
    );
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-list" style="grid-column: 1/-1; text-align:center; padding: 2rem;">Belum ada catatan disimpan.</div>';
        return;
    }
    
    filtered.forEach(n => {
        const card = document.createElement('div');
        card.className = 'note-card';
        
        let tagColor = 'var(--text-muted)';
        if (n.tag === 'Penting') tagColor = 'var(--color-danger)';
        else if (n.tag === 'Ide') tagColor = 'var(--accent-gold)';
        else if (n.tag === 'Pribadi') tagColor = 'var(--color-success)';
        else if (n.tag === 'Pekerjaan') tagColor = 'var(--accent-orange)';
        
        card.innerHTML = `
            <div class="note-card-header">
                <span class="note-card-tag" style="border: 1px solid ${tagColor}; color: ${tagColor};">${n.tag}</span>
                <div class="note-card-actions">
                    <button class="note-card-action-btn" onclick="openEditNote('${n.id}', event)"><i class="fa-solid fa-pen"></i></button>
                    <button class="note-card-action-btn btn-delete" onclick="deleteNote('${n.id}', event)"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
            <div class="note-card-body" onclick="openEditNote('${n.id}', event)">
                <h4 class="note-card-title">${n.title}</h4>
                <p class="note-card-desc">${n.content.replace(/\n/g, '<br>')}</p>
                <div class="note-card-date">${formatDateStr(n.date)}</div>
            </div>
        `;
        container.appendChild(card);
    });
}

function deleteNote(id, event) {
    if (event) event.stopPropagation();
    showConfirm('Hapus catatan ini?', () => {
        state.notes = state.notes.filter(n => n.id !== id);
        saveDataToLocalStorage();
        renderNotes();
    });
}

function openEditNote(id, event) {
    if (event) event.stopPropagation();
    const note = state.notes.find(n => n.id === id);
    if (!note) return;
    
    document.getElementById('edit-note-id').value = note.id;
    document.getElementById('note-title').value = note.title;
    document.getElementById('note-tag').value = note.tag;
    document.getElementById('note-content').value = note.content;
    
    openModal('noteModal');
}

function filterNotes() {
    renderNotes();
}

// GLOBAL KEYBOARD SHORTCUTS (ESC & SPACE)
document.addEventListener('keydown', (e) => {
    // ESC: Menutup modal aktif (atau batalkan konfirmasi)
    if (e.key === 'Escape') {
        const activeModal = document.querySelector('.modal.active');
        if (activeModal) {
            e.preventDefault();
            const modalId = activeModal.id;
            if (modalId === 'confirmModal') {
                const cancelBtn = document.getElementById('confirm-cancel-btn');
                if (cancelBtn) cancelBtn.click();
            } else {
                closeModal(modalId);
            }
        }
    }
    
    // SPASI: Buka/Tutup Transaksi Baru (jika sudah masuk) atau Play/Pause Video Naruto (jika di halaman depan)
    if (e.key === ' ' || e.key === 'Spacebar') {
        // Jangan jalankan jika user sedang mengetik di kolom input/textarea
        const targetTag = e.target.tagName.toLowerCase();
        if (targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select' || e.target.isContentEditable) {
            return;
        }
        
        e.preventDefault(); // Cegah halaman scroll otomatis saat tekan spasi
        
        const isLogged = sessionStorage.getItem('heist_authorized') === 'true';
        if (isLogged) {
            const txModal = document.getElementById('transactionModal');
            if (txModal && txModal.classList.contains('active')) {
                closeModal('transactionModal');
            } else {
                openModal('transactionModal');
            }
        } else {
            // Play/Pause video Naruto Kyubi di login portal
            const video = document.querySelector('.login-video-bg');
            if (video) {
                if (video.paused) {
                    video.play();
                } else {
                    video.pause();
                }
            }
        }
    }
});