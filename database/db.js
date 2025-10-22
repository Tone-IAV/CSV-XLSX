const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, 'avaliacoes.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados SQLite:', err.message);
  } else {
    console.log('Banco de dados SQLite conectado em', dbPath);
  }
});

db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON');

  db.run(`CREATE TABLE IF NOT EXISTS avaliacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      controle TEXT UNIQUE NOT NULL,
      ano INTEGER NOT NULL,
      dados_json TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

  db.run(`CREATE TRIGGER IF NOT EXISTS trg_avaliacoes_updated
    AFTER UPDATE ON avaliacoes
    FOR EACH ROW
    BEGIN
      UPDATE avaliacoes SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
    END;`);

  db.run(`CREATE TABLE IF NOT EXISTS areas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      avaliacao_id INTEGER NOT NULL,
      descricao TEXT,
      largura REAL,
      comprimento REAL,
      area REAL,
      tipo TEXT,
      FOREIGN KEY(avaliacao_id) REFERENCES avaliacoes(id) ON DELETE CASCADE
    )`);

  db.run(`CREATE TABLE IF NOT EXISTS comparativos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      avaliacao_id INTEGER NOT NULL,
      endereco TEXT,
      valor REAL,
      area REAL,
      link TEXT,
      latitude REAL,
      longitude REAL,
      observacoes TEXT,
      FOREIGN KEY(avaliacao_id) REFERENCES avaliacoes(id) ON DELETE CASCADE
    )`);

  db.run(`CREATE TABLE IF NOT EXISTS fotos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      avaliacao_id INTEGER NOT NULL,
      legenda TEXT,
      caminho TEXT NOT NULL,
      ordem INTEGER DEFAULT 0,
      FOREIGN KEY(avaliacao_id) REFERENCES avaliacoes(id) ON DELETE CASCADE
    )`);

  db.run(`CREATE TABLE IF NOT EXISTS documentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      avaliacao_id INTEGER NOT NULL,
      tipo TEXT,
      nome_original TEXT,
      caminho TEXT NOT NULL,
      FOREIGN KEY(avaliacao_id) REFERENCES avaliacoes(id) ON DELETE CASCADE
    )`);
});

module.exports = db;
