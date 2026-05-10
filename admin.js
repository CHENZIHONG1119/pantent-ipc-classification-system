// ==================== API 基础配置 ====================

const API_BASE = 'http://localhost:3000';
const TOKEN_KEY = 'patent_classification_token';
const USER_KEY = 'patent_classification_current_user';

let isDarkMode = localStorage.getItem('theme') === 'dark';

function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
}

function getCurrentUser() {
    let userData = sessionStorage.getItem(USER_KEY);
    if (!userData) userData = localStorage.getItem(USER_KEY);
    if (userData) {
        try { return JSON.parse(userData); } catch (e) { return null; }
    }
    return null;
}

function checkAuth() {
    const user = getCurrentUser();
    if (!user) {
        window.location.href = 'login.html';
        return false;
    }
    if (user.role !== 'admin') {
        alert('您没有管理员权限，将返回主页面');
        window.location.href = '1.html';
        return false;
    }
    document.getElementById('adminUsername').textContent = user.username;
    return true;
}

function authHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + getToken()
    };
}

async function apiGet(path) {
    const res = await fetch(API_BASE + path, { headers: authHeaders() });
    if (res.status === 401) { window.location.href = 'login.html'; return null; }
    return await res.json();
}

async function apiDelete(path) {
    const res = await fetch(API_BASE + path, { method: 'DELETE', headers: authHeaders() });
    if (res.status === 401) { window.location.href = 'login.html'; return null; }
    return await res.json();
}

async function apiPost(path, body) {
    const res = await fetch(API_BASE + path, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body)
    });
    if (res.status === 401) { window.location.href = 'login.html'; return null; }
    return await res.json();
}

// ==================== 数据获取 (基于API) ====================

async function getUsers() {
    const res = await apiGet('/api/admin/users');
    if (!res) return {};
    const usersObj = {};
    res.users.forEach(u => {
        usersObj[u.username.toLowerCase()] = u;
    });
    return usersObj;
}

async function getClassifications() {
    const res = await apiGet('/api/admin/classifications');
    if (!res) return [];
    return res.classifications.map(cls => ({
        ...cls,
        usernameKey: cls.username ? cls.username.toLowerCase() : 'unknown'
    }));
}

async function deleteClassification(id, usernameKey) {
    if (!confirm('确定要删除该分类记录吗？')) return;
    await apiDelete('/api/admin/classifications/' + id);
    updateClassificationsTable();
    updateDashboard();
    showMessage('分类记录已删除', 'success');
}

function getApiSettings() {
    return {
        url: localStorage.getItem('apiUrl') || 'http://localhost:8000',
        model: localStorage.getItem('modelName') || '',
        apiKey: localStorage.getItem('apiKey') || '',
        maxTokens: parseInt(localStorage.getItem('maxTokens')) || 512,
        temperature: parseFloat(localStorage.getItem('temperature')) || 0.7
    };
}

// ==================== 统计计算 ====================
function calculateStorageSize() {
    let total = 0;
    for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
            total += localStorage[key].length * 2;
        }
    }
    return total;
}

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function formatIPCCode(result) {
    if (!result) return '-';

    let section = '', mainClass = '', subclass = '', mainGroup = '', subgroup = '';

    const patterns = {
        section: /部[::：]\s*([A-H])/i,
        mainClass: /大类[::：]\s*(\d+)/i,
        subclass: /小类[::：]\s*([A-Z])/i,
        mainGroup: /大组[::：]\s*(\d+)/i,
        subgroup: /小组[::：]\s*(\d+)/i
    };

    const sectionMatch = result.match(patterns.section);
    const classMatch = result.match(patterns.mainClass);
    const subclassMatch = result.match(patterns.subclass);
    const mainGroupMatch = result.match(patterns.mainGroup);
    const subgroupMatch = result.match(patterns.subgroup);

    if (sectionMatch) section = sectionMatch[1];
    if (classMatch) mainClass = classMatch[1];
    if (subclassMatch) subclass = subclassMatch[1];
    if (mainGroupMatch) mainGroup = mainGroupMatch[1];
    if (subgroupMatch) subgroup = subgroupMatch[1];

    if (!section && !mainClass) return '-';

    const paddedClass = mainClass ? mainClass.padStart(2, '0') : '00';
    const paddedSubgroup = subgroup ? subgroup.padStart(2, '0') : '00';

    return `${section}${paddedClass}${subclass}${mainGroup}/${paddedSubgroup}`;
}

// ==================== UI 更新 ====================
async function updateDashboard() {
    const users = await getUsers();
    const classifications = await getClassifications();

    document.getElementById('statUsers').textContent = Object.keys(users).length;
    document.getElementById('statClassifications').textContent = classifications.length;
    document.getElementById('statStorage').textContent = 'N/A (DB)';

    const tbody = document.querySelector('#recentClassifications tbody');
    tbody.innerHTML = '';

    if (classifications.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">暂无分类记录</td></tr>';
    } else {
        classifications.slice(0, 5).forEach(cls => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="badge badge-info">${cls.username || '未知'}</span></td>
                <td>${cls.title || '未命名'}</td>
                <td>${formatDate(cls.created_at)}</td>
                <td><span class="badge ${cls.result ? 'badge-success' : 'badge-warning'}">${cls.result ? '已完成' : '待处理'}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }
}

async function updateUsersTable() {
    const users = await getUsers();
    const tbody = document.querySelector('#usersTable tbody');
    tbody.innerHTML = '';

    const userList = Object.values(users);
    if (userList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">暂无用户数据</td></tr>';
    } else {
        userList.forEach(user => {
            const tr = document.createElement('tr');
            const roleText = user.role === 'admin' ? '管理员' : '普通用户';
            const roleBadge = user.role === 'admin' ? 'badge-warning' : 'badge-success';
            const canDelete = user.role !== 'admin';
            tr.innerHTML = `
                <td>${user.username}</td>
                <td>${user.email || '-'}</td>
                <td><span class="badge ${roleBadge}">${roleText}</span></td>
                <td>${formatDate(user.created_at)}</td>
                <td>
                    ${canDelete ? `<button class="btn btn-danger btn-sm" onclick="deleteUser('${user.id}')"><i class="fas fa-trash"></i></button>` : '<span style="color: var(--text-secondary); font-size: 12px;">不可删除</span>'}
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

async function updateClassificationsTable() {
    const classifications = await getClassifications();
    const tbody = document.querySelector('#classificationsTable tbody');
    tbody.innerHTML = '';

    if (classifications.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">暂无分类数据</td></tr>';
        return;
    }

    const groupedByUser = {};
    classifications.forEach(cls => {
        const key = cls.usernameKey || 'unknown';
        if (!groupedByUser[key]) {
            groupedByUser[key] = {
                username: cls.username || '未知用户',
                usernameKey: key,
                records: []
            };
        }
        groupedByUser[key].records.push(cls);
    });

    Object.values(groupedByUser).forEach(group => {
        const headerRow = document.createElement('tr');
        headerRow.className = 'user-group-header';
        headerRow.dataset.usernameKey = group.usernameKey;
        headerRow.innerHTML = `
            <td colspan="5">
                <div class="user-group-toggle">
                    <i class="fas fa-chevron-right toggle-arrow"></i>
                    <span class="user-group-name">
                        <i class="fas fa-user" style="margin-right: 6px; color: var(--primary-color);"></i>
                        ${group.username}
                    </span>
                    <span class="user-group-count">${group.records.length} 条记录</span>
                </div>
            </td>
        `;
        headerRow.addEventListener('click', () => toggleUserGroup(group.usernameKey));
        tbody.appendChild(headerRow);

        group.records.forEach(cls => {
            const dataRow = document.createElement('tr');
            dataRow.className = 'user-data-row';
            dataRow.dataset.usernameKey = group.usernameKey;
            const preview = cls.patent_abstract ? cls.patent_abstract.substring(0, 50) + '...' : '-';
            const ipcCode = formatIPCCode(cls.result);
            dataRow.innerHTML = `
                <td>${cls.title || '未命名'}</td>
                <td>${preview}</td>
                <td><span class="badge ${ipcCode !== '-' ? 'badge-success' : 'badge-warning'}">${ipcCode}</span></td>
                <td>${formatDate(cls.created_at)}</td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteClassification('${cls.id}', '${cls.usernameKey}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(dataRow);
        });
    });
}

function toggleUserGroup(usernameKey) {
    const header = document.querySelector(`.user-group-header[data-username-key="${usernameKey}"]`);
    const dataRows = document.querySelectorAll(`.user-data-row[data-username-key="${usernameKey}"]`);

    const isExpanded = header.classList.contains('expanded');

    if (isExpanded) {
        header.classList.remove('expanded');
        dataRows.forEach(row => row.classList.remove('visible'));
    } else {
        header.classList.add('expanded');
        dataRows.forEach(row => row.classList.add('visible'));
    }
}

function loadApiSettings() {
    const settings = getApiSettings();
    document.getElementById('apiUrl').value = settings.url;
    document.getElementById('modelName').value = settings.model;
    document.getElementById('apiKey').value = settings.apiKey;
    document.getElementById('maxTokens').value = settings.maxTokens;
    document.getElementById('temperature').value = settings.temperature;
}

// ==================== API 操作 ====================
async function testApiConnection() {
    updateApiStatus('connecting', '连接中...');

    const url = document.getElementById('apiUrl').value;
    const apiKey = document.getElementById('apiKey').value;

    try {
        const response = await fetch(`${url}/v1/models`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(apiKey && {'Authorization': `Bearer ${apiKey}`})
            }
        });

        if (response.ok) {
            updateApiStatus('connected', '连接成功');
            document.getElementById('statApiStatus').textContent = '正常';
            showMessage('API连接测试成功', 'success');
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        updateApiStatus('error', '连接失败');
        document.getElementById('statApiStatus').textContent = '异常';
        showMessage('API连接测试失败: ' + error.message, 'error');
    }
}

function updateApiStatus(status, text) {
    const dot = document.getElementById('apiStatusDot');
    dot.className = 'status-indicator';
    if (status === 'connected') {
        dot.classList.add('connected');
    } else if (status === 'connecting') {
        dot.classList.add('connecting');
    }
    document.getElementById('apiStatusText').textContent = text;
}

function saveApiSettings() {
    localStorage.setItem('apiUrl', document.getElementById('apiUrl').value);
    localStorage.setItem('modelName', document.getElementById('modelName').value);
    localStorage.setItem('apiKey', document.getElementById('apiKey').value);
    localStorage.setItem('maxTokens', document.getElementById('maxTokens').value);
    localStorage.setItem('temperature', document.getElementById('temperature').value);
    showMessage('API配置已保存', 'success');
}

// ==================== 删除操作 ====================

async function deleteUser(userId) {
    if (!confirm('确定要删除该用户吗？此操作不可恢复。')) return;
    await apiDelete('/api/admin/users/' + userId);
    updateUsersTable();
    updateDashboard();
    showMessage('用户已删除', 'success');
}

async function clearAllClassifications() {
    if (!confirm('确定要清空所有用户的分类记录吗？此操作不可恢复！')) return;
    if (!confirm('再次确认：您真的要删除所有用户的分类记录吗？')) return;
    await apiDelete('/api/admin/classifications');
    updateClassificationsTable();
    updateDashboard();
    showMessage('所有分类记录已清空', 'success');
}

async function clearAllUsers() {
    if (!confirm('确定要清空所有用户数据吗？此操作不可恢复！')) return;
    if (!confirm('再次确认：清空后所有用户将无法登录！')) return;
    await apiDelete('/api/admin/users');
    updateUsersTable();
    updateDashboard();
    showMessage('所有用户数据已清空', 'success');
}

async function resetSystem() {
    if (!confirm('确定要重置系统吗？这将清空所有数据！')) return;
    if (!confirm('最后确认：系统重置后所有数据将丢失，您将被退出登录！')) return;
    await apiPost('/api/admin/reset');
    sessionStorage.clear();
    showMessage('系统已重置，即将跳转到登录页...', 'success');
    setTimeout(() => { window.location.href = 'login.html'; }, 2000);
}

// ==================== 消息提示 ====================
function showMessage(text, type) {
    const toast = document.getElementById('messageToast');
    const textEl = document.getElementById('messageText');
    textEl.textContent = text;
    toast.className = `message-toast show ${type}`;
    toast.querySelector('i').className = type === 'success' ? 'fas fa-check-circle' : 'fas fa-exclamation-circle';

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ==================== 主题切换 ====================
function applyTheme() {
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        document.getElementById('themeToggle').innerHTML = '<i class="fas fa-sun"></i>';
    } else {
        document.body.classList.remove('dark-mode');
        document.getElementById('themeToggle').innerHTML = '<i class="fas fa-moon"></i>';
    }
}

function toggleTheme() {
    isDarkMode = !isDarkMode;
    applyTheme();
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
}

// ==================== 导航切换 ====================
async function switchSection(sectionName) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.section === sectionName);
    });
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(`section-${sectionName}`).classList.add('active');

    const titles = {
        dashboard: '仪表盘', users: '用户管理', api: 'API配置', data: '数据管理'
    };
    document.getElementById('pageTitle').textContent = titles[sectionName];

    if (sectionName === 'dashboard') await updateDashboard();
    if (sectionName === 'users') await updateUsersTable();
    if (sectionName === 'data') await updateClassificationsTable();
    if (sectionName === 'api') loadApiSettings();
}

// ==================== 事件绑定 ====================
function setupEventListeners() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => switchSection(item.dataset.section));
    });

    document.getElementById('backToMain').addEventListener('click', () => {
        window.location.href = '1.html';
    });

    document.getElementById('themeToggle').addEventListener('click', toggleTheme);

    document.getElementById('testConnection').addEventListener('click', testApiConnection);
    document.getElementById('saveApiSettings').addEventListener('click', saveApiSettings);

    document.getElementById('clearAllData').addEventListener('click', clearAllClassifications);
    document.getElementById('clearClassifications').addEventListener('click', clearAllClassifications);
    document.getElementById('clearUsers').addEventListener('click', clearAllUsers);
    document.getElementById('resetSystem').addEventListener('click', resetSystem);
}

// ==================== 初始化 ====================
async function init() {
    if (!checkAuth()) return;
    applyTheme();
    setupEventListeners();
    await updateDashboard();
    loadApiSettings();
    testApiConnection();
}

document.addEventListener('DOMContentLoaded', init);
