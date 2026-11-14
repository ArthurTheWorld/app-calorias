import { useMemo, useState } from 'react'
import { Anel } from '../componentes/Anel'
import { hojeLocal, somarDias } from '../calc/datas'
import { gastoDia, metaConsumo, type Perfil } from '../calc/energia'
import { refeicoesDoDia, removerRefeicao, treinosDoDia, type TipoRefeicao } from '../db/repos'
import { useBanco } from '../estado'
import { Adicionar } from './Adicionar'

export const NOMES_REFEICAO: Record<TipoRefeicao, string> = {
  cafe: 'Café da manhã',
  almoco: 'Almoço',
  jantar: 'Jantar',
  lanche: 'Lanches',
}

export function rotuloData(data: string): string {
  const hoje = hojeLocal()
  if (data === hoje) return 'Hoje'
  if (data === somarDias(hoje, -1)) return 'Ontem'
  const [a, m, d] = data.split('-')
  return `${d}/${m}/${a}`
}

export function Hoje({ perfil }: { perfil: Perfil }) {
  const { banco, versao, mudou } = useBanco()
  const [data, setData] = useState(hojeLocal())
  const [adicionando, setAdicionando] = useState<TipoRefeicao | null>(null)

  const refeicoes = useMemo(() => refeicoesDoDia(banco, data), [banco, data, versao])
  const treinos = useMemo(() => treinosDoDia(banco, data), [banco, data, versao])
  const kcalTreinos = treinos.reduce((s, t) => s + t.kcal, 0)
  const consumido = refeicoes.reduce((s, r) => s + r.kcal, 0)
  const meta = metaConsumo(perfil, kcalTreinos)
  const gasto = gastoDia(perfil, kcalTreinos)

  if (adicionando) {
    return <Adicionar data={data} tipo={adicionando} fechar={() => setAdicionando(null)} />
  }

  return (
    <section>
      <header className="navegar-data">
        <button aria-label="Dia anterior" onClick={() => setData(somarDias(data, -1))}>‹</button>
        <h1>{rotuloData(data)}</h1>
        <button aria-label="Próximo dia" disabled={data >= hojeLocal()} onClick={() => setData(somarDias(data, 1))}>›</button>
      </header>

      <Anel consumido={consumido} meta={meta} />

      <div className="numeros">
        <div><span>Consumido</span><strong data-testid="consumido">{Math.round(consumido)}</strong></div>
        <div><span>Meta</span><strong>{Math.round(meta)}</strong></div>
        <div><span>Gasto</span><strong>{Math.round(gasto)}</strong></div>
        <div><span>Treino</span><strong>{Math.round(kcalTreinos)}</strong></div>
      </div>
      <p className={consumido < gasto ? 'status ok' : 'status ruim'}>
        {consumido === 0
          ? 'Nada registrado ainda.'
          : consumido < gasto
            ? `Déficit de ${Math.round(gasto - consumido)} kcal até agora`
            : `${Math.round(consumido - gasto)} kcal acima do gasto`}
      </p>

      {(Object.keys(NOMES_REFEICAO) as TipoRefeicao[]).map((tipo) => {
        const itens = refeicoes.filter((r) => r.tipo === tipo)
        const total = itens.reduce((s, r) => s + r.kcal, 0)
        return (
          <div key={tipo} className="cartao">
            <div className="cartao-topo">
              <h2>{NOMES_REFEICAO[tipo]}</h2>
              <span>{Math.round(total)} kcal</span>
              <button className="mais" aria-label={`Adicionar em ${NOMES_REFEICAO[tipo]}`} onClick={() => setAdicionando(tipo)}>+</button>
            </div>
            {itens.map((r) => (
              <div key={r.id} className="item">
                <span>{r.nome} <small>{r.gramas} g</small></span>
                <span>{Math.round(r.kcal)}</span>
                <button aria-label={`Remover ${r.nome}`} onClick={async () => { await removerRefeicao(banco, r.id); mudou() }}>×</button>
              </div>
            ))}
          </div>
        )
      })}
    </section>
  )
}
