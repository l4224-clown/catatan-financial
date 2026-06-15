/* ==========================================
   APP STATE & INITIAL DATA
   ========================================== */
let state = {
    transactions: [],
    loans: []
};

const categories = {
    masuk: ['Modal / Saldo Awal', 'Tambahan Modal', 'Gaji', 'Investasi', 'Bisnis', 'Hadiah/Bonus', 'Lainnya'],
    keluar: ['Makanan', 'Transportasi', 'Hiburan', 'Belanja', 'Kebutuhan Rumah', 'Investasi', 'Tagihan', 'Lainnya']
};

let activeCurrency = 'IDR';
let cashflowChart = null;
let categoryChart = null;

const OWNER_USERNAME = "pakdol";
const OWNER_PASSWORD = "asd123";

/* ==========================================
   APP INIT & EVENT LISTENERS
   ========================================== */
document.addEventListener('DOMContentLoaded', () => {
    checkAuthStatus();
    setupNavigation();
    setupDefaultDates();
    updateCategoryOptions();
    populateFilterCategories();
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
    if (confirm('Keluar dari Kubah Utama? Sesi enkripsi Anda akan ditutup.')) {
        sessionStorage.removeItem('heist_authorized');
        checkAuthStatus();
    }
}

function loadDataFromLocalStorage() {
    // Force-clear old legacy dummy data from previous versions once
    if (!localStorage.getItem('fina_cleared_v2')) {
        localStorage.clear();
        localStorage.setItem('fina_cleared_v2', 'true');
    }

    const savedTransactions = localStorage.getItem('fina_transactions');
    const savedLoans = localStorage.getItem('fina_loans');
    
    if (savedTransactions) state.transactions = JSON.parse(savedTransactions);
    if (savedLoans) state.loans = JSON.parse(savedLoans);
}

function saveDataToLocalStorage() {
    localStorage.setItem('fina_transactions', JSON.stringify(state.transactions));
    localStorage.setItem('fina_loans', JSON.stringify(state.loans));
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
    }
}

function setupDefaultDates() {
    const todayStr = new Date().toISOString().split('T')[0];
    const txDate = document.getElementById('tx-date');
    const loanDate = document.getElementById('loan-date');
    const repayDate = document.getElementById('repay-date');
    
    if (txDate) txDate.value = todayStr;
    if (loanDate) loanDate.value = todayStr;
    if (repayDate) repayDate.value = todayStr;
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

// Helper function to format input values during typing
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

// Convert "1.000.000" back to float
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
                const mKey = t.date.substring(0, 7);
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
                const mKeyInit = l.date.substring(0, 7);
                const bucketInit = last6Months.find(m => m.monthKey === mKeyInit);
                if (bucketInit) {
                    if (l.type === 'piutang') bucketInit.expense += l.amount;
                    else bucketInit.income += l.amount;
                }

                l.repayments.forEach(r => {
                    const mKeyRep = r.date.substring(0, 7);
                    const bucketRep = last6Months.find(m => m.monthKey === mKeyRep);
                    if (bucketRep) {
                        if (l.type === 'piutang') bucketRep.income += r.amount;
                        else bucketRep.expense += r.amount;
                    }
                });
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
                        borderColor: '#2ecc71',
                        backgroundColor: 'rgba(46, 204, 113, 0.05)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Total Kas Keluar (' + activeCurrency + ')',
                        data: expenseData,
                        borderColor: '#e74c3c',
                        backgroundColor: 'rgba(231, 76, 60, 0.08)',
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#eef7f2', font: { family: 'Outfit' } } }
                },
                scales: {
                    x: { ticks: { color: '#a8beb2', font: { family: 'Outfit' } }, grid: { color: 'rgba(133,187,101,0.05)' } },
                    y: { ticks: { color: '#a8beb2', font: { family: 'Outfit' } }, grid: { color: 'rgba(133,187,101,0.05)' } }
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
            emptyCtx.fillStyle = '#6e8579';
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
                        '#85bb65', '#2ecc71', '#d4af37', '#e74c3c', 
                        '#3498db', '#f1c40f', '#9b59b6', '#1abc9c'
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
                        labels: { color: '#eef7f2', font: { family: 'Outfit', size: 11 } } 
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
    if (confirm('Apakah Anda yakin ingin menghapus data ini?')) {
        state.transactions = state.transactions.filter(t => t.id !== id);
        saveDataToLocalStorage();
        updateDashboardUI();
        renderTransactionTable();
    }
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
            <td>${formatDateStr(t.date)}</td>
            <td><strong>${tCurr}</strong></td>
            <td><strong>${t.category}</strong></td>
            <td>${t.note}</td>
            <td><span class="badge ${badgeClass}">${typeStr}</span></td>
            <td><strong>${formatCurrency(t.amount, tCurr)}</strong></td>
            <td>
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
    if (confirm('Hapus data pinjaman ini? Semua riwayat pengembalian juga akan terhapus.')) {
        state.loans = state.loans.filter(l => l.id !== id);
        saveDataToLocalStorage();
        updateDashboardUI();
        renderLoanTable();
    }
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
            <td>${formatDateStr(l.date)}</td>
            <td><strong>${l.name}</strong><br><small style="color:var(--text-muted);">${l.note}</small></td>
            <td><strong>${lCurr}</strong></td>
            <td>${typeStr}</td>
            <td>${formatCurrency(l.amount, lCurr)}</td>
            <td style="color: var(--accent-gold); font-size:0.85rem;">${interestRate}% (${formatCurrency(interestAmount, lCurr)})</td>
            <td style="font-weight: 600;">${formatCurrency(loanTotal, lCurr)}</td>
            <td style="color:var(--color-success); font-weight: 500;">${formatCurrency(totalRepaid, lCurr)}</td>
            <td style="font-weight: 700; color: ${isLunas ? 'var(--color-success)' : 'var(--color-danger)'};">${formatCurrency(remaining, lCurr)}</td>
            <td>${l.dueDate ? formatDateStr(l.dueDate) : '-'}</td>
            <td>${statusBadge}</td>
            <td>
                ${!isLunas ? `<button class="btn btn-primary btn-sm" onclick="openRepayModal('${l.id}')"><i class="fa-solid fa-coins"></i> Cicil</button>` : ''}
                <button class="btn btn-danger btn-sm" onclick="deleteLoan('${l.id}')">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}
