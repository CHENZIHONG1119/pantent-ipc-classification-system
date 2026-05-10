const state = {
    classifications: [],
    currentClassificationId: null,
    isDarkMode: localStorage.getItem('theme') === 'dark',
    isThinking: false,
    apiSettings: {
        url: 'http://localhost:8000',
        model: '',
        apiKey: '',
        maxTokens: 512,
        temperature: 0.7,
        isConnected: false
    },
    currentSearchQuery: '',
    excelData: [],
    isBatchProcessing: false,
    batchProgress: { current: 0, total: 0 }
};

const elements = {
    sidebar: document.getElementById('sidebar'),
    classificationList: document.getElementById('classificationList'),
    submitBtn: document.getElementById('submitBtn'),
    clearFormBtn: document.getElementById('clearFormBtn'),
    patentAbstract: document.getElementById('patentAbstract'),
    resultSection: document.getElementById('resultSection'),
    resultContent: document.getElementById('resultContent'),
    themeToggle: document.getElementById('themeToggle'),
    newClassificationBtn: document.getElementById('newClassificationBtn'),
    historyControls: document.getElementById('historyControls'),
    apiStatus: document.getElementById('apiStatus'),
    statusDot: document.getElementById('statusDot'),
    statusText: document.getElementById('statusText'),
    historySearch: document.getElementById('historySearch'),
    clearHistory: document.getElementById('clearHistory'),
    logoutBtn: document.getElementById('logoutBtn'),
    adminBtn: document.getElementById('adminBtn'),
    userInfo: document.getElementById('userInfo'),
    currentUsername: document.getElementById('currentUsername'),
    importExcelBtn: document.getElementById('importExcelBtn'),
    excelModal: document.getElementById('excelModal'),
    closeExcelModal: document.getElementById('closeExcelModal'),
    excelUploadArea: document.getElementById('excelUploadArea'),
    excelFileInput: document.getElementById('excelFileInput'),
    excelTableContainer: document.getElementById('excelTableContainer'),
    excelDataBody: document.getElementById('excelDataBody'),
    excelProgress: document.getElementById('excelProgress'),
    excelProgressText: document.getElementById('excelProgressText'),
    excelProgressFill: document.getElementById('excelProgressFill'),
    resetExcelBtn: document.getElementById('resetExcelBtn'),
    startBatchBtn: document.getElementById('startBatchBtn'),
    exportResultBtn: document.getElementById('exportResultBtn'),
    confirmModal: document.getElementById('confirmModal'),
    confirmResultValue: document.getElementById('confirmResultValue'),
    confirmCorrectBtn: document.getElementById('confirmCorrectBtn'),
    confirmWrongBtn: document.getElementById('confirmWrongBtn')
};

// ==================== API 基础配置 ====================

const API_BASE = 'http://localhost:3000';
const TOKEN_KEY = 'patent_classification_token';
const USER_KEY = 'patent_classification_current_user';

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

function isLoggedIn() {
    return getCurrentUser() !== null && getToken() !== null;
}

function checkAuth() {
    if (!isLoggedIn()) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

function logout() {
    if (confirm('确定要退出登录吗？')) {
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(USER_KEY);
        localStorage.removeItem(USER_KEY);
        window.location.href = 'login.html';
    }
}

function authHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + getToken()
    };
}

async function apiGet(path) {
    const res = await fetch(API_BASE + path, { headers: authHeaders() });
    if (res.status === 401) { logout(); return null; }
    return await res.json();
}

async function apiPost(path, body) {
    const res = await fetch(API_BASE + path, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body)
    });
    if (res.status === 401) { logout(); return null; }
    return await res.json();
}

async function apiPut(path, body) {
    const res = await fetch(API_BASE + path, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(body)
    });
    if (res.status === 401) { logout(); return null; }
    return await res.json();
}

async function apiDelete(path) {
    const res = await fetch(API_BASE + path, { method: 'DELETE', headers: authHeaders() });
    if (res.status === 401) { logout(); return null; }
    return await res.json();
}

function displayUserInfo() {
    const user = getCurrentUser();
    if (user && elements.currentUsername) {
        elements.currentUsername.textContent = user.username;
    }

    if (elements.adminBtn) {
        if (user && user.role === 'admin') {
            elements.adminBtn.style.display = 'flex';
        } else {
            elements.adminBtn.style.display = 'none';
        }
    }
}

// ==================== 分类记录管理功能 (基于API) ====================

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

async function saveClassificationHistory() {
    // 已通过各API操作实时保存
}

async function loadClassificationHistory() {
    const res = await apiGet('/api/classifications');
    return res ? res.classifications : [];
}

function deleteClassificationHistory() {
    apiDelete('/api/classifications');
}

async function addClassificationToHistory(classification) {
    await apiPost('/api/classifications', {
        id: classification.id,
        title: classification.title,
        patentAbstract: classification.patentAbstract,
        result: classification.result,
        confirmed: classification.confirmed,
        corrected: classification.corrected,
        createdAt: classification.createdAt,
        updatedAt: classification.updatedAt
    });
}

async function updateClassificationInHistory(classificationId, classification) {
    await apiPut('/api/classifications/' + classificationId, {
        title: classification.title,
        patentAbstract: classification.patentAbstract,
        result: classification.result,
        confirmed: classification.confirmed,
        corrected: classification.corrected,
        updatedAt: classification.updatedAt
    });
}

async function deleteClassificationFromHistory(classificationId) {
    await apiDelete('/api/classifications/' + classificationId);
}

async function loadAllClassifications() {
    state.classifications = await loadClassificationHistory();

    if (elements.historyControls) {
        elements.historyControls.style.display = state.classifications.length > 0 ? 'block' : 'none';
    }

    if (state.classifications.length === 0) {
        showEmptyState();
    } else {
        state.currentClassificationId = state.classifications[0].id;
        loadClassification(state.currentClassificationId);
    }

    updateClassificationsList();
}

function createNewClassification() {
    const classification = {
        id: generateId(),
        title: '新分类',
        patentAbstract: '',
        result: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    state.classifications.unshift(classification);
    state.currentClassificationId = classification.id;

    addClassificationToHistory(classification);

    return classification;
}

function saveCurrentClassification() {
    if (!state.currentClassificationId) return;

    const classification = state.classifications.find(cls => cls.id === state.currentClassificationId);
    if (classification) {
        classification.updatedAt = new Date().toISOString();
        updateClassificationInHistory(state.currentClassificationId, classification);
    }
}

function loadClassification(classificationId) {
    const classification = state.classifications.find(cls => cls.id === classificationId);
    if (!classification) return;

    state.currentClassificationId = classificationId;

    elements.patentAbstract.value = classification.patentAbstract || '';

    if (classification.result) {
        showClassificationResult(classification);
    } else {
        elements.resultSection.style.display = 'none';
    }
}

function showClassificationResult(classification) {
    elements.resultSection.style.display = 'block';

    const fields = parseIPCFields(classification.result);

    if (classification.confirmed !== undefined && classification.confirmed !== null) {
        if (classification.confirmed === true) {
            showFullResult(fields, classification);
        } else {
            showResultError(fields, classification);
        }
    } else {
        showPreliminaryResult(fields, classification);
    }
}

function showPreliminaryResult(fields, classification) {
    const preliminaryResult = `部:${fields.section || '-'}  大类:${fields.class || '-'}`;

    elements.confirmResultValue.textContent = preliminaryResult;
    elements.confirmModal.classList.add('show');

    const newConfirmBtn = elements.confirmCorrectBtn.cloneNode(true);
    const newWrongBtn = elements.confirmWrongBtn.cloneNode(true);
    elements.confirmCorrectBtn.parentNode.replaceChild(newConfirmBtn, elements.confirmCorrectBtn);
    elements.confirmWrongBtn.parentNode.replaceChild(newWrongBtn, elements.confirmWrongBtn);
    elements.confirmCorrectBtn = newConfirmBtn;
    elements.confirmWrongBtn = newWrongBtn;

    elements.confirmCorrectBtn.addEventListener('click', () => {
        elements.confirmModal.classList.remove('show');
        classification.confirmed = true;
        updateClassificationInHistory(classification.id, classification);
        const idx = state.classifications.findIndex(c => c.id === classification.id);
        if (idx !== -1) state.classifications[idx].confirmed = true;
        showFullResult(fields, classification);
    });

    elements.confirmWrongBtn.addEventListener('click', () => {
        elements.confirmModal.classList.remove('show');
        classification.confirmed = false;
        updateClassificationInHistory(classification.id, classification);
        const idx = state.classifications.findIndex(c => c.id === classification.id);
        if (idx !== -1) state.classifications[idx].confirmed = false;
        showResultError(fields, classification);
    });
}

function generateIPCCodeFromFields(fields) {
    const section = fields.section || '';
    const mainClass = fields.class || '';
    const subclass = fields.subclass || '';
    const mainGroup = fields.main_group || '';
    const subgroup = fields.subgroup || '';

    if (!section && !mainClass && !subclass && !mainGroup && !subgroup) {
        return '-';
    }

    const paddedClass = mainClass ? mainClass.padStart(2, '0') : '00';
    const paddedSubgroup = subgroup ? subgroup.padStart(2, '0') : '00';
    return `${section}${paddedClass}${subclass}${mainGroup}/${paddedSubgroup}`;
}

function showFullResult(fields, classification) {
    const ipcCode = generateIPCCodeFromFields(fields);

    let resultHtml = `
        <div class="result-item">
            <div class="result-label">主IPC分类号</div>
            <div class="result-value"><span class="ipc-code" style="font-size: 18px; font-weight: 600;">${ipcCode}</span></div>
        </div>
        <div class="result-item" style="margin-top: 12px;">
            <div class="result-label">分类详情</div>
            <div class="result-value" style="line-height: 1.8;">
                <div>部：${fields.section || '-'}</div>
                <div>大类：${fields.class || '-'}</div>
                <div>小类：${fields.subclass || '-'}</div>
                <div>大组：${fields.main_group || '-'}</div>
                <div>小组：${fields.subgroup || '-'}</div>
            </div>
        </div>
        <div class="result-item" style="margin-top: 8px;">
            <div class="result-label">状态</div>
            <div class="result-value" style="display: flex; align-items: center; gap: 12px;">
                <span style="color: var(--success-color);">
                    <i class="fas fa-check-circle"></i> 已确认
                </span>
                <button class="btn btn-secondary" id="editConfirmedBtn" style="padding: 4px 12px; font-size: 12px; display: inline-flex; align-items: center; justify-content: center; gap: 4px; line-height: 1; height: 28px;">
                    <i class="fas fa-edit"></i> 修改
                </button>
            </div>
        </div>
    `;

    elements.resultContent.innerHTML = resultHtml;

    document.getElementById('editConfirmedBtn').addEventListener('click', () => {
        showEditForm(fields, classification);
    });
}

function showEditForm(fields, classification) {
    const ipcCode = generateIPCCodeFromFields(fields);

    let resultHtml = `
        <div class="result-item">
            <div class="result-label">当前分类号</div>
            <div class="result-value"><span class="ipc-code" style="font-size: 16px;">${ipcCode}</span></div>
        </div>
        <div class="result-item" style="margin-top: 16px; padding-top: 16px; border-top: 1px dashed var(--border-color);">
            <div class="result-label">修改分类</div>
            <div class="result-value">
                <div style="display: grid; grid-template-columns: 60px 1fr; gap: 8px; align-items: center;">
                    <label style="font-size: 13px;">部：</label>
                    <input type="text" id="editSection" value="${fields.section || ''}" maxlength="1" placeholder="A-H" style="padding: 6px 10px; border: 1px solid var(--border-color); border-radius: 4px; width: 60px;">
                    <label style="font-size: 13px;">大类：</label>
                    <input type="text" id="editClass" value="${fields.class || ''}" maxlength="2" placeholder="01-99" style="padding: 6px 10px; border: 1px solid var(--border-color); border-radius: 4px; width: 60px;">
                    <label style="font-size: 13px;">小类：</label>
                    <input type="text" id="editSubclass" value="${fields.subclass || ''}" maxlength="1" placeholder="A-Z" style="padding: 6px 10px; border: 1px solid var(--border-color); border-radius: 4px; width: 60px;">
                    <label style="font-size: 13px;">大组：</label>
                    <input type="text" id="editMainGroup" value="${fields.main_group || ''}" maxlength="4" placeholder="1-9999" style="padding: 6px 10px; border: 1px solid var(--border-color); border-radius: 4px; width: 80px;">
                    <label style="font-size: 13px;">小组：</label>
                    <input type="text" id="editSubgroup" value="${fields.subgroup || ''}" maxlength="4" placeholder="00-99" style="padding: 6px 10px; border: 1px solid var(--border-color); border-radius: 4px; width: 80px;">
                </div>
                <div style="margin-top: 12px; display: flex; gap: 8px;">
                    <button class="btn btn-primary" id="saveEditBtn" style="padding: 4px 12px; font-size: 12px; display: inline-flex; align-items: center; justify-content: center; gap: 4px; line-height: 1; height: 28px;">
                        <i class="fas fa-save"></i> 保存
                    </button>
                    <button class="btn btn-secondary" id="cancelEditBtn" style="padding: 4px 12px; font-size: 12px; display: inline-flex; align-items: center; justify-content: center; gap: 4px; line-height: 1; height: 28px;">
                        <i class="fas fa-times"></i> 取消
                    </button>
                </div>
            </div>
        </div>
    `;

    elements.resultContent.innerHTML = resultHtml;

    document.getElementById('saveEditBtn').addEventListener('click', () => {
        saveCorrectedClassification(classification);
    });

    document.getElementById('cancelEditBtn').addEventListener('click', () => {
        showFullResult(fields, classification);
    });
}

function showResultError(fields, classification) {
    const ipcCode = generateIPCCodeFromFields(fields);

    let resultHtml = `
        <div class="result-item">
            <div class="result-label">原分类号</div>
            <div class="result-value"><span class="ipc-code" style="font-size: 16px; background-color: var(--error-color); text-decoration: line-through;">${ipcCode}</span></div>
        </div>
        <div class="result-item" style="margin-top: 12px;">
            <div class="result-label">原分类详情</div>
            <div class="result-value" style="line-height: 1.8; color: var(--error-color); text-decoration: line-through;">
                <div>部：${fields.section || '-'}</div>
                <div>大类：${fields.class || '-'}</div>
                <div>小类：${fields.subclass || '-'}</div>
                <div>大组：${fields.main_group || '-'}</div>
                <div>小组：${fields.subgroup || '-'}</div>
            </div>
        </div>
        <div class="result-item" style="margin-top: 16px; padding-top: 16px; border-top: 1px dashed var(--border-color);">
            <div class="result-label">手动校正</div>
            <div class="result-value">
                <div style="display: grid; grid-template-columns: 60px 1fr; gap: 8px; align-items: center;">
                    <label style="font-size: 13px;">部：</label>
                    <input type="text" id="editSection" value="${fields.section || ''}" maxlength="1" placeholder="A-H" style="padding: 6px 10px; border: 1px solid var(--border-color); border-radius: 4px; width: 60px;">
                    <label style="font-size: 13px;">大类：</label>
                    <input type="text" id="editClass" value="${fields.class || ''}" maxlength="2" placeholder="01-99" style="padding: 6px 10px; border: 1px solid var(--border-color); border-radius: 4px; width: 60px;">
                    <label style="font-size: 13px;">小类：</label>
                    <input type="text" id="editSubclass" value="${fields.subclass || ''}" maxlength="1" placeholder="A-Z" style="padding: 6px 10px; border: 1px solid var(--border-color); border-radius: 4px; width: 60px;">
                    <label style="font-size: 13px;">大组：</label>
                    <input type="text" id="editMainGroup" value="${fields.main_group || ''}" maxlength="4" placeholder="1-9999" style="padding: 6px 10px; border: 1px solid var(--border-color); border-radius: 4px; width: 80px;">
                    <label style="font-size: 13px;">小组：</label>
                    <input type="text" id="editSubgroup" value="${fields.subgroup || ''}" maxlength="4" placeholder="00-99" style="padding: 6px 10px; border: 1px solid var(--border-color); border-radius: 4px; width: 80px;">
                </div>
                <button class="btn btn-primary" id="saveCorrectionBtn" style="margin-top: 12px;">
                    <i class="fas fa-save"></i> 保存校正
                </button>
            </div>
        </div>
        <div class="result-item" style="margin-top: 8px;">
            <div class="result-label">状态</div>
            <div class="result-value" style="color: var(--error-color);">
                <i class="fas fa-exclamation-circle"></i> 用户标记为有误，请手动校正
            </div>
        </div>
    `;

    elements.resultContent.innerHTML = resultHtml;

    document.getElementById('saveCorrectionBtn').addEventListener('click', () => {
        saveCorrectedClassification(classification);
    });
}

function saveCorrectedClassification(classification) {
    const newFields = {
        section: document.getElementById('editSection').value.toUpperCase().trim(),
        class: document.getElementById('editClass').value.trim(),
        subclass: document.getElementById('editSubclass').value.toUpperCase().trim(),
        main_group: document.getElementById('editMainGroup').value.trim(),
        subgroup: document.getElementById('editSubgroup').value.trim()
    };

    if (!newFields.section || !newFields.class) {
        alert('请至少填写部和大类');
        return;
    }

    const newResult = `部:${newFields.section},大类:${newFields.class},小类:${newFields.subclass || '-'},大组:${newFields.main_group || '-'},小组:${newFields.subgroup || '-'}`;

    classification.result = newResult;
    classification.confirmed = true;
    classification.corrected = true;
    classification.updatedAt = new Date().toISOString();

    updateClassificationInHistory(classification.id, classification);

    const idx = state.classifications.findIndex(c => c.id === classification.id);
    if (idx !== -1) {
        state.classifications[idx] = classification;
    }

    showCorrectedResult(newFields);

    alert('分类结果已校正保存');
}

function showCorrectedResult(fields) {
    const ipcCode = generateIPCCodeFromFields(fields);

    let resultHtml = `
        <div class="result-item">
            <div class="result-label">主IPC分类号</div>
            <div class="result-value"><span class="ipc-code" style="font-size: 18px; font-weight: 600;">${ipcCode}</span></div>
        </div>
        <div class="result-item" style="margin-top: 12px;">
            <div class="result-label">分类详情</div>
            <div class="result-value" style="line-height: 1.8;">
                <div>部：${fields.section || '-'}</div>
                <div>大类：${fields.class || '-'}</div>
                <div>小类：${fields.subclass || '-'}</div>
                <div>大组：${fields.main_group || '-'}</div>
                <div>小组：${fields.subgroup || '-'}</div>
            </div>
        </div>
        <div class="result-item" style="margin-top: 8px;">
            <div class="result-label">状态</div>
            <div class="result-value" style="color: var(--primary-color);">
                <i class="fas fa-edit"></i> 已手动校正
            </div>
        </div>
    `;

    elements.resultContent.innerHTML = resultHtml;
}

function parseIPCFields(rawResult) {
    const fields = {
        section: '',
        class: '',
        subclass: '',
        main_group: '',
        subgroup: ''
    };

    if (!rawResult) return fields;

    const patterns = {
        section: /section\s*[::：]\s*([A-Ha-h])/i,
        class: /class\s*[::：]\s*(\d+)/i,
        subclass: /subclass\s*[::：]\s*([A-Za-z])/i,
        main_group: /main_group\s*[::：]\s*(\d+)/i,
        subgroup: /subgroup\s*[::：]\s*(\d+)/i
    };

    const chinesePatterns = {
        section: /部\s*[::：]\s*([A-Ha-h])/i,
        class: /类\s*[::：]\s*(\d+)/i,
        subclass: /子类\s*[::：]\s*([A-Za-z])/i,
        main_group: /主组\s*[::：]\s*(\d+)/i,
        subgroup: /子组\s*[::：]\s*(\d+)/i
    };

    for (const [key, pattern] of Object.entries(patterns)) {
        const match = rawResult.match(pattern);
        if (match) {
            fields[key] = match[1].toUpperCase();
        }
    }

    for (const [key, pattern] of Object.entries(chinesePatterns)) {
        if (!fields[key]) {
            const match = rawResult.match(pattern);
            if (match) {
                fields[key] = match[1].toUpperCase();
            }
        }
    }

    return fields;
}

function parseIPCResult(rawResult) {
    const fields = parseIPCFields(rawResult);

    if (fields.section || fields.class || fields.subclass || fields.main_group || fields.subgroup) {
        return `部:${fields.section || '-'},大类:${fields.class || '-'},小类:${fields.subclass || '-'},大组:${fields.main_group || '-'},小组:${fields.subgroup || '-'}`;
    }

    return '分类失败';
}

function showEmptyState() {
    elements.patentAbstract.value = '';
    elements.resultSection.style.display = 'none';
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}小时前`;

    return date.toLocaleDateString('zh-CN');
}

function updateClassificationsList() {
    if (!elements.classificationList) return;

    elements.classificationList.innerHTML = '';

    if (state.currentSearchQuery) {
        searchClassifications(state.currentSearchQuery);
        return;
    }

    state.classifications.forEach(classification => {
        const classificationItem = document.createElement('div');
        classificationItem.className = `classification-item ${classification.id === state.currentClassificationId ? 'active' : ''}`;
        classificationItem.dataset.id = classification.id;

        classificationItem.innerHTML = `
            <div class="classification-content">
                <i class="fas fa-file-alt classification-icon"></i>
                <div class="classification-info">
                    <div class="classification-title">${classification.title}</div>
                    <div class="classification-date">${formatTime(classification.updatedAt)}</div>
                </div>
            </div>
            <div class="classification-actions">
                <button class="classification-edit-btn" title="编辑分类记录">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="classification-delete-btn" title="删除分类记录">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;

        classificationItem.addEventListener('click', (e) => {
            if (!e.target.closest('.classification-actions')) {
                loadClassification(classification.id);
                if (state.currentSearchQuery) {
                    searchClassifications(state.currentSearchQuery);
                    elements.sidebar.classList.add('expanded');
                } else {
                    updateClassificationsList();
                }
            }
        });

        const deleteBtn = classificationItem.querySelector('.classification-delete-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteClassification(classification.id);
        });

        const editBtn = classificationItem.querySelector('.classification-edit-btn');
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const newTitle = prompt('请输入新的分类记录标题:', classification.title);
            if (newTitle && newTitle.trim()) {
                classification.title = newTitle.trim().substring(0, 30);
                updateClassificationInHistory(classification.id, classification);
                updateClassificationsList();
                if (state.currentSearchQuery) {
                    elements.sidebar.classList.add('expanded');
                }
            }
        });

        elements.classificationList.appendChild(classificationItem);
    });
}

function createNewClassificationAndRender() {
    createNewClassification();
    updateClassificationsList();
    showEmptyState();
}

function deleteClassification(classificationId) {
    if (!confirm('确定要删除这个分类记录吗？')) return;

    deleteClassificationFromHistory(classificationId);

    state.classifications = state.classifications.filter(cls => cls.id !== classificationId);

    if (state.currentClassificationId === classificationId) {
        if (state.classifications.length > 0) {
            state.currentClassificationId = state.classifications[0].id;
            loadClassification(state.currentClassificationId);
        } else {
            createNewClassificationAndRender();
        }
    }

    if (state.currentSearchQuery) {
        searchClassifications(state.currentSearchQuery);
        elements.sidebar.classList.add('expanded');
    } else {
        updateClassificationsList();
    }
    loadAllClassifications();
}

function searchClassifications(query) {
    state.currentSearchQuery = query.trim();

    if (!state.currentSearchQuery) {
        updateClassificationsList();
        return;
    }

    const filteredClassifications = state.classifications.filter(cls => {
        const titleMatch = cls.title.toLowerCase().includes(query.toLowerCase());
        const abstractMatch = cls.patentAbstract.toLowerCase().includes(query.toLowerCase());
        const resultMatch = cls.result.toLowerCase().includes(query.toLowerCase());
        return titleMatch || abstractMatch || resultMatch;
    });

    if (!elements.classificationList) return;
    elements.classificationList.innerHTML = '';

    if (filteredClassifications.length === 0) {
        elements.classificationList.innerHTML = `
            <div style="padding: 20px; text-align: center; color: var(--text-secondary);">
                <i class="fas fa-search" style="font-size: 24px; margin-bottom: 8px;"></i>
                <div>没有找到匹配的分类记录</div>
            </div>
        `;
        return;
    }

    filteredClassifications.forEach(classification => {
        const classificationItem = document.createElement('div');
        classificationItem.className = `classification-item ${classification.id === state.currentClassificationId ? 'active' : ''}`;
        classificationItem.dataset.id = classification.id;

        classificationItem.innerHTML = `
            <div class="classification-content">
                <i class="fas fa-file-alt classification-icon"></i>
                <div class="classification-info">
                    <div class="classification-title">${classification.title}</div>
                    <div class="classification-date">${formatTime(classification.updatedAt)}</div>
                </div>
            </div>
            <div class="classification-actions">
                <button class="classification-edit-btn" title="编辑分类记录">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="classification-delete-btn" title="删除分类记录">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;

        classificationItem.addEventListener('click', (e) => {
            if (!e.target.closest('.classification-actions')) {
                loadClassification(classification.id);
                if (state.currentSearchQuery) {
                    searchClassifications(state.currentSearchQuery);
                    elements.sidebar.classList.add('expanded');
                } else {
                    updateClassificationsList();
                }
            }
        });

        const deleteBtn = classificationItem.querySelector('.classification-delete-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteClassification(classification.id);
        });

        const editBtn = classificationItem.querySelector('.classification-edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const newTitle = prompt('请输入新的分类记录标题:', classification.title);
                if (newTitle && newTitle.trim()) {
                    classification.title = newTitle.trim().substring(0, 30);
                    updateClassificationInHistory(classification.id, classification);
                    if (state.currentSearchQuery) {
                        searchClassifications(state.currentSearchQuery);
                        elements.sidebar.classList.add('expanded');
                    } else {
                        updateClassificationsList();
                    }
                }
            });
        }

        elements.classificationList.appendChild(classificationItem);
    });
}

function clearAllHistory() {
    if (!confirm('确定要清空所有分类记录吗？此操作无法恢复！')) return;
    if (!confirm('再次确认：您真的要删除所有分类记录吗？')) return;

    deleteClassificationHistory();

    state.classifications = [];
    state.currentClassificationId = null;
    state.currentSearchQuery = '';

    if (elements.historySearch) elements.historySearch.value = '';
    if (elements.sidebar) elements.sidebar.classList.remove('expanded');

    createNewClassificationAndRender();
    loadAllClassifications();

    alert('所有分类记录已清空');
}

async function init() {
    if (!checkAuth()) return;

    applyTheme();
    setupEventListeners();
    await loadThemeFromServer();
    await loadApiSettings();
    checkApiConnection();
    loadAllClassifications();
    displayUserInfo();
}

async function checkApiConnection() {
    updateConnectionStatus('connecting', '连接中...');

    try {
        const response = await fetch(`${state.apiSettings.url}/v1/models`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(state.apiSettings.apiKey && {'Authorization': `Bearer ${state.apiSettings.apiKey}`})
            }
        });

        if (response.ok) {
            const data = await response.json();
            console.log('可用模型:', data);
            state.apiSettings.isConnected = true;
            updateConnectionStatus('connected', '已连接');
            enableFormInterface();
        } else {
            throw new Error(`API响应异常: ${response.status}`);
        }
    } catch (error) {
        console.error('连接检查失败:', error);
        state.apiSettings.isConnected = false;
        updateConnectionStatus('error', '连接失败');
        disableFormInterface();
    }
}

function updateConnectionStatus(status, text) {
    elements.statusDot.className = 'status-dot';
    if (status === 'connected') {
        elements.statusDot.classList.add('connected');
    } else if (status === 'connecting') {
        elements.statusDot.classList.add('connecting');
    }
    elements.statusText.textContent = text;
}

function enableFormInterface() {
    elements.submitBtn.disabled = false;
    elements.clearFormBtn.disabled = false;
}

function disableFormInterface() {
    elements.submitBtn.disabled = true;
    elements.clearFormBtn.disabled = true;
}

function goToAdmin() {
    window.location.href = 'admin.html';
}

async function classifyPatent(patentAbstract) {
    const systemPrompt = "你是一个专利分类专家。给定一个专利摘要，预测其主IPC分类号，并以分层次的形式输出。IPC分类号包括部（section）、类（class）、子类（subclass）、主组（main_group）和子组（subgroup）。输出格式为：section: [部], class: [类], subclass: [子类], main_group: [主组], subgroup: [子组]，根据提供的专利摘要进行分类";

    const requestData = {
        model: state.apiSettings.model,
        messages: [
            {role: "system", content: systemPrompt},
            {role: "user", content: `专利摘要：${patentAbstract}`}
        ],
        max_tokens: state.apiSettings.maxTokens,
        temperature: state.apiSettings.temperature,
        stream: false
    };

    const response = await fetch(`${state.apiSettings.url}/v1/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(state.apiSettings.apiKey && {'Authorization': `Bearer ${state.apiSettings.apiKey}`})
        },
        body: JSON.stringify(requestData)
    });

    if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

async function submitClassification() {
    if (!state.apiSettings.isConnected) {
        if (confirm('API未连接，是否前往管理后台配置API？')) {
            goToAdmin();
        }
        return;
    }

    const patentAbstract = elements.patentAbstract.value.trim();

    if (!patentAbstract) {
        alert('请填写专利摘要');
        return;
    }

    if (!state.currentClassificationId) {
        createNewClassification();
    }

    const classification = state.classifications.find(cls => cls.id === state.currentClassificationId);
    if (classification) {
        classification.patentAbstract = patentAbstract;
        classification.title = patentAbstract.length > 20 ? patentAbstract.substring(0, 20) + '...' : patentAbstract;
    }

    state.isThinking = true;
    elements.submitBtn.disabled = true;
    elements.submitBtn.textContent = '分类中...';

    try {
        const result = await classifyPatent(patentAbstract);

        if (classification) {
            classification.result = result;
            showClassificationResult(classification);
            saveCurrentClassification();
        }

    } catch (error) {
        console.error('分类失败:', error);
        const errorMessage = `抱歉，发生了错误：${error.message}`;

        elements.resultSection.style.display = 'block';
        elements.resultContent.innerHTML = `
            <div class="result-item">
                <div class="result-label">错误信息</div>
                <div class="result-value" style="color: var(--error-color);">${errorMessage}</div>
            </div>
        `;

        if (classification) {
            classification.result = errorMessage;
            saveCurrentClassification();
        }
    } finally {
        state.isThinking = false;
        elements.submitBtn.disabled = false;
        elements.submitBtn.textContent = '提交分类';
        updateClassificationsList();
    }
}

function clearForm() {
    elements.patentAbstract.value = '';
    elements.resultSection.style.display = 'none';
    createNewClassificationAndRender();
}

function applyTheme() {
    if (state.isDarkMode) {
        document.body.classList.add('dark-mode');
        elements.themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
        document.body.classList.remove('dark-mode');
        elements.themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    }
}

function toggleTheme() {
    state.isDarkMode = !state.isDarkMode;
    applyTheme();
    localStorage.setItem('theme', state.isDarkMode ? 'dark' : 'light');
    if (isLoggedIn()) {
        apiPut('/api/settings/theme', { theme: state.isDarkMode ? 'dark' : 'light' });
    }
}

async function loadApiSettings() {
    if (!isLoggedIn()) return;
    const res = await apiGet('/api/settings');
    if (res) {
        state.apiSettings.url = res.url;
        state.apiSettings.model = res.model;
        state.apiSettings.apiKey = res.apiKey;
        state.apiSettings.maxTokens = res.maxTokens;
        state.apiSettings.temperature = res.temperature;
    }
}

async function loadThemeFromServer() {
    if (!isLoggedIn()) return;
    const res = await apiGet('/api/settings/theme');
    if (res && res.theme) {
        state.isDarkMode = res.theme === 'dark';
        localStorage.setItem('theme', res.theme);
        applyTheme();
    }
}

function setupEventListeners() {
    elements.submitBtn.addEventListener('click', submitClassification);
    elements.clearFormBtn.addEventListener('click', clearForm);

    elements.themeToggle.addEventListener('click', toggleTheme);
    elements.newClassificationBtn.addEventListener('click', createNewClassificationAndRender);

    if (elements.historySearch) {
        elements.historySearch.addEventListener('focus', () => {
            elements.sidebar.classList.add('expanded');
        });
        elements.historySearch.addEventListener('input', (e) => {
            if (e.target.value.trim()) {
                elements.sidebar.classList.add('expanded');
            }
            searchClassifications(e.target.value);
        });
        elements.historySearch.addEventListener('blur', (e) => {
            if (!e.target.value.trim()) {
                elements.sidebar.classList.remove('expanded');
            }
        });
    }

    if (elements.clearHistory) {
        elements.clearHistory.addEventListener('click', clearAllHistory);
    }

    if (elements.adminBtn) {
        elements.adminBtn.addEventListener('click', goToAdmin);
    }

    if (elements.logoutBtn) {
        elements.logoutBtn.addEventListener('click', logout);
    }

    setupExcelImportListeners();
}

// ==================== Excel导入功能 ====================

function setupExcelImportListeners() {
    elements.importExcelBtn.addEventListener('click', openExcelModal);

    elements.closeExcelModal.addEventListener('click', closeExcelModal);
    elements.excelModal.addEventListener('click', (e) => {
        if (e.target === elements.excelModal) closeExcelModal();
    });

    elements.excelUploadArea.addEventListener('click', () => {
        elements.excelFileInput.click();
    });

    elements.excelFileInput.addEventListener('change', handleFileSelect);

    elements.excelUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.excelUploadArea.classList.add('dragover');
    });

    elements.excelUploadArea.addEventListener('dragleave', () => {
        elements.excelUploadArea.classList.remove('dragover');
    });

    elements.excelUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.excelUploadArea.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) processExcelFile(file);
    });

    elements.resetExcelBtn.addEventListener('click', resetExcelImport);
    elements.startBatchBtn.addEventListener('click', startBatchClassification);
    elements.exportResultBtn.addEventListener('click', exportResults);
}

function openExcelModal() {
    elements.excelModal.classList.add('show');
    resetExcelImport();
}

function closeExcelModal() {
    if (state.isBatchProcessing) {
        if (!confirm('正在处理中，确定要关闭吗？')) return;
        state.isBatchProcessing = false;
    }
    elements.excelModal.classList.remove('show');
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) processExcelFile(file);
}

function processExcelFile(file) {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
        alert('请选择Excel文件 (.xlsx 或 .xls)');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

            state.excelData = [];
            jsonData.forEach((row, index) => {
                const abstract = row[0];
                if (abstract && typeof abstract === 'string' && abstract.trim()) {
                    state.excelData.push({
                        id: generateId(),
                        index: state.excelData.length + 1,
                        abstract: abstract.trim(),
                        status: 'pending',
                        result: ''
                    });
                }
            });

            if (state.excelData.length === 0) {
                alert('未找到有效的专利摘要数据');
                return;
            }

            renderExcelTable();
            showExcelActions();

        } catch (error) {
            console.error('解析Excel失败:', error);
            alert('解析Excel文件失败，请检查文件格式');
        }
    };
    reader.readAsArrayBuffer(file);
}

function renderExcelTable() {
    elements.excelUploadArea.style.display = 'none';
    elements.excelTableContainer.style.display = 'block';

    elements.excelDataBody.innerHTML = '';
    state.excelData.forEach(item => {
        const tr = document.createElement('tr');
        tr.id = `excel-row-${item.id}`;
        tr.innerHTML = `
            <td>${item.index}</td>
            <td class="abstract-cell" title="${escapeHtml(item.abstract)}">${escapeHtml(item.abstract)}</td>
            <td class="status-cell"><span class="status-badge ${item.status}">${getStatusText(item.status)}</span></td>
            <td class="result-cell" title="${escapeHtml(item.result)}">${escapeHtml(item.result) || '-'}</td>
        `;
        elements.excelDataBody.appendChild(tr);
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getStatusText(status) {
    const statusMap = {
        'pending': '待处理',
        'processing': '处理中',
        'success': '已完成',
        'error': '失败'
    };
    return statusMap[status] || status;
}

function showExcelActions() {
    elements.resetExcelBtn.style.display = 'inline-flex';
    elements.startBatchBtn.style.display = 'inline-flex';
    elements.exportResultBtn.style.display = 'none';
}

function resetExcelImport() {
    state.excelData = [];
    state.isBatchProcessing = false;
    state.batchProgress = { current: 0, total: 0 };

    elements.excelUploadArea.style.display = 'block';
    elements.excelTableContainer.style.display = 'none';
    elements.excelDataBody.innerHTML = '';
    elements.excelFileInput.value = '';

    elements.resetExcelBtn.style.display = 'none';
    elements.startBatchBtn.style.display = 'none';
    elements.exportResultBtn.style.display = 'none';
    elements.excelProgress.style.display = 'none';
}

async function startBatchClassification() {
    if (!state.apiSettings.isConnected) {
        alert('API未连接，请先配置API');
        return;
    }

    if (state.excelData.length === 0) {
        alert('没有可处理的数据');
        return;
    }

    state.isBatchProcessing = true;
    state.batchProgress = { current: 0, total: state.excelData.length };

    elements.startBatchBtn.disabled = true;
    elements.startBatchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 处理中...';
    elements.excelProgress.style.display = 'block';

    for (let i = 0; i < state.excelData.length; i++) {
        if (!state.isBatchProcessing) break;

        const item = state.excelData[i];

        if (item.status === 'success') {
            state.batchProgress.current++;
            updateBatchProgress();
            continue;
        }

        item.status = 'processing';
        updateExcelRow(item);

        try {
            const result = await classifyPatent(item.abstract);
            item.rawResult = result;
            item.result = parseIPCResult(result);
            item.status = 'success';

            const classification = {
                id: item.id,
                title: item.abstract.length > 20 ? item.abstract.substring(0, 20) + '...' : item.abstract,
                patentAbstract: item.abstract,
                result: result,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            addClassificationToHistory(classification);

        } catch (error) {
            console.error(`分类失败 [${i + 1}]:`, error);
            item.result = `错误: ${error.message}`;
            item.status = 'error';
        }

        updateExcelRow(item);
        state.batchProgress.current++;
        updateBatchProgress();

        if (i < state.excelData.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    state.isBatchProcessing = false;
    elements.startBatchBtn.disabled = false;
    elements.startBatchBtn.innerHTML = '<i class="fas fa-play"></i> 开始分类';
    elements.exportResultBtn.style.display = 'inline-flex';

    loadAllClassifications();

    alert('批量分类完成！');
}

function updateExcelRow(item) {
    const row = document.getElementById(`excel-row-${item.id}`);
    if (row) {
        row.innerHTML = `
            <td>${item.index}</td>
            <td class="abstract-cell" title="${escapeHtml(item.abstract)}">${escapeHtml(item.abstract)}</td>
            <td class="status-cell"><span class="status-badge ${item.status}">${getStatusText(item.status)}</span></td>
            <td class="result-cell" title="${escapeHtml(item.result)}">${escapeHtml(item.result) || '-'}</td>
        `;
    }
}

function updateBatchProgress() {
    const { current, total } = state.batchProgress;
    const percent = Math.round((current / total) * 100);
    elements.excelProgressText.textContent = `处理中... ${current}/${total}`;
    elements.excelProgressFill.style.width = `${percent}%`;
}

function exportResults() {
    if (state.excelData.length === 0) {
        alert('没有可导出的数据');
        return;
    }

    function parseResultFields(result) {
        const fields = { '部': '', '大类': '', '小类': '', '大组': '', '小组': '' };
        if (!result) return fields;

        const parts = result.split(',');
        parts.forEach(part => {
            const [key, value] = part.split(':');
            if (key && value && fields.hasOwnProperty(key.trim())) {
                fields[key.trim()] = value.trim() === '-' ? '' : value.trim();
            }
        });

        return fields;
    }

    function generateIPCCode(fields) {
        const section = fields['部'] || '';
        const mainClass = fields['大类'] || '';
        const subclass = fields['小类'] || '';
        const mainGroup = fields['大组'] || '';
        const subgroup = fields['小组'] || '';

        if (!section && !mainClass && !subclass && !mainGroup && !subgroup) {
            return '';
        }

        const paddedClass = mainClass ? mainClass.padStart(2, '0') : '00';
        const paddedSubgroup = subgroup ? subgroup.padStart(2, '0') : '00';
        return `${section}${paddedClass}${subclass}${mainGroup}/${paddedSubgroup}`;
    }

    const exportData = state.excelData.map(item => {
        const fields = parseResultFields(item.result);
        const ipcCode = generateIPCCode(fields);
        return {
            '序号': item.index,
            '专利摘要': item.abstract,
            '分类状态': getStatusText(item.status),
            '主IPC分类号': ipcCode,
            '部': fields['部'],
            '大类': fields['大类'],
            '小类': fields['小类'],
            '大组': fields['大组'],
            '小组': fields['小组']
        };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '分类结果');

    ws['!cols'] = [
        { wch: 8 },
        { wch: 60 },
        { wch: 10 },
        { wch: 14 },
        { wch: 6 },
        { wch: 8 },
        { wch: 6 },
        { wch: 8 },
        { wch: 8 }
    ];

    const timestamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `专利分类结果_${timestamp}.xlsx`);
}

document.addEventListener('DOMContentLoaded', init);
