// Dashboard JavaScript

let currentServices = [];
let currentUser = null;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
    setupEventListeners();
});

async function initializeDashboard() {
    try {
        // Check authentication
        if (!requireAuth()) return;
        
        // Get user data
        currentUser = getUserData();
        if (!currentUser) {
            window.location.href = 'login.html';
            return;
        }
        
        // Update UI with user data
        updateUserInfo();
        
        // Load initial data
        await loadDashboardData();
        await loadServices();
        await loadOrders();
        await loadTransactions();
        await loadTickets();
        
        // Setup section switching
        setupSectionSwitching();
        
    } catch (error) {
        console.error('Dashboard initialization error:', error);
        showNotification('Failed to load dashboard data', 'error');
    }
}

function setupEventListeners() {
    // Deposit amount calculation
    const depositAmount = document.getElementById('deposit-amount');
    if (depositAmount) {
        depositAmount.addEventListener('input', updateDepositPreview);
    }
    
    // Deposit form submission
    const depositForm = document.getElementById('deposit-form');
    if (depositForm) {
        depositForm.addEventListener('submit', handleDeposit);
    }
    
    // Profile form submission
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', handleProfileUpdate);
    }
    
    // Password form submission
    const passwordForm = document.getElementById('password-form');
    if (passwordForm) {
        passwordForm.addEventListener('submit', handlePasswordChange);
    }
    
    // Support form submission
    const supportForm = document.getElementById('support-form');
    if (supportForm) {
        supportForm.addEventListener('submit', handleSupportTicket);
    }
    
    // Service filter tabs
    const filterTabs = document.querySelectorAll('.filter-tab');
    filterTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const platform = this.dataset.platform;
            filterServices(platform);
            
            // Update active tab
            filterTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

function updateUserInfo() {
    if (!currentUser) return;
    
    // Update sidebar user info
    const usernameElements = document.querySelectorAll('#user-username, #profile-username');
    const emailElements = document.querySelectorAll('#user-email, #profile-email');
    const balanceElements = document.querySelectorAll('#user-balance, #overview-balance');
    const balanceNairaElements = document.querySelectorAll('#user-balance-naira, #overview-balance-naira');
    
    usernameElements.forEach(el => el.textContent = currentUser.username);
    emailElements.forEach(el => el.textContent = currentUser.email);
    
    // Format balance (1 equity = ₦10)
    const balance = currentUser.balance || 0;
    const balanceNaira = balance * 10;
    
    balanceElements.forEach(el => el.textContent = `${balance} Equities`);
    balanceNairaElements.forEach(el => el.textContent = `₦${balanceNaira.toLocaleString()}`);
    
    // Update referral code
    const referralCodeElements = document.querySelectorAll('#user-referral-code, #referral-code-display');
    referralCodeElements.forEach(el => el.textContent = currentUser.referralCode || 'N/A');
    
    // Update referral link
    const referralLink = document.getElementById('referral-link-input');
    if (referralLink && currentUser.referralCode) {
        const baseUrl = window.location.origin;
        referralLink.value = `${baseUrl}/register.html?ref=${currentUser.referralCode}`;
    }
}

async function loadDashboardData() {
    try {
        const response = await makeAPIRequest('/user/profile', 'GET', null, true);
        
        if (response.success) {
            currentUser = response.user;
            setUserData(currentUser);
            updateUserInfo();
            
            // Update overview stats
            document.getElementById('overview-spent').textContent = `${response.user.totalSpent || 0} Equities`;
            document.getElementById('overview-orders').textContent = response.user.totalOrders || 0;
            document.getElementById('referral-count').textContent = response.user.referralCount || 0;
            document.getElementById('referral-earnings').textContent = `${response.user.referralEarnings || 0} Equities`;
            document.getElementById('overview-referral').textContent = `${response.user.referralEarnings || 0} Equities`;
            document.getElementById('overview-referral-count').textContent = `${response.user.referralCount || 0} Referrals`;
            
            // Load recent orders
            await loadRecentOrders();
        }
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

async function loadRecentOrders() {
    try {
        const response = await makeAPIRequest('/orders/my-orders', 'GET', null, true);
        
        if (response.success && response.orders.length > 0) {
            const recentOrders = response.orders.slice(0, 5);
            const tbody = document.getElementById('recent-orders');
            
            if (tbody) {
                tbody.innerHTML = recentOrders.map(order => `
                    <tr>
                        <td><code>${order.orderId.substring(0, 10)}...</code></td>
                        <td>${order.serviceName}</td>
                        <td>${order.quantity}</td>
                        <td>${order.cost} Equities</td>
                        <td><span class="status-badge status-${order.status}">${order.status}</span></td>
                    </tr>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Error loading recent orders:', error);
    }
}

async function loadServices() {
    try {
        const response = await makeAPIRequest('/services', 'GET');
        
        if (response.success) {
            currentServices = [];
            
            // Flatten services
            Object.values(response.services).forEach(platformServices => {
                platformServices.forEach(service => {
                    currentServices.push(service);
                });
            });
            
            displayServices(currentServices);
        }
    } catch (error) {
        console.error('Error loading services:', error);
        showNotification('Failed to load services', 'error');
    }
}

function displayServices(services) {
    const container = document.getElementById('services-container');
    if (!container) return;
    
    if (services.length === 0) {
        container.innerHTML = '<div class="text-center"><p>No services found.</p></div>';
        return;
    }
    
    container.innerHTML = services.map(service => `
        <div class="service-item" data-platform="${service.platform}" data-type="${service.type}">
            <div class="service-item-header">
                <div class="service-platform ${service.platform}">
                    <i class="fab fa-${service.platform}"></i>
                    <span>${service.platform.charAt(0).toUpperCase() + service.platform.slice(1)}</span>
                </div>
                <div class="service-actions">
                    <button class="btn-icon" title="Calculate" onclick="calculateOrder('${service.id}', '${service.name}')">
                        <i class="fas fa-calculator"></i>
                    </button>
                    <button class="btn-icon" title="Order" onclick="showOrderModal('${service.id}')">
                        <i class="fas fa-shopping-cart"></i>
                    </button>
                </div>
            </div>
            
            <h4 class="service-name">${service.name}</h4>
            <p class="service-description">${service.description || 'High quality service'}</p>
            
            <div class="service-details">
                <div class="detail-item">
                    <span class="detail-label">Type</span>
                    <span class="detail-value">${service.type}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Min</span>
                    <span class="detail-value">${service.min}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Max</span>
                    <span class="detail-value">${service.max}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Speed</span>
                    <span class="detail-value">${service.speed || 'Fast'}</span>
                </div>
            </div>
            
            <div class="service-price">
                <div class="price-amount">${service.ourRate / 1000} Equities</div>
                <div class="price-unit">Per 1000 units</div>
                <div class="text-muted">₦${service.nairaRate / 1000} per 1000</div>
            </div>
            
            <button class="btn btn-primary btn-block" onclick="showOrderModal('${service.id}')">
                <i class="fas fa-shopping-cart"></i> Order Now
            </button>
        </div>
    `).join('');
}

function filterServices(platform) {
    if (platform === 'all') {
        displayServices(currentServices);
        return;
    }
    
    const filtered = currentServices.filter(service => service.platform === platform);
    displayServices(filtered);
}

function searchServices() {
    const searchTerm = document.getElementById('service-search').value.toLowerCase();
    
    if (!searchTerm) {
        displayServices(currentServices);
        return;
    }
    
    const filtered = currentServices.filter(service => 
        service.name.toLowerCase().includes(searchTerm) ||
        service.type.toLowerCase().includes(searchTerm) ||
        service.platform.toLowerCase().includes(searchTerm)
    );
    
    displayServices(filtered);
}

async function loadOrders() {
    try {
        const filter = document.getElementById('order-filter')?.value || 'all';
        let url = '/orders/my-orders';
        
        const response = await makeAPIRequest(url, 'GET', null, true);
        
        if (response.success) {
            const orders = response.orders;
            const tbody = document.getElementById('orders-table');
            
            if (tbody) {
                if (orders.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="9" class="text-center">No orders found.</td></tr>';
                    return;
                }
                
                tbody.innerHTML = orders.map(order => `
                    <tr>
                        <td><code>${order.orderId}</code></td>
                        <td>${order.serviceName}</td>
                        <td>${order.platform}</td>
                        <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;">
                            ${order.targetUrl}
                        </td>
                        <td>${order.quantity}</td>
                        <td>${order.cost} Equities</td>
                        <td><span class="status-badge status-${order.status}">${order.status}</span></td>
                        <td>${new Date(order.createdAt).toLocaleDateString()}</td>
                        <td>
                            <button class="btn-icon" title="View Details" onclick="viewOrder('${order.orderId}')">
                                <i class="fas fa-eye"></i>
                            </button>
                            ${(order.status === 'pending' || order.status === 'processing') ? `
                            <button class="btn-icon" title="Cancel" onclick="cancelOrder('${order.orderId}')">
                                <i class="fas fa-times"></i>
                            </button>
                            ` : ''}
                        </td>
                    </tr>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Error loading orders:', error);
        showNotification('Failed to load orders', 'error');
    }
}

async function loadTransactions() {
    try {
        const filter = document.getElementById('transaction-filter')?.value || 'all';
        let url = '/deposit/history';
        
        if (filter !== 'deposit') {
            // For now, we only have deposit endpoint
            // In production, you'd have a separate transactions endpoint
            return;
        }
        
        const response = await makeAPIRequest(url, 'GET', null, true);
        
        if (response.success) {
            const transactions = response.transactions;
            const tbody = document.getElementById('transactions-table');
            const depositTbody = document.getElementById('deposit-history');
            
            [tbody, depositTbody].forEach(table => {
                if (table) {
                    if (transactions.length === 0) {
                        table.innerHTML = '<tr><td colspan="6" class="text-center">No transactions found.</td></tr>';
                        return;
                    }
                    
                    table.innerHTML = transactions.map(transaction => `
                        <tr>
                            <td><code>${transaction.transactionId}</code></td>
                            <td>${formatCurrency(transaction.amount)}</td>
                            <td>${transaction.equities} Equities</td>
                            <td><span class="status-badge status-${transaction.status}">${transaction.status}</span></td>
                            <td>${new Date(transaction.createdAt).toLocaleDateString()}</td>
                            <td>
                                ${transaction.status === 'pending' ? `
                                <button class="btn btn-outline btn-sm" onclick="uploadProof('${transaction.transactionId}')">
                                    Upload Proof
                                </button>
                                ` : ''}
                            </td>
                        </tr>
                    `).join('');
                }
            });
        }
    } catch (error) {
        console.error('Error loading transactions:', error);
    }
}

async function loadTickets() {
    try {
        const response = await makeAPIRequest('/support/my-tickets', 'GET', null, true);
        
        if (response.success) {
            const tickets = response.tickets;
            const tbody = document.getElementById('tickets-table');
            
            if (tbody) {
                if (tickets.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6" class="text-center">No tickets found.</td></tr>';
                    return;
                }
                
                tbody.innerHTML = tickets.map(ticket => `
                    <tr>
                        <td><code>${ticket.ticketId}</code></td>
                        <td>${ticket.subject}</td>
                        <td><span class="status-badge status-${ticket.status}">${ticket.status}</span></td>
                        <td><span class="status-badge">${ticket.priority}</span></td>
                        <td>${new Date(ticket.createdAt).toLocaleDateString()}</td>
                        <td>
                            <button class="btn-icon" title="View" onclick="viewTicket('${ticket.ticketId}')">
                                <i class="fas fa-eye"></i>
                            </button>
                        </td>
                    </tr>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Error loading tickets:', error);
    }
}

function setupSectionSwitching() {
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    const sections = document.querySelectorAll('.dashboard-section');
    
    sidebarLinks.forEach(link => {
        if (link.dataset.section) {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                
                const sectionId = this.dataset.section;
                
                // Hide all sections
                sections.forEach(section => {
                    section.classList.remove('active');
                });
                
                // Show selected section
                const targetSection = document.getElementById(`${sectionId}-section`);
                if (targetSection) {
                    targetSection.classList.add('active');
                }
                
                // Update active link
                sidebarLinks.forEach(l => l.classList.remove('active'));
                this.classList.add('active');
                
                // Update URL hash
                window.location.hash = sectionId;
            });
        }
    });
    
    // Handle initial hash
    const hash = window.location.hash.substring(1);
    if (hash) {
        const targetLink = document.querySelector(`.sidebar-link[data-section="${hash}"]`);
        if (targetLink) {
            targetLink.click();
        }
    }
}

// Modal Functions
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    const overlay = document.getElementById('modal-overlay');
    
    if (modal && overlay) {
        modal.style.display = 'block';
        overlay.style.display = 'block';
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    const overlay = document.getElementById('modal-overlay');
    
    if (modal && overlay) {
        modal.style.display = 'none';
        overlay.style.display = 'none';
        
        // Restore body scroll
        document.body.style.overflow = 'auto';
    }
}

function showDepositModal() {
    showModal('deposit-modal');
    updateDepositPreview();
}

function updateDepositPreview() {
    const amountInput = document.getElementById('deposit-amount');
    if (!amountInput) return;
    
    const amount = parseFloat(amountInput.value) || 0;
    const equities = Math.floor(amount / 10);
    
    document.getElementById('preview-amount').textContent = formatCurrency(amount);
    document.getElementById('preview-equities').textContent = `${equities} Equities`;
    document.getElementById('preview-receive').textContent = `${equities} Equities`;
}

async function handleDeposit(e) {
    e.preventDefault();
    
    const amount = parseFloat(document.getElementById('deposit-amount').value);
    const btn = e.target.querySelector('button[type="submit"]');
    
    if (!amount || amount < 500 || amount > 500000) {
        showNotification('Amount must be between ₦500 and ₦500,000', 'error');
        return;
    }
    
    try {
        setButtonLoading(btn, true);
        
        const response = await makeAPIRequest('/deposit/request', 'POST', {
            amount: amount
        }, true);
        
        if (response.success) {
            hideModal('deposit-modal');
            
            // Show deposit instructions
            showNotification('Deposit request created! Please send payment with the reference provided.', 'success', 10000);
            
            // Show deposit details modal (you can create this)
            showDepositInstructions(response.deposit);
            
            // Reload transactions
            loadTransactions();
        }
    } catch (error) {
        showNotification(error.message || 'Failed to create deposit request', 'error');
    } finally {
        setButtonLoading(btn, false);
    }
}

function showDepositInstructions(deposit) {
    const instructions = `
        <div class="deposit-instructions">
            <h4>Payment Instructions</h4>
            <div class="account-details">
                <p><strong>Account Name:</strong> ${process.env.MONIEPOINT_ACCOUNT_NAME || 'E-Acquire'}</p>
                <p><strong>Account Number:</strong> ${process.env.MONIEPOINT_ACCOUNT_NUMBER || 'XXXXXXXXXX'}</p>
                <p><strong>Bank:</strong> ${process.env.MONIEPOINT_BANK_NAME || 'Moniepoint'}</p>
                <p><strong>Reference:</strong> <code>${deposit.reference}</code></p>
                <p><strong>Amount:</strong> ${formatCurrency(deposit.amount)}</p>
            </div>
            <div class="alert alert-info">
                <p><strong>Important:</strong> Use the exact reference above when sending payment. Upload proof after payment.</p>
            </div>
            <button class="btn btn-primary btn-block" onclick="uploadProofModal('${deposit.transactionId}')">
                <i class="fas fa-upload"></i> Upload Payment Proof
            </button>
        </div>
    `;
    
    // Create and show modal with instructions
    // You can implement this as needed
    showNotification('Check your dashboard deposit section for payment details', 'info', 10000);
}

function uploadProof(transactionId) {
    // Implement proof upload modal
    showNotification('Proof upload feature coming soon', 'info');
}

async function showOrderModal(serviceId) {
    try {
        const service = currentServices.find(s => s.id === serviceId);
        if (!service) {
            showNotification('Service not found', 'error');
            return;
        }
        
        const modalContent = `
            <h4>Order: ${service.name}</h4>
            <form id="order-form">
                <div class="form-group">
                    <label for="order-url">Target URL</label>
                    <input type="url" id="order-url" class="form-control" placeholder="https://instagram.com/username" required>
                    <div class="form-hint">Enter the complete URL of the post/profile</div>
                </div>
                
                <div class="form-group">
                    <label for="order-quantity">Quantity</label>
                    <input type="number" id="order-quantity" class="form-control" 
                           min="${service.min}" max="${service.max}" 
                           value="${service.min}" required>
                    <div class="form-hint">Min: ${service.min}, Max: ${service.max}</div>
                </div>
                
                <div class="amount-preview">
                    <div class="preview-item">
                        <span>Service:</span>
                        <span>${service.name}</span>
                    </div>
                    <div class="preview-item">
                        <span>Price per 1000:</span>
                        <span>${service.ourRate / 1000} Equities</span>
                    </div>
                    <div class="preview-item">
                        <span>Total Cost:</span>
                        <span id="order-total">0 Equities</span>
                    </div>
                </div>
                
                <div class="alert alert-info">
                    <p><strong>Note:</strong> Orders are processed automatically. Refunds only for failed orders.</p>
                </div>
                
                <button type="submit" class="btn btn-primary btn-block">
                    <i class="fas fa-shopping-cart"></i> Place Order
                </button>
            </form>
        `;
        
        document.getElementById('order-modal-content').innerHTML = modalContent;
        showModal('order-modal');
        
        // Update total cost on quantity change
        const quantityInput = document.getElementById('order-quantity');
        if (quantityInput) {
            quantityInput.addEventListener('input', function() {
                const quantity = parseInt(this.value) || service.min;
                const total = Math.ceil((service.ourRate / 1000) * quantity);
                document.getElementById('order-total').textContent = `${total} Equities`;
            });
            
            // Trigger initial calculation
            quantityInput.dispatchEvent(new Event('input'));
        }
        
        // Handle form submission
        const orderForm = document.getElementById('order-form');
        if (orderForm) {
            orderForm.onsubmit = function(e) {
                e.preventDefault();
                placeOrder(serviceId);
            };
        }
        
    } catch (error) {
        console.error('Error showing order modal:', error);
        showNotification('Failed to load order form', 'error');
    }
}

async function placeOrder(serviceId) {
    const url = document.getElementById('order-url').value;
    const quantity = parseInt(document.getElementById('order-quantity').value);
    const btn = document.querySelector('#order-form button[type="submit"]');
    
    if (!url) {
        showNotification('Please enter target URL', 'error');
        return;
    }
    
    try {
        setButtonLoading(btn, true);
        
        const response = await makeAPIRequest('/orders/place', 'POST', {
            serviceId,
            targetUrl: url,
            quantity
        }, true);
        
        if (response.success) {
            hideModal('order-modal');
            showNotification('Order placed successfully!', 'success');
            
            // Reload orders and balance
            loadDashboardData();
            loadOrders();
        }
    } catch (error) {
        showNotification(error.message || 'Failed to place order', 'error');
    } finally {
        setButtonLoading(btn, false);
    }
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    
    const phone = document.getElementById('profile-phone').value;
    const btn = e.target.querySelector('button[type="submit"]');
    
    try {
        setButtonLoading(btn, true);
        
        const response = await makeAPIRequest('/user/profile', 'PUT', {
            phone
        }, true);
        
        if (response.success) {
            showNotification('Profile updated successfully', 'success');
            loadDashboardData();
        }
    } catch (error) {
        showNotification(error.message || 'Failed to update profile', 'error');
    } finally {
        setButtonLoading(btn, false);
    }
}

async function handlePasswordChange(e) {
    e.preventDefault();
    
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const btn = e.target.querySelector('button[type="submit"]');
    
    if (newPassword !== confirmPassword) {
        showNotification('Passwords do not match', 'error');
        return;
    }
    
    if (newPassword.length < 6) {
        showNotification('Password must be at least 6 characters', 'error');
        return;
    }
    
    try {
        setButtonLoading(btn, true);
        
        const response = await makeAPIRequest('/user/change-password', 'POST', {
            currentPassword,
            newPassword
        }, true);
        
        if (response.success) {
            showNotification('Password changed successfully', 'success');
            e.target.reset();
        }
    } catch (error) {
        showNotification(error.message || 'Failed to change password', 'error');
    } finally {
        setButtonLoading(btn, false);
    }
}

function showSupportModal() {
    showModal('support-modal');
}

async function handleSupportTicket(e) {
    e.preventDefault();
    
    const subject = document.getElementById('ticket-subject').value;
    const category = document.getElementById('ticket-category').value;
    const message = document.getElementById('ticket-message').value;
    const btn = e.target.querySelector('button[type="submit"]');
    
    if (!subject || !category || !message) {
        showNotification('Please fill all fields', 'error');
        return;
    }
    
    try {
        setButtonLoading(btn, true);
        
        const response = await makeAPIRequest('/support/ticket', 'POST', {
            subject,
            category,
            message
        }, true);
        
        if (response.success) {
            hideModal('support-modal');
            showNotification('Support ticket created successfully', 'success');
            loadTickets();
            e.target.reset();
        }
    } catch (error) {
        showNotification(error.message || 'Failed to create ticket', 'error');
    } finally {
        setButtonLoading(btn, false);
    }
}

// Referral Functions
function copyReferralCode() {
    const code = currentUser?.referralCode;
    if (!code) {
        showNotification('No referral code found', 'error');
        return;
    }
    
    navigator.clipboard.writeText(code).then(() => {
        showNotification('Referral code copied to clipboard!', 'success');
    }).catch(() => {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = code;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showNotification('Referral code copied!', 'success');
    });
}

function copyReferralLink() {
    const linkInput = document.getElementById('referral-link-input');
    if (!linkInput) return;
    
    linkInput.select();
    navigator.clipboard.writeText(linkInput.value).then(() => {
        showNotification('Referral link copied to clipboard!', 'success');
    }).catch(() => {
        document.execCommand('copy');
        showNotification('Referral link copied!', 'success');
    });
}

function shareWhatsApp() {
    const link = document.getElementById('referral-link-input')?.value;
    if (!link) return;
    
    const message = `Join E-Acquire and boost your social media! Use my referral code: ${currentUser?.referralCode}\n${link}`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
}

function shareTelegram() {
    const link = document.getElementById('referral-link-input')?.value;
    if (!link) return;
    
    const message = `Join E-Acquire and boost your social media! Use my referral code: ${currentUser?.referralCode}\n${link}`;
    const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
}

// Order Management
async function viewOrder(orderId) {
    try {
        const response = await makeAPIRequest(`/orders/${orderId}`, 'GET', null, true);
        
        if (response.success) {
            const order = response.order;
            const modalContent = `
                <h4>Order Details: ${order.orderId}</h4>
                <div class="order-details">
                    <div class="detail-row">
                        <span>Service:</span>
                        <span>${order.serviceName}</span>
                    </div>
                    <div class="detail-row">
                        <span>Platform:</span>
                        <span>${order.platform}</span>
                    </div>
                    <div class="detail-row">
                        <span>Target:</span>
                        <span style="word-break: break-all;">${order.targetUrl}</span>
                    </div>
                    <div class="detail-row">
                        <span>Quantity:</span>
                        <span>${order.quantity}</span>
                    </div>
                    <div class="detail-row">
                        <span>Cost:</span>
                        <span>${order.cost} Equities</span>
                    </div>
                    <div class="detail-row">
                        <span>Status:</span>
                        <span class="status-badge status-${order.status}">${order.status}</span>
                    </div>
                    <div class="detail-row">
                        <span>Created:</span>
                        <span>${new Date(order.createdAt).toLocaleString()}</span>
                    </div>
                    ${order.deliveredAt ? `
                    <div class="detail-row">
                        <span>Delivered:</span>
                        <span>${new Date(order.deliveredAt).toLocaleString()}</span>
                    </div>
                    ` : ''}
                    ${order.startCount ? `
                    <div class="detail-row">
                        <span>Start Count:</span>
                        <span>${order.startCount}</span>
                    </div>
                    ` : ''}
                    ${order.remains ? `
                    <div class="detail-row">
                        <span>Remaining:</span>
                        <span>${order.remains}</span>
                    </div>
                    ` : ''}
                </div>
                
                ${(order.status === 'pending' || order.status === 'processing') ? `
                <div class="alert alert-warning">
                    <p>You can cancel this order if it hasn't started yet.</p>
                </div>
                <button class="btn btn-danger btn-block" onclick="cancelOrder('${order.orderId}')">
                    <i class="fas fa-times"></i> Cancel Order
                </button>
                ` : ''}
            `;
            
            // Show in modal
            document.getElementById('order-modal-content').innerHTML = modalContent;
            showModal('order-modal');
        }
    } catch (error) {
        showNotification(error.message || 'Failed to load order details', 'error');
    }
}

async function cancelOrder(orderId) {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    
    try {
        const response = await makeAPIRequest(`/orders/${orderId}/cancel`, 'POST', null, true);
        
        if (response.success) {
            showNotification('Order cancelled successfully', 'success');
            hideModal('order-modal');
            loadDashboardData();
            loadOrders();
        }
    } catch (error) {
        showNotification(error.message || 'Failed to cancel order', 'error');
    }
}

async function viewTicket(ticketId) {
    try {
        const response = await makeAPIRequest(`/support/ticket/${ticketId}`, 'GET', null, true);
        
        if (response.success) {
            const ticket = response.ticket;
            const modalContent = `
                <h4>Ticket: ${ticket.ticketId}</h4>
                <div class="ticket-details">
                    <div class="detail-row">
                        <span>Subject:</span>
                        <span>${ticket.subject}</span>
                    </div>
                    <div class="detail-row">
                        <span>Status:</span>
                        <span class="status-badge status-${ticket.status}">${ticket.status}</span>
                    </div>
                    <div class="detail-row">
                        <span>Priority:</span>
                        <span>${ticket.priority}</span>
                    </div>
                    <div class="detail-row">
                        <span>Category:</span>
                        <span>${ticket.category}</span>
                    </div>
                    <div class="detail-row">
                        <span>Created:</span>
                        <span>${new Date(ticket.createdAt).toLocaleString()}</span>
                    </div>
                </div>
                
                <div class="ticket-message">
                    <h5>Initial Message:</h5>
                    <div class="message-content">
                        ${ticket.message}
                    </div>
                </div>
                
                ${ticket.replies?.length > 0 ? `
                <div class="ticket-replies">
                    <h5>Replies:</h5>
                    ${ticket.replies.map(reply => `
                        <div class="reply ${reply.isStaff ? 'staff' : ''}">
                            <div class="reply-header">
                                <span>${reply.isStaff ? 'Support Staff' : 'You'}</span>
                                <span>${new Date(reply.createdAt).toLocaleString()}</span>
                            </div>
                            <div class="reply-content">
                                ${reply.message}
                            </div>
                        </div>
                    `).join('')}
                </div>
                ` : ''}
                
                <form id="reply-form">
                    <div class="form-group">
                        <label for="reply-message">Reply Message</label>
                        <textarea id="reply-message" class="form-control" rows="3" required></textarea>
                    </div>
                    <button type="submit" class="btn btn-primary">
                        <i class="fas fa-paper-plane"></i> Send Reply
                    </button>
                </form>
            `;
            
            document.getElementById('order-modal-content').innerHTML = modalContent;
            showModal('order-modal');
            
            // Handle reply form
            const replyForm = document.getElementById('reply-form');
            if (replyForm) {
                replyForm.onsubmit = function(e) {
                    e.preventDefault();
                    sendTicketReply(ticketId);
                };
            }
        }
    } catch (error) {
        showNotification(error.message || 'Failed to load ticket', 'error');
    }
}

async function sendTicketReply(ticketId) {
    const message = document.getElementById('reply-message').value;
    const btn = document.querySelector('#reply-form button[type="submit"]');
    
    if (!message) {
        showNotification('Please enter a message', 'error');
        return;
    }
    
    try {
        setButtonLoading(btn, true);
        
        const response = await makeAPIRequest(`/support/ticket/${ticketId}/reply`, 'POST', {
            message
        }, true);
        
        if (response.success) {
            showNotification('Reply sent successfully', 'success');
            hideModal('order-modal');
            loadTickets();
        }
    } catch (error) {
        showNotification(error.message || 'Failed to send reply', 'error');
    } finally {
        setButtonLoading(btn, false);
    }
}

function calculateOrder(serviceId, serviceName) {
    const service = currentServices.find(s => s.id === serviceId);
    if (!service) return;
    
    const modalContent = `
        <h4>Calculate: ${serviceName}</h4>
        <form id="calculate-form">
            <div class="form-group">
                <label for="calculate-quantity">Quantity</label>
                <input type="number" id="calculate-quantity" class="form-control" 
                       min="${service.min}" max="${service.max}" 
                       value="${service.min}" required>
                <div class="form-hint">Min: ${service.min}, Max: ${service.max}</div>
            </div>
            
            <div class="amount-preview">
                <div class="preview-item">
                    <span>Price per 1000:</span>
                    <span>${service.ourRate / 1000} Equities</span>
                </div>
                <div class="preview-item">
                    <span>Total Cost:</span>
                    <span id="calculate-total">0 Equities</span>
                </div>
                <div class="preview-item">
                    <span>Cost in Naira:</span>
                    <span id="calculate-naira">₦0</span>
                </div>
            </div>
            
            <button type="button" class="btn btn-primary btn-block" onclick="proceedToOrder('${serviceId}')">
                <i class="fas fa-shopping-cart"></i> Proceed to Order
            </button>
        </form>
    `;
    
    document.getElementById('order-modal-content').innerHTML = modalContent;
    showModal('order-modal');
    
    // Update calculation on quantity change
    const quantityInput = document.getElementById('calculate-quantity');
    if (quantityInput) {
        quantityInput.addEventListener('input', function() {
            const quantity = parseInt(this.value) || service.min;
            const totalEquities = Math.ceil((service.ourRate / 1000) * quantity);
            const totalNaira = totalEquities * 10;
            
            document.getElementById('calculate-total').textContent = `${totalEquities} Equities`;
            document.getElementById('calculate-naira').textContent = `₦${totalNaira}`;
        });
        
        quantityInput.dispatchEvent(new Event('input'));
    }
}

function proceedToOrder(serviceId) {
    hideModal('order-modal');
    setTimeout(() => showOrderModal(serviceId), 300);
}

// Export for use in HTML
window.showDepositModal = showDepositModal;
window.loadServices = loadServices;
window.showSupportModal = showSupportModal;
window.copyReferralCode = copyReferralCode;
window.copyReferralLink = copyReferralLink;
window.shareWhatsApp = shareWhatsApp;
window.shareTelegram = shareTelegram;