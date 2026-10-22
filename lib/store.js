// مخزن بيانات بسيط مبني على ملف JSON واحد مع كتابة ذرّية (atomic) لحماية البيانات من التلف.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

let db = null;
let saveTimer = null;

function load(seedFn) {
  if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } else {
    db = seedFn();
    saveNow();
  }
  return db;
}

function saveNow() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

// تجميع عمليات الحفظ المتتالية في كتابة واحدة
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 150);
}

function flush() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveNow();
  }
}

const id = (prefix = '') => prefix + crypto.randomBytes(6).toString('hex');

function nextNumber(counterKey, start) {
  db.counters = db.counters || {};
  db.counters[counterKey] = (db.counters[counterKey] || start) + 1;
  return db.counters[counterKey];
}

module.exports = {
  DATA_DIR,
  UPLOAD_DIR,
  load,
  save,
  flush,
  id,
  nextNumber,
  get db() {
    return db;
  },
  set db(v) {
    db = v;
  },
};
