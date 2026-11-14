import { useEffect, useMemo, useRef, useState } from 'react'
import { parseGramas } from '../calc/datas'
import {
  addRefeicao, adicionarApelido, adicionarPorcao, buscarAlimentos, criarAlimento, porcoesDoAlimento, ultimoUso,
  type Alimento, type Porcao, type TipoRefeicao,
} from '../db/repos'
import { useBanco } from '../estado'
import { NOMES_REFEICAO } from '../refeicoes'

/** `fechar(true)` quando a refeição foi salva; `fechar()` ao voltar sem salvar. */
/** Medida escolhida: gramas direto ou uma porção (pelo id). */
type Selecao = { tipo: 'gramas' } | { tipo: 'porcao'; id: number }

const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1, useGrouping: false })

interface Props { data: string; tipo: TipoRefeicao; fechar: (salvou?: boolean) => void }

export function Adicionar({ data, tipo, fechar }: Props) {
  const { banco, mudou } = useBanco()
  const [termo, setTermo] = useState('')
  const [termoBusca, setTermoBusca] = useState('')
  const [escolhido, setEscolhido] = useState<Alimento | null>(null)
  const [gramasTxt, setGramasTxt] = useState('100')
  const [porcoes, setPorcoes] = useState<Porcao[]>([])
  const [sel, setSel] = useState<Selecao>({ tipo: 'gramas' })
  const [qtdTxt, setQtdTxt] = useState('1')
  const [criandoPorcao, setCriandoPorcao] = useState(false)
  const [cadastrando, setCadastrando] = useState(false)
  /** Termo que o usuário está ensinando: vira apelido do alimento quando a refeição é confirmada. */
  const [ensinando, setEnsinando] = useState<string | null>(null)
  const campoBusca = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setTermoBusca(termo), 150)
    return () => clearTimeout(t)
  }, [termo])

  const resultados = useMemo(() => buscarAlimentos(banco, termoBusca), [banco, termoBusca])
  const porcao = sel.tipo === 'porcao' ? porcoes.find((p) => p.id === sel.id) ?? null : null
  const qtd = parseGramas(qtdTxt)
  const gramas = porcao ? (qtd === null ? null : qtd * porcao.gramas) : parseGramas(gramasTxt)

  /**
   * Abre o alimento com a medida da última vez: a mesma porção (a do usuário vence em nome igual) e quantidade,
   * ou os mesmos gramas. Sem histórico, ou se a porção não existe mais: a primeira porção, ou 100 g.
   */
  function escolher(a: Alimento) {
    const ps = porcoesDoAlimento(banco, a.id)
    const u = ultimoUso(banco, a.id)
    setPorcoes(ps)
    setEscolhido(a)
    setCriandoPorcao(false)
    const daVez = u?.porcao ? [...ps].reverse().find((p) => p.nome === u.porcao) : undefined
    if (daVez) {
      setSel({ tipo: 'porcao', id: daVez.id })
      setQtdTxt(num(u?.qtd ?? 1))
    } else if (u && !u.porcao) {
      setSel({ tipo: 'gramas' })
      setGramasTxt(num(u.gramas))
    } else if (ps.length > 0) {
      setSel({ tipo: 'porcao', id: ps[0].id })
      setQtdTxt('1')
    } else {
      setSel({ tipo: 'gramas' })
      setGramasTxt('100')
    }
  }

  /** + e − andam de 1 em 1; − não desce abaixo de 1. Texto inválido: + vira 1. */
  function passo(delta: 1 | -1) {
    const q = parseGramas(qtdTxt)
    if (q === null) return setQtdTxt('1')
    setQtdTxt(num(delta > 0 ? Math.floor(q) + 1 : Math.max(1, Math.ceil(q) - 1)))
  }

  async function criarPorcao(nome: string, g: number) {
    if (!escolhido) return
    const id = await adicionarPorcao(banco, escolhido.id, nome, g)
    setPorcoes(porcoesDoAlimento(banco, escolhido.id))
    setSel({ tipo: 'porcao', id })
    setQtdTxt('1')
    setCriandoPorcao(false)
  }

  function ensinar() {
    setEnsinando(termoBusca.trim())
    setTermo('')
    setTermoBusca('')
    campoBusca.current?.focus()
  }

  async function confirmar() {
    if (!escolhido || gramas === null) return
    // O apelido só é gravado ao confirmar: uma escolha errada desfeita com "Trocar" não vira apelido.
    if (ensinando) await adicionarApelido(banco, escolhido.id, ensinando)
    await addRefeicao(banco, porcao && qtd !== null
      ? { data, tipo, alimentoId: escolhido.id, gramas, qtd, porcao: porcao.nome }
      : { data, tipo, alimentoId: escolhido.id, gramas })
    mudou()
    fechar(true)
  }

  if (cadastrando) {
    return (
      <NovoAlimento
        nomeInicial={termo || ensinando || ''}
        voltar={() => setCadastrando(false)}
        criado={async (a) => {
          const id = await criarAlimento(banco, a)
          escolher({ ...a, id })
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
          <div className="porcoes" role="radiogroup" aria-label="Medida">
            <button role="radio" aria-checked={sel.tipo === 'gramas'} onClick={() => setSel({ tipo: 'gramas' })}>Gramas</button>
            {porcoes.map((p) => (
              <button key={p.id} role="radio" aria-checked={porcao?.id === p.id}
                onClick={() => { setSel({ tipo: 'porcao', id: p.id }); setCriandoPorcao(false) }}>{p.nome}</button>
            ))}
            <button className="nova" onClick={() => setCriandoPorcao(true)}>+ Minha porção</button>
          </div>
          {criandoPorcao && <NovaPorcao cancelar={() => setCriandoPorcao(false)} salvar={criarPorcao} />}
          {porcao ? (
            <div className="quantidade">
              <button aria-label="Menos" onClick={() => passo(-1)}>−</button>
              <label>
                Quantidade
                <input inputMode="decimal" value={qtdTxt} onChange={(e) => setQtdTxt(e.target.value)} />
              </label>
              <button aria-label="Mais" onClick={() => passo(1)}>+</button>
            </div>
          ) : (
            <label>
              Gramas
              <input inputMode="decimal" value={gramasTxt} onChange={(e) => setGramasTxt(e.target.value)} autoFocus />
            </label>
          )}
          <p className="destaque" data-testid="total">
            {gramas === null ? '—' : `${num(gramas)} g · ${Math.round((escolhido.kcal100g * gramas) / 100)} kcal`}
          </p>
          <div className="acoes">
            <button className="secundario" onClick={() => setEscolhido(null)}>Trocar</button>
            <button disabled={gramas === null} onClick={confirmar}>Adicionar</button>
          </div>
        </div>
      ) : (
        <>
          {ensinando && (
            <p className="aviso" role="status">
              Procure o alimento que "{ensinando}" quer dizer
              <button className="link" onClick={() => setEnsinando(null)}>Cancelar</button>
            </p>
          )}
          <input
            ref={campoBusca} className="busca" placeholder="Buscar alimento" value={termo} autoFocus
            onChange={(e) => setTermo(e.target.value)}
          />
          <ul className="resultados">
            {resultados.map((a) => (
              <li key={a.id}>
                <button onClick={() => escolher(a)}>
                  <span>{a.nome}</span>
                  <small>{a.kcal100g} kcal/100 g</small>
                </button>
              </li>
            ))}
          </ul>
          {termoBusca && resultados.length === 0 && (
            <div className="vazio">
              <p>Nada encontrado.</p>
              {!ensinando && (
                <button className="secundario largo" onClick={ensinar}>Ensinar "{termoBusca.trim()}"</button>
              )}
            </div>
          )}
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

function NovaPorcao({ cancelar, salvar }: { cancelar: () => void; salvar: (nome: string, gramas: number) => void }) {
  const [nome, setNome] = useState('')
  const [gTxt, setGTxt] = useState('')
  const g = parseGramas(gTxt)
  const valido = nome.trim() !== '' && g !== null
  return (
    <div className="nova-porcao">
      <label>Nome da porção<input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus /></label>
      <label>Gramas ou ml<input inputMode="decimal" value={gTxt} onChange={(e) => setGTxt(e.target.value)} /></label>
      <div className="acoes">
        <button className="secundario" onClick={cancelar}>Cancelar</button>
        <button disabled={!valido} onClick={() => g !== null && salvar(nome, g)}>Salvar porção</button>
      </div>
    </div>
  )
}
