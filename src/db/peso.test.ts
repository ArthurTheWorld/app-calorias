import { beforeEach, expect, test, vi } from 'vitest'
import { abrirBanco, carregarSql, consultar, type Banco } from './banco'
import { getPerfil, pesosRegistrados, registrarPeso, removerPeso, salvarPerfil } from './repos'
import { tabelaParaCsv } from '../exportar'

const perfil = { alturaCm: 178, pesoKg: 82, idade: 30, sexo: 'M' as const, deficitMeta: 500 }
let b: Banco
beforeEach(async () => {
  b = await abrirBanco()
  await salvarPerfil(b, perfil)
})

test('um peso por dia: registrar de novo substitui', async () => {
  await registrarPeso(b, '2026-11-14', 81)
  await registrarPeso(b, '2026-11-14', 80.5)
  expect(pesosRegistrados(b).map((p) => [p.data, p.pesoKg])).toEqual([['2026-11-14', 80.5]])
})

test('perfil acompanha o registro mais recente, mesmo registrando data antiga', async () => {
  await registrarPeso(b, '2026-11-14', 80)
  await registrarPeso(b, '2026-11-01', 85)
  expect(getPerfil(b)?.pesoKg).toBe(80)
})

test('não apaga o único registro; apagar o mais recente volta o perfil ao anterior', async () => {
  await registrarPeso(b, '2026-11-01', 85)
  const [unico] = pesosRegistrados(b)
  expect(await removerPeso(b, unico.id)).toBe(false)
  expect(pesosRegistrados(b)).toHaveLength(1)
  await registrarPeso(b, '2026-11-14', 80)
  const recente = pesosRegistrados(b).find((p) => p.data === '2026-11-14')!
  expect(await removerPeso(b, recente.id)).toBe(true)
  expect(getPerfil(b)?.pesoKg).toBe(85)
})

test('csv de pesos', () => {
  expect(tabelaParaCsv(b, 'pesos').split('\n')[0]).toBe('id;data;peso_kg')
})

async function bancoV3(comPerfil: boolean): Promise<Uint8Array> {
  const SQL = await carregarSql()
  const base = await abrirBanco()
  base.db.run('DROP TABLE pesos')
  base.db.run('PRAGMA user_version = 3')
  if (comPerfil) {
    base.db.run(`INSERT INTO perfil VALUES (1, 178, 82, 30, 'M', 500)`)
    base.db.run(`INSERT INTO alimentos (nome, nome_busca, kcal_100g, origem) VALUES ('X', 'x', 100, 'custom')`)
    base.db.run(`INSERT INTO refeicoes (data, tipo, alimento_id, gramas, kcal) VALUES ('2026-11-04', 'almoco', 1, 100, 100)`)
    base.db.run(`INSERT INTO treinos (data, tipo, duracao_min, kcal) VALUES ('2026-11-06', 'Corrida', 30, 300)`)
  }
  return new SQL.Database(base.exportar()).export()
}
const versao = (x: Banco) => consultar<{ user_version: number }>(x, 'PRAGMA user_version')[0].user_version

test('migração v3 → v4 semeia o peso do perfil na data do primeiro registro', async () => {
  const m = await abrirBanco(await bancoV3(true))
  expect(versao(m)).toBe(6)
  expect(pesosRegistrados(m).map((p) => [p.data, p.pesoKg])).toEqual([['2026-11-04', 82]])
  const m2 = await abrirBanco(m.exportar())
  expect(pesosRegistrados(m2)).toHaveLength(1)
})

test('migração v3 → v4 sem perfil deixa pesos vazia', async () => {
  const m = await abrirBanco(await bancoV3(false))
  expect(versao(m)).toBe(6)
  expect(pesosRegistrados(m)).toHaveLength(0)
})

test('migração de madrugada sem registros usa o dia do app', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 15, 2, 0))
  try {
    const SQL = await carregarSql()
    const base = await abrirBanco()
    base.db.run('DROP TABLE pesos')
    base.db.run('PRAGMA user_version = 3')
    base.db.run(`INSERT INTO perfil VALUES (1, 178, 82, 30, 'M', 500)`)
    const m = await abrirBanco(new SQL.Database(base.exportar()).export())
    expect(pesosRegistrados(m).map((p) => p.data)).toEqual(['2026-11-14'])
  } finally {
    vi.useRealTimers()
  }
})
