const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const controle = req.body.controle || req.query.controle;
    if (!controle) {
      return cb(new Error('Número de controle não informado.'));
    }
    const tipo = req.body.tipo || req.query.tipo || 'outros';
    const dir = path.join(__dirname, 'uploads', controle, tipo);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9\.\-_]/g, '_');
    cb(null, `${timestamp}-${sanitized}`);
  }
});

const upload = multer({ storage });

function gerarNumeroControle(ano = new Date().getFullYear()) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT controle FROM avaliacoes WHERE ano = ? ORDER BY id DESC LIMIT 1',
      [ano],
      (err, row) => {
        if (err) {
          return reject(err);
        }
        let sequencia = 1;
        if (row && row.controle) {
          const match = row.controle.match(/RL\s*(\d+)\-(\d{4})/);
          if (match) {
            sequencia = parseInt(match[1], 10) + 1;
          }
        }
        const controle = `RL ${String(sequencia).padStart(3, '0')}-${ano}`;
        resolve(controle);
      }
    );
  });
}

function salvarDadosBasicos(avaliacaoId, payload) {
  return new Promise((resolve, reject) => {
    const dados = payload || {};
    const json = JSON.stringify(dados);
    db.run(
      'UPDATE avaliacoes SET dados_json = ? WHERE id = ?',
      [json, avaliacaoId],
      function (err) {
        if (err) {
          return reject(err);
        }
        resolve();
      }
    );
  });
}

function salvarAreas(avaliacaoId, areas = []) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('DELETE FROM areas WHERE avaliacao_id = ?', [avaliacaoId]);
      const stmt = db.prepare(
        'INSERT INTO areas (avaliacao_id, descricao, largura, comprimento, area, tipo) VALUES (?, ?, ?, ?, ?, ?)'
      );
      areas.forEach((area) => {
        stmt.run([
          avaliacaoId,
          area.descricao || null,
          area.largura || null,
          area.comprimento || null,
          area.area || null,
          area.tipo || null
        ]);
      });
      stmt.finalize((err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  });
}

function salvarComparativos(avaliacaoId, comparativos = []) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('DELETE FROM comparativos WHERE avaliacao_id = ?', [avaliacaoId]);
      const stmt = db.prepare(
        'INSERT INTO comparativos (avaliacao_id, endereco, valor, area, link, latitude, longitude, observacoes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      );
      comparativos.forEach((item) => {
        stmt.run([
          avaliacaoId,
          item.endereco || null,
          item.valor || null,
          item.area || null,
          item.link || null,
          item.latitude || null,
          item.longitude || null,
          item.observacoes || null
        ]);
      });
      stmt.finalize((err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  });
}

function obterRelacoes(avaliacaoId) {
  return new Promise((resolve, reject) => {
    const result = {
      areas: [],
      comparativos: [],
      fotos: [],
      documentos: []
    };
    let pending = 4;

    const checkDone = () => {
      pending -= 1;
      if (pending === 0) {
        resolve(result);
      }
    };

    db.all('SELECT * FROM areas WHERE avaliacao_id = ?', [avaliacaoId], (err, rows) => {
      if (err) return reject(err);
      result.areas = rows || [];
      checkDone();
    });
    db.all('SELECT * FROM comparativos WHERE avaliacao_id = ?', [avaliacaoId], (err, rows) => {
      if (err) return reject(err);
      result.comparativos = rows || [];
      checkDone();
    });
    db.all('SELECT * FROM fotos WHERE avaliacao_id = ? ORDER BY ordem, id', [avaliacaoId], (err, rows) => {
      if (err) return reject(err);
      result.fotos = rows || [];
      checkDone();
    });
    db.all('SELECT * FROM documentos WHERE avaliacao_id = ?', [avaliacaoId], (err, rows) => {
      if (err) return reject(err);
      result.documentos = rows || [];
      checkDone();
    });
  });
}

app.get('/api/avaliacoes', (req, res) => {
  const { busca } = req.query;
  let sql = 'SELECT id, controle, ano, dados_json, created_at, updated_at FROM avaliacoes ORDER BY created_at DESC';
  const params = [];
  if (busca) {
    sql =
      'SELECT id, controle, ano, dados_json, created_at, updated_at FROM avaliacoes WHERE controle LIKE ? OR dados_json LIKE ? ORDER BY created_at DESC';
    params.push(`%${busca}%`, `%${busca}%`);
  }
  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    const avaliacoes = rows.map((row) => ({
      ...row,
      dados: JSON.parse(row.dados_json || '{}')
    }));
    res.json(avaliacoes);
  });
});

app.get('/api/avaliacoes/:id', async (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM avaliacoes WHERE id = ?', [id], async (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Avaliação não encontrada' });
    }
    try {
      const relacoes = await obterRelacoes(id);
      res.json({
        ...row,
        dados: JSON.parse(row.dados_json || '{}'),
        ...relacoes
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

app.post('/api/avaliacoes', async (req, res) => {
  const { dados, areas = [], comparativos = [] } = req.body;
  const ano = new Date().getFullYear();
  try {
    const controle = await gerarNumeroControle(ano);
    const json = JSON.stringify(dados || {});
    db.run(
      'INSERT INTO avaliacoes (controle, ano, dados_json) VALUES (?, ?, ?)',
      [controle, ano, json],
      function (err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        const avaliacaoId = this.lastID;
        Promise.all([
          salvarAreas(avaliacaoId, areas),
          salvarComparativos(avaliacaoId, comparativos)
        ])
          .then(async () => {
            const relacoes = await obterRelacoes(avaliacaoId);
            res.status(201).json({
              id: avaliacaoId,
              controle,
              ano,
              dados: dados || {},
              ...relacoes
            });
          })
          .catch((error) => res.status(500).json({ error: error.message }));
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/avaliacoes/:id', async (req, res) => {
  const { id } = req.params;
  const { dados, areas = [], comparativos = [] } = req.body;
  db.get('SELECT * FROM avaliacoes WHERE id = ?', [id], async (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Avaliação não encontrada' });
    }
    try {
      await salvarDadosBasicos(id, dados);
      await Promise.all([
        salvarAreas(id, areas),
        salvarComparativos(id, comparativos)
      ]);
      const relacoes = await obterRelacoes(id);
      res.json({
        id: Number(id),
        controle: row.controle,
        ano: row.ano,
        dados: dados || {},
        ...relacoes
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

app.post('/api/avaliacoes/:id/duplicar', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM avaliacoes WHERE id = ?', [id], async (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Avaliação não encontrada' });
    try {
      const dados = JSON.parse(row.dados_json || '{}');
      const areas = await new Promise((resolve, reject) => {
        db.all('SELECT * FROM areas WHERE avaliacao_id = ?', [id], (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });
      const comparativos = await new Promise((resolve, reject) => {
        db.all(
          'SELECT * FROM comparativos WHERE avaliacao_id = ?',
          [id],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });
      const anoAtual = new Date().getFullYear();
      const controleNovo = await gerarNumeroControle(anoAtual);
      db.run(
        'INSERT INTO avaliacoes (controle, ano, dados_json) VALUES (?, ?, ?)',
        [controleNovo, anoAtual, JSON.stringify(dados)],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });
          const novoId = this.lastID;
          Promise.all([
            salvarAreas(novoId, areas),
            salvarComparativos(novoId, comparativos)
          ])
            .then(async () => {
              // duplicar arquivos
              const origemDir = path.join(__dirname, 'uploads', row.controle);
              const destinoDir = path.join(__dirname, 'uploads', controleNovo);
              if (fs.existsSync(origemDir)) {
                fs.mkdirSync(destinoDir, { recursive: true });
                fs.cpSync(origemDir, destinoDir, { recursive: true });
              }
              await obterRelacoes(novoId)
                .then((relacoes) => {
                  res.status(201).json({
                    id: novoId,
                    controle: controleNovo,
                    ano: anoAtual,
                    dados,
                    ...relacoes
                  });
                })
                .catch((error) => res.status(500).json({ error: error.message }));
            })
            .catch((error) => res.status(500).json({ error: error.message }));
        }
      );
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

app.post('/api/upload/fotos', upload.array('fotos', 20), (req, res) => {
  const { controle, avaliacaoId } = req.body;
  if (!avaliacaoId) {
    return res.status(400).json({ error: 'ID da avaliação obrigatório.' });
  }
  const arquivos = req.files || [];
  const insertPromises = arquivos.map((arquivo, index) => {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO fotos (avaliacao_id, legenda, caminho, ordem) VALUES (?, ?, ?, ?)',
        [
          avaliacaoId,
          req.body[`legenda_${index}`] || arquivo.originalname,
          path.relative(__dirname, arquivo.path),
          index
        ],
        function (err) {
          if (err) return reject(err);
          resolve({
            id: this.lastID,
            legenda: req.body[`legenda_${index}`] || arquivo.originalname,
            caminho: path.relative(__dirname, arquivo.path),
            ordem: index
          });
        }
      );
    });
  });

  Promise.all(insertPromises)
    .then((fotos) => res.json({ fotos }))
    .catch((error) => res.status(500).json({ error: error.message }));
});

app.post('/api/upload/documentos', upload.single('documento'), (req, res) => {
  const { controle, avaliacaoId, tipo } = req.body;
  if (!avaliacaoId) {
    return res.status(400).json({ error: 'ID da avaliação obrigatório.' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'Arquivo não recebido.' });
  }
  const caminhoRelativo = path.relative(__dirname, req.file.path);
  db.run(
    'INSERT INTO documentos (avaliacao_id, tipo, nome_original, caminho) VALUES (?, ?, ?, ?)',
    [
      avaliacaoId,
      tipo || 'anexo',
      req.file.originalname,
      caminhoRelativo
    ],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({
        id: this.lastID,
        tipo: tipo || 'anexo',
        nome_original: req.file.originalname,
        caminho: caminhoRelativo
      });
    }
  );
});

app.delete('/api/fotos/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM fotos WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Foto não encontrada' });
    const filePath = path.join(__dirname, row.caminho);
    db.run('DELETE FROM fotos WHERE id = ?', [id], (error) => {
      if (error) return res.status(500).json({ error: error.message });
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      res.json({ success: true });
    });
  });
});

app.delete('/api/documentos/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM documentos WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Documento não encontrado' });
    const filePath = path.join(__dirname, row.caminho);
    db.run('DELETE FROM documentos WHERE id = ?', [id], (error) => {
      if (error) return res.status(500).json({ error: error.message });
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      res.json({ success: true });
    });
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor executando na porta ${PORT}`);
});
