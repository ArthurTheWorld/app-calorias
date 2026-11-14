interface Props { consumido: number; meta: number }

/** Anel de progresso: consumido em relação à meta do dia. */
export function Anel({ consumido, meta }: Props) {
  const r = 70
  const c = 2 * Math.PI * r
  const frac = meta > 0 ? Math.min(consumido / meta, 1) : 0
  const passou = consumido > meta
  const restante = Math.round(meta - consumido)
  return (
    <div className="anel">
      <svg viewBox="0 0 180 180" width="180" height="180" aria-hidden>
        <circle cx="90" cy="90" r={r} className="anel-fundo" />
        <circle
          cx="90" cy="90" r={r}
          className={passou ? 'anel-progresso passou' : 'anel-progresso'}
          strokeDasharray={c} strokeDashoffset={c * (1 - frac)}
          transform="rotate(-90 90 90)"
        />
      </svg>
      <div className="anel-texto">
        <strong data-testid="restante">{Math.abs(restante)}</strong>
        <span>{passou ? 'kcal acima' : 'kcal restantes'}</span>
      </div>
    </div>
  )
}
