// Gera public/taco.json a partir de data/TACO.json (TACO 4ª ed., via github.com/marcelosanto/tabela_taco, MIT).
// Uso: node scripts/gerar-taco.ts
import { readFileSync, writeFileSync } from 'node:fs'
import { normalizarTaco, type ItemTacoBruto } from '../src/db/taco.ts'

const bruto = JSON.parse(readFileSync('data/TACO.json', 'utf8')) as ItemTacoBruto[]
const itens = normalizarTaco(bruto)
writeFileSync('public/taco.json', JSON.stringify(itens))
console.log(`${itens.length} alimentos de ${bruto.length} → public/taco.json`)
