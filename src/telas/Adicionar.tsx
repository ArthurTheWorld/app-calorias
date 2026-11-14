import { useEffect, useMemo, useState } from 'react'
import { parseGramas } from '../calc/datas'
import { addRefeicao, buscarAlimentos, criarAlimento, type Alimento, type TipoRefeicao } from '../db/repos'
import { useBanco } from '../estado'
import { NOMES_REFEICAO } from '../refeicoes'

/** `fechar(true)` quando a refeição foi salva; `fechar()` ao voltar sem salvar. */
interface Props { data: string; tipo: TipoRefeicao; fechar: (salvou?: boolean) => void }

export function Adicionar({ data, tipo, fechar }: Props) {
  const { banco, mudou } = useBanco()
  const [termo, setTermo] = useState('')
  const [termoBusca, setTermoBusca] = useState('')
  const [escolhido, setEscolhido] = useState<Alimento | null>(null)
  const [gramasTxt, setGramasTxt] = useState('100')
  const [cadastrando, setCadastrando] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setTermoBusca(termo), 150)
    return () => clearTimeout(t)
  }, [termo])

  const resultados = useMemo(() => buscarAlimentos(banco, termoBusca), [banco, termoBusca])
  const gramas = parseGramas(gramasTxt)

  async function confirmar() {
    if (!escolhido || gramas === null) return
    await addRefeicao(banco, { data, tipo, alimentoId: escolhido.id, gramas })
    mudou()
    fechar(true)
  }

  if (cadastrando) {
    return (
      <NovoAlimento
        nomeInicial={termo}
        voltar={() => setCadastrando(false)}
        criado={async (a) => {
          const id = await criarAlimento(banco, a)
          setEscolhido({ ...a, id })
          setCadastrando(false)
        }}
      />
    )
  }

  return (
    <section>
      <header className="barra">
        <button onClick={() => fechar()} aria-label="Voltar">‹</button>
        <h1>{NOMES_REFEICAO[tipo]}</h1>
      </header>

      {escolhido ? (
        <div className="cartao">
          <h2>{escolhido.nome}</h2>
          <p>{escolhido.kcal100g} kcal / 100 g</p>
          <label>
            Gramas
            <input inputMode="decimal" value={gramasTxt} onChange={(e) => setGramasTxt(e.target.value)} autoFocus />
          </label>
          <p className="destaque">{gramas === null ? '—' : Math.round((escolhido.kcal100g * gramas) / 100)} kcal</p>
          <div className="acoes">
            <button className="secundario" onClick={() => setEscolhido(null)}>Trocar</button>
            <button disabled={gramas === null} onClick={confirmar}>Adicionar</button>
          </div>
        </div>
      ) : (
        <>
          <input
            className="busca" placeholder="Buscar alimento" value={termo} autoFocus
            onChange={(e) => setTermo(e.target.value)}
          />
          <ul className="resultados">
            {resultados.map((a) => (
              <li key={a.id}>
                <button onClick={() => setEscolhido(a)}>
                  <span>{a.nome}</span>
                  <small>{a.kcal100g} kcal/100 g</small>
                </button>
              </li>
            ))}
          </ul>
          {termoBusca && resultados.length === 0 && <p className="vazio">Nada encontrado.</p>}
          <button className="secundario largo" onClick={() => setCadastrando(true)}>+ Cadastrar alimento</button>
        </>
      )}
    </section>
  )
}

function NovoAlimento({ nomeInicial, voltar, criado }: {
  nomeInicial: string
  voltar: () => void
  criado: (a: Omit<Alimento, 'id'>) => void
}) {
  const [nome, setNome] = useState(nomeInicial)
  const [kcal, setKcal] = useState('')
  const [prot, setProt] = useState('')
  const [carb, setCarb] = useState('')
  const [gord, setGord] = useState('')
  const n = (s: string) => Number(s.replace(',', '.')) || 0
  const valido = nome.trim() !== '' && n(kcal) > 0

  return (
    <section>
      <header className="barra">
        <button onClick={voltar} aria-label="Voltar">‹</button>
        <h1>Novo alimento</h1>
      </header>
      <div className="cartao formulario">
        <label>Nome<input value={nome} onChange={(e) => setNome(e.target.value)} /></label>
        <label>kcal por 100 g<input inputMode="decimal" value={kcal} onChange={(e) => setKcal(e.target.value)} /></label>
        <label>Proteína (g/100 g)<input inputMode="decimal" value={prot} onChange={(e) => setProt(e.target.value)} /></label>
        <label>Carboidrato (g/100 g)<input inputMode="decimal" value={carb} onChange={(e) => setCarb(e.target.value)} /></label>
        <label>Gordura (g/100 g)<input inputMode="decimal" value={gord} onChange={(e) => setGord(e.target.value)} /></label>
        <button disabled={!valido} onClick={() => criado({
          nome: nome.trim(), kcal100g: n(kcal), proteinaG: n(prot), carboG: n(carb), gorduraG: n(gord), origem: 'custom',
        })}>Salvar</button>
      </div>
    </section>
  )
}
