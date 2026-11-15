import { useMemo, useRef, useState } from 'react'
import {
  adicionarDivisao, adicionarExercicio, editarDescricao, editarDivisao, editarExercicio, lerFicha, moverExercicio, removerDivisao,
  removerExercicio,
} from '../db/ficha'
import { normalizar } from '../db/repos'
import { useBanco } from '../estado'
import type { Divisao, ExercicioFicha } from '../treino/ficha'

const chave = (s: string) => normalizar(s).trim().replace(/\s+/g, ' ')

interface Form { id: number | null; nome: string; series: string; reps: string; obs: string; erro: string | null }
const NOVO: Form = { id: null, nome: '', series: '4', reps: '10', obs: '', erro: null }

/** Editor da ficha: divisões e exercícios. Tudo grava na hora. */
export function EditarFicha({ fechar }: { fechar: () => void }) {
  const { banco, versao, mudou } = useBanco()
  const ficha = useMemo(() => lerFicha(banco), [banco, versao])
  const [selId, setSelId] = useState<number | null>(null)
  const atual = ficha.find((d) => d.id === selId) ?? ficha[0]

  const criando = useRef(false)
  async function novaDivisao() {
    if (criando.current) return // toque duplo: uma divisão só
    criando.current = true
    try {
      const id = await adicionarDivisao(banco)
      setSelId(id)
      mudou()
    } finally {
      criando.current = false
    }
  }

  return (
    <section>
      <div className="titulo-acao">
        <h1>Editar ficha</h1>
        <button onClick={fechar}>Pronto</button>
      </div>
      <div className="cartao">
        <div className="porcoes" role="radiogroup" aria-label="Divisões">
          {ficha.map((d) => (
            <button key={d.id} role="radio" aria-checked={d.id === atual?.id} onClick={() => setSelId(d.id)}>
              {d.nome}
            </button>
          ))}
          <button className="nova" onClick={novaDivisao}>+ Divisão</button>
        </div>
        {atual ? (
          <EditorDivisao key={atual.id} divisao={atual} outras={ficha.filter((d) => d.id !== atual.id)} />
        ) : (
          <p className="dica">Sem divisões. Toque em "+ Divisão" para começar.</p>
        )}
      </div>
    </section>
  )
}

function EditorDivisao({ divisao, outras }: { divisao: Divisao; outras: Divisao[] }) {
  const { banco, mudou } = useBanco()
  const [nome, setNome] = useState(divisao.nome)
  const [titulo, setTitulo] = useState(divisao.titulo ?? '')
  const [form, setForm] = useState<Form | null>(null)

  const nomeVazio = nome.trim() === ''
  const nomeRepetido = !nomeVazio && outras.some((o) => chave(o.nome) === chave(nome))
  const nomeValido = !nomeVazio && !nomeRepetido

  /** Descrição grava a cada tecla; o nome só ao sair do campo, para nomes intermediários não irem ao histórico. */
  async function salvarTitulo(t: string) {
    await editarDescricao(banco, divisao.id, t)
    mudou()
  }
  async function salvarNome() {
    if (!nomeValido) { setNome(divisao.nome); return } // inválido: volta ao último nome salvo
    if (nome.trim() === divisao.nome) return
    if (await editarDivisao(banco, divisao.id, { nome, titulo })) mudou()
  }

  const seriesNum = /^\d+$/.test(form?.series.trim() ?? '') ? Number(form!.series.trim()) : NaN
  const formValido = form !== null && form.nome.trim() !== '' && form.reps.trim() !== '' && seriesNum >= 1 && seriesNum <= 20

  async function salvarExercicio() {
    if (!form || !formValido) return
    const dados = { nome: form.nome, series: seriesNum, reps: form.reps, obs: form.obs }
    const ok = form.id === null ? await adicionarExercicio(banco, divisao.id, dados) : await editarExercicio(banco, form.id, dados)
    if (!ok) {
      setForm({ ...form, erro: 'Já existe um exercício com esse nome nesta divisão.' })
      return
    }
    setForm(null)
    mudou()
  }

  async function remover() {
    if (!window.confirm(`Remover a divisão ${divisao.nome} e os exercícios dela? O histórico de cargas continua.`)) return
    await removerDivisao(banco, divisao.id)
    mudou()
  }

  const editar = (e: ExercicioFicha) =>
    setForm({ id: e.id, nome: e.nome, series: String(e.series), reps: e.reps, obs: e.obs ?? '', erro: null })
  const acao = async (f: () => Promise<void>) => { await f(); mudou() }

  return (
    <div className="editor-divisao">
      <div className="formulario">
        <label>Nome da divisão
          <input value={nome} onChange={(ev) => setNome(ev.target.value)} onBlur={salvarNome} />
        </label>
        {nomeVazio && <p className="dica">Dê um nome à divisão.</p>}
        {nomeRepetido && <p className="dica">Use um nome que ainda não existe.</p>}
        <label>Descrição
          <input
            value={titulo}
            placeholder="Ex.: Peito e tríceps"
            onChange={(ev) => { setTitulo(ev.target.value); salvarTitulo(ev.target.value) }}
          />
        </label>
      </div>

      {divisao.exercicios.length === 0 && form === null && <p className="vazio">Nenhum exercício nesta divisão.</p>}
      {divisao.exercicios.map((e, i) => (
        <div key={e.id} className="item exercicio-ficha">
          <span>{e.nome} · {e.series} × {e.reps}{e.obs && <small> · {e.obs}</small>}</span>
          <button aria-label={`Subir ${e.nome}`} disabled={i === 0} onClick={() => acao(() => moverExercicio(banco, e.id, -1))}>↑</button>
          <button aria-label={`Descer ${e.nome}`} disabled={i === divisao.exercicios.length - 1} onClick={() => acao(() => moverExercicio(banco, e.id, 1))}>↓</button>
          <button aria-label={`Editar ${e.nome}`} onClick={() => editar(e)}>✎</button>
          <button aria-label={`Remover ${e.nome}`} onClick={() => { if (form?.id === e.id) setForm(null); acao(() => removerExercicio(banco, e.id)) }}>×</button>
        </div>
      ))}

      {form === null ? (
        <button className="secundario" onClick={() => setForm(NOVO)}>+ Exercício</button>
      ) : (
        <div className="formulario nova-porcao">
          <label>Nome
            <input value={form.nome} onChange={(ev) => setForm({ ...form, nome: ev.target.value, erro: null })} />
          </label>
          <div className="dois-campos">
            <label>Séries
              <input inputMode="numeric" value={form.series} onChange={(ev) => setForm({ ...form, series: ev.target.value })} />
            </label>
            <label>Repetições
              <input value={form.reps} onChange={(ev) => setForm({ ...form, reps: ev.target.value })} />
            </label>
          </div>
          <label>Observação (opcional)
            <input value={form.obs} onChange={(ev) => setForm({ ...form, obs: ev.target.value })} />
          </label>
          {form.erro && <p className="dica">{form.erro}</p>}
          <div className="botoes">
            <button disabled={!formValido} onClick={salvarExercicio}>Salvar exercício</button>
            <button className="secundario" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </div>
      )}

      <button className="discreto" onClick={remover}>Remover divisão {divisao.nome}</button>
    </div>
  )
}
