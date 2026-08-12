(() => {
  'use strict';
 
  /* ---------- Constants ---------- */
  const CATEGORIES = ['Food', 'Transport', 'Rent', 'Utilities', 'Entertainment', 'Shopping', 'Other'];
  const STORAGE_KEY_TX = 'ledger.transactions';
  const STORAGE_KEY_BUDGETS = 'ledger.budgets';
  const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
 
  /* ---------- State ---------- */
  let transactions = loadTransactions();
  let budgets = loadBudgets();
  let selectedType = 'expense';
 
  /* ---------- DOM references ---------- */
  const form = document.getElementById('transactionForm');
  const typeExpenseBtn = document.getElementById('typeExpense');
  const typeIncomeBtn = document.getElementById('typeIncome');
  const amountInput = document.getElementById('amount');
  const categorySelect = document.getElementById('category');
  const dateInput = document.getElementById('date');
  const descriptionInput = document.getElementById('description');
 
  const budgetForm = document.getElementById('budgetForm');
  const budgetCategorySelect = document.getElementById('budgetCategory');
  const budgetAmountInput = document.getElementById('budgetAmount');
  const budgetListEl = document.getElementById('budgetList');
 
  const filterCategorySelect = document.getElementById('filterCategory');
  const sortBySelect = document.getElementById('sortBy');
  const transactionListEl = document.getElementById('transactionList');
  const emptyStateEl = document.getElementById('emptyState');
 
  const totalIncomeEl = document.getElementById('totalIncome');
  const totalExpenseEl = document.getElementById('totalExpense');
  const totalBalanceEl = document.getElementById('totalBalance');
 
  /* ---------- Storage helpers ---------- */
  function loadTransactions() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_TX);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
 
  function loadBudgets() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_BUDGETS);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }
 
  function saveTransactions() {
    localStorage.setItem(STORAGE_KEY_TX, JSON.stringify(transactions));
  }
 
  function saveBudgets() {
    localStorage.setItem(STORAGE_KEY_BUDGETS, JSON.stringify(budgets));
  }
 
  /* ---------- Init dropdowns ---------- */
  function populateCategoryDropdowns() {
    [categorySelect, budgetCategorySelect, filterCategorySelect].forEach(select => {
      const isFilter = select === filterCategorySelect;
      const keep = isFilter ? select.querySelector('option[value="all"]') : null;
      select.innerHTML = '';
      if (keep) select.appendChild(keep);
      CATEGORIES.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        select.appendChild(opt);
      });
    });
  }
 
  /* ---------- Type toggle ---------- */
  function setType(type) {
    selectedType = type;
    typeExpenseBtn.classList.toggle('active', type === 'expense');
    typeIncomeBtn.classList.toggle('active', type === 'income');
  }
  typeExpenseBtn.addEventListener('click', () => setType('expense'));
  typeIncomeBtn.addEventListener('click', () => setType('income'));
 
  /* ---------- Add transaction ---------- */
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const amount = parseFloat(amountInput.value);
    if (isNaN(amount) || amount <= 0) return;
 
    const tx = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
      type: selectedType,
      amount,
      category: selectedType === 'income' ? 'Income' : categorySelect.value,
      description: descriptionInput.value.trim() || '(no description)',
      date: dateInput.value || new Date().toISOString().slice(0, 10)
    };
 
    transactions.push(tx);
    saveTransactions();
    form.reset();
    setType(selectedType); // keep toggle state after reset
    dateInput.value = new Date().toISOString().slice(0, 10);
    renderAll();
  });
 
  /* ---------- Set budget ---------- */
  budgetForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const cat = budgetCategorySelect.value;
    const limit = parseFloat(budgetAmountInput.value);
    if (!cat || isNaN(limit) || limit < 0) return;
    budgets[cat] = limit;
    saveBudgets();
    budgetForm.reset();
    renderBudgets();
  });
 
  /* ---------- Delete transaction ---------- */
  transactionListEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.del-btn');
    if (!btn) return;
    const id = btn.dataset.id;
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;
    const label = `${tx.description} (${currency.format(tx.amount)})`;
    if (confirm(`Delete this entry?\n\n${label}`)) {
      transactions = transactions.filter(t => t.id !== id);
      saveTransactions();
      renderAll();
    }
  });
 
  /* ---------- Filter / sort controls ---------- */
  filterCategorySelect.addEventListener('change', renderTransactionList);
  sortBySelect.addEventListener('change', renderTransactionList);
 
  /* ---------- Rendering ---------- */
  function renderTotals() {
    const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const balance = income - expense;
 
    totalIncomeEl.textContent = currency.format(income);
    totalExpenseEl.textContent = currency.format(expense);
    totalBalanceEl.textContent = currency.format(balance);
    totalBalanceEl.style.color = balance < 0 ? 'var(--expense)' : 'var(--ink)';
  }
 
  function renderBudgets() {
    budgetListEl.innerHTML = '';
    const setCats = Object.keys(budgets);
 
    if (setCats.length === 0) {
      budgetListEl.innerHTML = '<p class="empty-state" style="padding:6px 0;">No budgets set yet. Choose a category above to set a monthly limit.</p>';
      return;
    }
 
    setCats.forEach(cat => {
      const limit = budgets[cat];
      const spent = transactions
        .filter(t => t.type === 'expense' && t.category === cat)
        .reduce((s, t) => s + t.amount, 0);
      const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
      const isOver = spent > limit;
      const isWarn = !isOver && pct >= 80;
 
      const row = document.createElement('div');
      row.className = 'budget-row' + (isOver ? ' is-over' : '');
      row.innerHTML = `
        <span class="cat-name">${cat}</span>
        <div class="budget-track">
          <div class="budget-fill ${isOver ? 'over' : isWarn ? 'warn' : ''}" style="width:${pct}%"></div>
        </div>
        <span class="budget-amounts">${currency.format(spent)} / ${currency.format(limit)}${isOver ? '<span class="over-flag">OVER</span>' : ''}</span>
      `;
      budgetListEl.appendChild(row);
    });
  }
 
  function renderTransactionList() {
    let list = [...transactions];
 
    const filterCat = filterCategorySelect.value;
    if (filterCat !== 'all') {
      list = list.filter(t => t.category === filterCat);
    }
 
    const sortVal = sortBySelect.value;
    list.sort((a, b) => {
      if (sortVal === 'date-desc') return b.date.localeCompare(a.date);
      if (sortVal === 'date-asc') return a.date.localeCompare(b.date);
      if (sortVal === 'amount-desc') return b.amount - a.amount;
      if (sortVal === 'amount-asc') return a.amount - b.amount;
      return 0;
    });
 
    transactionListEl.innerHTML = '';
    emptyStateEl.hidden = transactions.length !== 0;
 
    if (transactions.length !== 0 && list.length === 0) {
      transactionListEl.innerHTML = '<p class="empty-state">No transactions match this filter.</p>';
      return;
    }
 
    list.forEach(t => {
      const row = document.createElement('div');
      row.className = 'entry';
      const sign = t.type === 'income' ? '+' : '−';
      row.innerHTML = `
        <span class="date">${formatDate(t.date)}</span>
        <span class="desc">${escapeHtml(t.description)}</span>
        <span class="cat-tag">${escapeHtml(t.category)}</span>
        <span class="amt ${t.type}">${sign}${currency.format(t.amount)}</span>
        <button class="del-btn" data-id="${t.id}" aria-label="Delete entry">×</button>
      `;
      transactionListEl.appendChild(row);
    });
  }
 
  function renderAll() {
    renderTotals();
    renderBudgets();
    renderTransactionList();
  }
 
  /* ---------- Utilities ---------- */
  function formatDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' });
  }
 
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
 
  /* ---------- Init ---------- */
  function init() {
    populateCategoryDropdowns();
    setType('expense');
    dateInput.value = new Date().toISOString().slice(0, 10);
    renderAll();
  }
 
  init();
})();
 
