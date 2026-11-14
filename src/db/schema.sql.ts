export const SCHEMA = `
CREATE TABLE IF NOT EXISTS perfil (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  altura_cm REAL NOT NULL,
  peso_kg REAL NOT NULL,
  idade INTEGER NOT NULL,
  sexo TEXT NOT NULL CHECK (sexo IN ('M','F')),
  deficit_meta REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS alimentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  nome_busca TEXT NOT NULL,
  kcal_100g REAL NOT NULL,
  proteina_g REAL NOT NULL DEFAULT 0,
  carbo_g REAL NOT NULL DEFAULT 0,
  gordura_g REAL NOT NULL DEFAULT 0,
  origem TEXT NOT NULL CHECK (origem IN ('TACO','custom'))
);
CREATE TABLE IF NOT EXISTS refeicoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('cafe','almoco','jantar','lanche')),
  alimento_id INTEGER NOT NULL REFERENCES alimentos(id),
  gramas REAL NOT NULL CHECK (gramas > 0),
  kcal REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_refeicoes_data ON refeicoes(data);
CREATE TABLE IF NOT EXISTS treinos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data TEXT NOT NULL,
  tipo TEXT NOT NULL,
  duracao_min REAL NOT NULL,
  kcal REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_treinos_data ON treinos(data);
`
