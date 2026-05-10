const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'data.db');

let db = null;
let saveTimer = null;

function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        if (db) {
            const data = db.export();
            const buffer = Buffer.from(data);
            fs.writeFileSync(DB_PATH, buffer);
        }
    }, 300);
}

function saveNow() {
    if (db) {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_PATH, buffer);
    }
}

function queryAll(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
        rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
}

function queryOne(sql, params = []) {
    const rows = queryAll(sql, params);
    return rows.length > 0 ? rows[0] : null;
}

function execute(sql, params = []) {
    db.run(sql, params);
    const lastId = queryOne('SELECT last_insert_rowid() as id');
    scheduleSave();
    return lastId ? lastId.id : null;
}

async function initDatabase() {
    const SQL = await initSqlJs();

    if (fs.existsSync(DB_PATH)) {
        const fileBuffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(fileBuffer);
    } else {
        db = new SQL.Database();
    }

    db.run('PRAGMA foreign_keys = ON');

    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            created_at TEXT DEFAULT (datetime('now'))
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS classifications (
            id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            title TEXT,
            patent_abstract TEXT,
            result TEXT,
            confirmed INTEGER,
            corrected INTEGER DEFAULT 0,
            created_at TEXT,
            updated_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS api_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE NOT NULL,
            url TEXT DEFAULT 'http://localhost:8000',
            model_name TEXT DEFAULT '',
            api_key TEXT DEFAULT '',
            max_tokens INTEGER DEFAULT 512,
            temperature REAL DEFAULT 0.7,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS user_settings (
            user_id INTEGER PRIMARY KEY,
            theme TEXT DEFAULT 'light',
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // 默认管理员
    const existingAdmin = queryOne('SELECT id FROM users WHERE username = ?', ['admin']);
    if (!existingAdmin) {
        const hash = bcrypt.hashSync('admin123', 10);
        execute(
            'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
            ['admin', 'admin@system.com', hash, 'admin']
        );
        const adminId = queryOne('SELECT last_insert_rowid() as id');

        if (adminId) {
            execute('INSERT INTO api_settings (user_id) VALUES (?)', [adminId.id]);
            execute('INSERT INTO user_settings (user_id, theme) VALUES (?, ?)', [adminId.id, 'light']);
        }
    }

    saveNow();
    return db;
}

function getDb() {
    return db;
}

module.exports = { initDatabase, getDb, queryAll, queryOne, execute, saveNow };
