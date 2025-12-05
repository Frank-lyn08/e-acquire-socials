// Main JavaScript File
const API_BASE_URL = 'https://e-acquire-socials.onrender.com';

// DOM Elements
let userData = null;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeMobileMenu();
    initializeFAQ();
    checkAuthStatus();
});

// Mobile Menu Toggle
function initializeMobileMenu() {
    const menuToggle = document.getElementById('mobile-menu');
    const navMenu = document.querySelector('.nav-menu');
    const navAuth = document.querySelector('.nav-auth');
    
    if (menuToggle) {
        menuToggle.addEventListener('click', function() {
            navMenu.style.display = navMenu.style.display === 'flex' ? 'none' : 'flex';
            navAuth.style.display = navAuth.style.display === 'flex' ? 'none' : 'flex';
            
            if (navMenu.style.display === 'flex') {
                navMenu.style.flexDirection = 'column';
                navMenu.style.position = 'absolute';
                navMenu.style.top = '100%';
                navMenu.style.left = '0';
                navMenu.style.right = '0';
                navMenu.style.backgroundColor = 'white';
                navMenu.style.padding = '1rem';
                navMenu.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
                
                navAuth.style.flexDirection = 'column';
                navAuth.style.position = 'absolute';
                navAuth.style.top = 'calc(100% + 150px)';
                navAuth.style.left = '0';
                navAuth.style.right = '0';
                navAuth.style.backgroundColor = 'white';
                navAuth.style.padding = '1rem';
                navAuth.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
            }
        });
    }
}

// FAQ Accordion
function initializeFAQ() {
    const faqQuestions = document.querySelectorAll('.faq-question');
    
    faqQuestions.forEach(question => {
        question.addEventListener('click', function() {
            const answer = this.nextElementSibling;
            const icon = this.querySelector('i');
            
            // Toggle active class on answer
            answer.classList.toggle('active');
            
            // Rotate icon
            icon.style.transform = answer.classList.contains('active') 
                ? 'rotate(180deg)' 
                : 'rotate(0)';
            
            // Close other FAQ items
            faqQuestions.forEach(otherQuestion => {
                if (otherQuestion !== this) {
                    const otherAnswer = otherQuestion.nextElementSibling;
                    const otherIcon = otherQuestion.querySelector('i');
                    
                    otherAnswer.classList.remove('active');
                    otherIcon.style.transform = 'rotate(0)';
                }
            });
        });
    });
}

// Authentication Functions
function getAuthToken() {
    return localStorage.getItem('token');
}

function setAuthToken(token) {
    localStorage.setItem('token', token);
}

function clearAuthToken() {
    localStorage.removeItem('token');
}

function getUserData() {
    const data = localStorage.getItem('userData');
    return data ? JSON.parse(data) : null;
}

function setUserData(data) {
    localStorage.setItem('userData', JSON.stringify(data));
}

function clearUserData() {
    localStorage.removeItem('userData');
}

function checkAuthStatus() {
    const token = getAuthToken();
    const user = getUserData();
    
    if (token && user) {
        userData = user;
        updateNavigationForLoggedInUser();
    }
}

function updateNavigationForLoggedInUser() {
    const navAuth = document.querySelector('.nav-auth');
    const user = getUserData();
    
    if (navAuth && user) {
        navAuth.innerHTML = `
            <div class="dropdown">
                <button class="btn btn-outline dropdown-toggle" id="user-dropdown">
                    <i class="fas fa-user"></i>
                    ${user.username}
                </button>
                <div class="dropdown-menu" id="dropdown-menu">
                    <a href="dashboard.html" class="dropdown-item">
                        <i class="fas fa-tachometer-alt"></i> Dashboard
                    </a>
                    ${user.role === 'admin' ? `
                    <a href="admin.html" class="dropdown-item">
                        <i class="fas fa-cog"></i> Admin Panel
                    </a>
                    ` : ''}
                    <div class="dropdown-divider"></div>
                    <a href="#" class="dropdown-item" onclick="logout()">
                        <i class="fas fa-sign-out-alt"></i> Logout
                    </a>
                </div>
            </div>
        `;
        
        initializeDropdown();
    }
}

function initializeDropdown() {
    const dropdownToggle = document.getElementById('user-dropdown');
    const dropdownMenu = document.getElementById('dropdown-menu');
    
    if (dropdownToggle && dropdownMenu) {
        dropdownToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function() {
            dropdownMenu.style.display = 'none';
        });
    }
}

function logout() {
    clearAuthToken();
    clearUserData();
    window.location.href = 'index.html';
}

// API Functions
async function makeAPIRequest(endpoint, method = 'GET', data = null, requiresAuth = false) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json'
    };
    
    if (requiresAuth) {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Authentication required');
        }
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const options = {
        method,
        headers,
        credentials: 'include'
    };
    
    if (data && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(data);
    }
    
    try {
        const response = await fetch(url, options);
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.message || 'API request failed');
        }
        
        return result;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN'
    }).format(amount);
}

// Show notification
function showNotification(message, type = 'info', duration = 5000) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${getNotificationIcon(type)}"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Add styles if not already present
    if (!document.querySelector('#notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 1rem 1.5rem;
                border-radius: var(--border-radius);
                box-shadow: var(--box-shadow);
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 1rem;
                z-index: 10000;
                animation: slideIn 0.3s ease;
                max-width: 400px;
            }
            
            .notification-success {
                background-color: #d1fae5;
                border-left: 4px solid var(--success-color);
                color: #065f46;
            }
            
            .notification-error {
                background-color: #fee2e2;
                border-left: 4px solid var(--danger-color);
                color: #991b1b;
            }
            
            .notification-warning {
                background-color: #fef3c7;
                border-left: 4px solid var(--warning-color);
                color: #92400e;
            }
            
            .notification-info {
                background-color: #dbeafe;
                border-left: 4px solid var(--primary-color);
                color: #1e40af;
            }
            
            .notification-content {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .notification-close {
                background: none;
                border: none;
                cursor: pointer;
                color: inherit;
                opacity: 0.7;
                transition: opacity 0.3s;
            }
            
            .notification-close:hover {
                opacity: 1;
            }
            
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
        `;
        document.head.appendChild(styles);
    }
    
    // Add to DOM
    document.body.appendChild(notification);
    
    // Auto remove after duration
    if (duration > 0) {
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, duration);
    }
    
    return notification;
}

function getNotificationIcon(type) {
    const icons = {
        success: 'check-circle',
        error: 'exclamation-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };
    return icons[type] || 'info-circle';
}

// Loading state for buttons
function setButtonLoading(button, isLoading) {
    if (isLoading) {
        button.classList.add('loading');
        button.disabled = true;
    } else {
        button.classList.remove('loading');
        button.disabled = false;
    }
}

// Form validation
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validatePhone(phone) {
    const re = /^[0-9]{11}$/;
    return re.test(phone);
}

function showFormError(inputId, message) {
    const input = document.getElementById(inputId);
    const errorElement = document.getElementById(`${inputId}-error`);
    
    if (input && errorElement) {
        input.classList.add('error');
        errorElement.textContent = message;
        errorElement.classList.add('show');
    }
}

function clearFormError(inputId) {
    const input = document.getElementById(inputId);
    const errorElement = document.getElementById(`${inputId}-error`);
    
    if (input && errorElement) {
        input.classList.remove('error');
        errorElement.textContent = '';
        errorElement.classList.remove('show');
    }
}

// Check if user is authenticated
function isAuthenticated() {
    return !!getAuthToken();
}

// Check if user is admin
function isAdmin() {
    const user = getUserData();
    return user && user.role === 'admin';
}

// Redirect if not authenticated
function requireAuth(redirectTo = 'login.html') {
    if (!isAuthenticated()) {
        window.location.href = redirectTo;
        return false;
    }
    return true;
}

// Redirect if not admin
function requireAdmin(redirectTo = 'dashboard.html') {
    if (!isAdmin()) {
        window.location.href = redirectTo;
        return false;
    }
    return true;
}

// Calculate order cost helper
function calculateOrderCost(ratePer1000, quantity) {
    const cost = (ratePer1000 / 1000) * quantity;
    return Math.ceil(cost);

}
