const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { initDatabase, queryAll, queryOne, execute } = require('./database');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'patent_classification_jwt_secret_2026';
const TOKEN_EXPIRY = '7d';

app.use(cors());
app.use(express.json());

// ==================== JWT 中间件 ====================

function authMiddleware(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: '未登录' });
    }
    try {
        const token = header.split(' ')[1];
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ error: '登录已过期，请重新登录' });
    }
}

function adminMiddleware(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: '无管理员权限' });
    }
    next();
}

// ==================== 认证接口 ====================

app.post('/api/auth/register', (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ error: '请填写所有必填字段' });
    }
    if (username.length < 3 || username.length > 20) {
        return res.status(400).json({ error: '用户名长度需在3-20个字符之间' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: '密码长度至少6个字符' });
    }

    const existingUser = queryOne('SELECT id FROM users WHERE username = ?', [username.toLowerCase()]);
    if (existingUser) {
        return res.status(400).json({ error: '用户名已存在' });
    }

    const existingEmail = queryOne('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existingEmail) {
        return res.status(400).json({ error: '该邮箱已被注册' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    execute(
        'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
        [username, email.toLowerCase(), passwordHash, 'user']
    );

    const userId = queryOne('SELECT MAX(id) as id FROM users').id;
    execute('INSERT INTO api_settings (user_id) VALUES (?)', [userId]);
    execute('INSERT INTO user_settings (user_id, theme) VALUES (?, ?)', [userId, 'light']);

    res.json({ success: true, message: '注册成功' });
});

app.post('/api/auth/login', (req, res) => {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
        return res.status(400).json({ error: '请输入用户名/邮箱和密码' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let user;
    if (emailRegex.test(identifier)) {
        user = queryOne('SELECT * FROM users WHERE email = ?', [identifier.toLowerCase()]);
    } else {
        user = queryOne('SELECT * FROM users WHERE username = ?', [identifier.toLowerCase()]);
    }

    if (!user) {
        return res.status(400).json({ error: '用户名或邮箱不存在' });
    }

    if (!bcrypt.compareSync(password, user.password_hash)) {
        return res.status(400).json({ error: '密码错误' });
    }

    const token = jwt.sign(
        { userId: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: TOKEN_EXPIRY }
    );

    res.json({
        success: true,
        message: '登录成功',
        token,
        user: {
            username: user.username,
            role: user.role
        }
    });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
    const user = queryOne('SELECT id, username, email, role, created_at FROM users WHERE id = ?', [req.user.userId]);
    if (!user) {
        return res.status(404).json({ error: '用户不存在' });
    }
    res.json({ user });
});

// ==================== 分类记录接口 ====================

app.get('/api/classifications', authMiddleware, (req, res) => {
    const rows = queryAll(
        'SELECT * FROM classifications WHERE user_id = ? ORDER BY updated_at DESC',
        [req.user.userId]
    );
    res.json({ classifications: rows });
});

app.post('/api/classifications', authMiddleware, (req, res) => {
    const { id, title, patentAbstract, result, confirmed, corrected, createdAt, updatedAt } = req.body;

    execute(`
        INSERT INTO classifications (id, user_id, title, patent_abstract, result, confirmed, corrected, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        id, req.user.userId,
        title || '', patentAbstract || '', result || '',
        confirmed !== undefined ? confirmed : null,
        corrected ? 1 : 0,
        createdAt || new Date().toISOString(),
        updatedAt || new Date().toISOString()
    ]);

    res.json({ success: true });
});

app.put('/api/classifications/:id', authMiddleware, (req, res) => {
    const { title, patentAbstract, result, confirmed, corrected, updatedAt } = req.body;

    const existing = queryOne(
        'SELECT * FROM classifications WHERE id = ? AND user_id = ?',
        [req.params.id, req.user.userId]
    );

    if (!existing) {
        return res.status(404).json({ error: '分类记录不存在' });
    }

    execute(`
        UPDATE classifications
        SET title = ?, patent_abstract = ?, result = ?, confirmed = ?, corrected = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
    `, [
        title !== undefined ? title : existing.title,
        patentAbstract !== undefined ? patentAbstract : existing.patent_abstract,
        result !== undefined ? result : existing.result,
        confirmed !== undefined ? confirmed : existing.confirmed,
        corrected !== undefined ? (corrected ? 1 : 0) : existing.corrected,
        updatedAt || new Date().toISOString(),
        req.params.id,
        req.user.userId
    ]);

    res.json({ success: true });
});

app.delete('/api/classifications/:id', authMiddleware, (req, res) => {
    execute('DELETE FROM classifications WHERE id = ? AND user_id = ?', [req.params.id, req.user.userId]);
    res.json({ success: true });
});

app.delete('/api/classifications', authMiddleware, (req, res) => {
    execute('DELETE FROM classifications WHERE user_id = ?', [req.user.userId]);
    res.json({ success: true });
});

// ==================== 设置接口 ====================

app.get('/api/settings', authMiddleware, (req, res) => {
    let settings = queryOne('SELECT * FROM api_settings WHERE user_id = ?', [req.user.userId]);
    if (!settings) {
        execute('INSERT INTO api_settings (user_id) VALUES (?)', [req.user.userId]);
        settings = queryOne('SELECT * FROM api_settings WHERE user_id = ?', [req.user.userId]);
    }
    res.json({
        url: settings.url,
        model: settings.model_name,
        apiKey: settings.api_key,
        maxTokens: settings.max_tokens,
        temperature: settings.temperature
    });
});

app.put('/api/settings', authMiddleware, (req, res) => {
    const { url, model, apiKey, maxTokens, temperature } = req.body;
    const existing = queryOne('SELECT id FROM api_settings WHERE user_id = ?', [req.user.userId]);

    if (existing) {
        execute(`
            UPDATE api_settings
            SET url = ?, model_name = ?, api_key = ?, max_tokens = ?, temperature = ?
            WHERE user_id = ?
        `, [
            url !== undefined ? url : 'http://localhost:8000',
            model !== undefined ? model : '',
            apiKey !== undefined ? apiKey : '',
            maxTokens !== undefined ? maxTokens : 512,
            temperature !== undefined ? temperature : 0.7,
            req.user.userId
        ]);
    } else {
        execute(
            'INSERT INTO api_settings (user_id, url, model_name, api_key, max_tokens, temperature) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.userId, url || 'http://localhost:8000', model || '', apiKey || '', maxTokens || 512, temperature || 0.7]
        );
    }

    res.json({ success: true });
});

app.get('/api/settings/theme', authMiddleware, (req, res) => {
    let setting = queryOne('SELECT theme FROM user_settings WHERE user_id = ?', [req.user.userId]);
    if (!setting) {
        execute('INSERT INTO user_settings (user_id, theme) VALUES (?, ?)', [req.user.userId, 'light']);
        setting = { theme: 'light' };
    }
    res.json({ theme: setting.theme });
});

app.put('/api/settings/theme', authMiddleware, (req, res) => {
    const { theme } = req.body;
    const existing = queryOne('SELECT user_id FROM user_settings WHERE user_id = ?', [req.user.userId]);
    if (existing) {
        execute('UPDATE user_settings SET theme = ? WHERE user_id = ?', [theme, req.user.userId]);
    } else {
        execute('INSERT INTO user_settings (user_id, theme) VALUES (?, ?)', [req.user.userId, theme]);
    }
    res.json({ success: true });
});

// ==================== 管理员接口 ====================

app.get('/api/admin/users', authMiddleware, adminMiddleware, (req, res) => {
    const users = queryAll('SELECT id, username, email, role, created_at FROM users');
    res.json({ users });
});

app.delete('/api/admin/users/:id', authMiddleware, adminMiddleware, (req, res) => {
    const user = queryOne('SELECT role FROM users WHERE id = ?', [req.params.id]);
    if (!user) {
        return res.status(404).json({ error: '用户不存在' });
    }
    if (user.role === 'admin') {
        return res.status(400).json({ error: '不能删除管理员账号' });
    }
    execute('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ success: true });
});

app.get('/api/admin/classifications', authMiddleware, adminMiddleware, (req, res) => {
    const rows = queryAll(`
        SELECT c.*, u.username
        FROM classifications c
        JOIN users u ON c.user_id = u.id
        ORDER BY c.created_at DESC
    `);
    res.json({ classifications: rows });
});

app.delete('/api/admin/classifications/:id', authMiddleware, adminMiddleware, (req, res) => {
    execute('DELETE FROM classifications WHERE id = ?', [req.params.id]);
    res.json({ success: true });
});

app.delete('/api/admin/classifications', authMiddleware, adminMiddleware, (req, res) => {
    execute('DELETE FROM classifications');
    res.json({ success: true });
});

app.delete('/api/admin/users', authMiddleware, adminMiddleware, (req, res) => {
    execute('DELETE FROM users WHERE role != ?', ['admin']);
    res.json({ success: true });
});

app.post('/api/admin/reset', authMiddleware, adminMiddleware, (req, res) => {
    execute('DELETE FROM classifications');
    execute("DELETE FROM api_settings WHERE user_id NOT IN (SELECT id FROM users WHERE role = 'admin')");
    execute("DELETE FROM user_settings WHERE user_id NOT IN (SELECT id FROM users WHERE role = 'admin')");
    execute("DELETE FROM users WHERE role != 'admin'");
    res.json({ success: true });
});

app.get('/api/admin/stats', authMiddleware, adminMiddleware, (req, res) => {
    const userCount = queryOne('SELECT COUNT(*) as count FROM users').count;
    const classificationCount = queryOne('SELECT COUNT(*) as count FROM classifications').count;
    res.json({ users: userCount, classifications: classificationCount });
});

// ==================== 启动 ====================

async function start() {
    await initDatabase();
    console.log('数据库已初始化');

    app.listen(PORT, () => {
        console.log(`服务器已启动: http://localhost:${PORT}`);
    });
}

start();
