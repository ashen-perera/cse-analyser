// CSE Analyser App Full Logic
const state = {
    currentView: 'dashboard',
    marketData: [],
    watchlist: ['JKH.N0000', 'EXPO.N0000', 'SAMP.N0000'],
    chartInstance: null,
    stockChartInstance: null,
    timeframe: '1M',
    searchQuery: '',
    broker: {
        isConnected: false,
        name: '',
        clientId: '',
        buyingPower: 2500000.00,
        cashBalance: 2500000.00,
        holdings: [
            { symbol: 'JKH.N0000', qty: 2000, avgPrice: 180.00 },
            { symbol: 'EXPO.N0000', qty: 5000, avgPrice: 140.00 }
        ],
        orders: []
    }
};

// Mock Stocks Database
const stocksDB = [
    { symbol: 'EXPO.N0000', name: 'Expolanka Holdings PLC', price: 145.50, change: 4.2, vol: '1.2M', sig: 'STRONG BUY', conf: 92, trend: 'up' },
    { symbol: 'JKH.N0000', name: 'John Keells Holdings', price: 182.25, change: 1.5, vol: '850k', sig: 'BUY', conf: 85, trend: 'up' },
    { symbol: 'BIL.N0000', name: 'Browns Investments', price: 5.20, change: -2.3, vol: '8.5M', sig: 'SELL', conf: 78, trend: 'down' },
    { symbol: 'LOLC.N0000', name: 'LOLC Holdings', price: 410.00, change: 0.8, vol: '320k', sig: 'ACCUMULATE', conf: 65, trend: 'up' },
    { symbol: 'SAMP.N0000', name: 'Sampath Bank PLC', price: 72.50, change: 4.6, vol: '1.5M', sig: 'STRONG BUY', conf: 88, trend: 'up' },
    { symbol: 'LIOC.N0000', name: 'Lanka IOC PLC', price: 105.75, change: -3.8, vol: '450k', sig: 'BEARISH', conf: 72, trend: 'down' },
    { symbol: 'COMB.N0000', name: 'Commercial Bank', price: 92.00, change: -1.1, vol: '890k', sig: 'SELL', conf: 60, trend: 'down' },
    { symbol: 'HAYL.N0000', name: 'Hayleys PLC', price: 85.20, change: 1.8, vol: '620k', sig: 'HOLD', conf: 55, trend: 'up' }
];

document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initSimulationMode();
    initNavigation();
    initSearch();
    initTimeframeControls();
    initModalEvents();
    initBroker();
    
    // Check login persistence
    if (localStorage.getItem('cse_logged_in') === 'true') {
        const loginScreen = document.getElementById('login-screen');
        if (loginScreen) loginScreen.classList.remove('active');
        
        try {
            const user = JSON.parse(localStorage.getItem('cse_current_user'));
            if (user) {
                updateUserUI(user);
            }
        } catch (err) {
            console.error("Failed to parse persisted user details:", err);
        }
    }
    
    // Initial renders
    renderDashboard();
    renderPredictionsView();
    renderWatchlist();
    renderSuggestionsView();
    
    // Start Live Market Simulation
    startLiveUpdates();
});

// User Database Initialization
if (!localStorage.getItem('cse_users')) {
    const defaultUsers = [
        { name: 'Space Admin', email: 'admin@cse.lk', password: 'password123', avatar: 'SA', provider: 'email' }
    ];
    localStorage.setItem('cse_users', JSON.stringify(defaultUsers));
}

// Helper to update User Header
function updateUserUI(user) {
    const nameEl = document.querySelector('.user-name');
    const avatarEl = document.querySelector('.avatar');
    if (nameEl && user) nameEl.innerText = user.name;
    if (avatarEl && user) {
        avatarEl.innerText = user.avatar || user.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
    }
}

// Password visibility helper
window.togglePasswordVisibility = function(inputId) {
    const input = document.getElementById(inputId);
    if(input) {
        input.type = input.type === 'password' ? 'text' : 'password';
    }
};

// Simulated Google Sign-In Actions
window.selectGoogleAccount = function(name, email, avatar) {
    window.closeGoogleModal();
    
    const btn = document.getElementById('btn-google-login');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<span class="btn-loading"></span>`;
    
    setTimeout(() => {
        const user = { name, email, avatar, provider: 'google' };
        localStorage.setItem('cse_logged_in', 'true');
        localStorage.setItem('cse_current_user', JSON.stringify(user));
        
        // Hide login overlay
        document.getElementById('login-screen').classList.remove('active');
        
        // Reset button
        btn.innerHTML = originalText;
        
        // Update user UI
        updateUserUI(user);
        
        alert(`Welcome back, ${name}! Logged in securely via Google.`);
    }, 1200);
};

window.closeGoogleModal = function() {
    const modal = document.getElementById('google-login-modal');
    if (modal) modal.classList.remove('active');
};

// Real Google Sign-In Callback (Fired by Google Identity Services API if running in web server)
window.handleGoogleLogin = function(response) {
    console.log("Encoded JWT ID token: " + response.credential);
    try {
        const payload = JSON.parse(atob(response.credential.split('.')[1]));
        const initials = (payload.name || 'G U').split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
        const user = { name: payload.name || 'Google User', email: payload.email, avatar: initials, provider: 'google' };
        
        localStorage.setItem('cse_logged_in', 'true');
        localStorage.setItem('cse_current_user', JSON.stringify(user));
        document.getElementById('login-screen').classList.remove('active');
        
        updateUserUI(user);
        alert('Welcome back, ' + user.name + '! Account securely synced via Google.');
    } catch(e) {
        localStorage.setItem('cse_logged_in', 'true');
        document.getElementById('login-screen').classList.remove('active');
        alert('Google Authentication Successful! Welcome to CSE Analyser.');
    }
};

// Email validation helper
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Authentication Logic & Transitions
function initAuth() {
    const stateSignin = document.getElementById('state-signin');
    const stateSignup = document.getElementById('state-signup');
    const stateForgot = document.getElementById('state-forgot');
    
    const linkSignup = document.getElementById('link-signup');
    const linkSignin = document.getElementById('link-signin');
    const linkForgot = document.getElementById('link-forgot-pass');
    const linkSigninForgot = document.getElementById('link-signin-forgot');
    
    const alertBox = document.getElementById('login-alert');
    
    function switchState(activeState) {
        if(alertBox) alertBox.classList.remove('active', 'success');
        [stateSignin, stateSignup, stateForgot].forEach(state => {
            if(state) state.classList.remove('active');
        });
        if(activeState) activeState.classList.add('active');
    }
    
    if (linkSignup) linkSignup.addEventListener('click', (e) => { e.preventDefault(); switchState(stateSignup); });
    if (linkSignin) linkSignin.addEventListener('click', (e) => { e.preventDefault(); switchState(stateSignin); });
    if (linkForgot) linkForgot.addEventListener('click', (e) => { e.preventDefault(); switchState(stateForgot); });
    if (linkSigninForgot) linkSigninForgot.addEventListener('click', (e) => { e.preventDefault(); switchState(stateSignin); });

    // Google Login Simulated click
    const googleLoginBtn = document.getElementById('btn-google-login');
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', () => {
            const modal = document.getElementById('google-login-modal');
            if (modal) modal.classList.add('active');
        });
    }

    // Sign In Submission
    const formSignin = document.getElementById('form-signin');
    if (formSignin) {
        formSignin.addEventListener('submit', (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('signin-email');
            const passwordInput = document.getElementById('signin-password');
            const emailError = document.getElementById('error-signin-email');
            const passwordError = document.getElementById('error-signin-password');
            
            // Clear errors
            emailError.classList.remove('active');
            passwordError.classList.remove('active');
            alertBox.classList.remove('active', 'success');
            
            let isValid = true;
            if (!validateEmail(emailInput.value)) {
                emailError.classList.add('active');
                isValid = false;
            }
            if (passwordInput.value.length < 6) {
                passwordError.classList.add('active');
                isValid = false;
            }
            
            if (!isValid) return;
            
            // Check credentials
            const users = JSON.parse(localStorage.getItem('cse_users') || '[]');
            const user = users.find(u => u.email.toLowerCase() === emailInput.value.toLowerCase() && u.password === passwordInput.value);
            
            const submitBtn = document.getElementById('btn-submit-signin');
            submitBtn.classList.add('btn-loading');
            
            setTimeout(() => {
                submitBtn.classList.remove('btn-loading');
                if (user) {
                    localStorage.setItem('cse_logged_in', 'true');
                    localStorage.setItem('cse_current_user', JSON.stringify(user));
                    alertBox.classList.add('active', 'success');
                    alertBox.querySelector('.alert-icon').innerText = '✅';
                    alertBox.querySelector('.alert-message').innerText = 'Login successful! Syncing trading account...';
                    
                    setTimeout(() => {
                        document.getElementById('login-screen').classList.remove('active');
                        alertBox.classList.remove('active', 'success');
                        updateUserUI(user);
                        emailInput.value = '';
                        passwordInput.value = '';
                    }, 1000);
                } else {
                    alertBox.classList.add('active');
                    alertBox.querySelector('.alert-icon').innerText = '⚠️';
                    alertBox.querySelector('.alert-message').innerText = 'Invalid email or password.';
                }
            }, 1000);
        });
    }

    // Sign Up Submission
    const formSignup = document.getElementById('form-signup');
    if (formSignup) {
        formSignup.addEventListener('submit', (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('signup-name');
            const emailInput = document.getElementById('signup-email');
            const passwordInput = document.getElementById('signup-password');
            const confirmInput = document.getElementById('signup-confirm-password');
            
            const emailError = document.getElementById('error-signup-email');
            const passwordError = document.getElementById('error-signup-password');
            const confirmError = document.getElementById('error-signup-confirm');
            
            emailError.classList.remove('active');
            passwordError.classList.remove('active');
            confirmError.classList.remove('active');
            alertBox.classList.remove('active', 'success');
            
            let isValid = true;
            if (!validateEmail(emailInput.value)) {
                emailError.classList.add('active');
                isValid = false;
            }
            if (passwordInput.value.length < 6) {
                passwordError.classList.add('active');
                isValid = false;
            }
            if (passwordInput.value !== confirmInput.value) {
                confirmError.classList.add('active');
                isValid = false;
            }
            
            if (!isValid) return;
            
            const users = JSON.parse(localStorage.getItem('cse_users') || '[]');
            const userExists = users.some(u => u.email.toLowerCase() === emailInput.value.toLowerCase());
            
            const submitBtn = document.getElementById('btn-submit-signup');
            submitBtn.classList.add('btn-loading');
            
            setTimeout(() => {
                submitBtn.classList.remove('btn-loading');
                if (userExists) {
                    alertBox.classList.add('active');
                    alertBox.querySelector('.alert-icon').innerText = '⚠️';
                    alertBox.querySelector('.alert-message').innerText = 'This email is already registered.';
                } else {
                    const initials = nameInput.value.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                    const newUser = {
                        name: nameInput.value,
                        email: emailInput.value,
                        password: passwordInput.value,
                        avatar: initials,
                        provider: 'email'
                    };
                    users.push(newUser);
                    localStorage.setItem('cse_users', JSON.stringify(users));
                    
                    localStorage.setItem('cse_logged_in', 'true');
                    localStorage.setItem('cse_current_user', JSON.stringify(newUser));
                    
                    alertBox.classList.add('active', 'success');
                    alertBox.querySelector('.alert-icon').innerText = '✅';
                    alertBox.querySelector('.alert-message').innerText = 'Registration successful! Creating account...';
                    
                    setTimeout(() => {
                        document.getElementById('login-screen').classList.remove('active');
                        alertBox.classList.remove('active', 'success');
                        updateUserUI(newUser);
                        nameInput.value = '';
                        emailInput.value = '';
                        passwordInput.value = '';
                        confirmInput.value = '';
                    }, 1000);
                }
            }, 1200);
        });
    }

    // Forgot Password Submission
    const formForgot = document.getElementById('form-forgot');
    if (formForgot) {
        formForgot.addEventListener('submit', (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('forgot-email');
            const emailError = document.getElementById('error-forgot-email');
            
            emailError.classList.remove('active');
            alertBox.classList.remove('active', 'success');
            
            if (!validateEmail(emailInput.value)) {
                emailError.classList.add('active');
                return;
            }
            
            const submitBtn = document.getElementById('btn-submit-forgot');
            submitBtn.classList.add('btn-loading');
            
            setTimeout(() => {
                submitBtn.classList.remove('btn-loading');
                alertBox.classList.add('active', 'success');
                alertBox.querySelector('.alert-icon').innerText = '📧';
                alertBox.querySelector('.alert-message').innerText = 'Password recovery link has been sent to your email!';
                emailInput.value = '';
            }, 1000);
        });
    }

    // Logout Action
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('cse_logged_in');
            localStorage.removeItem('cse_current_user');
            
            const loginScreen = document.getElementById('login-screen');
            if (loginScreen) {
                switchState(stateSignin);
                loginScreen.classList.add('active');
            }
            alert('Logged out successfully.');
        });
    }
}

// Simulation Mode Toggle Management
function initSimulationMode() {
    const simToggle = document.getElementById('simulation-toggle');
    if (simToggle) {
        if (localStorage.getItem('cse_sim_mode') === null) {
            localStorage.setItem('cse_sim_mode', 'true');
        }
        
        simToggle.checked = localStorage.getItem('cse_sim_mode') === 'true';
        simToggle.addEventListener('change', (e) => {
            localStorage.setItem('cse_sim_mode', e.target.checked ? 'true' : 'false');
            updateMarketStatusUI();
        });
    }
    updateMarketStatusUI();
}

function updateMarketStatusUI() {
    const now = new Date();
    const hour = now.getHours();
    const isMarketOpen = (hour >= 9 && hour < 15) && now.getDay() >= 1 && now.getDay() <= 5;
    const isSimMode = localStorage.getItem('cse_sim_mode') === 'true';
    
    const statusEl = document.getElementById('market-status');
    if (statusEl) {
        if (isMarketOpen) {
            statusEl.innerHTML = '🟢 Market Open';
            statusEl.style.background = 'rgba(16, 185, 129, 0.2)';
            statusEl.style.color = 'var(--success-color)';
        } else if (isSimMode) {
            statusEl.innerHTML = '🟢 Simulating Market';
            statusEl.style.background = 'rgba(16, 185, 129, 0.2)';
            statusEl.style.color = 'var(--success-color)';
        } else {
            statusEl.innerHTML = '🔴 Market Closed';
            statusEl.style.background = 'rgba(239, 68, 68, 0.2)';
            statusEl.style.color = 'var(--danger-color)';
        }
    }
}

function startLiveUpdates() {
    setInterval(() => {
        const now = new Date();
        const hour = now.getHours();
        const isMarketOpen = (hour >= 9 && hour < 15) && now.getDay() >= 1 && now.getDay() <= 5;
        const isSimMode = localStorage.getItem('cse_sim_mode') === 'true';
        
        updateMarketStatusUI();
        
        if (!isMarketOpen && !isSimMode) {
            return;
        }

        // Fluctuate prices and keep old values to determine flash directions
        stocksDB.forEach(s => {
            const volatility = s.price * 0.003; 
            const shift = (Math.random() - 0.45) * volatility;
            s.price += shift;
            s.change = s.change + ((shift / s.price) * 100);
            
            if (s.change > 3) { s.trend = 'up'; s.sig = 'STRONG BUY'; }
            else if (s.change < -3) { s.trend = 'down'; s.sig = 'SELL'; }
            else { s.sig = 'HOLD'; }
        });
        
        // Update indices
        const aspiEl = document.getElementById('aspi-value');
        if(aspiEl) {
            let val = parseFloat(aspiEl.innerText.replace(/,/g, ''));
            val += (Math.random() - 0.45) * 8;
            aspiEl.innerText = val.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
            
            const spEl = document.getElementById('sp-value');
            let spVal = parseFloat(spEl.innerText.replace(/,/g, ''));
            spVal += (Math.random() - 0.45) * 3;
            spEl.innerText = spVal.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
        }
        
        // Trigger live in-place DOM updates
        updateLivePricesDOM();

        // Update live portfolio values if broker is active
        if (state.broker && state.broker.isConnected) {
            renderPortfolioHoldings(true);
        }
        
        // update chart if view is dashboard
        if (state.currentView === 'dashboard' && state.chartInstance && state.timeframe === '1D') {
            const data = state.chartInstance.data.datasets[0].data;
            data[data.length - 1] += (Math.random() - 0.45) * 10;
            state.chartInstance.update();
        }
    }, 2500);
}

// In-place Live Price DOM Updates
function updateLivePricesDOM() {
    stocksDB.forEach(s => {
        // 1. Update movers-tbody
        const moverRow = document.querySelector(`#movers-tbody tr[data-symbol="${s.symbol}"]`);
        if (moverRow) {
            updateMoverRowDOM(moverRow, s);
        }
        
        // 2. Update prediction lists (Sidebar predictions)
        const sidebarPreds = document.querySelectorAll(`#prediction-list .pred-item[data-symbol="${s.symbol}"]`);
        sidebarPreds.forEach(el => updatePredictionItemDOM(el, s));
        
        // 3. Update full predictions page
        const fullPreds = document.querySelectorAll(`#full-predictions .pred-item[data-symbol="${s.symbol}"]`);
        fullPreds.forEach(el => updatePredictionItemDOM(el, s));

        // 4. Update watchlist table
        const watchlistRow = document.querySelector(`#watchlist-tbody tr[data-symbol="${s.symbol}"]`);
        if (watchlistRow) {
            updateWatchlistRowDOM(watchlistRow, s);
        }
    });
}

function flashElement(el, direction) {
    el.classList.remove('flash-up', 'flash-down');
    void el.offsetWidth; // Force reflow
    el.classList.add(direction === 'up' ? 'flash-up' : 'flash-down');
}

function updateMoverRowDOM(row, s) {
    const oldPrice = parseFloat(row.getAttribute('data-price')) || s.price;
    if (s.price !== oldPrice) {
        const direction = s.price > oldPrice ? 'up' : 'down';
        row.setAttribute('data-price', s.price);
        
        const priceCell = row.querySelector('.price-cell');
        if (priceCell) {
            priceCell.innerText = `Rs. ${s.price.toFixed(2)}`;
            flashElement(priceCell, direction);
        }
        
        const changeCell = row.querySelector('.change-cell');
        if (changeCell) {
            const changeClass = s.change >= 0 ? 'text-success' : 'text-danger';
            const changeSign = s.change >= 0 ? '+' : '';
            const netChange = s.price * (Math.abs(s.change)/100);
            changeCell.className = `change-cell ${changeClass}`;
            changeCell.innerText = `${changeSign}${netChange.toFixed(2)} (${changeSign}${s.change.toFixed(2)}%)`;
            flashElement(changeCell, direction);
        }
        
        const signalCell = row.querySelector('.signal-cell');
        if (signalCell) {
            const badgeColor = s.trend === 'up' ? 'var(--success-color)' : 'var(--danger-color)';
            const badge = signalCell.querySelector('.badge');
            if (badge) {
                badge.innerText = s.sig;
                badge.style.color = badgeColor;
            }
        }
    }
}

function updateWatchlistRowDOM(row, s) {
    const oldPrice = parseFloat(row.getAttribute('data-price')) || s.price;
    if (s.price !== oldPrice) {
        const direction = s.price > oldPrice ? 'up' : 'down';
        row.setAttribute('data-price', s.price);
        
        const priceCell = row.querySelector('.price-cell');
        if (priceCell) {
            priceCell.innerText = `Rs. ${s.price.toFixed(2)}`;
            flashElement(priceCell, direction);
        }
        
        const changeCell = row.querySelector('.change-cell');
        if (changeCell) {
            const changeClass = s.change >= 0 ? 'text-success' : 'text-danger';
            changeCell.className = `change-cell ${changeClass}`;
            changeCell.innerText = `${s.change.toFixed(2)}%`;
            flashElement(changeCell, direction);
        }
        
        const trendCell = row.querySelector('.trend-cell');
        if (trendCell) {
            trendCell.innerText = s.trend === 'up' ? '📈 Bullish' : '📉 Bearish';
        }
    }
}

function updatePredictionItemDOM(el, s) {
    const oldPrice = parseFloat(el.getAttribute('data-price')) || s.price;
    if (s.price !== oldPrice) {
        const direction = s.price > oldPrice ? 'up' : 'down';
        el.setAttribute('data-price', s.price);
        el.className = `pred-item ${s.trend}`;
        
        const actionEl = el.querySelector('.pred-action');
        if (actionEl) {
            actionEl.innerText = s.sig;
        }
        flashElement(el, direction);
    }
}

// Navigation Handling
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            // Don't navigate if it's logout
            if (item.classList.contains('logout')) return;
            
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            
            const target = item.getAttribute('data-target');
            document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
            document.getElementById(`view-${target}`).classList.add('active');
            
            state.currentView = target;
            if(target === 'dashboard') {
                renderDashboard();
            } else if(target === 'watchlist') {
                renderWatchlist();
            } else if(target === 'predictions') {
                renderPredictionsView();
            } else if(target === 'portfolio' || target === 'settings') {
                updateBrokerUI();
            }
        });
    });
}

// Search Functionality
window.selectSearchStock = function(symbol) {
    const resultsPanel = document.getElementById('search-results');
    const searchInput = document.getElementById('search-input');
    if (resultsPanel) resultsPanel.classList.remove('active');
    if (searchInput) searchInput.value = '';
    window.openAnalysisModal(symbol);
};

function initSearch() {
    const searchInput = document.getElementById('search-input');
    const resultsPanel = document.getElementById('search-results');
    
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        if(query.length < 1) {
            resultsPanel.classList.remove('active');
            return;
        }
        
        const matches = stocksDB.filter(s => s.symbol.toLowerCase().includes(query) || s.name.toLowerCase().includes(query));
        
        if (matches.length === 0) {
            resultsPanel.innerHTML = `
                <div class="search-result no-results">
                    No companies found matching "${e.target.value}"
                </div>
            `;
        } else {
            resultsPanel.innerHTML = matches.map(m => `
                <div class="search-result" onclick="selectSearchStock('${m.symbol}')">
                    <span style="font-weight:600; color:var(--text-primary)">${m.symbol}</span>
                    <span style="font-size:12px; color:var(--text-secondary)">${m.name}</span>
                </div>
            `).join('');
        }
        
        resultsPanel.classList.add('active');
    });

    document.addEventListener('click', (e) => {
        if(!e.target.closest('.search-bar')) {
            resultsPanel.classList.remove('active');
        }
    });
}

// Charting Logic
function initTimeframeControls() {
    const btns = document.querySelectorAll('.time-btn');
    btns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateMarketChart(btn.getAttribute('data-time'));
        });
    });
}

function updateMarketChart(timeframe) {
    let steps, volatility;
    switch(timeframe) {
        case '1D': steps = 24; volatility = 50; break;
        case '1W': steps = 7; volatility = 100; break;
        case '1M': steps = 30; volatility = 200; break;
        case '1Y': steps = 12; volatility = 800; break;
    }
    state.timeframe = timeframe;
    const data = generateRandomWalk(21066, steps, volatility);
    const labels = Array.from({length: steps}, (_, i) => `${timeframe} ${i+1}`);
    
    if(state.chartInstance) {
        state.chartInstance.data.labels = labels;
        state.chartInstance.data.datasets[0].data = data;
        state.chartInstance.update();
    }
}

function renderDashboard(isUpdate = false) {
    if(!document.getElementById('marketChart')) return;
    
    if (!isUpdate && !state.chartInstance) {
        const ctx = document.getElementById('marketChart').getContext('2d');
        const gradientFill = ctx.createLinearGradient(0, 0, 0, 300);
        gradientFill.addColorStop(0, 'rgba(99, 102, 241, 0.5)');
        gradientFill.addColorStop(1, 'rgba(99, 102, 241, 0.01)');

        const initialData = generateRandomWalk(21066, 30, 200);
        const labels = Array.from({length: 30}, (_, i) => `Day ${i + 1}`);

        state.chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    data: initialData,
                    borderColor: '#6366f1',
                    backgroundColor: gradientFill,
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
                scales: {
                    x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8', maxTicksLimit: 6 } },
                    y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } }
                },
                interaction: { mode: 'index', intersect: false }
            }
        });
    }

    const tbody = document.getElementById('movers-tbody');
    if (tbody) {
        if (tbody.children.length === 0 || !isUpdate) {
            tbody.innerHTML = stocksDB.map(s => {
                const changeClass = s.change >= 0 ? 'text-success' : 'text-danger';
                const changeSign = s.change >= 0 ? '+' : '';
                const badgeColor = s.trend === 'up' ? 'var(--success-color)' : 'var(--danger-color)';
                const netChange = s.price * (Math.abs(s.change)/100);
                
                return `
                    <tr data-symbol="${s.symbol}" data-price="${s.price}" onclick="openAnalysisModal('${s.symbol}')">
                        <td class="symbol-col">${s.symbol}</td>
                        <td class="text-secondary">${s.name}</td>
                        <td class="price-cell">Rs. ${s.price.toFixed(2)}</td>
                        <td class="change-cell ${changeClass}">${changeSign}${netChange.toFixed(2)} (${changeSign}${s.change.toFixed(2)}%)</td>
                        <td class="volume-cell">${s.vol}</td>
                        <td class="signal-cell"><span class="badge" style="background: rgba(255,255,255,0.1); color: ${badgeColor}">${s.sig}</span></td>
                        <td><button class="btn-action">Analyse</button></td>
                    </tr>
                `;
            }).join('');
        } else {
            updateLivePricesDOM();
        }
    }

    const predList = document.getElementById('prediction-list');
    if (predList) {
        if (predList.children.length === 0 || !isUpdate) {
            predList.innerHTML = stocksDB.slice(0, 4).map(s => createPredItem(s)).join('');
        } else {
            updateLivePricesDOM();
        }
    }
}

function renderPredictionsView() {
    const grid = document.getElementById('full-predictions');
    if (!grid) return;
    if (grid.children.length === 0) {
        grid.innerHTML = stocksDB.map(s => createPredItem(s)).join('');
    } else {
        updateLivePricesDOM();
    }
}

function createPredItem(s) {
    return `
        <div class="pred-item ${s.trend}" data-symbol="${s.symbol}" data-price="${s.price}" onclick="openAnalysisModal('${s.symbol}')">
            <div>
                <div class="pred-symbol">${s.symbol}</div>
                <div class="pred-company">${s.name}</div>
            </div>
            <div style="text-align: right">
                <div class="pred-action">${s.sig}</div>
                <div class="pred-company" style="margin-top: 4px">Conf: ${s.conf}%</div>
            </div>
        </div>
    `;
}

function renderWatchlist() {
    const tbody = document.getElementById('watchlist-tbody');
    if (!tbody) return;
    
    if(state.watchlist.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 40px; color: var(--text-secondary)">Your watchlist is empty.</td></tr>';
        return;
    }
    
    const existingRows = tbody.querySelectorAll('tr[data-symbol]');
    if (existingRows.length === 0 || existingRows.length !== state.watchlist.length) {
        tbody.innerHTML = state.watchlist.map(sym => {
            const s = stocksDB.find(x => x.symbol === sym) || { symbol: sym, price: 0, change: 0, trend: 'neutral', sig: 'HOLD' };
            const changeClass = s.change >= 0 ? 'text-success' : 'text-danger';
            return `
                <tr data-symbol="${s.symbol}" data-price="${s.price}" onclick="openAnalysisModal('${s.symbol}')">
                    <td class="symbol-col">${s.symbol}</td>
                    <td class="price-cell">Rs. ${s.price.toFixed(2)}</td>
                    <td class="change-cell ${changeClass}">${s.change.toFixed(2)}%</td>
                    <td class="trend-cell">${s.trend === 'up' ? '📈 Bullish' : '📉 Bearish'}</td>
                    <td><button class="btn-action" onclick="removeFromWatchlist('${s.symbol}', event)">Remove</button></td>
                </tr>
            `;
        }).join('');
    } else {
        updateLivePricesDOM();
    }
}

// Expert Suggestions Logic
const expertSuggestions = [
    { symbol: 'LIOC.N0000', name: 'Lanka IOC PLC', type: 'buy', entry: '105.00', target: '120.00', stop: '98.00', reason: 'Strong quarterly earnings and favorable fuel pricing formula anticipated in the short term.' },
    { symbol: 'SAMP.N0000', name: 'Sampath Bank PLC', type: 'buy', entry: '72.50', target: '85.00', stop: '68.00', reason: 'Anticipated massive dividend announcement alongside solid systemic loan growth.' },
    { symbol: 'EXPO.N0000', name: 'Expolanka Holdings', type: 'sell', entry: '145.00', target: '120.00', stop: '155.00', reason: 'Global freight rates normalizing rapidly, which drastically reduces core profit margins.' },
    { symbol: 'BIL.N0000', name: 'Browns Investments', type: 'buy', entry: '5.20', target: '6.50', stop: '4.80', reason: 'Undervalued penny stock approaching breakout resistance volume.' }
];

function renderSuggestionsView() {
    const list = document.getElementById('expert-suggestions-list');
    if (!list) return;
    
    list.innerHTML = expertSuggestions.map(s => {
        const typeBg = s.type === 'buy' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
        const btnText = s.type === 'buy' ? 'STRONG BUY' : 'SELL';
        const borderColor = s.type === 'buy' ? 'var(--success-color)' : 'var(--danger-color)';
        const textColor = s.type === 'buy' ? 'var(--success-color)' : 'var(--danger-color)';
        
        return `
            <div class="pred-item" style="display: flex; flex-direction: column; gap: 12px; padding: 16px; align-items: flex-start; border-left: 3px solid ${borderColor}; cursor: default;">
                <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
                    <div>
                        <div class="pred-symbol" style="font-size: 18px;">${s.symbol}</div>
                        <div class="pred-company">${s.name}</div>
                    </div>
                    <div style="background: ${typeBg}; color: ${textColor}; padding: 6px 12px; border-radius: 20px; font-weight: 700; font-size: 12px;">
                        ${btnText}
                    </div>
                </div>
                
                <div style="display: flex; gap: 24px; font-size: 14px; background: rgba(0,0,0,0.2); width: 100%; padding: 12px; border-radius: 8px;">
                    <div><span class="text-secondary">Entry:</span> <b>Rs. ${s.entry}</b></div>
                    <div><span class="text-secondary">Target:</span> <b class="text-success">Rs. ${s.target}</b></div>
                    <div><span class="text-secondary">Stop Loss:</span> <b class="text-danger">Rs. ${s.stop}</b></div>
                </div>
                
                <div style="font-size: 14px; color: var(--text-secondary); line-height: 1.5;">
                    <b>💡 Analyst Take:</b> ${s.reason}
                </div>
                <button class="btn-action" style="margin-top: 8px;" onclick="openAnalysisModal('${s.symbol}')">View AI Chart</button>
            </div>
        `;
    }).join('');
}

function removeFromWatchlist(symbol, event) {
    event.stopPropagation();
    state.watchlist = state.watchlist.filter(s => s !== symbol);
    renderWatchlist();
}

window.addToWatchlist = function(symbol) {
    if(!state.watchlist.includes(symbol)) {
        state.watchlist.push(symbol);
        renderWatchlist();
        alert(`${symbol} added to watchlist!`);
    } else {
        alert(`${symbol} is already in watchlist.`);
    }
};

// Modal Logic
function initModalEvents() {
    document.getElementById('close-modal').addEventListener('click', closeModal);
    document.getElementById('modal-title').addEventListener('click', (e) => e.stopPropagation());
    
    document.getElementById('add-watchlist').addEventListener('click', () => {
        openAnalysisModal('JKH.N0000'); // Example add
    });

    const execBtn = document.getElementById('btn-modal-execute-trade');
    if (execBtn) {
        execBtn.addEventListener('click', () => {
            const titleText = document.getElementById('modal-title').innerText;
            const symbol = titleText.split(' ')[0]; // Extract symbol
            const stock = stocksDB.find(s => s.symbol === symbol) || { symbol, price: 100 };
            
            const panel = document.getElementById('modal-trade-panel');
            if (panel.style.display === 'none') {
                initTradePanel(stock);
            } else {
                panel.style.display = 'none';
            }
        });
    }
}

window.openAnalysisModal = function(symbol) {
    const modal = document.getElementById('analysis-modal');
    const stock = stocksDB.find(s => s.symbol === symbol) || { symbol, name: 'Unknown' };
    
    document.getElementById('modal-title').innerText = `${stock.symbol} Analysis`;
    document.getElementById('modal-rsi').innerText = (Math.random() * 40 + 30).toFixed(1); // 30-70 mock RSI
    document.getElementById('modal-macd').innerText = stock.trend === 'up' ? 'Bullish Cross' : 'Bearish Cross';
    document.getElementById('modal-macd').style.color = stock.trend === 'up' ? 'var(--success-color)' : 'var(--danger-color)';
    
    const watchBtn = document.getElementById('add-to-watchlist-modal');
    watchBtn.onclick = () => window.addToWatchlist(stock.symbol);
    
    modal.classList.add('active');
    
    // Hide trade panel initially
    document.getElementById('modal-trade-panel').style.display = 'none';
    
    // Draw Stock Chart
    setTimeout(() => renderStockChart(stock), 50);
};

function closeModal() {
    document.getElementById('analysis-modal').classList.remove('active');
    document.getElementById('modal-trade-panel').style.display = 'none';
    if(state.stockChartInstance) {
        state.stockChartInstance.destroy();
        state.stockChartInstance = null;
    }
}

function renderStockChart(stock) {
    const ctx = document.getElementById('stockChart').getContext('2d');
    if(state.stockChartInstance) state.stockChartInstance.destroy();
    
    const price = stock.price || 100;
    const isUp = stock.trend === 'up';
    const chartColor = isUp ? '#10b981' : '#ef4444';
    
    const gradient = ctx.createLinearGradient(0, 0, 0, 250);
    gradient.addColorStop(0, isUp ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
 
    const data = generateRandomWalk(price * 0.9, 14, price * 0.05);
    data.push(price); // Ensure final matches

    state.stockChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array.from({length: 15}, (_, i) => `T-${14-i}`),
            datasets: [{
                data: data,
                borderColor: chartColor,
                backgroundColor: gradient,
                borderWidth: 2,
                pointRadius: 2,
                fill: true,
                tension: 0.2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { display: false },
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }
            }
        }
    });
}

// Helpers
function generateRandomWalk(start, steps, volatility) {
    let current = start;
    let data = [current];
    for (let i = 1; i < steps; i++) {
        let change = (Math.random() - 0.45) * volatility;
        current += change;
        data.push(current);
    }
    return data;
}

// ATrad / CSE Profit Calculator (approx 1.12% total transaction fee)
window.calculateATradProfit = function() {
    const buyPrice = parseFloat(document.getElementById('calc-buy-price').value) || 0;
    const qty = parseInt(document.getElementById('calc-qty').value) || 0;
    const sellPrice = parseFloat(document.getElementById('calc-sell-price').value) || 0;
    
    const feeRate = 0.0112; // 1.12% generic CSE fee structure
    
    const grossBuy = buyPrice * qty;
    const buyFees = grossBuy * feeRate;
    const totalCost = grossBuy + buyFees;
    
    const grossSell = sellPrice * qty;
    const sellFees = grossSell * feeRate;
    const netProceeds = grossSell - sellFees;
    
    const netProfit = netProceeds - totalCost;
    
    document.getElementById('res-gross-buy').innerText = `Rs. ${grossBuy.toFixed(2)}`;
    document.getElementById('res-buy-fees').innerText = `Rs. ${buyFees.toFixed(2)}`;
    
    document.getElementById('res-gross-sell').innerText = `Rs. ${grossSell.toFixed(2)}`;
    document.getElementById('res-sell-fees').innerText = `Rs. ${sellFees.toFixed(2)}`;
    
    const profitEl = document.getElementById('res-net-profit');
    profitEl.innerText = `Rs. ${netProfit.toFixed(2)}`;
    profitEl.className = netProfit >= 0 ? 'text-success' : 'text-danger';
};

// ==========================================
// BROKER API INTEGRATION & TRADE EXECUTION
// ==========================================

window.navigateToSettings = function() {
    const settingsNavItem = document.querySelector('.nav-menu [data-target="settings"]');
    if (settingsNavItem) {
        settingsNavItem.click();
    }
};

function initBroker() {
    const savedBroker = localStorage.getItem('cse_broker_state');
    if (savedBroker) {
        try {
            state.broker = JSON.parse(savedBroker);
        } catch(e) {
            console.error("Failed to parse broker state", e);
        }
    }

    updateBrokerUI();

    const form = document.getElementById('form-broker-connect');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('broker-select').value;
            const clientId = document.getElementById('broker-client-id').value;
            const secret = document.getElementById('broker-secret-key').value;
            
            connectBroker(name, clientId, secret);
        });
    }

    const disconnectBtn = document.getElementById('btn-broker-disconnect');
    if (disconnectBtn) {
        disconnectBtn.addEventListener('click', () => {
            disconnectBroker();
        });
    }
}

function updateBrokerUI() {
    const badge = document.getElementById('broker-status-badge');
    const disconnectedSection = document.getElementById('broker-disconnected-section');
    const connectedSection = document.getElementById('broker-connected-section');
    
    const portfolioOfflineBanner = document.getElementById('portfolio-offline-banner');
    const portfolioConnectedCard = document.getElementById('portfolio-connected-card');
    const portfolioOrdersCard = document.getElementById('portfolio-orders-card');

    if (state.broker.isConnected) {
        // Header Badge
        if (badge) {
            badge.className = 'broker-status-btn connected';
            badge.innerHTML = `<span class="pulse-dot"></span> <span class="badge-text">⚡ ${state.broker.name} Synced</span>`;
        }
        // Settings Page Sections
        if (disconnectedSection) disconnectedSection.style.display = 'none';
        if (connectedSection) connectedSection.style.display = 'grid';
        
        document.getElementById('connected-broker-name').innerText = state.broker.name;
        document.getElementById('connected-client-id').innerText = state.broker.clientId;
        document.getElementById('connected-buying-power').innerText = `Rs. ${state.broker.buyingPower.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
        
        // Portfolio Page Sections
        if (portfolioOfflineBanner) portfolioOfflineBanner.style.display = 'none';
        if (portfolioConnectedCard) portfolioConnectedCard.style.display = 'block';
        if (portfolioOrdersCard) portfolioOrdersCard.style.display = 'block';

        document.getElementById('portfolio-broker-name').innerText = state.broker.name;
        document.getElementById('portfolio-client-id').innerText = state.broker.clientId;
        document.getElementById('portfolio-buying-power').innerText = `Rs. ${state.broker.buyingPower.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
        document.getElementById('portfolio-cash-balance').innerText = `Rs. ${state.broker.cashBalance.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`;

        renderPortfolioHoldings();
        renderPortfolioOrders();
    } else {
        // Header Badge
        if (badge) {
            badge.className = 'broker-status-btn';
            badge.innerHTML = `<span class="pulse-dot" style="display:none;"></span> <span class="badge-text">🔌 Connect Broker</span>`;
        }
        // Settings Page Sections
        if (disconnectedSection) disconnectedSection.style.display = 'grid';
        if (connectedSection) connectedSection.style.display = 'none';
        
        // Portfolio Page Sections
        if (portfolioOfflineBanner) portfolioOfflineBanner.style.display = 'flex';
        if (portfolioConnectedCard) portfolioConnectedCard.style.display = 'none';
        if (portfolioOrdersCard) portfolioOrdersCard.style.display = 'none';
    }
}

function connectBroker(name, clientId, secret) {
    const log = document.getElementById('broker-sync-log');
    if (log) {
        log.innerHTML = '';
        appendConsoleLog('info', `Establishing handshakes with ${name} API gateway...`);
    }

    const btn = document.getElementById('btn-broker-connect');
    if (btn) btn.classList.add('btn-loading');

    setTimeout(() => {
        appendConsoleLog('info', `Authenticating client ID '${clientId}' using secure key exchange...`);
        setTimeout(() => {
            appendConsoleLog('info', `Verifying CDS Account details from Central Depository Systems Sri Lanka...`);
            setTimeout(() => {
                appendConsoleLog('success', `CDS accounts resolved successfully. Retrieving active holdings...`);
                setTimeout(() => {
                    state.broker.isConnected = true;
                    state.broker.name = name;
                    state.broker.clientId = clientId;
                    
                    // Pre-populate mock holdings if this is a fresh connection
                    if (state.broker.orders.length === 0) {
                        state.broker.buyingPower = 2500000.00;
                        state.broker.cashBalance = 2500000.00;
                        state.broker.holdings = [
                            { symbol: 'JKH.N0000', qty: 2000, avgPrice: 180.00 },
                            { symbol: 'EXPO.N0000', qty: 5000, avgPrice: 140.00 }
                        ];
                    }

                    localStorage.setItem('cse_broker_state', JSON.stringify(state.broker));
                    updateBrokerUI();
                    appendConsoleLog('success', `SYNC COMPLETED. Live brokerage streams matching incoming market feeds.`);

                    if (btn) btn.classList.remove('btn-loading');
                    alert(`Broker ${name} connected successfully! Live CDS holdings and trade execution are now enabled.`);
                }, 400);
            }, 500);
        }, 500);
    }, 500);
}

function disconnectBroker() {
    if (confirm(`Are you sure you want to disconnect your broker account? Trade execution and live CDS syncing will be deactivated.`)) {
        state.broker.isConnected = false;
        localStorage.setItem('cse_broker_state', JSON.stringify(state.broker));
        updateBrokerUI();
        
        const log = document.getElementById('broker-sync-log');
        if (log) {
            log.innerHTML = `<div class="console-line info">Account disconnected. Select a broker to establish a new API tunnel.</div>`;
        }
        alert("Broker account disconnected successfully.");
    }
}

function appendConsoleLog(type, text) {
    const log = document.getElementById('broker-sync-log');
    if (log) {
        const time = new Date().toLocaleTimeString();
        const line = document.createElement('div');
        line.className = `console-line ${type}`;
        line.innerText = `[${time}] ${text}`;
        log.appendChild(line);
        log.scrollTop = log.scrollHeight;
    }
}

function renderPortfolioHoldings(isLiveUpdate = false) {
    const tbody = document.getElementById('portfolio-holdings-tbody');
    if (!tbody) return;

    let totalMarketValue = 0;
    let totalCostValue = 0;

    const rowsHtml = state.broker.holdings.map(h => {
        const s = stocksDB.find(x => x.symbol === h.symbol) || { price: h.avgPrice };
        const mktPrice = s.price;
        const mktVal = h.qty * mktPrice;
        const costVal = h.qty * h.avgPrice;
        const gainLoss = mktVal - costVal;
        const gainLossPct = costVal > 0 ? (gainLoss / costVal) * 100 : 0;
        
        totalMarketValue += mktVal;
        totalCostValue += costVal;

        const glClass = gainLoss >= 0 ? 'text-success' : 'text-danger';
        const glSign = gainLoss >= 0 ? '+' : '';

        return `
            <tr data-symbol="${h.symbol}" data-qty="${h.qty}" data-avg-price="${h.avgPrice}">
                <td class="symbol-col">${h.symbol}</td>
                <td>${h.qty.toLocaleString()}</td>
                <td>Rs. ${h.avgPrice.toFixed(2)}</td>
                <td class="price-cell">Rs. ${mktPrice.toFixed(2)}</td>
                <td>Rs. ${mktVal.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                <td class="${glClass}">${glSign}Rs. ${gainLoss.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})} (${glSign}${gainLossPct.toFixed(2)}%)</td>
                <td>
                    <button class="btn-action" style="border-color: var(--danger-color); color: var(--danger-color);" onclick="openSellPanel('${h.symbol}')">SELL</button>
                </td>
            </tr>
        `;
    }).join('');

    if (!isLiveUpdate) {
        tbody.innerHTML = rowsHtml;
    } else {
        // In-place live updates to values
        state.broker.holdings.forEach(h => {
            const s = stocksDB.find(x => x.symbol === h.symbol);
            if (s) {
                const row = tbody.querySelector(`tr[data-symbol="${h.symbol}"]`);
                if (row) {
                    const priceCell = row.querySelector('.price-cell');
                    if (priceCell) priceCell.innerText = `Rs. ${s.price.toFixed(2)}`;
                    
                    const mktVal = h.qty * s.price;
                    const costVal = h.qty * h.avgPrice;
                    const gainLoss = mktVal - costVal;
                    const gainLossPct = (gainLoss / costVal) * 100;
                    
                    row.cells[4].innerText = `Rs. ${mktVal.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
                    
                    const glCell = row.cells[5];
                    glCell.className = gainLoss >= 0 ? 'text-success' : 'text-danger';
                    const glSign = gainLoss >= 0 ? '+' : '';
                    glCell.innerText = `${glSign}Rs. ${gainLoss.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})} (${glSign}${gainLossPct.toFixed(2)}%)`;
                }
            }
        });
    }

    const unrealizedPnL = totalMarketValue - totalCostValue;
    const totalAccountValue = state.broker.cashBalance + totalMarketValue;

    document.getElementById('portfolio-total-val').innerText = `Rs. ${totalAccountValue.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    
    const pnlEl = document.getElementById('portfolio-unrealized-pnl');
    if (pnlEl) {
        pnlEl.innerText = `${unrealizedPnL >= 0 ? '+' : ''}Rs. ${unrealizedPnL.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
        pnlEl.className = `stat-val ${unrealizedPnL >= 0 ? 'text-success' : 'text-danger'}`;
        pnlEl.style.fontSize = '18px';
    }

    // Update Settings Summary
    const settingsHoldingsCount = document.getElementById('connected-holdings-count');
    if (settingsHoldingsCount) settingsHoldingsCount.innerText = state.broker.holdings.length;
    const settingsHoldingsVal = document.getElementById('connected-holdings-value');
    if (settingsHoldingsVal) settingsHoldingsVal.innerText = `Rs. ${totalMarketValue.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
}

function renderPortfolioOrders() {
    const tbody = document.getElementById('portfolio-orders-tbody');
    if (!tbody) return;

    if (state.broker.orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 24px; color: var(--text-secondary)">No orders executed in this session.</td></tr>';
        return;
    }

    tbody.innerHTML = state.broker.orders.map(o => {
        const typeClass = o.type === 'BUY' ? 'text-success' : 'text-danger';
        return `
            <tr>
                <td class="text-secondary">${o.time}</td>
                <td class="symbol-col">${o.symbol}</td>
                <td class="${typeClass}" style="font-weight:700;">${o.type}</td>
                <td>${o.qty.toLocaleString()}</td>
                <td>Rs. ${o.price.toFixed(2)}</td>
                <td>Rs. ${o.total.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                <td><span class="badge" style="background: rgba(16, 185, 129, 0.15); color: var(--success-color)">MATCHED</span></td>
            </tr>
        `;
    }).join('');
}

window.openSellPanel = function(symbol) {
    // Open modal for sell
    openAnalysisModal(symbol);
    // Auto select Sell in trade panel
    setTimeout(() => {
        const typeSelect = document.getElementById('trade-type');
        if (typeSelect) {
            typeSelect.value = 'SELL';
            typeSelect.dispatchEvent(new Event('change'));
        }
    }, 100);
};

function initTradePanel(stock) {
    const panel = document.getElementById('modal-trade-panel');
    if (!panel) return;
    
    if (!state.broker.isConnected) {
        panel.innerHTML = `
            <div style="text-align: center; padding: 12px; color: var(--warning-color); font-size: 13px;">
                ⚠️ <b>Broker Account Offline:</b> Please connect your broker API in the Settings tab to place orders.
            </div>
        `;
        panel.style.display = 'block';
        return;
    }

    const holding = state.broker.holdings.find(h => h.symbol === stock.symbol);
    const ownedQty = holding ? holding.qty : 0;

    panel.innerHTML = `
        <h3 style="margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; font-size: 14px;">Place Simulated Market Order</h3>
        <div class="trade-input-row">
            <div class="trade-input-group">
                <label>Order Type</label>
                <select id="trade-type">
                    <option value="BUY">BUY (Long)</option>
                    <option value="SELL" ${ownedQty === 0 ? 'disabled' : ''}>SELL (Liquidate)</option>
                </select>
            </div>
            <div class="trade-input-group">
                <label>Quantity</label>
                <input type="number" id="trade-qty" value="100" min="1" step="1">
            </div>
            <div class="trade-input-group">
                <label>Execution Price (Rs)</label>
                <input type="number" id="trade-price" value="${stock.price.toFixed(2)}" readonly style="background: rgba(255,255,255,0.02); color: var(--text-secondary);">
            </div>
        </div>

        <div style="background: rgba(0,0,0,0.15); padding: 12px; border-radius: 8px; margin-bottom: 16px;">
            <div class="trade-summary-row">
                <span>Gross Trade Value:</span>
                <span id="trade-gross">Rs. 0.00</span>
            </div>
            <div class="trade-summary-row">
                <span>Broker & CDS Fees (1.12%):</span>
                <span id="trade-fees">Rs. 0.00</span>
            </div>
            ${ownedQty > 0 ? `<div class="trade-summary-row" style="color: #60a5fa;"><span>Currently Owned:</span><span>${ownedQty.toLocaleString()} shares</span></div>` : ''}
            <div class="trade-summary-total">
                <span id="trade-total-label">Total Est. Cost:</span>
                <span id="trade-total">Rs. 0.00</span>
            </div>
        </div>

        <div id="trade-error-msg" style="color: var(--danger-color); font-size: 12px; margin-bottom: 12px; display: none; font-weight: 500;">
            ⚠️ Insufficient buying power.
        </div>

        <button class="btn-primary" id="btn-confirm-trade" style="width: 100%; padding: 12px; font-size: 14px;">
            Confirm Order Match
        </button>
    `;

    panel.style.display = 'block';

    // Bind listeners
    const typeEl = document.getElementById('trade-type');
    const qtyEl = document.getElementById('trade-qty');
    const confirmBtn = document.getElementById('btn-confirm-trade');

    function recalculateOrder() {
        const type = typeEl.value;
        const qty = parseInt(qtyEl.value) || 0;
        const price = stock.price;
        const gross = qty * price;
        const fees = gross * 0.0112;
        
        document.getElementById('trade-gross').innerText = `Rs. ${gross.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
        document.getElementById('trade-fees').innerText = `Rs. ${fees.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
        
        let total = 0;
        const errorMsg = document.getElementById('trade-error-msg');
        errorMsg.style.display = 'none';

        if (type === 'BUY') {
            total = gross + fees;
            document.getElementById('trade-total-label').innerText = 'Total Est. Cost:';
            document.getElementById('trade-total').innerText = `Rs. ${total.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
            
            if (total > state.broker.buyingPower) {
                errorMsg.innerText = `⚠️ Insufficient buying power. Available: Rs. ${state.broker.buyingPower.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
                errorMsg.style.display = 'block';
                confirmBtn.disabled = true;
                confirmBtn.style.opacity = '0.5';
            } else {
                confirmBtn.disabled = false;
                confirmBtn.style.opacity = '1';
            }
        } else {
            total = gross - fees;
            document.getElementById('trade-total-label').innerText = 'Net Est. Proceeds:';
            document.getElementById('trade-total').innerText = `Rs. ${total.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
            
            if (qty > ownedQty) {
                errorMsg.innerText = `⚠️ Insufficient shares owned. You hold ${ownedQty.toLocaleString()} shares.`;
                errorMsg.style.display = 'block';
                confirmBtn.disabled = true;
                confirmBtn.style.opacity = '0.5';
            } else {
                confirmBtn.disabled = false;
                confirmBtn.style.opacity = '1';
            }
        }
    }

    typeEl.addEventListener('change', recalculateOrder);
    qtyEl.addEventListener('input', recalculateOrder);
    recalculateOrder();

    confirmBtn.addEventListener('click', () => {
        const type = typeEl.value;
        const qty = parseInt(qtyEl.value) || 0;
        const price = stock.price;
        
        executeOrder(stock.symbol, type, qty, price);
    });
}

function executeOrder(symbol, type, qty, price) {
    const gross = qty * price;
    const fees = gross * 0.0112;
    let netTotal = 0;
    
    const confirmBtn = document.getElementById('btn-confirm-trade');
    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = `<span class="btn-loading"></span> Matching Order...`;
    }

    setTimeout(() => {
        if (type === 'BUY') {
            netTotal = gross + fees;
            state.broker.buyingPower -= netTotal;
            state.broker.cashBalance -= netTotal;
            
            // Add/Update Holdings
            const holding = state.broker.holdings.find(h => h.symbol === symbol);
            if (holding) {
                const totalCost = (holding.qty * holding.avgPrice) + gross;
                holding.qty += qty;
                holding.avgPrice = totalCost / holding.qty;
            } else {
                state.broker.holdings.push({ symbol, qty, avgPrice: price });
            }
        } else {
            netTotal = gross - fees;
            state.broker.buyingPower += netTotal;
            state.broker.cashBalance += netTotal;
            
            // Subtract Holdings
            const holdingIndex = state.broker.holdings.findIndex(h => h.symbol === symbol);
            if (holdingIndex > -1) {
                const holding = state.broker.holdings[holdingIndex];
                holding.qty -= qty;
                if (holding.qty <= 0) {
                    state.broker.holdings.splice(holdingIndex, 1);
                }
            }
        }

        // Record Order
        const order = {
            time: new Date().toLocaleTimeString(),
            symbol,
            type,
            qty,
            price,
            total: gross
        };
        state.broker.orders.unshift(order);

        localStorage.setItem('cse_broker_state', JSON.stringify(state.broker));
        updateBrokerUI();
        
        // Print sync terminal logs
        appendConsoleLog(type === 'BUY' ? 'success' : 'warn', `Executed ${type} ${qty.toLocaleString()} ${symbol} @ Rs. ${price.toFixed(2)} via CDS API.`);

        alert(`Order successfully executed & matched on CSE! Details: ${type} ${qty.toLocaleString()} ${symbol} @ Rs. ${price.toFixed(2)}.`);
        
        // Close trade panel & modal
        document.getElementById('modal-trade-panel').style.display = 'none';
        closeModal();
    }, 1000);
}

