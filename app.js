/* ==========================================
   GLOBAL ERROR CATCHER (LOG ONLY)
   ========================================== */
window.onerror = function(message, source, lineno, colno, error) {
    console.error("Uncaught Error: " + message + " at line " + lineno + " (col " + colno + ")");
    return false;
};
window.onunhandledrejection = function(event) {
    console.error("Unhandled Promise Rejection: " + event.reason);
};

/* ==========================================
   APP STATE & INITIAL DATA
   ========================================== */
let state = {
    transactions: [],
    loans: [],
    travels: [],
    notes: [],
    goals: [],
    archives: []
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
        checkAndAutoArchive();
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

        const goalsData = state.goals.map(g => [
            g.id,
            g.name,
            g.target,
            g.balance,
            g.currency || 'IDR',
            g.category || 'Tabungan',
            JSON.stringify(g.history)
        ]);

        const archivesData = state.archives.map(a => [
            a.id,
            a.month,
            a.year,
            a.label,
            a.archivedAt,
            a.summary.totalIncome,
            a.summary.totalExpense,
            a.summary.netBalance,
            a.summary.transactionCount,
            JSON.stringify(a.transactions)
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

        await fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'saveAll',
                sheet: 'PosDana',
                data: goalsData
            })
        });

        await fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'saveAll',
                sheet: 'Arsip',
                data: archivesData
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
                interestRate: isNaN(parseFloat(row[5])) ? 20 : parseFloat(row[5]),
                date: row[8] || new Date().toISOString().split('T')[0],
                dueDate: row[8],
                tenor: parseInt(row[7]) || 1,
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

    // 5. Pos Dana (Saving Goals)
    try {
        const responseGoals = await fetch(`${API_URL}?sheet=PosDana`);
        const jsonGoals = await responseGoals.json();
        if (jsonGoals.status === 'success' && jsonGoals.data) {
            state.goals = jsonGoals.data.map(row => ({
                id: row[0],
                name: row[1],
                target: parseFloat(row[2]) || 0,
                balance: parseFloat(row[3]) || 0,
                currency: row[4] || 'IDR',
                category: row[5] || 'Tabungan',
                history: row[6] ? JSON.parse(row[6]) : []
            }));
            localStorage.setItem('fina_goals', JSON.stringify(state.goals));
        }
    } catch (e) {
        console.error("Gagal memuat sheet PosDana:", e);
        errorsCount++;
    }

    // 6. Arsip Bulanan (Monthly Archives)
    try {
        const responseArch = await fetch(`${API_URL}?sheet=Arsip`);
        const jsonArch = await responseArch.json();
        if (jsonArch.status === 'success' && jsonArch.data) {
            state.archives = jsonArch.data.map(row => ({
                id: row[0],
                month: parseInt(row[1]) || 1,
                year: parseInt(row[2]) || 2026,
                label: row[3],
                archivedAt: row[4] || new Date().toISOString(),
                summary: {
                    totalIncome: parseFloat(row[5]) || 0,
                    totalExpense: parseFloat(row[6]) || 0,
                    netBalance: parseFloat(row[7]) || 0,
                    transactionCount: parseInt(row[8]) || 0
                },
                transactions: row[9] ? JSON.parse(row[9]) : []
            }));
            localStorage.setItem('fina_archives', JSON.stringify(state.archives));
        }
    } catch (e) {
        console.error("Gagal memuat sheet Arsip:", e);
        errorsCount++;
    }

    isSyncing = false;
    if (errorsCount === 6) {
        showSyncStatus("Gagal sinkron online, memuat data lokal", true);
        updateDashboardUI();
    } else if (errorsCount > 0) {
        showSyncStatus(`Sinkron sebagian (${6 - errorsCount}/6 sukses)`, false);
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
    if (document.getElementById('goals-section')?.classList.contains('active')) {
        renderGoals();
    }
}

function loadDataFromLocalStorage() {
    const savedTransactions = localStorage.getItem('fina_transactions');
    const savedLoans = localStorage.getItem('fina_loans');
    const savedTravels = localStorage.getItem('fina_travels');
    const savedNotes = localStorage.getItem('fina_notes');
    const savedGoals = localStorage.getItem('fina_goals');
    
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

    try {
        if (savedGoals) state.goals = JSON.parse(savedGoals);
    } catch(e) {
        console.error("Gagal membaca pos dana lokal:", e);
        state.goals = [];
    }

    const savedArchives = localStorage.getItem('fina_archives');
    try {
        if (savedArchives) state.archives = JSON.parse(savedArchives);
    } catch(e) {
        console.error("Gagal membaca arsip lokal:", e);
        state.archives = [];
    }

    loadFromGoogleSheets();
}

function saveDataToLocalStorage() {
    localStorage.setItem('fina_transactions', JSON.stringify(state.transactions));
    localStorage.setItem('fina_loans', JSON.stringify(state.loans));
    localStorage.setItem('fina_travels', JSON.stringify(state.travels));
    localStorage.setItem('fina_notes', JSON.stringify(state.notes));
    localStorage.setItem('fina_goals', JSON.stringify(state.goals));
    localStorage.setItem('fina_archives', JSON.stringify(state.archives));
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
    } else if (sectionId === 'goals-section') {
        renderGoals();
    } else if (sectionId === 'archives-section') {
        renderArchives();
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
    } else if (modalId === 'goalModal') {
        document.getElementById('goal-form').reset();
    } else if (modalId === 'goalActionModal') {
        document.getElementById('goal-action-form').reset();
        removeProofPhoto();
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

function formatInputGoalTarget(input) {
    const cat = document.getElementById('goal-category')?.value;
    if (cat === 'Emas') {
        // Hanya izinkan angka dan titik desimal
        input.value = input.value.replace(/[^0-9.]/g, '');
        const parts = input.value.split('.');
        if (parts.length > 2) {
            input.value = parts[0] + '.' + parts.slice(1).join('');
        }
    } else {
        formatInputCurrency(input);
    }
}

function calculateGoldTotal() {
    const gramsEl = document.getElementById('goal-action-grams');
    const priceEl = document.getElementById('goal-action-price-gram');
    const amountEl = document.getElementById('goal-action-amount');
    
    if (!gramsEl || !priceEl || !amountEl) return;
    
    const grams = parseFloat(gramsEl.value) || 0;
    const price = parseFormattedNumber(priceEl.value) || 0;
    const total = Math.round(grams * price);
    
    if (total > 0) {
        amountEl.value = new Intl.NumberFormat('id-ID').format(total);
    } else {
        amountEl.value = '';
    }
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
    
    // Hitung transaksi aktif
    state.transactions.forEach(t => {
        const tCurr = t.currency || 'IDR';
        if (tCurr === currencyCode) {
            if (t.type === 'masuk') incomeSum += t.amount;
            else if (t.type === 'keluar') expenseSum += t.amount;
        }
    });

    // Hitung transaksi dari arsip bulanan (agar saldo total tetap akurat)
    if (state.archives && state.archives.length > 0) {
        state.archives.forEach(archive => {
            if (archive.transactions) {
                archive.transactions.forEach(t => {
                    const tCurr = t.currency || 'IDR';
                    if (tCurr === currencyCode) {
                        if (t.type === 'masuk') incomeSum += t.amount;
                        else if (t.type === 'keluar') expenseSum += t.amount;
                    }
                });
            }
        });
    }

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

    // Hitung total saldo yang teralokasi di Pos Dana (tabungan kurban, dll)
    let totalAllocatedGoals = 0;
    if (state.goals) {
        state.goals.forEach(g => {
            if ((g.currency || 'IDR') === currencyCode) {
                totalAllocatedGoals += g.balance || 0;
            }
        });
    }

    return {
        balance: incomeSum - expenseSum - totalAllocatedGoals,
        income: incomeSum,
        expense: expenseSum,
        loans: activeLoans,
        savings: totalAllocatedGoals
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

function updateVisibilityButtonUI(isHidden) {
    const btn = document.getElementById('btn-toggle-visibility');
    if (!btn) return;
    
    const icon = btn.querySelector('i');
    const textSpan = document.getElementById('toggle-visibility-text');
    
    if (isHidden) {
        if (icon) {
            icon.className = 'fa-solid fa-eye';
        }
        if (textSpan) {
            textSpan.textContent = 'Tampilkan Detail';
        }
    } else {
        if (icon) {
            icon.className = 'fa-solid fa-eye-slash';
        }
        if (textSpan) {
            textSpan.textContent = 'Sensor Detail';
        }
    }
}

function toggleNominalVisibility() {
    const isCurrentlyHidden = localStorage.getItem('fina_hide_details') !== 'false';
    const newHiddenState = !isCurrentlyHidden;
    localStorage.setItem('fina_hide_details', newHiddenState ? 'true' : 'false');
    
    updateVisibilityButtonUI(newHiddenState);
    updateDashboardUI();
}

function updateDashboardUI() {
    const fin = calculateFinancials(activeCurrency);
    const isHidden = localStorage.getItem('fina_hide_details') !== 'false'; // Default to true (hidden) if not set
    
    updateVisibilityButtonUI(isHidden);
    const maskText = '••••••';
    
    document.getElementById('total-balance').textContent = formatCurrency(fin.balance, activeCurrency);
    document.getElementById('total-income').textContent = isHidden ? maskText : formatCurrency(fin.income, activeCurrency);
    document.getElementById('total-expense').textContent = isHidden ? maskText : formatCurrency(fin.expense, activeCurrency);
    document.getElementById('total-loans').textContent = isHidden ? maskText : formatCurrency(fin.loans, activeCurrency);
    document.getElementById('total-savings').textContent = isHidden ? maskText : formatCurrency(fin.savings, activeCurrency);

    const balEl = document.getElementById('total-balance');
    if (fin.balance < 0) {
        balEl.style.color = 'var(--color-danger)';
    } else {
        balEl.style.color = 'var(--text-primary)';
    }

    // Hitung performa kas bulan berjalan
    const now = new Date();
    const thisMonth = now.getMonth() + 1;
    const thisYear = now.getFullYear();
    let thisMonthIncome = 0;
    let thisMonthExpense = 0;
    
    state.transactions.forEach(t => {
        const tCurr = t.currency || 'IDR';
        if (tCurr === activeCurrency && t.date) {
            const d = new Date(t.date);
            if (d.getMonth() + 1 === thisMonth && d.getFullYear() === thisYear) {
                if (t.type === 'masuk') thisMonthIncome += t.amount;
                else if (t.type === 'keluar') thisMonthExpense += t.amount;
            }
        }
    });
    
    const monthlyNet = thisMonthIncome - thisMonthExpense;
    const netPrefix = monthlyNet > 0 ? '+' : '';
    const compEl = document.getElementById('monthly-comparison-status');
    if (compEl) {
        if (isHidden) {
            compEl.textContent = maskText;
            compEl.style.color = '#ffffff';
        } else {
            compEl.textContent = `${netPrefix}${formatCurrency(monthlyNet, activeCurrency)}`;
            if (monthlyNet > 0) {
                compEl.style.color = 'var(--accent-green)';
            } else if (monthlyNet < 0) {
                compEl.style.color = 'var(--accent-red)';
            } else {
                compEl.style.color = '#ffffff';
            }
        }
    }

    renderBudgetingUI(isHidden, maskText);
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
                date: l.date || l.dueDate || new Date().toISOString().split('T')[0],
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

function filterLoans() {
    renderLoanTable();
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
            <td data-label="Pihak / Nama"><strong>${l.name}</strong>${l.note ? `<br><small style="color:var(--text-muted);">${l.note}</small>` : ''}</td>
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

/* ==========================================
   POS KEUANGAN (SAVING GOALS) OPERATIONS
   ========================================== */
let tempProofPhotoBase64 = null;

function previewProofImage(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        tempProofPhotoBase64 = e.target.result;
        const previewImg = document.getElementById('proof-photo-preview');
        const previewContainer = document.querySelector('.proof-photo-preview-container');
        const statusText = document.getElementById('proof-upload-status');
        
        if (previewImg && previewContainer) {
            previewImg.src = tempProofPhotoBase64;
            previewContainer.style.display = 'block';
        }
        if (statusText) {
            statusText.textContent = "Bukti Terpilih";
        }
    };
    reader.readAsDataURL(file);
}

function removeProofPhoto() {
    const fileInput = document.getElementById('goal-action-proof');
    if (fileInput) fileInput.value = '';
    
    tempProofPhotoBase64 = null;
    
    const previewImg = document.getElementById('proof-photo-preview');
    const previewContainer = document.querySelector('.proof-photo-preview-container');
    const statusText = document.getElementById('proof-upload-status');
    
    if (previewImg) previewImg.src = '';
    if (previewContainer) previewContainer.style.display = 'none';
    if (statusText) statusText.textContent = "Pilih Foto Bukti";
}

function viewProof(base64Str) {
    const img = document.getElementById('proof-view-img');
    if (img) {
        img.src = base64Str;
        openModal('proofViewModal');
    }
}

function renderGoals() {
    const container = document.getElementById('goals-grid-container');
    if (!container) return;

    // Filter goals berdasarkan pencarian
    const searchQuery = (document.getElementById('search-goals')?.value || '').toLowerCase();
    const filtered = state.goals.filter(g => {
        const matchesSearch = g.name.toLowerCase().includes(searchQuery) || (g.category || '').toLowerCase().includes(searchQuery);
        const matchesCurrency = (g.currency || 'IDR') === activeCurrency;
        return matchesSearch && matchesCurrency;
    });

    // Update kartu ringkasan pos keuangan
    let totalTarget = 0;
    let totalBalance = 0;

    state.goals.forEach(g => {
        if ((g.currency || 'IDR') === activeCurrency) {
            totalTarget += g.target || 0;
            totalBalance += g.balance || 0;
        }
    });

    const totalRemaining = Math.max(0, totalTarget - totalBalance);

    document.getElementById('goals-total-target').textContent = formatCurrency(totalTarget, activeCurrency);
    document.getElementById('goals-total-balance').textContent = formatCurrency(totalBalance, activeCurrency);
    document.getElementById('goals-total-remaining').textContent = formatCurrency(totalRemaining, activeCurrency);

    // Handling jika kosong
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-list" style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">Belum ada pos keuangan terdaftar untuk mata uang ' + activeCurrency + '.</div>';
        return;
    }

    container.innerHTML = '';
    filtered.forEach(g => {
        const card = document.createElement('div');
        card.className = 'goal-card';

        // Ikon dan warna per kategori
        let icon = 'fa-solid fa-coins';
        let glowClass = 'glow-blue';
        let catText = 'Tabungan / Arisan';

        if (g.category === 'Emergency') {
            icon = 'fa-solid fa-shield-halved';
            glowClass = 'glow-red';
            catText = 'Dana Darurat';
        } else if (g.category === 'Investasi') {
            icon = 'fa-solid fa-chart-line';
            glowClass = 'glow-green';
            catText = 'Investasi / Aset';
        } else if (g.category === 'Hiburan') {
            icon = 'fa-solid fa-umbrella-beach';
            glowClass = 'glow-yellow';
            catText = 'Kesenangan / Liburan';
        } else if (g.category === 'Kebutuhan') {
            icon = 'fa-solid fa-cart-shopping';
            glowClass = 'glow-purple';
            catText = 'Target Pembelian';
        } else if (g.category === 'Emas') {
            icon = 'fa-solid fa-coins';
            glowClass = 'glow-gold';
            catText = 'Tabungan Emas';
        }

        const formattedBalance = formatCurrency(g.balance, g.currency);

        let progressHTML = '';
        if (g.category === 'Emas') {
            const grams = g.goldGrams || 0;
            const formattedGrams = grams.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 3 }) + ' gr';
            const costBasis = g.balance || 0;
            const avgPrice = grams > 0 ? Math.round(costBasis / grams) : 0;
            
            let targetText = '';
            let barFillHTML = '';
            
            if (g.target && g.target > 0) {
                const targetGrams = g.target;
                const percentage = Math.min(100, Math.round((grams / targetGrams) * 100));
                targetText = `Target: ${targetGrams.toLocaleString('id-ID')} gr`;
                barFillHTML = `
                    <div class="goal-progress-info">
                        <span>${formattedGrams} terkumpul</span>
                        <span>${percentage}%</span>
                    </div>
                    <div class="goal-progress-bar-bg">
                        <div class="goal-progress-bar-fill ${glowClass}" style="width: ${percentage}%;"></div>
                    </div>
                `;
            } else {
                barFillHTML = `
                    <div style="font-size: 0.85rem; font-weight: 700; color: #ffffff; text-align: center; margin-bottom: 0.5rem;">
                        ${formattedGrams} terkumpul
                    </div>
                    <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600; padding: 0.5rem; background: rgba(255,255,255,0.03); border-radius: 8px; text-align: center; border: 1px dashed var(--border-color); margin-bottom: 0.5rem;">
                        <i class="fa-solid fa-infinity"></i> Tanpa Target Batas Emas
                    </div>
                `;
            }
            
            progressHTML = `
                <div class="goal-progress-container">
                    ${barFillHTML}
                    <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--text-muted); margin-top: 0.35rem; font-weight: 600;">
                        <span>Modal: ${formatCurrency(costBasis, g.currency)}</span>
                        <span>${avgPrice > 0 ? 'Avg: ' + formatCurrency(avgPrice, g.currency) + '/gr' : ''}</span>
                    </div>
                    ${g.target && g.target > 0 ? '<div style="font-size: 0.7rem; color: var(--text-muted); text-align: right; margin-top: 0.15rem; font-weight: 600;">' + targetText + '</div>' : ''}
                </div>
            `;
        } else {
            if (g.target && g.target > 0) {
                const percentage = Math.min(100, Math.round(((g.balance || 0) / (g.target || 1)) * 100));
                const formattedTarget = formatCurrency(g.target, g.currency);
                progressHTML = `
                    <div class="goal-progress-container">
                        <div class="goal-progress-info">
                            <span>${formattedBalance} terkumpul</span>
                            <span>${percentage}%</span>
                        </div>
                        <div class="goal-progress-bar-bg">
                            <div class="goal-progress-bar-fill ${glowClass}" style="width: ${percentage}%;"></div>
                        </div>
                        <div style="font-size: 0.7rem; color: var(--text-muted); text-align: right; margin-top: 0.35rem; font-weight: 600;">
                            Target: ${formattedTarget}
                        </div>
                    </div>
                `;
            } else {
                progressHTML = `
                    <div class="goal-progress-container" style="margin: 1.5rem 0;">
                        <div style="font-size: 0.85rem; font-weight: 700; color: #ffffff; text-align: center; margin-bottom: 0.5rem;">
                            ${formattedBalance} terkumpul
                        </div>
                        <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600; padding: 0.5rem; background: rgba(255,255,255,0.03); border-radius: 8px; text-align: center; border: 1px dashed var(--border-color);">
                            <i class="fa-solid fa-infinity"></i> Tanpa Target Batas Dana
                        </div>
                    </div>
                `;
            }
        }

        card.innerHTML = `
            <div class="goal-card-header">
                <div>
                    <h4 class="goal-card-title">${g.name}</h4>
                    <span class="goal-card-category category-${(g.category || 'Tabungan').toLowerCase()}">${catText}</span>
                </div>
                <div class="goal-card-icon category-${(g.category || 'Tabungan').toLowerCase()}">
                    <i class="${icon}"></i>
                </div>
            </div>
            
            ${progressHTML}

            <div class="goal-card-actions">
                <button class="goal-btn goal-btn-deposit" onclick="openGoalActionModal('${g.id}', 'deposit')">
                    <i class="fa-solid fa-circle-plus"></i> Setor
                </button>
                <button class="goal-btn goal-btn-withdraw" onclick="openGoalActionModal('${g.id}', 'withdraw')">
                    <i class="fa-solid fa-circle-minus"></i> Tarik
                </button>
                <button class="goal-btn goal-btn-history" title="Lihat Riwayat" onclick="openGoalHistoryModal('${g.id}')">
                    <i class="fa-solid fa-history"></i>
                </button>
                <button class="goal-btn goal-btn-danger" title="Hapus Pos" onclick="deleteGoal('${g.id}')">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
        container.appendChild(card);
    });
}

function filterGoals() {
    renderGoals();
}

function saveGoal(e) {
    e.preventDefault();
    const name = document.getElementById('goal-name').value;
    const currency = document.getElementById('goal-currency').value;
    const category = document.getElementById('goal-category').value;
    
    const targetInput = document.getElementById('goal-target').value;
    const target = targetInput ? (category === 'Emas' ? parseFloat(targetInput) : parseFormattedNumber(targetInput)) : 0;
    
    const initial = parseFormattedNumber(document.getElementById('goal-initial').value) || 0;

    // Validasi setoran awal tidak boleh melebihi saldo bebas utama saat ini
    const fin = calculateFinancials(currency);
    if (initial > 0 && initial > fin.balance) {
        alert(`Gagal! Setoran awal (${formatCurrency(initial, currency)}) melebihi Saldo Bebas Utama Anda (${formatCurrency(fin.balance, currency)}).`);
        return;
    }

    const newGoalId = `goal-${Date.now()}`;
    const newGoal = {
        id: newGoalId,
        name,
        target,
        balance: 0,
        currency,
        category,
        goldGrams: 0,
        history: []
    };

    if (initial > 0) {
        newGoal.balance = initial;
        newGoal.history.push({
            id: `log-${Date.now()}`,
            date: new Date().toISOString().split('T')[0],
            type: 'deposit',
            proof: null,
            amount: initial,
            goldGrams: 0,
            goldPricePerGram: 0,
            note: 'Setoran dana awal pos keuangan'
        });
    }

    state.goals.push(newGoal);
    saveDataToLocalStorage();
    closeModal('goalModal');
    changeDashboardCurrency(currency);
    
    if (document.getElementById('goals-section').classList.contains('active')) {
        renderGoals();
    }
}

function openGoalActionModal(goalId, type) {
    const goal = state.goals.find(g => g.id === goalId);
    if (!goal) return;

    document.getElementById('goal-action-id').value = goalId;
    document.getElementById('goal-action-type').value = type;
    document.getElementById('goal-action-amount').value = '';
    document.getElementById('goal-action-note').value = '';
    document.getElementById('goal-action-date').value = new Date().toISOString().split('T')[0];
    
    const goldContainer = document.getElementById('gold-inputs-container');
    const gramsInput = document.getElementById('goal-action-grams');
    const priceInput = document.getElementById('goal-action-price-gram');
    const amountInput = document.getElementById('goal-action-amount');

    if (gramsInput) gramsInput.value = '';
    if (priceInput) priceInput.value = '';

    if (goal.category === 'Emas') {
        if (goldContainer) goldContainer.style.display = 'block';
        if (amountInput) {
            amountInput.readOnly = true;
            amountInput.placeholder = 'Otomatis dihitung...';
        }
    } else {
        if (goldContainer) goldContainer.style.display = 'none';
        if (amountInput) {
            amountInput.readOnly = false;
            amountInput.placeholder = 'Nominal...';
        }
    }

    removeProofPhoto();

    const titleEl = document.getElementById('goal-action-title');
    const labelEl = document.getElementById('goal-action-label');
    const submitBtn = document.getElementById('goal-action-submit-btn');

    if (type === 'deposit') {
        titleEl.textContent = `Setor Dana ke: ${goal.name}`;
        labelEl.textContent = goal.category === 'Emas' ? `Total Nilai Pembelian (${goal.currency})` : `Nominal Setoran (${goal.currency})`;
        submitBtn.textContent = 'Proses Setoran';
        submitBtn.className = 'btn btn-primary';
    } else {
        titleEl.textContent = `Tarik Dana dari: ${goal.name}`;
        labelEl.textContent = goal.category === 'Emas' ? `Total Nilai Penjualan (${goal.currency})` : `Nominal Penarikan (${goal.currency})`;
        submitBtn.textContent = 'Proses Penarikan';
        submitBtn.className = 'btn btn-secondary';
    }

    openModal('goalActionModal');
}

function handleGoalAction(e) {
    e.preventDefault();
    const goalId = document.getElementById('goal-action-id').value;
    const type = document.getElementById('goal-action-type').value;
    const amount = parseFormattedNumber(document.getElementById('goal-action-amount').value) || 0;
    const date = document.getElementById('goal-action-date').value;
    
    const goal = state.goals.find(g => g.id === goalId);
    if (!goal) return;

    let grams = 0;
    let pricePerGram = 0;
    let note = document.getElementById('goal-action-note').value;

    if (goal.category === 'Emas') {
        grams = parseFloat(document.getElementById('goal-action-grams').value) || 0;
        pricePerGram = parseFormattedNumber(document.getElementById('goal-action-price-gram').value) || 0;
        
        if (grams <= 0 || pricePerGram <= 0) {
            alert('Jumlah gram dan harga per gram harus diisi!');
            return;
        }
        
        if (!note) {
            note = type === 'deposit' 
                ? `Beli ${grams} gr emas @ ${formatCurrency(pricePerGram, goal.currency)}/gr`
                : `Jual ${grams} gr emas @ ${formatCurrency(pricePerGram, goal.currency)}/gr`;
        }
    } else {
        if (!note) {
            note = type === 'deposit' ? 'Setor dana pos' : 'Tarik dana pos';
        }
    }

    if (amount <= 0) {
        alert('Nominal total harus lebih dari 0!');
        return;
    }

    const fin = calculateFinancials(goal.currency);

    if (type === 'deposit') {
        // Validasi ketersediaan saldo utama untuk disetor
        if (amount > fin.balance) {
            alert(`Gagal! Saldo Bebas Utama Anda (${formatCurrency(fin.balance, goal.currency)}) tidak mencukupi untuk transaksi sebesar ${formatCurrency(amount, goal.currency)}.`);
            return;
        }
        goal.balance += amount;
        if (goal.category === 'Emas') {
            goal.goldGrams = (goal.goldGrams || 0) + grams;
        }
    } else {
        // Validasi ketersediaan saldo untuk ditarik
        if (goal.category === 'Emas') {
            if (grams > (goal.goldGrams || 0)) {
                alert(`Gagal! Saldo emas Anda (${(goal.goldGrams || 0).toLocaleString('id-ID')} gr) tidak mencukupi untuk ditarik sebesar ${grams.toLocaleString('id-ID')} gr.`);
                return;
            }
            goal.goldGrams = (goal.goldGrams || 0) - grams;
        } else {
            if (amount > goal.balance) {
                alert(`Gagal! Saldo di pos dana ${goal.name} (${formatCurrency(goal.balance, goal.currency)}) tidak mencukupi untuk ditarik sebesar ${formatCurrency(amount, goal.currency)}.`);
                return;
            }
        }
        goal.balance -= amount;
    }

    // Tambah catatan riwayat mutasi pos
    goal.history.push({
        id: `log-${Date.now()}`,
        date,
        type,
        amount,
        goldGrams: grams,
        goldPricePerGram: pricePerGram,
        proof: tempProofPhotoBase64,
        note
    });

    saveDataToLocalStorage();
    closeModal('goalActionModal');
    
    if (document.getElementById('goals-section').classList.contains('active')) {
        renderGoals();
    }
    updateDashboardUI();
}

function deleteGoal(goalId) {
    const goal = state.goals.find(g => g.id === goalId);
    if (!goal) return;

    showConfirm(`Hapus pos keuangan "${goal.name}"? Sisa dana teralokasi (${formatCurrency(goal.balance, goal.currency)}) otomatis dikembalikan ke Saldo Bebas Utama Anda.`, () => {
        state.goals = state.goals.filter(g => g.id !== goalId);
        saveDataToLocalStorage();
        
        if (document.getElementById('goals-section').classList.contains('active')) {
            renderGoals();
        }
        updateDashboardUI();
    });
}

function openGoalHistoryModal(goalId) {
    const goal = state.goals.find(g => g.id === goalId);
    if (!goal) return;

    document.getElementById('goal-history-title').textContent = `Riwayat Dana: ${goal.name}`;
    const tbody = document.getElementById('goal-history-table-body');
    tbody.innerHTML = '';

    if (!goal.history || goal.history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-list" style="text-align:center;">Belum ada riwayat mutasi dana di pos ini.</td></tr>';
    } else {
        // Urutkan riwayat berdasarkan tanggal terbaru
        const sorted = [...goal.history].sort((a, b) => new Date(b.date) - new Date(a.date));
        sorted.forEach(h => {
            const tr = document.createElement('tr');
            const typeStr = h.type === 'deposit' ? 'Setor' : 'Tarik';
            const badgeClass = h.type === 'deposit' ? 'badge-income' : 'badge-expense';
            
            let proofHTML = '<span style="color: var(--text-muted); font-size: 0.75rem;">-</span>';
            if (h.proof) {
                proofHTML = `<button class="btn btn-xs btn-secondary" onclick="viewProof('${h.proof}')" style="padding: 2px 6px; font-size: 0.75rem; background-color: rgba(0, 200, 255, 0.15); color: #00c8ff; border: 1px solid rgba(0, 200, 255, 0.25); border-radius: 4px; cursor: pointer;"><i class="fa-solid fa-image"></i> Lihat</button>`;
            }
            
            let amountHTML = '';
            if (goal.category === 'Emas' && h.goldGrams) {
                amountHTML = `
                    <div style="font-weight: 700;">${h.goldGrams.toLocaleString('id-ID')} gr</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">(${formatCurrency(h.amount, goal.currency)})</div>
                `;
            } else {
                amountHTML = `<span style="font-weight: 700;">${formatCurrency(h.amount, goal.currency)}</span>`;
            }
            
            tr.innerHTML = `
                <td>${formatDateStr(h.date)}</td>
                <td><span class="badge ${badgeClass}">${typeStr}</span></td>
                <td>${amountHTML}</td>
                <td>${proofHTML}</td>
                <td>${h.note}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    openModal('goalHistoryModal');
}

/* ==========================================
   ARSIP BULANAN (MONTHLY ARCHIVES) OPERATIONS
   ========================================== */
const MONTH_NAMES_ID = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function getMonthLabel(month, year) {
    return `${MONTH_NAMES_ID[month]} ${year}`;
}

function getCurrentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function checkAndAutoArchive() {
    const lastMonth = localStorage.getItem('fina_last_active_month');
    const currentKey = getCurrentMonthKey();
    
    if (!lastMonth) {
        // Pertama kali → set bulan aktif sekarang tanpa arsip
        localStorage.setItem('fina_last_active_month', currentKey);
        return;
    }
    
    if (lastMonth === currentKey) return; // Masih bulan yang sama
    
    // Bulan berganti! Arsipkan transaksi bulan-bulan lalu yang belum terarsip
    const [lastYear, lastMonthNum] = lastMonth.split('-').map(Number);
    const [currYear, currMonthNum] = currentKey.split('-').map(Number);
    
    // Iterasi dari bulan lalu sampai bulan sebelum bulan sekarang
    let archiveDate = new Date(lastYear, lastMonthNum - 1, 1); // bulan lalu start
    const currentDate = new Date(currYear, currMonthNum - 1, 1); // bulan sekarang start
    
    let archivedMonths = [];
    
    while (archiveDate < currentDate) {
        const aMonth = archiveDate.getMonth() + 1;
        const aYear = archiveDate.getFullYear();
        const archiveId = `archive-${aYear}-${String(aMonth).padStart(2, '0')}`;
        
        // Skip jika sudah ada arsip untuk bulan ini
        if (!state.archives.find(a => a.id === archiveId)) {
            // Filter transaksi bulan ini
            const monthTransactions = state.transactions.filter(t => {
                if (!t.date) return false;
                const d = new Date(t.date);
                return d.getMonth() + 1 === aMonth && d.getFullYear() === aYear;
            });
            
            if (monthTransactions.length > 0) {
                // Hitung summary
                let totalIncome = 0, totalExpense = 0;
                monthTransactions.forEach(t => {
                    if (t.type === 'masuk') totalIncome += t.amount;
                    else if (t.type === 'keluar') totalExpense += t.amount;
                });
                
                const archive = {
                    id: archiveId,
                    month: aMonth,
                    year: aYear,
                    label: getMonthLabel(aMonth, aYear),
                    archivedAt: new Date().toISOString(),
                    summary: {
                        totalIncome,
                        totalExpense,
                        netBalance: totalIncome - totalExpense,
                        transactionCount: monthTransactions.length
                    },
                    transactions: JSON.parse(JSON.stringify(monthTransactions))
                };
                
                state.archives.push(archive);
                archivedMonths.push(archive.label);
                
                // Hapus transaksi bulan ini dari data aktif
                state.transactions = state.transactions.filter(t => {
                    if (!t.date) return true;
                    const d = new Date(t.date);
                    return !(d.getMonth() + 1 === aMonth && d.getFullYear() === aYear);
                });
            }
        }
        
        // Maju ke bulan berikutnya
        archiveDate.setMonth(archiveDate.getMonth() + 1);
    }
    
    // Update bulan aktif
    localStorage.setItem('fina_last_active_month', currentKey);
    
    if (archivedMonths.length > 0) {
        saveDataToLocalStorage();
        showArchiveNotification(archivedMonths);
    }
}

function showArchiveNotification(monthLabels) {
    const existing = document.querySelector('.archive-notification');
    if (existing) existing.remove();
    
    const monthList = monthLabels.join(', ');
    const notif = document.createElement('div');
    notif.className = 'archive-notification';
    notif.innerHTML = `
        <div class="archive-notification-icon">
            <i class="fa-solid fa-box-archive"></i>
        </div>
        <div class="archive-notification-text">
            Arsip otomatis berhasil!<br>
            Data <strong>${monthList}</strong> telah diarsipkan.
        </div>
    `;
    
    document.body.appendChild(notif);
    
    setTimeout(() => {
        notif.style.animation = 'slideInRight 0.4s ease reverse';
        setTimeout(() => notif.remove(), 400);
    }, 5000);
}

function renderArchives() {
    const container = document.getElementById('archives-grid-container');
    if (!container) return;
    
    // Update current month info card
    const now = new Date();
    const currentMonthLabel = getMonthLabel(now.getMonth() + 1, now.getFullYear());
    const displayEl = document.getElementById('current-month-display');
    if (displayEl) displayEl.textContent = currentMonthLabel;
    
    // Hitung stats bulan ini dari transaksi aktif
    const thisMonth = now.getMonth() + 1;
    const thisYear = now.getFullYear();
    let cmIncome = 0, cmExpense = 0, cmCount = 0;
    
    state.transactions.forEach(t => {
        if (!t.date) return;
        const d = new Date(t.date);
        if (d.getMonth() + 1 === thisMonth && d.getFullYear() === thisYear) {
            cmCount++;
            if (t.type === 'masuk') cmIncome += t.amount;
            else if (t.type === 'keluar') cmExpense += t.amount;
        }
    });
    
    const cmIncomeEl = document.getElementById('current-month-income');
    const cmExpenseEl = document.getElementById('current-month-expense');
    const cmCountEl = document.getElementById('current-month-tx-count');
    if (cmIncomeEl) cmIncomeEl.textContent = formatCurrency(cmIncome, activeCurrency);
    if (cmExpenseEl) cmExpenseEl.textContent = formatCurrency(cmExpense, activeCurrency);
    if (cmCountEl) cmCountEl.textContent = cmCount;
    
    // Render arsip grid
    if (!state.archives || state.archives.length === 0) {
        container.innerHTML = `<div class="empty-list" style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);"><i class="fa-solid fa-box-open" style="font-size: 2rem; margin-bottom: 1rem; display: block; opacity: 0.3;"></i>Belum ada arsip bulanan. Data akan otomatis diarsipkan saat pergantian bulan.</div>`;
        return;
    }
    
    // Urutkan arsip terbaru dulu
    const sorted = [...state.archives].sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
    });
    
    container.innerHTML = '';
    sorted.forEach(archive => {
        const card = document.createElement('div');
        card.className = 'archive-card';
        card.onclick = () => openArchiveDetail(archive.id);
        
        const net = archive.summary.netBalance;
        const netClass = net >= 0 ? 'positive' : 'negative';
        const netPrefix = net >= 0 ? '+' : '';
        
        card.innerHTML = `
            <div class="archive-card-header">
                <div class="archive-card-icon">
                    <i class="fa-solid fa-calendar-check"></i>
                </div>
                <div>
                    <h4 class="archive-card-title">${archive.label}</h4>
                    <div class="archive-card-date">Diarsipkan: ${formatDateStr(archive.archivedAt.split('T')[0])}</div>
                </div>
            </div>
            <div class="archive-card-stats">
                <div class="archive-card-stat">
                    <div class="archive-card-stat-label">Pemasukan</div>
                    <div class="archive-card-stat-value positive">${formatCurrency(archive.summary.totalIncome, activeCurrency)}</div>
                </div>
                <div class="archive-card-stat">
                    <div class="archive-card-stat-label">Pengeluaran</div>
                    <div class="archive-card-stat-value negative">${formatCurrency(archive.summary.totalExpense, activeCurrency)}</div>
                </div>
                <div class="archive-card-stat">
                    <div class="archive-card-stat-label">Selisih Bersih</div>
                    <div class="archive-card-stat-value ${netClass}">${netPrefix}${formatCurrency(Math.abs(net), activeCurrency)}</div>
                </div>
                <div class="archive-card-stat">
                    <div class="archive-card-stat-label">Jumlah Transaksi</div>
                    <div class="archive-card-stat-value">${archive.summary.transactionCount}</div>
                </div>
            </div>
            <div class="archive-card-footer">
                <div class="archive-card-tx-count"><i class="fa-solid fa-receipt" style="margin-right: 0.3rem;"></i>${archive.summary.transactionCount} transaksi tercatat</div>
                <div class="archive-card-view-btn">Lihat Detail <i class="fa-solid fa-chevron-right"></i></div>
            </div>
        `;
        container.appendChild(card);
    });
}

function openArchiveDetail(archiveId) {
    const archive = state.archives.find(a => a.id === archiveId);
    if (!archive) return;
    
    const titleEl = document.getElementById('archive-detail-title');
    if (titleEl) titleEl.textContent = `Arsip: ${archive.label}`;
    
    // Render summary stats
    const summaryEl = document.getElementById('archive-detail-summary');
    if (summaryEl) {
        const net = archive.summary.netBalance;
        const netClass = net >= 0 ? 'income-val' : 'expense-val';
        summaryEl.innerHTML = `
            <div class="archive-detail-stat">
                <div class="archive-detail-stat-label">Total Pemasukan</div>
                <div class="archive-detail-stat-value income-val">${formatCurrency(archive.summary.totalIncome, activeCurrency)}</div>
            </div>
            <div class="archive-detail-stat">
                <div class="archive-detail-stat-label">Total Pengeluaran</div>
                <div class="archive-detail-stat-value expense-val">${formatCurrency(archive.summary.totalExpense, activeCurrency)}</div>
            </div>
            <div class="archive-detail-stat">
                <div class="archive-detail-stat-label">Selisih Bersih</div>
                <div class="archive-detail-stat-value ${netClass}">${formatCurrency(net, activeCurrency)}</div>
            </div>
            <div class="archive-detail-stat">
                <div class="archive-detail-stat-label">Total Transaksi</div>
                <div class="archive-detail-stat-value net-val">${archive.summary.transactionCount}</div>
            </div>
        `;
    }
    
    // Render transactions table
    const tbody = document.getElementById('archive-detail-table-body');
    if (tbody) {
        tbody.innerHTML = '';
        if (!archive.transactions || archive.transactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-list" style="text-align:center;">Tidak ada transaksi di arsip ini.</td></tr>';
        } else {
            const sorted = [...archive.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
            sorted.forEach(t => {
                const tr = document.createElement('tr');
                const badgeClass = t.type === 'masuk' ? 'badge-income' : 'badge-expense';
                const typeLabel = t.type === 'masuk' ? 'Masuk' : 'Keluar';
                tr.innerHTML = `
                    <td>${formatDateStr(t.date)}</td>
                    <td><span class="badge ${badgeClass}">${typeLabel}</span></td>
                    <td>${t.category || '-'}</td>
                    <td style="font-weight: 700;">${formatCurrency(t.amount, t.currency || 'IDR')}</td>
                    <td>${t.note || '-'}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    }
    
    // Setup delete button
    const deleteBtn = document.getElementById('archive-delete-btn');
    if (deleteBtn) {
        deleteBtn.onclick = () => deleteArchive(archiveId);
    }
    
    openModal('archiveDetailModal');
}

function manualArchive() {
    const now = new Date();
    const thisMonth = now.getMonth() + 1;
    const thisYear = now.getFullYear();
    const archiveId = `archive-${thisYear}-${String(thisMonth).padStart(2, '0')}`;
    const label = getMonthLabel(thisMonth, thisYear);
    
    // Cek transaksi bulan ini
    const monthTransactions = state.transactions.filter(t => {
        if (!t.date) return false;
        const d = new Date(t.date);
        return d.getMonth() + 1 === thisMonth && d.getFullYear() === thisYear;
    });
    
    if (monthTransactions.length === 0) {
        alert('Tidak ada transaksi bulan ini untuk diarsipkan.');
        return;
    }
    
    // Cek duplikat
    const existing = state.archives.find(a => a.id === archiveId);
    if (existing) {
        showConfirm(`Arsip ${label} sudah ada (${existing.summary.transactionCount} transaksi). Ganti dengan data terbaru?`, () => {
            state.archives = state.archives.filter(a => a.id !== archiveId);
            executeManualArchive(archiveId, thisMonth, thisYear, label, monthTransactions);
        });
        return;
    }
    
    showConfirm(`Arsipkan semua ${monthTransactions.length} transaksi bulan ${label}? Data transaksi akan dipindahkan ke arsip dan dihapus dari Arus Kas aktif.`, () => {
        executeManualArchive(archiveId, thisMonth, thisYear, label, monthTransactions);
    });
}

function executeManualArchive(archiveId, month, year, label, monthTransactions) {
    let totalIncome = 0, totalExpense = 0;
    monthTransactions.forEach(t => {
        if (t.type === 'masuk') totalIncome += t.amount;
        else if (t.type === 'keluar') totalExpense += t.amount;
    });
    
    const archive = {
        id: archiveId,
        month,
        year,
        label,
        archivedAt: new Date().toISOString(),
        summary: {
            totalIncome,
            totalExpense,
            netBalance: totalIncome - totalExpense,
            transactionCount: monthTransactions.length
        },
        transactions: JSON.parse(JSON.stringify(monthTransactions))
    };
    
    state.archives.push(archive);
    
    // Hapus transaksi bulan ini dari aktif
    state.transactions = state.transactions.filter(t => {
        if (!t.date) return true;
        const d = new Date(t.date);
        return !(d.getMonth() + 1 === month && d.getFullYear() === year);
    });
    
    saveDataToLocalStorage();
    showArchiveNotification([label]);
    renderArchives();
    updateDashboardUI();
}

function deleteArchive(archiveId) {
    const archive = state.archives.find(a => a.id === archiveId);
    if (!archive) return;
    
    showConfirm(`Hapus arsip "${archive.label}" (${archive.summary.transactionCount} transaksi)? Data transaksi dalam arsip ini akan dikembalikan ke Arus Kas aktif.`, () => {
        if (archive.transactions && archive.transactions.length > 0) {
            state.transactions = state.transactions.concat(archive.transactions);
        }
        state.archives = state.archives.filter(a => a.id !== archiveId);
        saveDataToLocalStorage();
        closeModal('archiveDetailModal');
        renderArchives();
        updateDashboardUI();
    });
}

function toggleMobileMenu(show) {
    const overlay = document.getElementById('mobileMenuOverlay');
    const drawer = overlay?.querySelector('.mobile-menu-drawer');
    if (!overlay || !drawer) return;
    
    if (show) {
        overlay.style.display = 'block';
        setTimeout(() => {
            drawer.style.transform = 'translateY(0)';
        }, 10);
    } else {
        drawer.style.transform = 'translateY(100%)';
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 300);
    }
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




/* ==========================================
   50/30/20 BUDGETING ENGINE & UI RENDERER
   ========================================== */
function renderBudgetingUI(isHidden, maskText) {
    const plannedInput = document.getElementById('planned-salary-input');
    if (!plannedInput) return;

    // Load planned salary from localStorage (defaulting to 0)
    let plannedSalary = parseFloat(localStorage.getItem('fina_planned_income')) || 0;
    
    // Set formatted value to input if not active/focused
    if (document.activeElement !== plannedInput) {
        plannedInput.value = plannedSalary > 0 ? new Intl.NumberFormat('id-ID').format(plannedSalary) : '';
    }

    // Targets based on 50/30/20
    const targetNeeds = plannedSalary * 0.5;
    const targetWants = plannedSalary * 0.3;
    const targetSavings = plannedSalary * 0.2;

    // Calculate actuals for this month (activeCurrency only)
    const now = new Date();
    const thisMonth = now.getMonth() + 1;
    const thisYear = now.getFullYear();

    let actualNeeds = 0;
    let actualWants = 0;
    let actualSavings = 0;

    // 1. Calculate from Transactions (Expenses only)
    state.transactions.forEach(t => {
        const tCurr = t.currency || 'IDR';
        if (tCurr === activeCurrency && t.date) {
            const d = new Date(t.date);
            if (d.getMonth() + 1 === thisMonth && d.getFullYear() === thisYear && t.type === 'keluar') {
                const category = t.category || '';
                if (category === 'Kebutuhan Rumah' || category === 'Makanan' || category === 'Transportasi') {
                    actualNeeds += t.amount;
                } else if (category === 'Hiburan' || category === 'Belanja' || category === 'Lainnya') {
                    actualWants += t.amount;
                } else if (category === 'Investasi') {
                    actualSavings += t.amount;
                }
            }
        }
    });

    // 2. Calculate from goals (savings allocated to goals this month)
    state.goals.forEach(g => {
        const gCurr = g.currency || 'IDR';
        if (gCurr === activeCurrency && g.history) {
            g.history.forEach(h => {
                if (h.date) {
                    const d = new Date(h.date);
                    if (d.getMonth() + 1 === thisMonth && d.getFullYear() === thisYear) {
                        if (h.type === 'tambah') {
                            actualSavings += h.amount;
                        } else if (h.type === 'ambil') {
                            actualSavings -= h.amount;
                        }
                    }
                }
            });
        }
    });

    // 3. Calculate from loans (repayments made or received this month)
    state.loans.forEach(l => {
        const lCurr = l.currency || 'IDR';
        if (lCurr === activeCurrency && l.repayments) {
            l.repayments.forEach(r => {
                if (r.date) {
                    const d = new Date(r.date);
                    if (d.getMonth() + 1 === thisMonth && d.getFullYear() === thisYear) {
                        if (l.type === 'hutang') {
                            actualSavings += r.amount;
                        }
                    }
                }
            });
        }
    });

    // Render Targets
    document.getElementById('budget-needs-target').textContent = isHidden ? maskText : formatCurrency(targetNeeds, activeCurrency);
    document.getElementById('budget-wants-target').textContent = isHidden ? maskText : formatCurrency(targetWants, activeCurrency);
    document.getElementById('budget-savings-target').textContent = isHidden ? maskText : formatCurrency(targetSavings, activeCurrency);

    // Render Actuals
    document.getElementById('budget-needs-actual').textContent = isHidden ? maskText : formatCurrency(actualNeeds, activeCurrency);
    document.getElementById('budget-wants-actual').textContent = isHidden ? maskText : formatCurrency(actualWants, activeCurrency);
    document.getElementById('budget-savings-actual').textContent = isHidden ? maskText : formatCurrency(actualSavings, activeCurrency);

    // Progress percentage
    const pctNeeds = targetNeeds > 0 ? (actualNeeds / targetNeeds) * 100 : 0;
    const pctWants = targetWants > 0 ? (actualWants / targetWants) * 100 : 0;
    const pctSavings = targetSavings > 0 ? (actualSavings / targetSavings) * 100 : 0;

    // Render Percentages
    document.getElementById('budget-needs-percent').textContent = `${pctNeeds.toFixed(1)}% terpakai`;
    document.getElementById('budget-wants-percent').textContent = `${pctWants.toFixed(1)}% terpakai`;
    document.getElementById('budget-savings-percent').textContent = `${pctSavings.toFixed(1)}% terkumpul`;

    // Render Progress Bars
    const barNeeds = document.getElementById('budget-needs-progress');
    const barWants = document.getElementById('budget-wants-progress');
    const barSavings = document.getElementById('budget-savings-progress');

    barNeeds.style.width = `${Math.min(100, pctNeeds)}%`;
    barWants.style.width = `${Math.min(100, pctWants)}%`;
    barSavings.style.width = `${Math.min(100, pctSavings)}%`;

    // Render statuses and change bar color if exceeded/achieved
    const statusNeeds = document.getElementById('budget-needs-status');
    const statusWants = document.getElementById('budget-wants-status');
    const statusSavings = document.getElementById('budget-savings-status');

    // Needs
    if (plannedSalary === 0) {
        statusNeeds.textContent = 'Rencana gaji belum diset';
        statusNeeds.style.color = 'var(--text-muted)';
        barNeeds.style.background = 'linear-gradient(90deg, #0055ff, #00c8ff)';
    } else if (pctNeeds > 100) {
        statusNeeds.textContent = `Over-budget Rp ${new Intl.NumberFormat('id-ID').format(actualNeeds - targetNeeds)}`;
        statusNeeds.style.color = 'var(--accent-red)';
        barNeeds.style.background = 'linear-gradient(90deg, var(--accent-red), #ff3333)';
    } else {
        statusNeeds.textContent = `Sisa Rp ${new Intl.NumberFormat('id-ID').format(targetNeeds - actualNeeds)}`;
        statusNeeds.style.color = 'var(--accent-green)';
        barNeeds.style.background = 'linear-gradient(90deg, #0055ff, #00c8ff)';
    }

    // Wants
    if (plannedSalary === 0) {
        statusWants.textContent = 'Rencana gaji belum diset';
        statusWants.style.color = 'var(--text-muted)';
        barWants.style.background = 'linear-gradient(90deg, var(--accent-orange), var(--accent-red))';
    } else if (pctWants > 100) {
        statusWants.textContent = `Over-budget Rp ${new Intl.NumberFormat('id-ID').format(actualWants - targetWants)}`;
        statusWants.style.color = 'var(--accent-red)';
        barWants.style.background = 'linear-gradient(90deg, var(--accent-red), #ff3333)';
    } else {
        statusWants.textContent = `Sisa Rp ${new Intl.NumberFormat('id-ID').format(targetWants - actualWants)}`;
        statusWants.style.color = 'var(--accent-green)';
        barWants.style.background = 'linear-gradient(90deg, var(--accent-orange), var(--accent-red))';
    }

    // Savings
    if (plannedSalary === 0) {
        statusSavings.textContent = 'Rencana gaji belum diset';
        statusSavings.style.color = 'var(--text-muted)';
        barSavings.style.background = 'linear-gradient(90deg, #00cc66, #00ff88)';
    } else if (pctSavings >= 100) {
        statusSavings.textContent = 'Target tercapai! mantap!';
        statusSavings.style.color = 'var(--accent-green)';
        barSavings.style.background = 'linear-gradient(90deg, #00cc66, #00ff88)';
    } else {
        statusSavings.textContent = `Sisa alokasi Rp ${new Intl.NumberFormat('id-ID').format(targetSavings - actualSavings)}`;
        statusSavings.style.color = 'var(--text-muted)';
        barSavings.style.background = 'linear-gradient(90deg, #00cc66, #00ff88)';
    }
}

function handlePlannedSalaryChange(input) {
    formatInputCurrency(input);
    const rawVal = parseFormattedNumber(input.value) || 0;
    localStorage.setItem('fina_planned_income', rawVal);
    updateDashboardUI();
}