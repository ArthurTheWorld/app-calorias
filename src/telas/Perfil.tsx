import { useMemo, useState } from 'react'
import { DEFICIT_PADRAO, gastoDia, metaConsumo, tmb, type Perfil as TPerfil, type Sexo } from '../calc/energia'
import {
  apelidosDoUsuario, diasDoJogo, pesosRegistrados, porcoesDoUsuario, registrarPeso, removerApelido, removerPeso, removerPorcao,
  salvarPerfil,
} from '../db/repos'
import { useHojeApp } from '../useHojeApp'
import { nivel, xpTotal } from '../calc/jogo'
import { useBanco } from '../estado'
import { hojeApp } from '../calc/datas'
import { abrirBanco } from '../db/banco'
import { baixar, validarBancoImportado } from '../exportar'
import { useSync } from '../sync/useSync'

/** "hoje 14:32" ou "15/11 09:10". */
function quando(iso: string): string {
  const d = new Date(iso)
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return d.toDateString() === new Date().toDateString() ? `hoje ${hora}` : `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${hora}`
}

export function Perfil({ perfil, aoSalvar }: { perfil: TPerfil | null; aoSalvar: () => void }) {
  const { banco, mudou } = useBanco()
  const [altura, setAltura] = useState(perfil ? String(perfil.alturaCm) : '')
  const [peso, setPeso] = useState(perfil ? String(perfil.pesoKg) : '')
  const [idade, setIdade] = useState(perfil ? String(perfil.idade) : '')
  const [sexo, setSexo] = useState<Sexo>(perfil?.sexo ?? 'M')
  const [deficit, setDeficit] = useState(String(perfil?.deficitMeta ?? DEFICIT_PADRAO))
  const [salvo, setSalvo] = useState(false)

  const n = (s: string) => Number(s.replace(',', '.'))
  // Com perfil, o peso vem do registro mais recente (muda pelo cartão "Peso"), não do formulário.
  const pesoKg = perfil ? perfil.pesoKg : n(peso)
  const candidato: TPerfil = { alturaCm: n(altura), pesoKg, idade: n(idade), sexo, deficitMeta: n(deficit) }
  const valido =
    candidato.alturaCm >= 100 && candidato.alturaCm <= 250 &&
    candidato.pesoKg >= 30 && candidato.pesoKg <= 300 &&
    candidato.idade >= 14 && candidato.idade <= 100 &&
    candidato.deficitMeta >= 0 && candidato.deficitMeta <= 1500

  async function salvar() {
    await salvarPerfil(banco, candidato)
    if (!perfil) await registrarPeso(banco, hojeApp(), candidato.pesoKg)
    setSalvo(true)
    mudou()
    aoSalvar()
  }

  return (
    <section>
      <h1>Seu perfil</h1>
      {!perfil && <p>Preencha seus dados para o app calcular seu gasto e sua meta.</p>}
      <div className="cartao formulario">
        <label>Altura (cm)<input inputMode="decimal" value={altura} onChange={(e) => { setAltura(e.target.value); setSalvo(false) }} /></label>
        {!perfil && (
          <label>Peso (kg)<input inputMode="decimal" value={peso} onChange={(e) => { setPeso(e.target.value); setSalvo(false) }} /></label>
        )}
        <label>Idade<input inputMode="numeric" value={idade} onChange={(e) => { setIdade(e.target.value); setSalvo(false) }} /></label>
        <label>Sexo
          <select value={sexo} onChange={(e) => { setSexo(e.target.value as Sexo); setSalvo(false) }}>
            <option value="M">Masculino</option>
            <option value="F">Feminino</option>
          </select>
        </label>
        <label>Déficit desejado (kcal/dia)<input inputMode="numeric" value={deficit} onChange={(e) => { setDeficit(e.target.value); setSalvo(false) }} /></label>
        {valido && (
          <p className="dica">
            Basal: {Math.round(tmb(candidato))} kcal · Gasto sem treino: {Math.round(gastoDia(candidato, 0))} kcal ·
            Meta sem treino: {Math.round(metaConsumo(candidato, 0))} kcal
            {metaConsumo(candidato, 0) > gastoDia(candidato, 0) - candidato.deficitMeta &&
              ' (limitada ao basal — em dia sem treino o déficit real fica menor)'}
          </p>
        )}
        <button disabled={!valido} onClick={salvar}>{salvo ? 'Salvo ✓' : 'Salvar'}</button>
      </div>
      {perfil && <Peso />}
      {perfil && <Nivel />}
      <SeusApelidos />
      <SuasPorcoes />
      <Dados />
    </section>
  )
}

const dataBr = (data: string) => data.split('-').reverse().join('/')
const kg = (n: number) => `${n.toLocaleString('pt-BR')} kg`

function Peso() {
  const { banco, versao, mudou } = useBanco()
  const hoje = useHojeApp()
  const pesos = useMemo(() => pesosRegistrados(banco), [banco, versao])
  const [txt, setTxt] = useState('')
  const valor = Number(txt.replace(',', '.'))
  const valido = txt.trim() !== '' && valor >= 30 && valor <= 300

  async function registrar() {
    await registrarPeso(banco, hoje, valor)
    setTxt('')
    mudou()
  }

  return (
    <div className="cartao peso">
      <h2>Peso</h2>
      <div className="peso-registrar">
        <label>Peso de hoje (kg)
          <input inputMode="decimal" value={txt} onChange={(e) => setTxt(e.target.value)} />
        </label>
        <button disabled={!valido} onClick={registrar}>Registrar</button>
      </div>
      {[...pesos].reverse().slice(0, 10).map((p) => (
        <div key={p.id} className="item">
          <span>{dataBr(p.data)}</span>
          <span>{kg(p.pesoKg)}</span>
          {pesos.length > 1 && (
            <button aria-label={`Apagar peso de ${dataBr(p.data)}`} onClick={async () => { await removerPeso(banco, p.id); mudou() }}>×</button>
          )}
        </div>
      ))}
    </div>
  )
}

function SeusApelidos() {
  const { banco, versao, mudou } = useBanco()
  const apelidos = useMemo(() => apelidosDoUsuario(banco), [banco, versao])
  if (apelidos.length === 0) return null
  return (
    <div className="cartao apelidos">
      <h2>Seus apelidos</h2>
      {apelidos.map((a) => (
        <div key={a.id} className="item">
          <span>{a.termo} → {a.nomeAlimento}</span>
          <button aria-label={`Remover apelido ${a.termo}`} onClick={async () => { await removerApelido(banco, a.id); mudou() }}>×</button>
        </div>
      ))}
    </div>
  )
}

function Nivel() {
  const { banco, versao } = useBanco()
  const xp = useMemo(() => xpTotal(diasDoJogo(banco)), [banco, versao])
  const nv = nivel(xp)
  return (
    <div className="cartao">
      <div className="nivel-topo">
        <h2 className="acento">LV {nv.nivel}</h2>
        <span className="suave">{nv.xpNoNivel} / {nv.xpDoNivel} XP</span>
      </div>
      <div className="barra-energia" data-testid="xp-barra">
        <i style={{ width: `${(nv.xpNoNivel / nv.xpDoNivel) * 100}%` }} />
      </div>
      <p className="dica">XP vem de registrar: refeições e treinos. Ele nunca diminui por resultado.</p>
    </div>
  )
}

function Dados() {
  const { banco } = useBanco()
  const sync = useSync()
  const [msg, setMsg] = useState<string | null>(null)
  const hoje = hojeApp()

  async function importar(arquivo: File) {
    const dados = new Uint8Array(await arquivo.arrayBuffer())
    if (!(await validarBancoImportado(dados))) {
      setMsg('Esse arquivo não é um backup deste app.')
      return
    }
    if (!window.confirm('Isso substitui TODOS os dados atuais pelos do backup. Continuar?')) return
    const novo = await abrirBanco(dados)
    await novo.salvar()
    window.location.reload()
  }

  return (
    <div className="cartao">
      <h2>Backup e sincronização</h2>
      {sync.ativo && (sync.conectado ? (
        <>
          <p className="dica">
            Drive conectado · última sincronização {sync.ultima ? quando(sync.ultima) : 'ainda não'}
          </p>
          <div className="acoes coluna">
            <button disabled={sync.ocupado} onClick={() => sync.sincronizarAgora()}>Sincronizar agora</button>
            <button className="discreto" onClick={() => sync.desconectar()}>Desconectar o Drive</button>
          </div>
        </>
      ) : (
        <>
          <p className="dica">Guarda o banco no seu Google Drive e pega sozinho as mudanças feitas pelo PC.</p>
          <div className="acoes coluna">
            <button onClick={() => sync.conectar()}>Conectar Google Drive</button>
          </div>
        </>
      ))}
      <p className="dica">Backup em arquivo único: o .sqlite também abre no DuckDB, DBeaver ou pandas.</p>
      <div className="acoes coluna">
        <button className="secundario" onClick={() => baixar(`calorias-${hoje}.sqlite`, banco.exportar() as BlobPart, 'application/vnd.sqlite3')}>Baixar backup (.sqlite)</button>
        <label className="botao-arquivo secundario">
          Restaurar backup (.sqlite)
          <input type="file" accept=".sqlite,.db,application/octet-stream,application/vnd.sqlite3" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importar(f); e.target.value = '' }} />
        </label>
      </div>
      {msg && <p className="status">{msg}</p>}
    </div>
  )
}

function SuasPorcoes() {
  const { banco, versao, mudou } = useBanco()
  const porcoes = useMemo(() => porcoesDoUsuario(banco), [banco, versao])
  if (porcoes.length === 0) return null
  return (
    <div className="cartao porcoes-usuario">
      <h2>Suas porções</h2>
      {porcoes.map((p) => (
        <div key={p.id} className="item">
          <span>{p.nome} · {p.gramas.toLocaleString('pt-BR', { useGrouping: false })} g → {p.nomeAlimento}</span>
          <button aria-label={`Remover porção ${p.nome}`} onClick={async () => { await removerPorcao(banco, p.id); mudou() }}>×</button>
        </div>
      ))}
    </div>
  )
}
