import { useMemo, useState } from 'react'
import { useHojeApp } from '../useHojeApp'
import { kcalTreino, type Perfil } from '../calc/energia'
import { METS } from '../calc/mets'
import { addTreino, removerTreino, treinosDoDia } from '../db/repos'
import { useBanco } from '../estado'
import { FICHA, type Divisao } from '../treino/ficha'
import { FichaTreino } from './FichaTreino'

export function Treino({ perfil, ficha = FICHA }: { perfil: Perfil; ficha?: Divisao[] }) {
  const { banco, versao, mudou } = useBanco()
  const data = useHojeApp()
  const treinos = useMemo(() => treinosDoDia(banco, data), [banco, data, versao])

  const [tipo, setTipo] = useState('Musculação')
  const [duracao, setDuracao] = useState('60')
  const [kcalManual, setKcalManual] = useState<string | null>(null)

  const min = Number(duracao.replace(',', '.'))
  const met = METS[tipo]
  const sugerido = met !== null && min > 0 ? String(kcalTreino(met, perfil.pesoKg, min)) : ''
  const kcalTxt = kcalManual ?? sugerido
  const kcal = Number(kcalTxt.replace(',', '.'))
  const valido = min > 0 && kcal > 0

  async function registrar() {
    await addTreino(banco, { data, tipo, duracaoMin: min, kcal })
    setKcalManual(null)
    mudou()
  }

  return (
    <section>
      <h1>Treino de hoje</h1>
      {ficha.length > 0 && <FichaTreino key={data} ficha={ficha} data={data} />}
      <div className="cartao formulario">
        <label>Tipo
          <select value={tipo} onChange={(e) => { setTipo(e.target.value); setKcalManual(null) }}>
            {Object.keys(METS).map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label>Duração (min)
          <input inputMode="numeric" value={duracao} onChange={(e) => { setDuracao(e.target.value); setKcalManual(null) }} />
        </label>
        <label>kcal gastas
          <input inputMode="numeric" value={kcalTxt} onChange={(e) => setKcalManual(e.target.value)} />
        </label>
        <p className="dica">Estimativa pelo seu peso; edite se o relógio marcar outro valor.</p>
        <button disabled={!valido} onClick={registrar}>Registrar treino</button>
      </div>

      {treinos.length === 0 ? (
        <p className="vazio">Nenhum treino hoje.</p>
      ) : (
        <div className="cartao">
          {treinos.map((t) => (
            <div key={t.id} className="item">
              <span>{t.tipo} · {t.duracaoMin} min · {Math.round(t.kcal)} kcal</span>
              <button aria-label={`Remover ${t.tipo}`} onClick={async () => { await removerTreino(banco, t.id); mudou() }}>×</button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
