import { useEffect, useMemo, useState } from 'react'
import { carregarBancoSalvo, type Banco } from './db/banco'
import { getPerfil } from './db/repos'
import { semearTaco, type AlimentoTaco } from './db/seed'
import { sincronizarApelidosLista } from './db/apelidos'
import { sincronizarPorcoesLista } from './db/porcoes'
import { ProvedorBanco, useBanco } from './estado'
import { Hoje } from './telas/Hoje'
import { Perfil } from './telas/Perfil'
import { Treino } from './telas/Treino'
import { Historico } from './telas/Historico'
import { Icone } from './componentes/Icone'
import type { NomeIcone } from './calc/conquistas'

type Aba = 'hoje' | 'treino' | 'historico' | 'perfil'
const ABAS: { id: Aba; rotulo: string; icone: NomeIcone }[] = [
  { id: 'hoje', rotulo: 'Hoje', icone: 'hoje' },
  { id: 'treino', rotulo: 'Treino', icone: 'haltere' },
  { id: 'historico', rotulo: 'Histórico', icone: 'calendario' },
  { id: 'perfil', rotulo: 'Perfil', icone: 'perfil' },
]

async function iniciarBanco(): Promise<Banco> {
  const b = await carregarBancoSalvo()
  try {
    const itens = (await (await fetch(`${import.meta.env.BASE_URL}taco.json`)).json()) as AlimentoTaco[]
    if (semearTaco(b, itens) > 0) await b.salvar()
  } catch (e) {
    console.error('Falha ao carregar a TACO', e)
  }
  try {
    sincronizarApelidosLista(b)
  } catch (e) {
    console.error('Falha ao sincronizar os apelidos', e)
  }
  try {
    sincronizarPorcoesLista(b)
  } catch (e) {
    console.error('Falha ao sincronizar as porções', e)
  }
  return b
}

export default function App({ banco }: { banco?: Banco }) {
  const [b, setB] = useState<Banco | null>(banco ?? null)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => {
    if (!b) iniciarBanco().then(setB).catch((e) => setErro(String(e)))
  }, [b])

  if (erro) return <p className="vazio">Erro ao abrir o banco: {erro}</p>
  if (!b) return <p className="vazio">Carregando…</p>
  return (
    <ProvedorBanco banco={b}>
      <Telas />
    </ProvedorBanco>
  )
}

function Telas() {
  const { banco, versao } = useBanco()
  const perfil = useMemo(() => getPerfil(banco), [banco, versao])
  const [aba, setAba] = useState<Aba>(perfil ? 'hoje' : 'perfil')
  const abaAtual: Aba = perfil ? aba : 'perfil'

  return (
    <div className="app">
      <main>
        {abaAtual === 'hoje' && perfil && <Hoje perfil={perfil} />}
        {abaAtual === 'treino' && perfil && <Treino perfil={perfil} />}
        {abaAtual === 'historico' && perfil && <Historico perfil={perfil} />}
        {abaAtual === 'perfil' && <Perfil perfil={perfil} aoSalvar={() => setAba('hoje')} />}
      </main>
      <nav className="abas">
        {ABAS.map((a) => (
          <button key={a.id} className={abaAtual === a.id ? 'ativa' : ''} disabled={!perfil && a.id !== 'perfil'} onClick={() => setAba(a.id)}>
            <Icone nome={a.icone} />
            <span>{a.rotulo}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
