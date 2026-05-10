// ==================== 用户认证管理 (基于API) ====================

const API_BASE = 'http://localhost:3000';
const TOKEN_KEY = 'patent_classification_token';
const USER_KEY = 'patent_classification_current_user';
const REMEMBER_ME_KEY = 'patent_classification_remember';

function setToken(token) {
    sessionStorage.setItem(TOKEN_KEY, token);
}

function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
}

function setCurrentUser(username, role, remember = false) {
    const userData = { username, role, loginTime: new Date().toISOString() };
    sessionStorage.setItem(USER_KEY, JSON.stringify(userData));
    if (remember) {
        localStorage.setItem(REMEMBER_ME_KEY, 'true');
    } else {
        localStorage.removeItem(REMEMBER_ME_KEY);
    }
}

function getCurrentUser() {
    let userData = sessionStorage.getItem(USER_KEY);
    if (!userData) userData = localStorage.getItem(USER_KEY);
    if (userData) {
        try { return JSON.parse(userData); } catch (e) { return null; }
    }
    return null;
}

function isLoggedIn() {
    return getCurrentUser() !== null && getToken() !== null;
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function registerUser(username, email, password) {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
    });
    const data = await res.json();
    return data;
}

async function loginUser(identifier, password) {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password })
    });
    const data = await res.json();
    return data;
}

// ==================== UI 交互 ====================

const elements = {
    themeToggle: document.getElementById('themeToggle'),
    tabs: document.querySelectorAll('.auth-tab'),
    loginForm: document.getElementById('loginForm'),
    registerForm: document.getElementById('registerForm'),
    loginIdentifier: document.getElementById('loginIdentifier'),
    loginPassword: document.getElementById('loginPassword'),
    loginMessage: document.getElementById('loginMessage'),
    registerUsername: document.getElementById('registerUsername'),
    registerEmail: document.getElementById('registerEmail'),
    registerPassword: document.getElementById('registerPassword'),
    registerConfirmPassword: document.getElementById('registerConfirmPassword'),
    registerMessage: document.getElementById('registerMessage'),
    rememberMe: document.getElementById('rememberMe'),
    passwordToggles: document.querySelectorAll('.password-toggle')
};

let isDarkMode = localStorage.getItem('theme') === 'dark';

function init() {
    if (isLoggedIn()) {
        window.location.href = '1.html';
        return;
    }
    applyTheme();
    setupEventListeners();
    if (localStorage.getItem(REMEMBER_ME_KEY)) {
        elements.rememberMe.checked = true;
    }
}

function applyTheme() {
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        elements.themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
        document.body.classList.remove('dark-mode');
        elements.themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    }
}

function toggleTheme() {
    isDarkMode = !isDarkMode;
    applyTheme();
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
}

function switchTab(tabName) {
    elements.tabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    document.querySelectorAll('.auth-form').forEach(form => {
        form.classList.remove('active');
    });

    if (tabName === 'login') {
        elements.loginForm.classList.add('active');
    } else {
        elements.registerForm.classList.add('active');
    }

    hideMessage(elements.loginMessage);
    hideMessage(elements.registerMessage);
}

function showMessage(element, message, type) {
    element.querySelector('span').textContent = message;
    element.className = `message-box show ${type}`;
    element.querySelector('i').className = type === 'success'
        ? 'fas fa-check-circle'
        : 'fas fa-exclamation-circle';
}

function hideMessage(element) {
    element.classList.remove('show');
}

function showFieldError(inputId, errorId, message) {
    const input = document.getElementById(inputId);
    const error = document.getElementById(errorId);

    input.classList.add('error');
    error.textContent = message;
    error.classList.add('show');

    input.parentElement.classList.add('shake');
    setTimeout(() => {
        input.parentElement.classList.remove('shake');
    }, 300);
}

function clearFieldError(inputId, errorId) {
    const input = document.getElementById(inputId);
    const error = document.getElementById(errorId);

    input.classList.remove('error');
    error.classList.remove('show');
}

function validateLoginForm() {
    let isValid = true;
    const identifier = elements.loginIdentifier.value.trim();
    const password = elements.loginPassword.value;

    clearFieldError('loginIdentifier', 'loginIdentifierError');
    clearFieldError('loginPassword', 'loginPasswordError');

    if (!identifier) {
        showFieldError('loginIdentifier', 'loginIdentifierError', '请输入用户名或邮箱');
        isValid = false;
    }

    if (!password) {
        showFieldError('loginPassword', 'loginPasswordError', '请输入密码');
        isValid = false;
    }

    return isValid;
}

function validateRegisterForm() {
    let isValid = true;
    const username = elements.registerUsername.value.trim();
    const email = elements.registerEmail.value.trim();
    const password = elements.registerPassword.value;
    const confirmPassword = elements.registerConfirmPassword.value;

    clearFieldError('registerUsername', 'registerUsernameError');
    clearFieldError('registerEmail', 'registerEmailError');
    clearFieldError('registerPassword', 'registerPasswordError');
    clearFieldError('registerConfirmPassword', 'registerConfirmPasswordError');

    if (!username) {
        showFieldError('registerUsername', 'registerUsernameError', '请输入用户名');
        isValid = false;
    } else if (username.length < 3 || username.length > 20) {
        showFieldError('registerUsername', 'registerUsernameError', '用户名长度需在3-20个字符之间');
        isValid = false;
    }

    if (!email) {
        showFieldError('registerEmail', 'registerEmailError', '请输入邮箱');
        isValid = false;
    } else if (!isValidEmail(email)) {
        showFieldError('registerEmail', 'registerEmailError', '请输入有效的邮箱地址');
        isValid = false;
    }

    if (!password) {
        showFieldError('registerPassword', 'registerPasswordError', '请输入密码');
        isValid = false;
    } else if (password.length < 6) {
        showFieldError('registerPassword', 'registerPasswordError', '密码长度至少6个字符');
        isValid = false;
    }

    if (!confirmPassword) {
        showFieldError('registerConfirmPassword', 'registerConfirmPasswordError', '请确认密码');
        isValid = false;
    } else if (password !== confirmPassword) {
        showFieldError('registerConfirmPassword', 'registerConfirmPasswordError', '两次输入的密码不一致');
        isValid = false;
    }

    return isValid;
}

async function handleLogin(e) {
    e.preventDefault();
    hideMessage(elements.loginMessage);

    if (!validateLoginForm()) return;

    const identifier = elements.loginIdentifier.value.trim();
    const password = elements.loginPassword.value;
    const remember = elements.rememberMe.checked;

    const result = await loginUser(identifier, password);

    if (result.success) {
        showMessage(elements.loginMessage, '登录成功，正在跳转...', 'success');
        setToken(result.token);
        setCurrentUser(result.user.username, result.user.role, remember);
        setTimeout(() => { window.location.href = '1.html'; }, 1000);
    } else {
        showMessage(elements.loginMessage, result.error || result.message, 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    hideMessage(elements.registerMessage);

    if (!validateRegisterForm()) return;

    const username = elements.registerUsername.value.trim();
    const email = elements.registerEmail.value.trim();
    const password = elements.registerPassword.value;

    const result = await registerUser(username, email, password);

    if (result.success) {
        showMessage(elements.registerMessage, '注册成功！请登录', 'success');
        elements.registerUsername.value = '';
        elements.registerEmail.value = '';
        elements.registerPassword.value = '';
        elements.registerConfirmPassword.value = '';
        resetPasswordStrengthUI();
        setTimeout(() => {
            switchTab('login');
            elements.loginIdentifier.value = username;
            elements.loginIdentifier.focus();
        }, 1500);
    } else {
        showMessage(elements.registerMessage, result.error || result.message, 'error');
    }
}

function togglePasswordVisibility(button) {
    const targetId = button.dataset.target;
    const input = document.getElementById(targetId);
    const icon = button.querySelector('i');

    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

// ==================== 密码强度检测 ====================

function checkPasswordStrength(password) {
    const checks = {
        length: password.length >= 6,
        lower: /[a-z]/.test(password),
        upper: /[A-Z]/.test(password),
        number: /[0-9]/.test(password),
        special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };

    let score = 0;
    if (checks.length) score++;
    if (checks.lower) score++;
    if (checks.upper) score++;
    if (checks.number) score++;
    if (checks.special) score++;

    let strength = 'weak';
    let text = '弱';
    let level = 1;

    if (score >= 4) {
        strength = 'strong';
        text = '强';
        level = 4;
    } else if (score >= 3) {
        strength = 'medium';
        text = '中';
        level = 3;
    } else if (score >= 2) {
        strength = 'medium';
        text = '较弱';
        level = 2;
    }

    return { checks, strength, text, level, score };
}

function updatePasswordStrengthUI(password) {
    const strengthContainer = document.getElementById('passwordStrength');
    const strengthText = document.getElementById('strengthText');
    const bars = [
        document.getElementById('strengthBar1'),
        document.getElementById('strengthBar2'),
        document.getElementById('strengthBar3'),
        document.getElementById('strengthBar4')
    ];
    const requirements = {
        length: document.getElementById('reqLength'),
        lower: document.getElementById('reqLower'),
        upper: document.getElementById('reqUpper'),
        number: document.getElementById('reqNumber'),
        special: document.getElementById('reqSpecial')
    };

    if (!password) {
        strengthContainer.style.display = 'none';
        return;
    }

    strengthContainer.style.display = 'block';
    const result = checkPasswordStrength(password);

    bars.forEach((bar, index) => {
        bar.classList.remove('active', 'weak', 'medium', 'strong');
        if (index < result.level) {
            bar.classList.add('active', result.strength);
        }
    });

    strengthText.className = `strength-text ${result.strength}`;
    const icon = result.strength === 'strong' ? 'fa-check-circle' :
                 result.strength === 'medium' ? 'fa-exclamation-circle' : 'fa-times-circle';
    strengthText.innerHTML = `<i class="fas ${icon}"></i><span>密码强度：${result.text}</span>`;

    Object.keys(requirements).forEach(key => {
        const req = requirements[key];
        if (result.checks[key]) {
            req.classList.add('met');
            req.querySelector('i').className = 'fas fa-check';
        } else {
            req.classList.remove('met');
            req.querySelector('i').className = 'fas fa-circle';
        }
    });
}

function resetPasswordStrengthUI() {
    const strengthContainer = document.getElementById('passwordStrength');
    strengthContainer.style.display = 'none';

    const requirements = ['reqLength', 'reqLower', 'reqUpper', 'reqNumber', 'reqSpecial'];
    requirements.forEach(id => {
        const req = document.getElementById(id);
        req.classList.remove('met');
        req.querySelector('i').className = 'fas fa-circle';
    });
}

function setupEventListeners() {
    elements.themeToggle.addEventListener('click', toggleTheme);

    elements.tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    elements.loginForm.addEventListener('submit', handleLogin);
    elements.registerForm.addEventListener('submit', handleRegister);

    elements.passwordToggles.forEach(toggle => {
        toggle.addEventListener('click', () => togglePasswordVisibility(toggle));
    });

    elements.loginIdentifier.addEventListener('input', () => clearFieldError('loginIdentifier', 'loginIdentifierError'));
    elements.loginPassword.addEventListener('input', () => clearFieldError('loginPassword', 'loginPasswordError'));
    elements.registerUsername.addEventListener('input', () => clearFieldError('registerUsername', 'registerUsernameError'));
    elements.registerEmail.addEventListener('input', () => clearFieldError('registerEmail', 'registerEmailError'));
    elements.registerPassword.addEventListener('input', () => {
        clearFieldError('registerPassword', 'registerPasswordError');
        updatePasswordStrengthUI(elements.registerPassword.value);
    });
    elements.registerConfirmPassword.addEventListener('input', () => clearFieldError('registerConfirmPassword', 'registerConfirmPasswordError'));
}

document.addEventListener('DOMContentLoaded', init);
