// Authentication JavaScript

// Backend API Configuration
const API_BASE_URL = 'https://e-acquire-socials.onrender.com';

document.addEventListener('DOMContentLoaded', function() {
    initializeAuthForms();
    checkExistingAuth();
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
}

function checkExistingAuth() {
    // If user is already logged in, redirect to dashboard
    const token = localStorage.getItem('token');
    const userData = getUserData();
    
    if (token && userData) {
        // Check if we're on login/register page
        const currentPage = window.location.pathname;
        if (currentPage.includes('login.html') || currentPage.includes('register.html')) {
            // Redirect to dashboard
            window.location.href = 'dashboard.html';
        }
    }
}

// API Request Helper Function
async function makeAPIRequest(endpoint, method = 'GET', data = null, requiresAuth = false) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const headers = {
        'Content-Type': 'application/json',
    };
    
    if (requiresAuth) {
        const token = localStorage.getItem('token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
    }
    
    const options = {
        method: method,
        headers: headers,
    };
    
    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        options.body = JSON.stringify(data);
    }
    
    try {
        const response = await fetch(url, options);
        
        // First try to parse as JSON
        let result;
        try {
            result = await response.json();
        } catch (jsonError) {
            // If not JSON, throw error with status
            throw new Error(`Invalid response from server (${response.status})`);
        }
        
        if (!response.ok) {
            throw new Error(result.message || `Request failed with status ${response.status}`);
        }
        
        return result;
    } catch (error) {
        console.error(`API Request Error (${method} ${endpoint}):`, error);
        throw error;
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
    const form = e.target;
    const email = form.email.value.trim();
    const password = form.password.value;
    const loginBtn = document.getElementById('loginBtn') || form.querySelector('button[type="submit"]');
    const alertDiv = document.getElementById('alert') || createAlertElement(form);
    
    // Clear previous errors
    clearFormError('email');
    clearFormError('password');
    if (alertDiv) {
        alertDiv.style.display = 'none';
    }
    
    // Validation
    let isValid = true;
    
    if (!validateEmail(email)) {
        showFormError('email', 'Please enter a valid email address');
        isValid = false;
    }
    
    if (password.length < 6) {
        showFormError('password', 'Password must be at least 6 characters');
        isValid = false;
    }
    
    if (!isValid) return;
    
    try {
        setButtonLoading(loginBtn, true);
        
        const response = await makeAPIRequest('/api/auth/login', 'POST', {
            email,
            password
        });
        
        if (response.success) {
            // Store token and user data
            setAuthToken(response.token);
            setUserData(response.user);
            
            showNotification('Login successful! Redirecting...', 'success');
            
            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
        } else {
            throw new Error(response.message || 'Login failed');
        }
        
    } catch (error) {
        const errorMessage = error.message || 'Invalid email or password';
        showFormError('email', errorMessage);
        if (alertDiv) {
            alertDiv.textContent = errorMessage;
            alertDiv.className = 'alert alert-error show';
            alertDiv.style.display = 'block';
        }
    } finally {
        setButtonLoading(loginBtn, false);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const form = e.target;
    const username = form.username.value.trim();
    const email = form.email.value.trim();
    const password = form.password.value;
    const confirmPassword = form.confirmPassword.value;
    const phone = form.phone?.value.trim() || '';
    const referralCode = form.referralCode?.value.trim() || '';
    const terms = form.terms?.checked || false;
    
    const registerBtn = document.getElementById('registerBtn') || form.querySelector('button[type="submit"]');
    const alertDiv = document.getElementById('alert') || createAlertElement(form);
    
    // Clear previous errors
    ['username', 'email', 'password', 'confirmPassword', 'phone'].forEach(id => {
        clearFormError(id);
    });
    if (alertDiv) {
        alertDiv.style.display = 'none';
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
    
    if (password !== confirmPassword) {
        showFormError('confirmPassword', 'Passwords do not match');
        isValid = false;
    }
    
    if (phone && !validatePhone(phone)) {
        showFormError('phone', 'Please enter a valid 11-digit phone number');
        isValid = false;
    }
    
    if (form.terms && !terms) {
        const errorMsg = 'You must agree to the terms and conditions';
        if (alertDiv) {
            alertDiv.textContent = errorMsg;
            alertDiv.className = 'alert alert-error show';
            alertDiv.style.display = 'block';
        } else {
            showFormError('terms', errorMsg);
        }
        return;
    }
    
    if (!isValid) return;
    
    try {
        setButtonLoading(registerBtn, true);
        
        const response = await makeAPIRequest('/api/auth/register', 'POST', {
            username,
            email,
            password,
            phone,
            referralCode
        });
        
        if (response.success) {
            // Store token and user data
            setAuthToken(response.token);
            setUserData(response.user);
            
            showNotification('Registration successful! Welcome to E-Acquire!', 'success');
            
            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
        } else {
            throw new Error(response.message || 'Registration failed');
        }
        
    } catch (error) {
        const errorMessage = error.message || 'Registration failed. Please try again.';
        
        // Try to determine which field the error is for
        if (errorMessage.includes('Email') || errorMessage.includes('email')) {
            showFormError('email', errorMessage);
        } else if (errorMessage.includes('Username') || errorMessage.includes('username')) {
            showFormError('username', errorMessage);
        } else if (errorMessage.includes('Phone') || errorMessage.includes('phone')) {
            showFormError('phone', errorMessage);
        } else {
            if (alertDiv) {
                alertDiv.textContent = errorMessage;
                alertDiv.className = 'alert alert-error show';
                alertDiv.style.display = 'block';
            } else {
                showFormError('email', errorMessage);
            }
        }
    } finally {
        setButtonLoading(registerBtn, false);
    }
}

// Admin login (if needed separately)
async function handleAdminLogin(e) {
    e.preventDefault();
    
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
        showNotification(error.message || 'Invalid admin credentials', 'error');
    } finally {
        setButtonLoading(loginBtn, false);
    }
}

// Utility Functions

function setAuthToken(token) {
    localStorage.setItem('token', token);
}

function setUserData(user) {
    localStorage.setItem('user', JSON.stringify(user));
}

function getUserData() {
    try {
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
        console.error('Error getting user data:', error);
        return null;
    }
}

function clearAuth() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
}

function isAuthenticated() {
    return !!localStorage.getItem('token');
}

function requireAuth() {
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

function requireAdmin() {
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
        return false;
    }
    
    const userData = getUserData();
    if (!userData || userData.role !== 'admin') {
        window.location.href = 'dashboard.html';
        return false;
    }
    
    return true;
}

// Form validation helpers
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validatePhone(phone) {
    // Nigerian phone number validation
    const re = /^(0|234)(7|8|9)(0|1)\d{8}$/;
    return re.test(phone);
}

function showFormError(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    
    // Remove existing error
    clearFormError(fieldId);
    
    // Add error class to field
    field.classList.add('error');
    
    // Create error message element
    const errorDiv = document.createElement('div');
    errorDiv.className = 'form-error';
    errorDiv.id = `${fieldId}-error`;
    errorDiv.textContent = message;
    
    // Insert after the field
    field.parentNode.insertBefore(errorDiv, field.nextSibling);
}

function clearFormError(fieldId) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    
    field.classList.remove('error');
    
    const errorDiv = document.getElementById(`${fieldId}-error`);
    if (errorDiv) {
        errorDiv.remove();
    }
}

function setButtonLoading(button, isLoading) {
    if (!button) return;
    
    if (isLoading) {
        button.disabled = true;
        const originalText = button.textContent;
        button.setAttribute('data-original-text', originalText);
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    } else {
        button.disabled = false;
        const originalText = button.getAttribute('data-original-text');
        if (originalText) {
            button.textContent = originalText;
            button.removeAttribute('data-original-text');
        }
    }
}

function showNotification(message, type = 'info') {
    // Check if notification function exists from admin.js
    if (typeof window.showNotification === 'function') {
        window.showNotification(message, type);
        return;
    }
    
    // Create custom notification if not
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">&times;</button>
    `;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        padding: 12px 16px;
        border-radius: 6px;
        color: white;
        display: flex;
        justify-content: space-between;
        align-items: center;
        animation: slideIn 0.3s ease;
        max-width: 300px;
    `;
    
    if (type === 'success') {
        notification.style.backgroundColor = '#28a745';
    } else if (type === 'error') {
        notification.style.backgroundColor = '#dc3545';
    } else if (type === 'info') {
        notification.style.backgroundColor = '#17a2b8';
    } else if (type === 'warning') {
        notification.style.backgroundColor = '#ffc107';
        notification.style.color = '#333';
    }
    
    // Add CSS for animation if not exists
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            .notification button {
                background: none;
                border: none;
                color: white;
                cursor: pointer;
                font-size: 18px;
                margin-left: 10px;
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

function createAlertElement(form) {
    const alertDiv = document.createElement('div');
    alertDiv.id = 'alert';
    alertDiv.style.display = 'none';
    alertDiv.style.margin = '10px 0';
    alertDiv.style.padding = '10px';
    alertDiv.style.borderRadius = '4px';
    
    form.insertBefore(alertDiv, form.firstChild);
    return alertDiv;
}

// Export functions for use in other scripts
window.setAuthToken = setAuthToken;
window.getUserData = getUserData;
window.clearAuth = clearAuth;
window.isAuthenticated = isAuthenticated;
window.requireAuth = requireAuth;
window.requireAdmin = requireAdmin;
window.showNotification = showNotification;
