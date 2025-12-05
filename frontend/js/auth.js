// Authentication JavaScript
const API_BASE_URL = 'https://e-acquire-socials.onrender.com';

document.addEventListener('DOMContentLoaded', function() {
    initializeAuthForms();
    // Check if user is already logged in
    checkAuthStatus();
});

function initializeAuthForms() {
    // Login Form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Register Form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
    
    // Admin Login Form (if exists)
    const adminLoginForm = document.getElementById('adminLoginForm');
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', handleAdminLogin);
    }
    
    // Logout buttons
    const logoutButtons = document.querySelectorAll('.logout-btn');
    logoutButtons.forEach(button => {
        button.addEventListener('click', handleLogout);
    });
}

// ====================
// HELPER FUNCTIONS
// ====================

// API Request Helper
async function makeAPIRequest(endpoint, method = 'GET', data = null) {
    console.log(`📡 API Request: ${method} ${API_BASE_URL}${endpoint}`);
    
    const headers = {
        'Content-Type': 'application/json',
    };
    
    // Add Authorization header if token exists
    const token = getAuthToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        console.log('🔑 Token found, adding to headers');
    }
    
    const config = {
        method,
        headers,
        mode: 'cors',
        credentials: 'include'
    };
    
    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        config.body = JSON.stringify(data);
        console.log('📦 Request body:', data);
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        console.log(`📨 Response status: ${response.status} ${response.statusText}`);
        
        const responseText = await response.text();
        console.log('📄 Raw response:', responseText);
        
        let responseData;
        try {
            responseData = JSON.parse(responseText);
        } catch (e) {
            console.error('❌ Failed to parse JSON:', e);
            throw new Error('Server returned invalid JSON response');
        }
        
        if (!response.ok) {
            throw new Error(responseData.message || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        console.log('✅ API request successful');
        return responseData;
    } catch (error) {
        console.error('❌ API Request Error:', error);
        throw error;
    }
}

// Validation Functions
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validatePhone(phone) {
    // Nigerian phone validation: 11 digits starting with 0
    const re = /^0[7-9][0-9]{9}$/;
    return re.test(phone);
}

// Form Error Handling
function showFormError(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    
    // Remove existing error
    clearFormError(fieldId);
    
    // Create error element
    const errorEl = document.createElement('div');
    errorEl.className = 'form-error';
    errorEl.id = `${fieldId}Error`;
    errorEl.textContent = message;
    errorEl.style.color = '#dc3545';
    errorEl.style.fontSize = '0.875rem';
    errorEl.style.marginTop = '0.25rem';
    
    // Insert after field
    field.parentNode.insertBefore(errorEl, field.nextSibling);
    
    // Add error class to field
    field.classList.add('error');
    field.style.borderColor = '#dc3545';
}

function clearFormError(fieldId) {
    const errorEl = document.getElementById(`${fieldId}Error`);
    if (errorEl) {
        errorEl.remove();
    }
    
    const field = document.getElementById(fieldId);
    if (field) {
        field.classList.remove('error');
        field.style.borderColor = '';
    }
}

// Button Loading State
function setButtonLoading(button, isLoading) {
    if (!button) return;
    
    if (isLoading) {
        button.dataset.originalText = button.textContent;
        button.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Loading...';
        button.disabled = true;
    } else {
        button.textContent = button.dataset.originalText || button.textContent;
        button.disabled = false;
    }
}

// Notification System
function showNotification(message, type = 'info') {
    // Create notification container if it doesn't exist
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            max-width: 350px;
        `;
        document.body.appendChild(container);
    }
    
    // Create notification
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show`;
    notification.style.cssText = `
        margin-bottom: 10px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    `;
    
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    container.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

// Auth Token Management
function setAuthToken(token) {
    if (token) {
        localStorage.setItem('authToken', token);
        console.log('✅ Token saved to localStorage');
    }
}

function getAuthToken() {
    const token = localStorage.getItem('authToken');
    console.log('🔍 Token retrieved:', token ? 'Yes' : 'No');
    return token;
}

function clearAuthToken() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    console.log('🗑️ Token cleared');
}

function setUserData(user) {
    if (user) {
        localStorage.setItem('userData', JSON.stringify(user));
        console.log('✅ User data saved');
    }
}

function getUserData() {
    const userData = localStorage.getItem('userData');
    return userData ? JSON.parse(userData) : null;
}

// Check Authentication Status
function checkAuthStatus() {
    const token = getAuthToken();
    const userData = getUserData();
    
    // If on login/register pages and already logged in, redirect to dashboard
    if (token && userData && (window.location.pathname.includes('login.html') || window.location.pathname.includes('register.html'))) {
        console.log('🔍 Already logged in, redirecting to dashboard');
        setTimeout(() => {
            window.location.href = userData.role === 'admin' ? 'admin.html' : 'dashboard.html';
        }, 100);
    }
    
    // If on protected pages and not logged in, redirect to login
    const protectedPages = ['dashboard.html', 'profile.html', 'admin.html'];
    const currentPage = window.location.pathname.split('/').pop();
    
    if (!token && protectedPages.includes(currentPage)) {
        console.log('🔐 Not logged in, redirecting to login');
        showNotification('Please login to continue', 'warning');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);
    }
}

// ====================
// AUTH HANDLERS
// ====================

async function handleLogin(e) {
    e.preventDefault();
    console.log('🔐 Login attempt');
    
    const form = e.target;
    const email = form.email.value.trim();
    const password = form.password.value;
    const loginBtn = document.getElementById('loginBtn');
    const alertDiv = document.getElementById('alert');
    
    // Clear previous errors
    clearFormError('email');
    clearFormError('password');
    if (alertDiv) {
        alertDiv.style.display = 'none';
        alertDiv.textContent = '';
    }
    
    // Validation
    let isValid = true;
    
    if (!email) {
        showFormError('email', 'Email is required');
        isValid = false;
    } else if (!validateEmail(email)) {
        showFormError('email', 'Please enter a valid email address');
        isValid = false;
    }
    
    if (!password) {
        showFormError('password', 'Password is required');
        isValid = false;
    } else if (password.length < 6) {
        showFormError('password', 'Password must be at least 6 characters');
        isValid = false;
    }
    
    if (!isValid) {
        showNotification('Please fix the errors above', 'error');
        return;
    }
    
    try {
        setButtonLoading(loginBtn, true);
        
        const response = await makeAPIRequest('/api/auth/login', 'POST', {
            email,
            password
        });
        
        console.log('✅ Login response:', response);
        
        if (response.success) {
            // Store token and user data
            setAuthToken(response.token);
            setUserData(response.user);
            
            showNotification('Login successful! Redirecting...', 'success');
            
            // Redirect based on user role
            setTimeout(() => {
                if (response.user.role === 'admin') {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'dashboard.html';
                }
            }, 1500);
        } else {
            throw new Error(response.message || 'Login failed');
        }
        
    } catch (error) {
        console.error('❌ Login error:', error);
        
        // Show appropriate error message
        const errorMessage = error.message || 'Login failed. Please check your credentials.';
        
        if (errorMessage.toLowerCase().includes('email') || errorMessage.toLowerCase().includes('invalid')) {
            showFormError('email', errorMessage);
        } else {
            showFormError('password', errorMessage);
        }
        
        // Show alert if exists
        if (alertDiv) {
            alertDiv.textContent = errorMessage;
            alertDiv.className = 'alert alert-danger show';
            alertDiv.style.display = 'block';
        }
        
        showNotification(errorMessage, 'error');
    } finally {
        setButtonLoading(loginBtn, false);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    console.log('📝 Registration attempt');
    
    const form = e.target;
    const username = form.username.value.trim();
    const email = form.email.value.trim();
    const password = form.password.value;
    const confirmPassword = form.confirmPassword?.value || '';
    const phone = form.phone?.value.trim() || '';
    const referralCode = form.referralCode?.value.trim() || '';
    const terms = form.terms?.checked || false;
    
    const registerBtn = document.getElementById('registerBtn');
    const alertDiv = document.getElementById('alert');
    
    // Clear previous errors
    ['username', 'email', 'password', 'confirmPassword', 'phone'].forEach(id => {
        clearFormError(id);
    });
    
    if (alertDiv) {
        alertDiv.style.display = 'none';
        alertDiv.textContent = '';
    }
    
    // Validation
    let isValid = true;
    
    if (username.length < 3) {
        showFormError('username', 'Username must be at least 3 characters');
        isValid = false;
    }
    
    if (!validateEmail(email)) {
        showFormError('email', 'Please enter a valid email address');
        isValid = false;
    }
    
    if (password.length < 6) {
        showFormError('password', 'Password must be at least 6 characters');
        isValid = false;
    }
    
    if (confirmPassword && password !== confirmPassword) {
        showFormError('confirmPassword', 'Passwords do not match');
        isValid = false;
    }
    
    if (phone && !validatePhone(phone)) {
        showFormError('phone', 'Please enter a valid 11-digit Nigerian phone number');
        isValid = false;
    }
    
    if (form.terms && !terms) {
        showNotification('You must agree to the terms and conditions', 'error');
        return;
    }
    
    if (!isValid) {
        showNotification('Please fix the errors above', 'error');
        return;
    }
    
    try {
        setButtonLoading(registerBtn, true);
        
        const response = await makeAPIRequest('/api/auth/register', 'POST', {
            username,
            email,
            password,
            phone,
            referralCode
        });
        
        console.log('✅ Registration response:', response);
        
        if (response.success) {
            // Store token and user data
            setAuthToken(response.token);
            setUserData(response.user);
            
            showNotification('Registration successful! Welcome!', 'success');
            
            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
        } else {
            throw new Error(response.message || 'Registration failed');
        }
        
    } catch (error) {
        console.error('❌ Registration error:', error);
        
        // Try to determine which field the error is for
        const errorMessage = error.message || 'Registration failed. Please try again.';
        
        if (errorMessage.toLowerCase().includes('email')) {
            showFormError('email', errorMessage);
        } else if (errorMessage.toLowerCase().includes('username')) {
            showFormError('username', errorMessage);
        } else if (errorMessage.toLowerCase().includes('phone')) {
            showFormError('phone', errorMessage);
        } else {
            if (alertDiv) {
                alertDiv.textContent = errorMessage;
                alertDiv.className = 'alert alert-danger show';
                alertDiv.style.display = 'block';
            }
        }
        
        showNotification(errorMessage, 'error');
    } finally {
        setButtonLoading(registerBtn, false);
    }
}

async function handleAdminLogin(e) {
    e.preventDefault();
    console.log('👑 Admin login attempt');
    
    const form = e.target;
    const username = form.username.value.trim();
    const password = form.password.value;
    const loginBtn = document.getElementById('adminLoginBtn') || form.querySelector('button[type="submit"]');
    
    // Validation
    if (!username || !password) {
        showNotification('Please fill in all fields', 'error');
        return;
    }
    
    try {
        setButtonLoading(loginBtn, true);
        
        const response = await makeAPIRequest('/api/admin/login', 'POST', {
            username,
            password
        });
        
        console.log('✅ Admin login response:', response);
        
        if (response.success) {
            // Store token and user data
            setAuthToken(response.token);
            setUserData(response.user);
            
            showNotification('Admin login successful!', 'success');
            
            // Redirect to admin panel
            setTimeout(() => {
                window.location.href = 'admin.html';
            }, 1500);
        } else {
            throw new Error(response.message || 'Invalid admin credentials');
        }
        
    } catch (error) {
        console.error('❌ Admin login error:', error);
        showNotification(error.message || 'Invalid admin credentials', 'error');
    } finally {
        setButtonLoading(loginBtn, false);
    }
}

function handleLogout() {
    console.log('👋 Logging out');
    
    // Clear auth data
    clearAuthToken();
    
    // Show notification
    showNotification('Logged out successfully', 'success');
    
    // Redirect to login page
    setTimeout(() => {
        window.location.href = 'login.html';
    }, 1000);
}

// ====================
// HEALTH CHECK
// ====================

async function testBackendConnection() {
    console.log('🩺 Testing backend connection...');
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/health`);
        const data = await response.json();
        
        console.log('🏥 Backend health check:', data);
        
        if (data.success) {
            showNotification(`✅ Backend is running (${data.database.connected ? 'DB Connected' : 'DB Disconnected'})`, 'success');
            return true;
        } else {
            showNotification('❌ Backend health check failed', 'error');
            return false;
        }
    } catch (error) {
        console.error('❌ Backend connection test failed:', error);
        showNotification('❌ Cannot connect to backend server', 'error');
        return false;
    }
}

// Expose test function globally for debugging
window.testConnection = testBackendConnection;

// Auto-check backend connection on page load
window.addEventListener('load', function() {
    setTimeout(() => {
        testBackendConnection().then(isConnected => {
            if (!isConnected) {
                console.warn('⚠️ Backend connection issues detected');
            }
        });
    }, 1000);
});

// Add CSS for notifications and form errors
const style = document.createElement('style');
style.textContent = `
    .form-error {
        color: #dc3545;
        font-size: 0.875rem;
        margin-top: 0.25rem;
    }
    
    .form-control.error {
        border-color: #dc3545;
    }
    
    .spinner-border {
        vertical-align: middle;
    }
    
    .alert {
        transition: all 0.3s ease;
    }
    
    .alert.show {
        display: block !important;
    }
    
    .btn:disabled {
        opacity: 0.65;
        cursor: not-allowed;
    }
`;
document.head.appendChild(style);
