// Admin Panel JavaScript
// API Configuration - Add this at the VERY TOP
const API_BASE_URL = 'https://e-acquire-socials.onrender.com';

// Authentication check
function requireAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// Get user data
function getUserData() {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
}

// Set user data
function setUserData(user) {
    localStorage.setItem('user', JSON.stringify(user));
}

// Logout function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

// Main API request function
async function makeAPIRequest(endpoint, method = 'GET', data = null, requiresAuth = false) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
    };
    
    if (requiresAuth) {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('Authentication required');
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const options = {
        method: method.toUpperCase(),
        headers: headers,
    };
    
    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        options.body = JSON.stringify(data);
    }
    
    const response = await fetch(url, options);
    return await response.json();
}

// Notification function
function showNotification(message, type = 'info') {
    alert(`${type.toUpperCase()}: ${message}`);
}

// Button loading function
function setButtonLoading(button, isLoading) {
    if (!button) return;
    
    if (isLoading) {
        button.setAttribute('data-original-text', button.innerHTML);
        button.innerHTML = 'Loading...';
        button.disabled = true;
    } else {
        const originalText = button.getAttribute('data-original-text');
        if (originalText) button.innerHTML = originalText;
        button.disabled = false;
    }
}

// Format currency
function formatCurrency(amount) {
    return `₦${amount.toLocaleString()}`;
}

// Make functions available globally
window.makeAPIRequest = makeAPIRequest;
window.showNotification = showNotification;
window.logout = logout;
window.formatCurrency = formatCurrency;
window.setButtonLoading = setButtonLoading;

// Add logout event listener
document.addEventListener('DOMContentLoaded', function() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
});
let currentAdminData = null;
let allUsers = [];
let allOrders = [];
let allTransactions = [];
let allTickets = [];
let allServices = [];

// Initialize admin panel
document.addEventListener('DOMContentLoaded', function() {
    initializeAdminPanel();
    setupAdminEventListeners();
});

async function initializeAdminPanel() {
    try {
        // Check authentication and admin role
        if (!requireAdmin()) return;
        
        // Get admin data
        currentAdminData = getUserData();
        if (!currentAdminData || currentAdminData.role !== 'admin') {
            window.location.href = 'dashboard.html';
            return;
        }
        
        // Update admin info
        updateAdminInfo();
        
        // Load initial data
        await loadAdminStats();
        await loadPendingDeposits();
        await loadAllUsers();
        await loadAllOrders();
        await loadAllTransactions();
        await loadAllServices();
        await loadSupportTickets();
        
        // Setup section switching
        setupAdminSectionSwitching();
        
        // Start system health check
        checkSystemHealth();
        startSystemClock();
        
    } catch (error) {
        console.error('Admin panel initialization error:', error);
        showNotification('Failed to load admin panel', 'error');
    }
}

function setupAdminEventListeners() {
    // Settings forms
    const generalSettings = document.getElementById('general-settings');
    if (generalSettings) {
        generalSettings.addEventListener('submit', handleGeneralSettings);
    }
    
    const apiSettings = document.getElementById('api-settings');
    if (apiSettings) {
        apiSettings.addEventListener('submit', handleApiSettings);
    }
    
    const depositSettings = document.getElementById('deposit-settings');
    if (depositSettings) {
        depositSettings.addEventListener('submit', handleDepositSettings);
    }
}

function updateAdminInfo() {
    if (!currentAdminData) return;
    
    const usernameElement = document.getElementById('admin-username');
    const emailElement = document.getElementById('admin-email');
    
    if (usernameElement) usernameElement.textContent = currentAdminData.username;
    if (emailElement) emailElement.textContent = currentAdminData.email;
}

async function loadAdminStats() {
    try {
        const response = await makeAPIRequest('/admin/stats', 'GET', null, true);
        
        if (response.success) {
            const stats = response.stats;
            
            // Update overview stats
            document.getElementById('total-users').textContent = stats.totalUsers || 0;
            document.getElementById('total-orders').textContent = stats.totalOrders || 0;
            document.getElementById('total-deposits').textContent = formatCurrency(stats.totalDeposits || 0);
            document.getElementById('total-revenue').textContent = `${stats.totalRevenue || 0} Equities`;
            document.getElementById('pending-deposits').textContent = '...'; // Will be updated separately
            document.getElementById('open-tickets').textContent = '...'; // Will be updated separately
            
            // Update recent users
            const recentUsersTbody = document.getElementById('recent-users');
            if (recentUsersTbody && stats.recentUsers) {
                recentUsersTbody.innerHTML = stats.recentUsers.map(user => `
                    <tr>
                        <td>${user.username}</td>
                        <td>${user.email}</td>
                        <td>${user.balance || 0} Equities</td>
                        <td>${new Date(user.createdAt).toLocaleDateString()}</td>
                        <td>
                            <button class="btn-icon" title="View" onclick="viewUserDetails('${user._id}')">
                                <i class="fas fa-eye"></i>
                            </button>
                        </td>
                    </tr>
                `).join('');
            }
            
            // Update recent orders
            const recentOrdersTbody = document.getElementById('recent-orders');
            if (recentOrdersTbody && stats.recentOrders) {
                recentOrdersTbody.innerHTML = stats.recentOrders.map(order => `
                    <tr>
                        <td><code>${order.orderId.substring(0, 10)}...</code></td>
                        <td>${order.userId?.username || 'N/A'}</td>
                        <td>${order.serviceName}</td>
                        <td>${order.cost} Equities</td>
                        <td><span class="status-badge status-${order.status}">${order.status}</span></td>
                    </tr>
                `).join('');
            }
            
            // Update Thekclaut balance
            document.getElementById('thekclaut-status').textContent = 
                stats.thekclautBalance ? `₦${stats.thekclautBalance}` : 'Not connected';
            
            // Update system info
            updateSystemInfo();
            
        }
    } catch (error) {
        console.error('Error loading admin stats:', error);
    }
}

async function loadPendingDeposits() {
    try {
        const response = await makeAPIRequest('/admin/deposits/pending', 'GET', null, true);
        
        if (response.success) {
            const deposits = response.deposits;
            
            // Update count badge
            const countElement = document.getElementById('pending-deposits-count');
            if (countElement) {
                countElement.textContent = deposits.length;
                countElement.style.display = deposits.length > 0 ? 'inline-block' : 'none';
            }
            
            // Update overview count
            document.getElementById('pending-deposits').textContent = deposits.length;
            
            // Update table
            const tbody = document.getElementById('pending-deposits-table');
            if (tbody) {
                if (deposits.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="8" class="text-center">No pending deposits found.</td></tr>';
                    return;
                }
                
                tbody.innerHTML = deposits.map(deposit => `
                    <tr>
                        <td><code>${deposit.transactionId}</code></td>
                        <td>${deposit.username} (${deposit.email})</td>
                        <td>${formatCurrency(deposit.amount)}</td>
                        <td>${deposit.equities} Equities</td>
                        <td><code>${deposit.reference}</code></td>
                        <td>
                            ${deposit.proofImage ? `
                            <button class="btn-icon" title="View Proof" onclick="viewProof('${deposit.transactionId}', '${deposit.proofImage}')">
                                <i class="fas fa-image"></i>
                            </button>
                            ` : 'No proof'}
                        </td>
                        <td>${new Date(deposit.createdAt).toLocaleDateString()}</td>
                        <td>
                            <div class="action-buttons">
                                <button class="btn btn-success btn-sm" onclick="approveDeposit('${deposit.transactionId}')">
                                    <i class="fas fa-check"></i> Approve
                                </button>
                                <button class="btn btn-danger btn-sm" onclick="rejectDeposit('${deposit.transactionId}')">
                                    <i class="fas fa-times"></i> Reject
                                </button>
                                <button class="btn btn-outline btn-sm" onclick="viewDepositDetails('${deposit.transactionId}')">
                                    <i class="fas fa-info-circle"></i> Details
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Error loading pending deposits:', error);
        showNotification('Failed to load pending deposits', 'error');
    }
}

async function loadAllUsers(page = 1, limit = 20) {
    try {
        // Note: We need to create this endpoint in backend
        // For now, we'll use the stats endpoint or implement a users endpoint
        const response = await makeAPIRequest(`/admin/users?page=${page}&limit=${limit}`, 'GET', null, true);
        
        if (response.success) {
            allUsers = response.users || [];
            const tbody = document.getElementById('users-table');
            
            if (tbody) {
                if (allUsers.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="9" class="text-center">No users found.</td></tr>';
                    return;
                }
                
                tbody.innerHTML = allUsers.map(user => `
                    <tr>
                        <td><code>${user._id.substring(0, 8)}...</code></td>
                        <td>${user.username}</td>
                        <td>${user.email}</td>
                        <td>${user.phone || 'N/A'}</td>
                        <td>${user.balance || 0} Equities</td>
                        <td><span class="role-badge role-${user.role}">${user.role}</span></td>
                        <td>
                            <span class="status-badge ${user.isActive ? 'status-active' : 'status-inactive'}">
                                ${user.isActive ? 'Active' : 'Inactive'}
                            </span>
                        </td>
                        <td>${new Date(user.createdAt).toLocaleDateString()}</td>
                        <td>
                            <div class="action-buttons">
                                <button class="btn-icon" title="View Details" onclick="viewUserDetails('${user._id}')">
                                    <i class="fas fa-eye"></i>
                                </button>
                                <button class="btn-icon" title="Edit" onclick="editUser('${user._id}')">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn-icon ${user.isActive ? 'text-danger' : 'text-success'}" 
                                        title="${user.isActive ? 'Deactivate' : 'Activate'}" 
                                        onclick="toggleUserStatus('${user._id}', ${user.isActive})">
                                    <i class="fas fa-${user.isActive ? 'ban' : 'check'}"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('');
            }
            
            // Update pagination
            updatePagination('users-pagination', page, limit, response.total || allUsers.length, loadAllUsers);
        }
    } catch (error) {
        console.error('Error loading all users:', error);
        // Fallback: Use recent users for now
        const tbody = document.getElementById('users-table');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center">User management endpoint not implemented yet.</td></tr>';
        }
    }
}

async function loadAllOrders(page = 1, limit = 20) {
    try {
        const filter = document.getElementById('admin-order-filter')?.value || 'all';
        const response = await makeAPIRequest(`/admin/orders?page=${page}&limit=${limit}&status=${filter}`, 'GET', null, true);
        
        if (response.success) {
            allOrders = response.orders || [];
            const tbody = document.getElementById('all-orders-table');
            
            if (tbody) {
                if (allOrders.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="10" class="text-center">No orders found.</td></tr>';
                    return;
                }
                
                tbody.innerHTML = allOrders.map(order => `
                    <tr>
                        <td><code>${order.orderId}</code></td>
                        <td>${order.userId?.username || 'Unknown'}</td>
                        <td>${order.serviceName}</td>
                        <td>${order.platform}</td>
                        <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis;">
                            ${order.targetUrl}
                        </td>
                        <td>${order.quantity}</td>
                        <td>${order.cost} Equities</td>
                        <td><span class="status-badge status-${order.status}">${order.status}</span></td>
                        <td>${new Date(order.createdAt).toLocaleDateString()}</td>
                        <td>
                            <div class="action-buttons">
                                <button class="btn-icon" title="View Details" onclick="viewOrderDetailsAdmin('${order.orderId}')">
                                    <i class="fas fa-eye"></i>
                                </button>
                                ${order.status === 'pending' || order.status === 'processing' ? `
                                <button class="btn-icon text-danger" title="Cancel" onclick="cancelOrderAdmin('${order.orderId}')">
                                    <i class="fas fa-times"></i>
                                </button>
                                ` : ''}
                            </div>
                        </td>
                    </tr>
                `).join('');
            }
            
            // Update pagination
            updatePagination('orders-pagination', page, limit, response.total || allOrders.length, loadAllOrders);
        }
    } catch (error) {
        console.error('Error loading all orders:', error);
        showNotification('Failed to load orders', 'error');
    }
}

async function loadAllTransactions(page = 1, limit = 20) {
    try {
        const filter = document.getElementById('admin-transaction-filter')?.value || 'all';
        const response = await makeAPIRequest(`/admin/transactions?page=${page}&limit=${limit}&type=${filter}`, 'GET', null, true);
        
        if (response.success) {
            allTransactions = response.transactions || [];
            const tbody = document.getElementById('all-transactions-table');
            
            if (tbody) {
                if (allTransactions.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="9" class="text-center">No transactions found.</td></tr>';
                    return;
                }
                
                tbody.innerHTML = allTransactions.map(transaction => `
                    <tr>
                        <td><code>${transaction.transactionId}</code></td>
                        <td>${transaction.userId?.username || 'Unknown'}</td>
                        <td><span class="type-badge type-${transaction.type}">${transaction.type}</span></td>
                        <td>${formatCurrency(transaction.amount)}</td>
                        <td>${transaction.equities} Equities</td>
                        <td><span class="status-badge status-${transaction.status}">${transaction.status}</span></td>
                        <td><code>${transaction.reference}</code></td>
                        <td>${new Date(transaction.createdAt).toLocaleDateString()}</td>
                        <td>${transaction.verifiedBy || 'N/A'}</td>
                    </tr>
                `).join('');
            }
            
            // Update pagination
            updatePagination('transactions-pagination', page, limit, response.total || allTransactions.length, loadAllTransactions);
        }
    } catch (error) {
        console.error('Error loading all transactions:', error);
        showNotification('Failed to load transactions', 'error');
    }
}

async function loadAllServices() {
    try {
        const response = await makeAPIRequest('/services', 'GET');
        
        if (response.success) {
            allServices = [];
            Object.values(response.services).forEach(platformServices => {
                platformServices.forEach(service => {
                    allServices.push(service);
                });
            });
            
            // Update stats
            document.getElementById('total-services').textContent = allServices.length;
            document.getElementById('last-synced').textContent = 
                response.lastUpdated ? new Date(response.lastUpdated).toLocaleString() : 'Never';
            
            // Count unique platforms
            const platforms = [...new Set(allServices.map(s => s.platform))];
            document.getElementById('platform-count').textContent = platforms.length;
            
            // Update table
            const tbody = document.getElementById('services-table');
            if (tbody) {
                tbody.innerHTML = allServices.map(service => `
                    <tr>
                        <td><code>${service.id}</code></td>
                        <td>${service.name}</td>
                        <td>${service.platform}</td>
                        <td>${service.type}</td>
                        <td>₦${service.rate / 1000}/1000</td>
                        <td>${service.ourRate / 1000} Equities/1000</td>
                        <td>${service.min}-${service.max}</td>
                        <td>
                            <span class="status-badge ${service.isActive !== false ? 'status-active' : 'status-inactive'}">
                                ${service.isActive !== false ? 'Active' : 'Inactive'}
                            </span>
                        </td>
                        <td>
                            <button class="btn-icon" title="Edit" onclick="editService('${service.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-icon" title="Toggle Status" onclick="toggleServiceStatus('${service.id}', ${service.isActive !== false})">
                                <i class="fas fa-power-off"></i>
                            </button>
                        </td>
                    </tr>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Error loading all services:', error);
        showNotification('Failed to load services', 'error');
    }
}

async function loadSupportTickets(page = 1, limit = 20) {
    try {
        const filter = document.getElementById('ticket-filter')?.value || 'all';
        const response = await makeAPIRequest(`/admin/tickets?page=${page}&limit=${limit}&status=${filter}`, 'GET', null, true);
        
        if (response.success) {
            allTickets = response.tickets || [];
            const tbody = document.getElementById('all-tickets-table');
            
            if (tbody) {
                if (allTickets.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="9" class="text-center">No tickets found.</td></tr>';
                    return;
                }
                
                tbody.innerHTML = allTickets.map(ticket => `
                    <tr>
                        <td><code>${ticket.ticketId}</code></td>
                        <td>${ticket.userId?.username || 'Unknown'}</td>
                        <td>${ticket.subject}</td>
                        <td>${ticket.category}</td>
                        <td><span class="priority-badge priority-${ticket.priority}">${ticket.priority}</span></td>
                        <td><span class="status-badge status-${ticket.status}">${ticket.status}</span></td>
                        <td>${new Date(ticket.createdAt).toLocaleDateString()}</td>
                        <td>${new Date(ticket.updatedAt).toLocaleDateString()}</td>
                        <td>
                            <div class="action-buttons">
                                <button class="btn-icon" title="View" onclick="viewTicketAdmin('${ticket.ticketId}')">
                                    <i class="fas fa-eye"></i>
                                </button>
                                <button class="btn-icon" title="Assign" onclick="assignTicket('${ticket.ticketId}')">
                                    <i class="fas fa-user-check"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('');
            }
            
            // Update open tickets count
            const openTickets = allTickets.filter(t => t.status === 'open' || t.status === 'in progress');
            document.getElementById('open-tickets').textContent = openTickets.length;
            
            // Update badge
            const badgeElement = document.getElementById('pending-tickets-count');
            if (badgeElement) {
                badgeElement.textContent = openTickets.length;
                badgeElement.style.display = openTickets.length > 0 ? 'inline-block' : 'none';
            }
            
            // Update pagination
            updatePagination('tickets-pagination', page, limit, response.total || allTickets.length, loadSupportTickets);
        }
    } catch (error) {
        console.error('Error loading support tickets:', error);
        showNotification('Failed to load support tickets', 'error');
    }
}

function setupAdminSectionSwitching() {
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

// Deposit Management
async function approveDeposit(transactionId) {
    if (!confirm('Are you sure you want to approve this deposit?')) return;
    
    try {
        const response = await makeAPIRequest('/admin/deposit/approve', 'POST', {
            transactionId,
            action: 'approve'
        }, true);
        
        if (response.success) {
            showNotification('Deposit approved successfully!', 'success');
            loadPendingDeposits();
            loadAdminStats();
        }
    } catch (error) {
        showNotification(error.message || 'Failed to approve deposit', 'error');
    }
}

async function rejectDeposit(transactionId) {
    const reason = prompt('Enter reason for rejection:', 'Incorrect payment details');
    if (reason === null) return;
    
    try {
        const response = await makeAPIRequest('/admin/deposit/approve', 'POST', {
            transactionId,
            action: 'reject',
            reason: reason || 'Rejected by admin'
        }, true);
        
        if (response.success) {
            showNotification('Deposit rejected successfully!', 'success');
            loadPendingDeposits();
            loadAdminStats();
        }
    } catch (error) {
        showNotification(error.message || 'Failed to reject deposit', 'error');
    }
}

function viewDepositDetails(transactionId) {
    const deposit = allTransactions.find(t => t.transactionId === transactionId);
    if (!deposit) {
        showNotification('Deposit not found', 'error');
        return;
    }
    
    const content = `
        <h4>Deposit Details: ${deposit.transactionId}</h4>
        <div class="deposit-details">
            <div class="detail-row">
                <span>User:</span>
                <span>${deposit.userId?.username || 'Unknown'} (${deposit.userId?.email || 'N/A'})</span>
            </div>
            <div class="detail-row">
                <span>Amount:</span>
                <span>${formatCurrency(deposit.amount)}</span>
            </div>
            <div class="detail-row">
                <span>Equities:</span>
                <span>${deposit.equities} Equities</span>
            </div>
            <div class="detail-row">
                <span>Reference:</span>
                <span><code>${deposit.reference}</code></span>
            </div>
            <div class="detail-row">
                <span>Status:</span>
                <span class="status-badge status-${deposit.status}">${deposit.status}</span>
            </div>
            <div class="detail-row">
                <span>Created:</span>
                <span>${new Date(deposit.createdAt).toLocaleString()}</span>
            </div>
            ${deposit.proofImage ? `
            <div class="detail-row">
                <span>Payment Proof:</span>
                <button class="btn btn-outline btn-sm" onclick="viewProof('${deposit.transactionId}', '${deposit.proofImage}')">
                    <i class="fas fa-image"></i> View Proof
                </button>
            </div>
            ` : ''}
            ${deposit.moniepointDetails ? `
            <div class="detail-row">
                <span>Sender Name:</span>
                <span>${deposit.moniepointDetails.senderName}</span>
            </div>
            <div class="detail-row">
                <span>Sender Account:</span>
                <span>${deposit.moniepointDetails.senderAccount}</span>
            </div>
            <div class="detail-row">
                <span>Transaction Date:</span>
                <span>${new Date(deposit.moniepointDetails.transactionDate).toLocaleString()}</span>
            </div>
            ` : ''}
        </div>
        
        ${deposit.status === 'pending' ? `
        <div class="action-buttons" style="margin-top: 20px;">
            <button class="btn btn-success" onclick="approveDeposit('${deposit.transactionId}')">
                <i class="fas fa-check"></i> Approve
            </button>
            <button class="btn btn-danger" onclick="rejectDeposit('${deposit.transactionId}')">
                <i class="fas fa-times"></i> Reject
            </button>
        </div>
        ` : ''}
    `;
    
    document.getElementById('deposit-action-content').innerHTML = content;
    showModal('deposit-action-modal');
}

function viewProof(transactionId, proofImage) {
    const content = `
        <h4>Payment Proof: ${transactionId}</h4>
        <div class="proof-image">
            <img src="${proofImage}" alt="Payment Proof" style="max-width: 100%; border-radius: 8px;">
        </div>
        <div class="proof-actions" style="margin-top: 20px;">
            <a href="${proofImage}" target="_blank" class="btn btn-outline">
                <i class="fas fa-external-link-alt"></i> Open in New Tab
            </a>
            <button class="btn btn-primary" onclick="downloadImage('${proofImage}', 'proof-${transactionId}')">
                <i class="fas fa-download"></i> Download
            </button>
        </div>
    `;
    
    document.getElementById('deposit-action-content').innerHTML = content;
    showModal('deposit-action-modal');
}

function downloadImage(url, filename) {
    fetch(url)
        .then(response => response.blob())
        .then(blob => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            link.click();
            URL.revokeObjectURL(link.href);
        })
        .catch(error => {
            console.error('Download error:', error);
            showNotification('Failed to download image', 'error');
        });
}

// User Management
async function viewUserDetails(userId) {
    try {
        const response = await makeAPIRequest(`/admin/user/${userId}`, 'GET', null, true);
        
        if (response.success) {
            const user = response.user;
            const content = `
                <h4>User Details: ${user.username}</h4>
                <div class="user-details-grid">
                    <div class="detail-section">
                        <h5>Account Information</h5>
                        <div class="detail-row">
                            <span>Username:</span>
                            <span>${user.username}</span>
                        </div>
                        <div class="detail-row">
                            <span>Email:</span>
                            <span>${user.email}</span>
                        </div>
                        <div class="detail-row">
                            <span>Phone:</span>
                            <span>${user.phone || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span>Role:</span>
                            <span class="role-badge role-${user.role}">${user.role}</span>
                        </div>
                        <div class="detail-row">
                            <span>Status:</span>
                            <span class="status-badge ${user.isActive ? 'status-active' : 'status-inactive'}">
                                ${user.isActive ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                        <div class="detail-row">
                            <span>Verified:</span>
                            <span>${user.isVerified ? 'Yes' : 'No'}</span>
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h5>Financial Information</h5>
                        <div class="detail-row">
                            <span>Balance:</span>
                            <span>${user.balance || 0} Equities (₦${(user.balance || 0) * 10})</span>
                        </div>
                        <div class="detail-row">
                            <span>Total Spent:</span>
                            <span>${user.totalSpent || 0} Equities</span>
                        </div>
                        <div class="detail-row">
                            <span>Total Orders:</span>
                            <span>${user.totalOrders || 0}</span>
                        </div>
                        <div class="detail-row">
                            <span>Referral Code:</span>
                            <span><code>${user.referralCode || 'N/A'}</code></span>
                        </div>
                        <div class="detail-row">
                            <span>Referred By:</span>
                            <span>${user.referredBy || 'No one'}</span>
                        </div>
                        <div class="detail-row">
                            <span>Referral Count:</span>
                            <span>${user.referralCount || 0}</span>
                        </div>
                        <div class="detail-row">
                            <span>Referral Earnings:</span>
                            <span>${user.referralEarnings || 0} Equities</span>
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h5>Account Activity</h5>
                        <div class="detail-row">
                            <span>Created:</span>
                            <span>${new Date(user.createdAt).toLocaleString()}</span>
                        </div>
                        <div class="detail-row">
                            <span>Last Login:</span>
                            <span>${user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}</span>
                        </div>
                        <div class="detail-row">
                            <span>Last Updated:</span>
                            <span>${new Date(user.updatedAt).toLocaleString()}</span>
                        </div>
                    </div>
                </div>
                
                <div class="action-buttons" style="margin-top: 20px;">
                    <button class="btn btn-primary" onclick="editUser('${user._id}')">
                        <i class="fas fa-edit"></i> Edit User
                    </button>
                    <button class="btn ${user.isActive ? 'btn-danger' : 'btn-success'}" 
                            onclick="toggleUserStatus('${user._id}', ${user.isActive})">
                        <i class="fas fa-${user.isActive ? 'ban' : 'check'}"></i> ${user.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button class="btn btn-warning" onclick="resetUserPassword('${user._id}')">
                        <i class="fas fa-key"></i> Reset Password
                    </button>
                </div>
            `;
            
            document.getElementById('user-details-content').innerHTML = content;
            showModal('user-details-modal');
        }
    } catch (error) {
        showNotification('Failed to load user details', 'error');
    }
}

async function toggleUserStatus(userId, isCurrentlyActive) {
    const action = isCurrentlyActive ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;
    
    try {
        const response = await makeAPIRequest(`/admin/user/${userId}/status`, 'POST', {
            action: action
        }, true);
        
        if (response.success) {
            showNotification(`User ${action}d successfully`, 'success');
            loadAllUsers();
            if (document.getElementById('user-details-modal').style.display === 'block') {
                hideModal('user-details-modal');
            }
        }
    } catch (error) {
        showNotification(error.message || `Failed to ${action} user`, 'error');
    }
}

async function editUser(userId) {
    // Implementation for editing user
    showNotification('Edit user feature coming soon', 'info');
}

async function resetUserPassword(userId) {
    const newPassword = prompt('Enter new password for user (minimum 6 characters):');
    if (!newPassword || newPassword.length < 6) {
        showNotification('Password must be at least 6 characters', 'error');
        return;
    }
    
    if (!confirm('Are you sure you want to reset this user\'s password?')) return;
    
    try {
        const response = await makeAPIRequest(`/admin/user/${userId}/reset-password`, 'POST', {
            newPassword
        }, true);
        
        if (response.success) {
            showNotification('Password reset successfully', 'success');
        }
    } catch (error) {
        showNotification(error.message || 'Failed to reset password', 'error');
    }
}

// Order Management (Admin)
async function viewOrderDetailsAdmin(orderId) {
    try {
        const response = await makeAPIRequest(`/admin/order/${orderId}`, 'GET', null, true);
        
        if (response.success) {
            const order = response.order;
            const content = `
                <h4>Order Details: ${order.orderId}</h4>
                <div class="order-details-grid">
                    <div class="detail-section">
                        <h5>Order Information</h5>
                        <div class="detail-row">
                            <span>Service:</span>
                            <span>${order.serviceName}</span>
                        </div>
                        <div class="detail-row">
                            <span>Platform:</span>
                            <span>${order.platform}</span>
                        </div>
                        <div class="detail-row">
                            <span>Type:</span>
                            <span>${order.type}</span>
                        </div>
                        <div class="detail-row">
                            <span>Target URL:</span>
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
                    </div>
                    
                    <div class="detail-section">
                        <h5>Status & Delivery</h5>
                        <div class="detail-row">
                            <span>Status:</span>
                            <span class="status-badge status-${order.status}">${order.status}</span>
                        </div>
                        <div class="detail-row">
                            <span>API Order ID:</span>
                            <span><code>${order.apiOrderId || 'N/A'}</code></span>
                        </div>
                        <div class="detail-row">
                            <span>Start Count:</span>
                            <span>${order.startCount || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span>Remains:</span>
                            <span>${order.remains || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span>Created:</span>
                            <span>${new Date(order.createdAt).toLocaleString()}</span>
                        </div>
                        <div class="detail-row">
                            <span>Updated:</span>
                            <span>${new Date(order.updatedAt).toLocaleString()}</span>
                        </div>
                        ${order.deliveredAt ? `
                        <div class="detail-row">
                            <span>Delivered:</span>
                            <span>${new Date(order.deliveredAt).toLocaleString()}</span>
                        </div>
                        ` : ''}
                    </div>
                    
                    <div class="detail-section">
                        <h5>User Information</h5>
                        <div class="detail-row">
                            <span>User:</span>
                            <span>${order.userId?.username || 'Unknown'} (${order.userId?.email || 'N/A'})</span>
                        </div>
                        <div class="detail-row">
                            <span>User ID:</span>
                            <span><code>${order.userId?._id || 'N/A'}</code></span>
                        </div>
                    </div>
                </div>
                
                ${order.apiResponse ? `
                <div class="detail-section">
                    <h5>API Response</h5>
                    <pre style="background: #f8fafc; padding: 10px; border-radius: 4px; overflow: auto; max-height: 200px;">
${JSON.stringify(order.apiResponse, null, 2)}
                    </pre>
                </div>
                ` : ''}
                
                ${order.status === 'pending' || order.status === 'processing' ? `
                <div class="action-buttons" style="margin-top: 20px;">
                    <button class="btn btn-danger" onclick="cancelOrderAdmin('${order.orderId}')">
                        <i class="fas fa-times"></i> Cancel Order
                    </button>
                    <button class="btn btn-warning" onclick="refillOrder('${order.orderId}')">
                        <i class="fas fa-redo"></i> Create Refill
                    </button>
                </div>
                ` : ''}
            `;
            
            document.getElementById('order-details-content').innerHTML = content;
            showModal('order-details-modal');
        }
    } catch (error) {
        showNotification('Failed to load order details', 'error');
    }
}

async function cancelOrderAdmin(orderId) {
    if (!confirm('Are you sure you want to cancel this order? This will refund the user.')) return;
    
    try {
        const response = await makeAPIRequest(`/admin/order/${orderId}/cancel`, 'POST', null, true);
        
        if (response.success) {
            showNotification('Order cancelled successfully', 'success');
            hideModal('order-details-modal');
            loadAllOrders();
            loadAdminStats();
        }
    } catch (error) {
        showNotification(error.message || 'Failed to cancel order', 'error');
    }
}

async function refillOrder(orderId) {
    if (!confirm('Create refill for this order?')) return;
    
    try {
        const response = await makeAPIRequest(`/admin/order/${orderId}/refill`, 'POST', null, true);
        
        if (response.success) {
            showNotification('Refill created successfully', 'success');
        }
    } catch (error) {
        showNotification(error.message || 'Failed to create refill', 'error');
    }
}

// Ticket Management
async function viewTicketAdmin(ticketId) {
    try {
        const response = await makeAPIRequest(`/admin/ticket/${ticketId}`, 'GET', null, true);
        
        if (response.success) {
            const ticket = response.ticket;
            const content = `
                <h4>Ticket: ${ticket.ticketId}</h4>
                <div class="ticket-details-grid">
                    <div class="detail-section">
                        <h5>Ticket Information</h5>
                        <div class="detail-row">
                            <span>Subject:</span>
                            <span>${ticket.subject}</span>
                        </div>
                        <div class="detail-row">
                            <span>Category:</span>
                            <span>${ticket.category}</span>
                        </div>
                        <div class="detail-row">
                            <span>Priority:</span>
                            <span class="priority-badge priority-${ticket.priority}">${ticket.priority}</span>
                        </div>
                        <div class="detail-row">
                            <span>Status:</span>
                            <span class="status-badge status-${ticket.status}">${ticket.status}</span>
                        </div>
                        <div class="detail-row">
                            <span>Assigned To:</span>
                            <span>${ticket.assignedTo || 'Unassigned'}</span>
                        </div>
                        <div class="detail-row">
                            <span>Created:</span>
                            <span>${new Date(ticket.createdAt).toLocaleString()}</span>
                        </div>
                        <div class="detail-row">
                            <span>Updated:</span>
                            <span>${new Date(ticket.updatedAt).toLocaleString()}</span>
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h5>User Information</h5>
                        <div class="detail-row">
                            <span>User:</span>
                            <span>${ticket.userId?.username || 'Unknown'} (${ticket.userId?.email || 'N/A'})</span>
                        </div>
                        <div class="detail-row">
                            <span>User ID:</span>
                            <span><code>${ticket.userId?._id || 'N/A'}</code></span>
                        </div>
                    </div>
                </div>
                
                <div class="ticket-message-section">
                    <h5>Initial Message</h5>
                    <div class="message-box">
                        ${ticket.message}
                    </div>
                </div>
                
                ${ticket.replies?.length > 0 ? `
                <div class="ticket-replies-section">
                    <h5>Conversation</h5>
                    <div class="replies-container">
                        ${ticket.replies.map(reply => `
                            <div class="reply ${reply.isStaff ? 'staff-reply' : 'user-reply'}">
                                <div class="reply-header">
                                    <span class="reply-author">${reply.isStaff ? 'Staff' : ticket.userId?.username || 'User'}</span>
                                    <span class="reply-time">${new Date(reply.createdAt).toLocaleString()}</span>
                                </div>
                                <div class="reply-content">
                                    ${reply.message}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
                
                <div class="ticket-reply-section" style="margin-top: 20px;">
                    <h5>Reply as Admin</h5>
                    <form id="admin-reply-form">
                        <div class="form-group">
                            <textarea id="admin-reply-message" class="form-control" rows="4" placeholder="Enter your reply..." required></textarea>
                        </div>
                        <div class="form-group">
                            <select id="ticket-status-update" class="form-control">
                                <option value="">Keep current status</option>
                                <option value="in progress">Mark as In Progress</option>
                                <option value="awaiting reply">Mark as Awaiting Reply</option>
                                <option value="resolved">Mark as Resolved</option>
                                <option value="closed">Mark as Closed</option>
                            </select>
                        </div>
                        <button type="submit" class="btn btn-primary">
                            <i class="fas fa-paper-plane"></i> Send Reply
                        </button>
                    </form>
                </div>
            `;
            
            document.getElementById('ticket-details-content').innerHTML = content;
            showModal('ticket-details-modal');
            
            // Handle reply form
            const replyForm = document.getElementById('admin-reply-form');
            if (replyForm) {
                replyForm.onsubmit = function(e) {
                    e.preventDefault();
                    sendAdminReply(ticketId);
                };
            }
        }
    } catch (error) {
        showNotification('Failed to load ticket details', 'error');
    }
}

async function sendAdminReply(ticketId) {
    const message = document.getElementById('admin-reply-message').value;
    const status = document.getElementById('ticket-status-update').value;
    
    if (!message) {
        showNotification('Please enter a message', 'error');
        return;
    }
    
    try {
        const data = { message };
        if (status) {
            data.status = status;
        }
        
        const response = await makeAPIRequest(`/admin/ticket/${ticketId}/reply`, 'POST', data, true);
        
        if (response.success) {
            showNotification('Reply sent successfully', 'success');
            hideModal('ticket-details-modal');
            loadSupportTickets();
        }
    } catch (error) {
        showNotification(error.message || 'Failed to send reply', 'error');
    }
}

async function assignTicket(ticketId) {
    const staff = prompt('Enter staff username to assign ticket to:');
    if (!staff) return;
    
    try {
        const response = await makeAPIRequest(`/admin/ticket/${ticketId}/assign`, 'POST', {
            staff
        }, true);
        
        if (response.success) {
            showNotification(`Ticket assigned to ${staff}`, 'success');
            loadSupportTickets();
        }
    } catch (error) {
        showNotification(error.message || 'Failed to assign ticket', 'error');
    }
}

// Service Management
async function syncServices() {
    if (!confirm('Sync services from Thekclaut? This may take a moment.')) return;
    
    try {
        const response = await makeAPIRequest('/admin/services/sync', 'POST', null, true);
        
        if (response.success) {
            showNotification('Services synced successfully', 'success');
            loadAllServices();
            loadAdminStats();
        }
    } catch (error) {
        showNotification(error.message || 'Failed to sync services', 'error');
    }
}

async function toggleServiceStatus(serviceId, isCurrentlyActive) {
    const action = isCurrentlyActive ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${action} this service?`)) return;
    
    try {
        const response = await makeAPIRequest(`/admin/service/${serviceId}/status`, 'POST', {
            action: action
        }, true);
        
        if (response.success) {
            showNotification(`Service ${action}d successfully`, 'success');
            loadAllServices();
        }
    } catch (error) {
        showNotification(error.message || `Failed to ${action} service`, 'error');
    }
}

function editService(serviceId) {
    showNotification('Edit service feature coming soon', 'info');
}

function showServiceStats() {
    showNotification('Service statistics feature coming soon', 'info');
}

// System Functions
async function checkSystemHealth() {
    try {
        const response = await makeAPIRequest('/api/health', 'GET');
        
        if (response.success) {
            document.getElementById('backend-status').textContent = '✅ Online';
            document.getElementById('backend-status').className = 'info-value online';
            
            document.getElementById('database-status').textContent = 
                response.database.connected ? '✅ Connected' : '❌ Disconnected';
            document.getElementById('database-status').className = 
                `info-value ${response.database.connected ? 'online' : 'offline'}`;
            
            document.getElementById('thekclaut-status').textContent = 
                response.thekclautAPI.status === 'connected' ? '✅ Connected' : '❌ Disconnected';
            document.getElementById('thekclaut-status').className = 
                `info-value ${response.thekclautAPI.status === 'connected' ? 'online' : 'offline'}`;
            
            // Update API status in sidebar
            const apiStatusElement = document.getElementById('api-status');
            if (apiStatusElement) {
                apiStatusElement.textContent = 'Online';
                apiStatusElement.className = 'status-indicator online';
            }
            
            // Show modal with detailed info
            if (document.getElementById('system-health-modal').style.display === 'block') {
                const healthContent = `
                    <div class="health-check">
                        <h4>System Health Status</h4>
                        <div class="health-item">
                            <span>Backend:</span>
                            <span class="status ${response.success ? 'healthy' : 'unhealthy'}">
                                ${response.success ? 'Healthy' : 'Unhealthy'}
                            </span>
                        </div>
                        <div class="health-item">
                            <span>Database:</span>
                            <span class="status ${response.database.connected ? 'healthy' : 'unhealthy'}">
                                ${response.database.connected ? 'Connected' : 'Disconnected'}
                            </span>
                        </div>
                        <div class="health-item">
                            <span>Thekclaut API:</span>
                            <span class="status ${response.thekclautAPI.status === 'connected' ? 'healthy' : 'unhealthy'}">
                                ${response.thekclautAPI.status === 'connected' ? 'Connected' : 'Disconnected'}
                            </span>
                        </div>
                        <div class="health-item">
                            <span>Environment:</span>
                            <span>${response.environment || 'development'}</span>
                        </div>
                        <div class="health-item">
                            <span>Timestamp:</span>
                            <span>${new Date(response.timestamp).toLocaleString()}</span>
                        </div>
                        <div class="health-item">
                            <span>Thekclaut Balance:</span>
                            <span>₦${response.thekclautAPI.balance || '0'}</span>
                        </div>
                    </div>
                `;
                document.getElementById('system-health-content').innerHTML = healthContent;
            }
            
            return true;
        }
    } catch (error) {
        console.error('Health check failed:', error);
        document.getElementById('backend-status').textContent = '❌ Offline';
        document.getElementById('backend-status').className = 'info-value offline';
        
        const apiStatusElement = document.getElementById('api-status');
        if (apiStatusElement) {
            apiStatusElement.textContent = 'Offline';
            apiStatusElement.className = 'status-indicator offline';
        }
        
        return false;
    }
}

function startSystemClock() {
    function updateClock() {
        const now = new Date();
        document.getElementById('server-time').textContent = now.toLocaleTimeString();
        
        // Calculate uptime (simplified - would need backend support for actual uptime)
        if (!window.serverStartTime) {
            window.serverStartTime = now;
        }
        const uptime = Math.floor((now - window.serverStartTime) / 1000);
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = uptime % 60;
        document.getElementById('uptime').textContent = `${hours}h ${minutes}m ${seconds}s`;
    }
    
    updateClock();
    setInterval(updateClock, 1000);
}

function updateSystemInfo() {
    // Update system information
    const now = new Date();
    document.getElementById('server-time').textContent = now.toLocaleTimeString();
}

function updatePagination(elementId, currentPage, limit, totalItems, loadFunction) {
    const paginationElement = document.getElementById(elementId);
    if (!paginationElement) return;
    
    const totalPages = Math.ceil(totalItems / limit);
    if (totalPages <= 1) {
        paginationElement.innerHTML = '';
        return;
    }
    
    let paginationHTML = `
        <div class="pagination-controls">
            <button class="btn btn-outline btn-sm ${currentPage === 1 ? 'disabled' : ''}" 
                    onclick="${currentPage > 1 ? `${loadFunction.name}(${currentPage - 1}, ${limit})` : ''}">
                <i class="fas fa-chevron-left"></i> Previous
            </button>
            
            <span class="page-info">Page ${currentPage} of ${totalPages}</span>
            
            <button class="btn btn-outline btn-sm ${currentPage === totalPages ? 'disabled' : ''}" 
                    onclick="${currentPage < totalPages ? `${loadFunction.name}(${currentPage + 1}, ${limit})` : ''}">
                Next <i class="fas fa-chevron-right"></i>
            </button>
        </div>
    `;
    
    paginationElement.innerHTML = paginationHTML;
}

// Search Functions
function searchUsers() {
    const searchTerm = document.getElementById('user-search').value.toLowerCase();
    
    if (!searchTerm) {
        // Reset to show all users
        const tbody = document.getElementById('users-table');
        if (tbody && allUsers.length > 0) {
            tbody.innerHTML = allUsers.map(user => `
                <tr>
                    <td><code>${user._id.substring(0, 8)}...</code></td>
                    <td>${user.username}</td>
                    <td>${user.email}</td>
                    <td>${user.phone || 'N/A'}</td>
                    <td>${user.balance || 0} Equities</td>
                    <td><span class="role-badge role-${user.role}">${user.role}</span></td>
                    <td>
                        <span class="status-badge ${user.isActive ? 'status-active' : 'status-inactive'}">
                            ${user.isActive ? 'Active' : 'Inactive'}
                        </span>
                    </td>
                    <td>${new Date(user.createdAt).toLocaleDateString()}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-icon" title="View Details" onclick="viewUserDetails('${user._id}')">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn-icon" title="Edit" onclick="editUser('${user._id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-icon ${user.isActive ? 'text-danger' : 'text-success'}" 
                                    title="${user.isActive ? 'Deactivate' : 'Activate'}" 
                                    onclick="toggleUserStatus('${user._id}', ${user.isActive})">
                                <i class="fas fa-${user.isActive ? 'ban' : 'check'}"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
        return;
    }
    
    const filteredUsers = allUsers.filter(user => 
        user.username.toLowerCase().includes(searchTerm) ||
        user.email.toLowerCase().includes(searchTerm) ||
        (user.phone && user.phone.includes(searchTerm)) ||
        user._id.toLowerCase().includes(searchTerm)
    );
    
    const tbody = document.getElementById('users-table');
    if (tbody) {
        if (filteredUsers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center">No users found matching search.</td></tr>';
            return;
        }
        
        tbody.innerHTML = filteredUsers.map(user => `
            <tr>
                <td><code>${user._id.substring(0, 8)}...</code></td>
                <td>${user.username}</td>
                <td>${user.email}</td>
                <td>${user.phone || 'N/A'}</td>
                <td>${user.balance || 0} Equities</td>
                <td><span class="role-badge role-${user.role}">${user.role}</span></td>
                <td>
                    <span class="status-badge ${user.isActive ? 'status-active' : 'status-inactive'}">
                        ${user.isActive ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>${new Date(user.createdAt).toLocaleDateString()}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon" title="View Details" onclick="viewUserDetails('${user._id}')">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-icon" title="Edit" onclick="editUser('${user._id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon ${user.isActive ? 'text-danger' : 'text-success'}" 
                                title="${user.isActive ? 'Deactivate' : 'Activate'}" 
                                onclick="toggleUserStatus('${user._id}', ${user.isActive})">
                            <i class="fas fa-${user.isActive ? 'ban' : 'check'}"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }
}

function searchOrders() {
    const searchTerm = document.getElementById('order-search').value.toLowerCase();
    
    if (!searchTerm) {
        // Reset to show all orders
        const tbody = document.getElementById('all-orders-table');
        if (tbody && allOrders.length > 0) {
            tbody.innerHTML = allOrders.map(order => `
                <tr>
                    <td><code>${order.orderId}</code></td>
                    <td>${order.userId?.username || 'Unknown'}</td>
                    <td>${order.serviceName}</td>
                    <td>${order.platform}</td>
                    <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis;">
                        ${order.targetUrl}
                    </td>
                    <td>${order.quantity}</td>
                    <td>${order.cost} Equities</td>
                    <td><span class="status-badge status-${order.status}">${order.status}</span></td>
                    <td>${new Date(order.createdAt).toLocaleDateString()}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-icon" title="View Details" onclick="viewOrderDetailsAdmin('${order.orderId}')">
                                <i class="fas fa-eye"></i>
                            </button>
                            ${order.status === 'pending' || order.status === 'processing' ? `
                            <button class="btn-icon text-danger" title="Cancel" onclick="cancelOrderAdmin('${order.orderId}')">
                                <i class="fas fa-times"></i>
                            </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `).join('');
        }
        return;
    }
    
    const filteredOrders = allOrders.filter(order => 
        order.orderId.toLowerCase().includes(searchTerm) ||
        order.serviceName.toLowerCase().includes(searchTerm) ||
        order.platform.toLowerCase().includes(searchTerm) ||
        order.targetUrl.toLowerCase().includes(searchTerm) ||
        (order.userId?.username && order.userId.username.toLowerCase().includes(searchTerm))
    );
    
    const tbody = document.getElementById('all-orders-table');
    if (tbody) {
        if (filteredOrders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="text-center">No orders found matching search.</td></tr>';
            return;
        }
        
        tbody.innerHTML = filteredOrders.map(order => `
            <tr>
                <td><code>${order.orderId}</code></td>
                <td>${order.userId?.username || 'Unknown'}</td>
                <td>${order.serviceName}</td>
                <td>${order.platform}</td>
                <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis;">
                    ${order.targetUrl}
                </td>
                <td>${order.quantity}</td>
                <td>${order.cost} Equities</td>
                <td><span class="status-badge status-${order.status}">${order.status}</span></td>
                <td>${new Date(order.createdAt).toLocaleDateString()}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon" title="View Details" onclick="viewOrderDetailsAdmin('${order.orderId}')">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${order.status === 'pending' || order.status === 'processing' ? `
                        <button class="btn-icon text-danger" title="Cancel" onclick="cancelOrderAdmin('${order.orderId}')">
                            <i class="fas fa-times"></i>
                        </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `).join('');
    }
}

function searchServicesAdmin() {
    const searchTerm = document.getElementById('service-search-admin').value.toLowerCase();
    
    if (!searchTerm) {
        // Reset to show all services
        const tbody = document.getElementById('services-table');
        if (tbody && allServices.length > 0) {
            tbody.innerHTML = allServices.map(service => `
                <tr>
                    <td><code>${service.id}</code></td>
                    <td>${service.name}</td>
                    <td>${service.platform}</td>
                    <td>${service.type}</td>
                    <td>₦${service.rate / 1000}/1000</td>
                    <td>${service.ourRate / 1000} Equities/1000</td>
                    <td>${service.min}-${service.max}</td>
                    <td>
                        <span class="status-badge ${service.isActive !== false ? 'status-active' : 'status-inactive'}">
                            ${service.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                    </td>
                    <td>
                        <button class="btn-icon" title="Edit" onclick="editService('${service.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon" title="Toggle Status" onclick="toggleServiceStatus('${service.id}', ${service.isActive !== false})">
                            <i class="fas fa-power-off"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        }
        return;
    }
    
    const filteredServices = allServices.filter(service => 
        service.id.toLowerCase().includes(searchTerm) ||
        service.name.toLowerCase().includes(searchTerm) ||
        service.platform.toLowerCase().includes(searchTerm) ||
        service.type.toLowerCase().includes(searchTerm)
    );
    
    const tbody = document.getElementById('services-table');
    if (tbody) {
        if (filteredServices.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center">No services found matching search.</td></tr>';
            return;
        }
        
        tbody.innerHTML = filteredServices.map(service => `
            <tr>
                <td><code>${service.id}</code></td>
                <td>${service.name}</td>
                <td>${service.platform}</td>
                <td>${service.type}</td>
                <td>₦${service.rate / 1000}/1000</td>
                <td>${service.ourRate / 1000} Equities/1000</td>
                <td>${service.min}-${service.max}</td>
                <td>
                    <span class="status-badge ${service.isActive !== false ? 'status-active' : 'status-inactive'}">
                        ${service.isActive !== false ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>
                    <button class="btn-icon" title="Edit" onclick="editService('${service.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon" title="Toggle Status" onclick="toggleServiceStatus('${service.id}', ${service.isActive !== false})">
                        <i class="fas fa-power-off"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }
}

// Settings Functions
async function handleGeneralSettings(e) {
    e.preventDefault();
    showNotification('Settings saved successfully', 'success');
    // In a real application, you would make an API call here
}

async function handleApiSettings(e) {
    e.preventDefault();
    showNotification('API settings updated', 'success');
    // In a real application, you would make an API call here
}

async function handleDepositSettings(e) {
    e.preventDefault();
    showNotification('Deposit settings updated', 'success');
    // In a real application, you would make an API call here
}

function clearCache() {
    if (confirm('Clear all cache? This will not affect the database.')) {
        showNotification('Cache cleared successfully', 'success');
    }
}

function backupDatabase() {
    showNotification('Database backup started...', 'info');
    // In a real application, you would trigger a backup here
}

function showMaintenanceModal() {
    showNotification('Maintenance mode feature coming soon', 'info');
}

function resetSystem() {
    if (confirm('⚠️ DANGER: This will reset the entire system! Are you absolutely sure?')) {
        const confirmation = prompt('Type "RESET" to confirm:');
        if (confirmation === 'RESET') {
            showNotification('System reset initiated...', 'warning');
            // In a real application, you would trigger a system reset here
        }
    }
}

// Additional CSS for admin-specific elements
const adminStyles = `
    .badge {
        display: inline-block;
        padding: 2px 6px;
        background-color: var(--danger-color);
        color: white;
        border-radius: 10px;
        font-size: 0.75rem;
        font-weight: 600;
        min-width: 20px;
        text-align: center;
    }
    
    .status-indicator {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 0.75rem;
        font-weight: 600;
    }
    
    .status-indicator.online {
        background-color: var(--success-color);
        color: white;
    }
    
    .status-indicator.offline {
        background-color: var(--danger-color);
        color: white;
    }
    
    .role-badge {
        display: inline-block;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
    }
    
    .role-user {
        background-color: #dbeafe;
        color: #1e40af;
    }
    
    .role-admin {
        background-color: #fce7f3;
        color: #9d174d;
    }
    
    .role-support {
        background-color: #fef3c7;
        color: #92400e;
    }
    
    .type-badge {
        display: inline-block;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
    }
    
    .type-deposit {
        background-color: #d1fae5;
        color: #065f46;
    }
    
    .type-order {
        background-color: #dbeafe;
        color: #1e40af;
    }
    
    .type-refund {
        background-color: #f3f4f6;
        color: #374151;
    }
    
    .type-referral {
        background-color: #fce7f3;
        color: #9d174d;
    }
    
    .type-bonus {
        background-color: #fef3c7;
        color: #92400e;
    }
    
    .priority-badge {
        display: inline-block;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
    }
    
    .priority-low {
        background-color: #d1fae5;
        color: #065f46;
    }
    
    .priority-medium {
        background-color: #fef3c7;
        color: #92400e;
    }
    
    .priority-high {
        background-color: #fde68a;
        color: #92400e;
    }
    
    .priority-urgent {
        background-color: #fee2e2;
        color: #991b1b;
    }
    
    .action-buttons {
        display: flex;
        gap: 4px;
    }
    
    .user-details-grid, .order-details-grid, .ticket-details-grid {
        display: grid;
        gap: 20px;
        margin-bottom: 20px;
    }
    
    .detail-section {
        background: #f8fafc;
        padding: 15px;
        border-radius: var(--border-radius);
        border: 1px solid #e5e7eb;
    }
    
    .detail-section h5 {
        margin-top: 0;
        margin-bottom: 10px;
        color: var(--dark-color);
        font-size: 1rem;
    }
    
    .detail-row {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid #e5e7eb;
    }
    
    .detail-row:last-child {
        border-bottom: none;
    }
    
    .detail-row span:first-child {
        font-weight: 600;
        color: var(--gray-color);
    }
    
    .detail-row span:last-child {
        text-align: right;
        max-width: 60%;
        word-break: break-word;
    }
    
    .message-box {
        background: #f8fafc;
        padding: 15px;
        border-radius: var(--border-radius);
        border: 1px solid #e5e7eb;
        margin-bottom: 20px;
    }
    
    .replies-container {
        max-height: 300px;
        overflow-y: auto;
        margin-bottom: 20px;
    }
    
    .reply {
        padding: 15px;
        margin-bottom: 10px;
        border-radius: var(--border-radius);
        border: 1px solid #e5e7eb;
    }
    
    .staff-reply {
        background-color: #dbeafe;
        border-left: 4px solid var(--primary-color);
    }
    
    .user-reply {
        background-color: #f3f4f6;
        border-left: 4px solid var(--gray-color);
    }
    
    .reply-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
        font-size: 0.875rem;
        color: var(--gray-color);
    }
    
    .reply-author {
        font-weight: 600;
    }
    
    .reply-time {
        font-size: 0.75rem;
    }
    
    .reply-content {
        line-height: 1.5;
    }
    
    .system-info-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 15px;
    }
    
    .info-item {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    
    .info-label {
        font-size: 0.875rem;
        color: var(--gray-color);
    }
    
    .info-value {
        font-weight: 600;
        color: var(--dark-color);
    }
    
    .info-value.online {
        color: var(--success-color);
    }
    
    .info-value.offline {
        color: var(--danger-color);
    }
    
    .health-check {
        display: flex;
        flex-direction: column;
        gap: 15px;
    }
    
    .health-item {
        display: flex;
        justify-content: space-between;
        padding: 10px;
        background: #f8fafc;
        border-radius: var(--border-radius);
        border: 1px solid #e5e7eb;
    }
    
    .health-item .status {
        font-weight: 600;
    }
    
    .health-item .status.healthy {
        color: var(--success-color);
    }
    
    .health-item .status.unhealthy {
        color: var(--danger-color);
    }
    
    .pagination-controls {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 20px;
        padding: 15px;
    }
    
    .page-info {
        color: var(--gray-color);
        font-size: 0.875rem;
    }
    
    .btn.disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    .maintenance-actions {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    
    .btn-warning {
        background-color: var(--warning-color);
        color: white;
        border: none;
    }
    
    .btn-warning:hover {
        background-color: #d97706;
    }
    
    .proof-image {
        text-align: center;
        margin: 20px 0;
    }
    
    .proof-image img {
        max-width: 100%;
        border-radius: var(--border-radius);
        box-shadow: var(--box-shadow);
    }
    
    .proof-actions {
        display: flex;
        gap: 10px;
        justify-content: center;
    }
`;

// Add admin styles to document
document.addEventListener('DOMContentLoaded', function() {
    const styleElement = document.createElement('style');
    styleElement.textContent = adminStyles;
    document.head.appendChild(styleElement);
});

// Export functions for use in HTML
window.syncServices = syncServices;
window.checkSystemHealth = checkSystemHealth;
window.loadPendingDeposits = loadPendingDeposits;
window.loadAllUsers = loadAllUsers;
window.loadAllOrders = loadAllOrders;
window.loadAllTransactions = loadAllTransactions;
window.loadSupportTickets = loadSupportTickets;
window.searchUsers = searchUsers;
window.searchOrders = searchOrders;
window.searchServicesAdmin = searchServicesAdmin;
window.viewDepositDetails = viewDepositDetails;
window.viewProof = viewProof;
window.approveDeposit = approveDeposit;
window.rejectDeposit = rejectDeposit;
window.viewUserDetails = viewUserDetails;
window.toggleUserStatus = toggleUserStatus;
window.editUser = editUser;
window.viewOrderDetailsAdmin = viewOrderDetailsAdmin;
window.cancelOrderAdmin = cancelOrderAdmin;
window.refillOrder = refillOrder;
window.viewTicketAdmin = viewTicketAdmin;
window.assignTicket = assignTicket;
window.toggleServiceStatus = toggleServiceStatus;
window.editService = editService;
window.showServiceStats = showServiceStats;
window.clearCache = clearCache;
window.backupDatabase = backupDatabase;
window.showMaintenanceModal = showMaintenanceModal;
window.resetSystem = resetSystem;
window.showModal = showModal;
window.hideModal = hideModal;
