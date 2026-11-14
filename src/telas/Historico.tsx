import { useMemo, useState } from 'react'
import { Calendario } from '../componentes/Calendario'
import { hojeLocal } from '../calc/datas'
import type { Perfil } from '../calc/energia'
import { resumirDias, resumoMes, streak } from '../calc/historico'
import { totaisPorDia } from '../db/repos'
import { useBanco } from '../estado'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const nomeMes = (mes: string) => { const [a, m] = mes.split('-'); return `${MESES[Number(m) - 1]} ${a}` }
const mudarMes = (mes: string, delta: number) => {
  const [a, m] = mes.split('-').map(Number)
  const d = new Date(a, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const fmt = (n: number) => Math.round(n).toLocaleString('pt-BR')

export function Historico({ perfil }: { perfil: Perfil }) {
  const { banco, versao } = useBanco()
  const hoje = hojeLocal()
  const [mes, setMes] = useState(hoje.slice(0, 7))

  // Usa o perfil atual para todos os dias (peso antigo não é guardado na v1).
  const dias = useMemo(() => resumirDias(perfil, totaisPorDia(banco, '0000-01-01', '9999-12-31')), [banco, perfil, versao])
  const porData = useMemo(() => new Map(dias.map((d) => [d.data, d])), [dias])
  const s = streak(dias, hoje)
  const r = resumoMes(dias, mes)
  const meses = useMemo(
    () => [...new Set(dias.map((d) => d.data.slice(0, 7)))].sort().reverse(),
    [dias],
  )

  return (
    <section>
      <h1>Histórico</h1>
      <div className="numeros dois">
        <div className="cartao"><span>Sequência atual</span><strong data-testid="streak-atual">{s.atual}</strong><span>dias em déficit</span></div>
        <div className="cartao"><span>Recorde</span><strong data-testid="recorde">{s.recorde}</strong><span>dias seguidos</span></div>
      </div>

      <div className="cartao">
        <header className="navegar-data">
          <button aria-label="Mês anterior" onClick={() => setMes(mudarMes(mes, -1))}>‹</button>
          <h2 data-testid="mes-titulo">{nomeMes(mes)}</h2>
          <button aria-label="Próximo mês" disabled={mes >= hoje.slice(0, 7)} onClick={() => setMes(mudarMes(mes, 1))}>›</button>
        </header>
        <Calendario mes={mes} dias={porData} hoje={hoje} />
        <div className="legenda"><i className="deficit" /> déficit <i className="acima" /> acima do gasto <i className="sem" /> sem registro</div>
        {r.diasRegistrados > 0 ? (
          <div className="resumo-mes">
            <p>Dias em déficit: <strong data-testid="dias-deficit-mes">{r.diasEmDeficit} de {r.diasRegistrados}</strong></p>
            <p>Saldo do mês: <strong>{r.deficitTotal >= 0 ? `−${fmt(r.deficitTotal)}` : `+${fmt(-r.deficitTotal)}`} kcal</strong></p>
            <p>Média consumida: <strong>{fmt(r.mediaConsumo)} kcal/dia</strong></p>
          </div>
        ) : <p className="vazio">Sem registros neste mês.</p>}
      </div>

      {meses.length > 0 && (
        <div className="cartao">
          <h2>Meses</h2>
          {meses.map((m) => {
            const rm = resumoMes(dias, m)
            return (
              <button key={m} className="linha-mes" onClick={() => setMes(m)}>
                <span>{nomeMes(m)}</span>
                <span>{rm.diasEmDeficit}/{rm.diasRegistrados} dias · {rm.deficitTotal >= 0 ? '−' : '+'}{fmt(Math.abs(rm.deficitTotal))} kcal</span>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
