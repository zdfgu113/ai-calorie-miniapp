const fs = require('fs/promises');
const path = require('path');
const sqlite3 = require('sqlite3');
const { config } = require('../config/env');

const DB_FILE = config.sqliteDbPath
  ? path.resolve(config.sqliteDbPath)
  : path.resolve(__dirname, '../../data/app.sqlite');
const DATA_DIR = path.dirname(DB_FILE);
const LEGACY_RECORDS_FILE = path.join(DATA_DIR, 'records.json');
const LEGACY_SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

let dbPromise = null;

async function getDb() {
  if (!dbPromise) {
    dbPromise = openDatabase().then(async (db) => {
      await initializeDatabase(db);
      return db;
    });
  }

  return dbPromise;
}

async function openDatabase() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_FILE, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(wrapDatabase(db));
    });
  });
}

function wrapDatabase(db) {
  return {
    run(sql, params = []) {
      return new Promise((resolve, reject) => {
        db.run(sql, params, function onRun(error) {
          if (error) {
            reject(error);
            return;
          }

          resolve({
            lastID: this.lastID,
            changes: this.changes
          });
        });
      });
    },

    get(sql, params = []) {
      return new Promise((resolve, reject) => {
        db.get(sql, params, (error, row) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(row);
        });
      });
    },

    all(sql, params = []) {
      return new Promise((resolve, reject) => {
        db.all(sql, params, (error, rows) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(rows || []);
        });
      });
    },

    exec(sql) {
      return new Promise((resolve, reject) => {
        db.exec(sql, (error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  };
}

async function initializeDatabase(db) {
  await db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      food_name TEXT NOT NULL,
      estimated_weight TEXT NOT NULL,
      calories INTEGER NOT NULL DEFAULT 0,
      protein REAL NOT NULL DEFAULT 0,
      fat REAL NOT NULL DEFAULT 0,
      carbs REAL NOT NULL DEFAULT 0,
      diet_advice TEXT NOT NULL,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_records_date ON records(date);
    CREATE INDEX IF NOT EXISTS idx_records_created_at ON records(created_at);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      openid TEXT NOT NULL UNIQUE,
      unionid TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_login_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (user_id, key),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  await ensureColumn(db, 'records', 'user_id', 'TEXT');
  await db.exec('CREATE INDEX IF NOT EXISTS idx_records_user_date ON records(user_id, date);');
  await seedDefaultSettings(db);
  await migrateLegacyJson(db);
}

async function ensureColumn(db, tableName, columnName, columnDefinition) {
  const columns = await db.all(`PRAGMA table_info(${tableName})`);
  const exists = columns.some((column) => column.name === columnName);

  if (!exists) {
    await db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
  }
}

async function seedDefaultSettings(db) {
  const defaults = {
    dailyGoalCalories: config.dailyCalorieGoal,
    heightCm: 170,
    weightKg: 65,
    fatLossGoal: 'steady'
  };

  for (const [key, value] of Object.entries(defaults)) {
    await db.run(
      'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
      [key, JSON.stringify(value)]
    );
  }
}

async function migrateLegacyJson(db) {
  const imported = await db.get('SELECT value FROM meta WHERE key = ?', ['legacyJsonImported']);

  if (imported && imported.value === 'true') {
    return;
  }

  await importLegacyRecords(db);
  await importLegacySettings(db);
  await db.run('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', ['legacyJsonImported', 'true']);
}

async function importLegacyRecords(db) {
  try {
    const existing = await db.get('SELECT COUNT(*) AS count FROM records');

    if (existing && Number(existing.count) > 0) {
      return;
    }

    const content = await fs.readFile(LEGACY_RECORDS_FILE, 'utf8');
    const records = JSON.parse(content || '[]');

    if (!Array.isArray(records)) {
      return;
    }

    for (const record of records) {
      await db.run(
        `INSERT OR IGNORE INTO records (
          id, user_id, food_name, estimated_weight, calories, protein, fat, carbs,
          diet_advice, date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          record.id,
          null,
          record.foodName,
          record.estimatedWeight,
          Number(record.calories || 0),
          Number(record.protein || 0),
          Number(record.fat || 0),
          Number(record.carbs || 0),
          record.dietAdvice || '',
          record.date,
          record.createdAt,
          record.updatedAt || null
        ]
      );
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(`旧记录导入 SQLite 失败：${error.message}`);
    }
  }
}

async function importLegacySettings(db) {
  try {
    const content = await fs.readFile(LEGACY_SETTINGS_FILE, 'utf8');
    const settings = JSON.parse(content || '{}');

    for (const [key, value] of Object.entries(settings)) {
      if (value !== undefined && value !== null) {
        await db.run(
          'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
          [key, JSON.stringify(value)]
        );
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(`旧设置导入 SQLite 失败：${error.message}`);
    }
  }
}

module.exports = { getDb };
