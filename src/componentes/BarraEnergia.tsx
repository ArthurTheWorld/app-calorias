const fmt = (n: number) => Math.round(n).toLocaleString('pt-BR')

/** Energia restante do dia: quanto ainda cabe na meta. Acima da meta vira "+X", em âmbar. */
export function BarraEnergia({ consumido, meta }: { consumido: number; meta: number }) {
  const restante = Math.round(meta - consumido)
  const acima = restante < 0
  const frac = meta > 0 ? Math.min(consumido / meta, 1) : 0
  return (
    <div className="energia">
      <div className="rotulo">{acima ? 'Acima da meta' : 'Energia restante'}</div>
      <div className="energia-linha">
        <strong data-testid="restante" className={acima ? 'grande acima' : 'grande'}>
          {acima ? '+' : ''}{Math.abs(restante)}
        </strong>
        <span className="suave">/ {fmt(meta)} kcal</span>
      </div>
      <div className="barra-energia" role="progressbar" aria-valuenow={Math.round(frac * 100)} aria-valuemin={0} aria-valuemax={100}>
        <i className={acima ? 'acima' : ''} style={{ width: `${frac * 100}%` }} />
      </div>
    </div>
  )
}
