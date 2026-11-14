import type { DiaResumo } from '../calc/historico'

const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

/** Calendário de um mês (YYYY-MM) com cada dia colorido pelo resultado. */
export function Calendario({ mes, dias, hoje }: { mes: string; dias: Map<string, DiaResumo>; hoje: string }) {
  const [a, m] = mes.split('-').map(Number)
  const primeiroDiaSemana = new Date(a, m - 1, 1).getDay()
  const totalDias = new Date(a, m, 0).getDate()
  const celulas: (number | null)[] = [
    ...Array<null>(primeiroDiaSemana).fill(null),
    ...Array.from({ length: totalDias }, (_, i) => i + 1),
  ]

  return (
    <div className="calendario">
      {SEMANA.map((s, i) => <div key={`s${i}`} className="cal-semana">{s}</div>)}
      {celulas.map((d, i) => {
        if (d === null) return <div key={`v${i}`} />
        const data = `${mes}-${String(d).padStart(2, '0')}`
        const r = dias.get(data)
        const estado = r ? (r.emDeficit ? 'deficit' : 'acima') : 'sem'
        return (
          <div
            key={data}
            className={`cal-dia ${estado}${data === hoje ? ' hoje' : ''}`}
            data-estado={estado}
            title={r ? `${Math.round(r.consumido)} / ${Math.round(r.gasto)} kcal` : undefined}
          >
            {d}
          </div>
        )
      })}
    </div>
  )
}
