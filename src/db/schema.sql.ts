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
  tipo TEXT NOT NULL CHECK (tipo IN ('cafe','almoco','lanche','jantar','madrugada')),
  alimento_id INTEGER NOT NULL REFERENCES alimentos(id),
  gramas REAL NOT NULL CHECK (gramas > 0),
  kcal REAL NOT NULL,
  qtd REAL,
  porcao TEXT
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
CREATE TABLE IF NOT EXISTS apelidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alimento_id INTEGER NOT NULL REFERENCES alimentos(id),
  termo TEXT NOT NULL,
  termo_busca TEXT NOT NULL,
  origem TEXT NOT NULL CHECK (origem IN ('lista','usuario')),
  UNIQUE (alimento_id, termo_busca, origem)
);
CREATE INDEX IF NOT EXISTS idx_apelidos_termo ON apelidos(termo_busca);
CREATE TABLE IF NOT EXISTS pesos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data TEXT NOT NULL UNIQUE,
  peso_kg REAL NOT NULL CHECK (peso_kg BETWEEN 30 AND 300)
);
CREATE TABLE IF NOT EXISTS porcoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alimento_id INTEGER NOT NULL REFERENCES alimentos(id),
  nome TEXT NOT NULL,
  gramas REAL NOT NULL CHECK (gramas > 0),
  origem TEXT NOT NULL CHECK (origem IN ('lista','usuario')),
  UNIQUE (alimento_id, nome, origem)
);
CREATE INDEX IF NOT EXISTS idx_porcoes_alimento ON porcoes(alimento_id);
CREATE TABLE IF NOT EXISTS exercicios_feitos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data TEXT NOT NULL,
  divisao TEXT NOT NULL,
  exercicio TEXT NOT NULL,
  carga_kg REAL CHECK (carga_kg IS NULL OR (carga_kg > 0 AND carga_kg <= 500)),
  UNIQUE (data, exercicio)
);
CREATE INDEX IF NOT EXISTS idx_exercicios_exercicio ON exercicios_feitos(exercicio);
`
