// Authentication JavaScript
const API_BASE_URL = 'https://e-acquire-socials.onrender.com';
document.addEventListener('DOMContentLoaded', function() {
    initializeAuthForms();
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
}

async function handleLogin(e) {
    e.preventDefault();
    
    const form = e.target;
    const email = form.email.value.trim();
    const password = form.password.value;
    const loginBtn = document.getElementById('loginBtn');
    const alertDiv = document.getElementById('alert');
    
    // Clear previous errors
    clearFormError('email');
    clearFormError('password');
    alertDiv.style.display = 'none';
    
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
        
        const response = await makeAPIRequest('/auth/login', 'POST', {
            email,
            password
        });
        
        // Store token and user data
        setAuthToken(response.token);
        setUserData(response.user);
        
        showNotification('Login successful! Redirecting...', 'success');
        
        // Redirect to dashboard
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1500);
        
    } catch (error) {
        showFormError('email', error.message);
        alertDiv.textContent = error.message;
        alertDiv.className = 'alert alert-error show';
        alertDiv.style.display = 'block';
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
    
    const registerBtn = document.getElementById('registerBtn');
    const alertDiv = document.getElementById('alert');
    
    // Clear previous errors
    ['username', 'email', 'password', 'confirmPassword', 'phone'].forEach(id => {
        clearFormError(id);
    });
    alertDiv.style.display = 'none';
    
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
        alertDiv.textContent = 'You must agree to the terms and conditions';
        alertDiv.className = 'alert alert-error show';
        alertDiv.style.display = 'block';
        return;
    }
    
    if (!isValid) return;
    
    try {
        setButtonLoading(registerBtn, true);
        
        const response = await makeAPIRequest('/auth/register', 'POST', {
            username,
            email,
            password,
            phone,
            referralCode
        });
        
        // Store token and user data
        setAuthToken(response.token);
        setUserData(response.user);
        
        showNotification('Registration successful! Welcome to E-Acquire!', 'success');
        
        // Redirect to dashboard
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1500);
        
    } catch (error) {
        // Try to determine which field the error is for
        if (error.message.includes('Email') || error.message.includes('email')) {
            showFormError('email', error.message);
        } else if (error.message.includes('Username') || error.message.includes('username')) {
            showFormError('username', error.message);
        } else {
            alertDiv.textContent = error.message;
            alertDiv.className = 'alert alert-error show';
            alertDiv.style.display = 'block';
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
    const loginBtn = document.getElementById('adminLoginBtn');
    
    // Validation
    if (!username || !password) {
        showNotification('Please fill in all fields', 'error');
        return;
    }
    
    try {
        setButtonLoading(loginBtn, true);
        
        const response = await makeAPIRequest('/admin/login', 'POST', {
            username,
            password
        });
        
        // Store token and user data
        setAuthToken(response.token);
        setUserData(response.user);
        
        showNotification('Admin login successful!', 'success');
        
        // Redirect to admin panel
        setTimeout(() => {
            window.location.href = 'admin.html';
        }, 1500);
        
    } catch (error) {
        showNotification(error.message || 'Invalid admin credentials', 'error');
    } finally {
        setButtonLoading(loginBtn, false);
    }
}
