import { useMemo, useState } from 'react'
import { desmarcarExercicio, exerciciosDoDia, limparCarga, marcarExercicio, ultimaCarga, ultimaDivisao, type ExercicioFeito } from '../db/repos'
import { useBanco } from '../estado'
import type { Divisao } from '../treino/ficha'

const kg = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2, useGrouping: false })

/** Carga digitada: número > 0 e ≤ 500 (aceita vírgula), '' = sem carga, null = inválida. */
function lerCarga(txt: string): number | '' | null {
  const t = txt.trim()
  if (t === '') return ''
  const n = Number(t.replace(',', '.'))
  return Number.isFinite(n) && n > 0 && n <= 500 ? n : null
}

/** Divisão de hoje se já houver registro; senão a seguinte à última feita (circular); senão a primeira. */
export function divisaoInicial(ficha: Divisao[], hoje: ExercicioFeito[], ultima: string | null): string {
  const nomes = ficha.map((d) => d.nome)
  const deHoje = hoje.map((e) => e.divisao).reverse().find((d) => nomes.includes(d))
  if (deHoje) return deHoje
  const i = ultima === null ? -1 : nomes.indexOf(ultima)
  return i === -1 ? nomes[0] : nomes[(i + 1) % nomes.length]
}

export function FichaTreino({ ficha, data, aoEditar }: { ficha: Divisao[]; data: string; aoEditar?: () => void }) {
  const { banco, versao, mudou } = useBanco()
  const feitos = useMemo(() => exerciciosDoDia(banco, data), [banco, data, versao])
  const [divisao, setDivisao] = useState(() => divisaoInicial(ficha, exerciciosDoDia(banco, data), ultimaDivisao(banco)))
  const [cargas, setCargas] = useState<Record<string, string>>(() =>
    Object.fromEntries(exerciciosDoDia(banco, data).filter((e) => e.cargaKg !== null).map((e) => [e.exercicio, kg(e.cargaKg!)])),
  )
  const atual = ficha.find((d) => d.nome === divisao) ?? ficha[0]
  const feito = (nome: string) => feitos.some((e) => e.exercicio === nome)

  /** Lido do banco na hora (não da lista do último render), para toques e teclas rápidos. */
  const feitoAgora = (nome: string) => exerciciosDoDia(banco, data).some((e) => e.exercicio === nome)

  async function alternar(nome: string) {
    if (feitoAgora(nome)) {
      setCargas((c) => ({ ...c, [nome]: '' }))
      await desmarcarExercicio(banco, data, nome)
    } else {
      const c = lerCarga(cargas[nome] ?? '')
      await marcarExercicio(banco, { data, divisao: atual.nome, exercicio: nome, ...(typeof c === 'number' ? { cargaKg: c } : {}) })
    }
    mudou()
  }

  async function digitar(nome: string, txt: string) {
    setCargas((c) => ({ ...c, [nome]: txt }))
    const c = lerCarga(txt)
    // Vazia ou inválida: o banco não fica com um valor que a tela não mostra.
    if (typeof c === 'number') await marcarExercicio(banco, { data, divisao: atual.nome, exercicio: nome, cargaKg: c })
    else await limparCarga(banco, data, nome)
    mudou()
  }

  return (
    <div className="cartao ficha">
      {aoEditar && <button className="editar-ficha discreto" onClick={aoEditar}>Editar ficha</button>}
      <div className="porcoes" role="radiogroup" aria-label="Divisão">
        {ficha.map((d) => (
          <button key={d.nome} role="radio" aria-checked={d.nome === atual.nome} onClick={() => setDivisao(d.nome)}>
            {d.nome}
          </button>
        ))}
      </div>
      {atual.titulo && <p className="dica">{atual.titulo}</p>}
      {atual.exercicios.map((e) => {
        const ultima = ultimaCarga(banco, e.nome, data)
        return (
          <div key={e.nome} className="exercicio">
            <label className="marcar">
              <input type="checkbox" checked={feito(e.nome)} onChange={() => alternar(e.nome)} />
              <span>{e.nome}</span>
            </label>
            <small>{e.series} × {e.reps}</small>
            {e.obs && <small className="obs">{e.obs}</small>}
            <div className="carga">
              {ultima !== null && <small>última: {kg(ultima)} kg</small>}
              <input
                inputMode="decimal"
                aria-label={`Carga de ${e.nome} (kg)`}
                placeholder="kg"
                aria-invalid={lerCarga(cargas[e.nome] ?? '') === null}
                value={cargas[e.nome] ?? ''}
                onChange={(ev) => digitar(e.nome, ev.target.value)}
              />
            </div>
            {lerCarga(cargas[e.nome] ?? '') === null && <small className="obs">Carga entre 0 e 500 kg</small>}
          </div>
        )
      })}
    </div>
  )
}
