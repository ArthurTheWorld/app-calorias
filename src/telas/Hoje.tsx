import { useEffect, useMemo, useState } from 'react'
import { BarraEnergia } from '../componentes/BarraEnergia'
import { Icone } from '../componentes/Icone'
import { conquistas, proximaConquista, textoFalta } from '../calc/conquistas'
import { dataParaRefeicao, hojeApp, nomeDiaSemana, somarDias } from '../calc/datas'
import { gastoDia, metaConsumo, type Perfil } from '../calc/energia'
import { resumirDias } from '../calc/historico'
import { diaN, nivel, xpTotal } from '../calc/jogo'
import { fechamentoOntem, painel } from '../calc/painel'
import { diasDoJogo, pesosRegistrados, refeicoesDoDia, removerRefeicao, totaisPorDia, treinosDoDia } from '../db/repos'
import { perfilNaData } from '../calc/peso'
import { useBanco } from '../estado'
import { NOMES_REFEICAO, TIPOS_REFEICAO, type TipoRefeicao } from '../refeicoes'
import { useHojeApp } from '../useHojeApp'
import { Adicionar } from './Adicionar'

export function rotuloData(data: string): string {
  const hoje = hojeApp()
  if (data === hoje) return 'Hoje'
  if (data === somarDias(hoje, -1)) return 'Ontem'
  const [a, m, d] = data.split('-')
  return `${d}/${m}/${a}`
}

const fmt = (n: number) => Math.round(n).toLocaleString('pt-BR')
/** Saldo com sinal: déficit aparece como "−300", acima do gasto como "+120". */
const saldo = (deficit: number | null) =>
  deficit === null ? '—' : deficit >= 0 ? `−${fmt(deficit)}` : `+${fmt(-deficit)}`

export function Hoje({ perfil }: { perfil: Perfil }) {
  const { banco, versao, mudou } = useBanco()
  const hoje = useHojeApp()
  const [data, setData] = useState(hoje)
  // Se o dia virou com o app aberto e a tela estava no "hoje" antigo, acompanha o novo dia.
  const [hojeVisto, setHojeVisto] = useState(hoje)
  if (hoje !== hojeVisto) {
    setHojeVisto(hoje)
    if (data === hojeVisto) setData(hoje)
  }
  const [adicionando, setAdicionando] = useState<{ tipo: TipoRefeicao; data: string } | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 4000)
    return () => clearTimeout(t)
  }, [aviso])

  const refeicoes = useMemo(() => refeicoesDoDia(banco, data), [banco, data, versao])
  const treinos = useMemo(() => treinosDoDia(banco, data), [banco, data, versao])
  const dias = useMemo(() => diasDoJogo(banco), [banco, versao])
  const pesos = useMemo(() => pesosRegistrados(banco), [banco, versao])
  const resumos = useMemo(
    () => resumirDias(perfil, totaisPorDia(banco, '0000-01-01', '9999-12-31'), pesos),
    [banco, perfil, pesos, versao],
  )

  const kcalTreinos = treinos.reduce((s, t) => s + t.kcal, 0)
  const consumido = refeicoes.reduce((s, r) => s + r.kcal, 0)
  const perfilDoDia = perfilNaData(perfil, pesos, data)
  const meta = metaConsumo(perfilDoDia, kcalTreinos)
  const gasto = gastoDia(perfilDoDia, kcalTreinos)
  const ehHoje = data === hoje

  if (adicionando) {
    return (
      <Adicionar
        data={adicionando.data}
        tipo={adicionando.tipo}
        fechar={(salvou) => {
          if (salvou && adicionando.data !== data) setAviso(`Salvo na madrugada de ${nomeDiaSemana(adicionando.data)}`)
          setAdicionando(null)
        }}
      />
    )
  }

  const xp = xpTotal(dias)
  const nv = nivel(xp)
  const p = painel(resumos, dias, hoje)
  const cs = conquistas(dias, resumos, hoje)
  const proxima = proximaConquista(cs)
  const fechamento = fechamentoOntem(dias, resumos, hoje)

  return (
    <section>
      <header className="navegar-data">
        <button aria-label="Dia anterior" onClick={() => setData(somarDias(data, -1))}>‹</button>
        <h1>{ehHoje ? `DIA ${diaN(dias, hoje)}` : rotuloData(data)}</h1>
        <button aria-label="Próximo dia" disabled={data >= hoje} onClick={() => setData(somarDias(data, 1))}>›</button>
      </header>
      {ehHoje && <div className="selo-xp">{`LV ${nv.nivel} · ${fmt(xp)} XP`}</div>}

      <div className="bloco">
        <BarraEnergia consumido={consumido} meta={meta} />
        <p className="detalhe">
          comido <strong data-testid="consumido">{Math.round(consumido)}</strong> ·
          gasto <strong data-testid="gasto">{Math.round(gasto)}</strong> ·
          treino <strong>{Math.round(kcalTreinos)}</strong>
        </p>
      </div>

      {aviso && <p className="aviso" role="status">{aviso}</p>}

      {ehHoje && (
        <>
          <div className="bloco grade">
            <div><div className="rotulo">Sequência</div><span className="num acento" data-testid="sequencia">{p.sequencia}</span> <span className="suave">recorde <span data-testid="recorde">{p.recorde}</span></span></div>
            <div><div className="rotulo">Média 7 dias</div><span className="num" data-testid="media7">{saldo(p.media7)}</span></div>
            <div><div className="rotulo">Ontem</div><span className="num" data-testid="ontem">{saldo(p.ontem)}</span></div>
            <div><div className="rotulo">Registros</div><span className="num" data-testid="registros">{p.registros14}/14</span></div>
          </div>

          {fechamento && <p className="bloco fechamento" data-testid="fechamento">{fechamento}</p>}

          <div className="bloco">
            <div className="rotulo">Conquistas</div>
            <div className="selos">
              {cs.filter((c) => c.desbloqueada).slice(-3).map((c) => (
                <span key={c.id} className="selo on" title={c.nome}><Icone nome={c.icone} /></span>
              ))}
              {proxima && <span className="selo apagado" title={proxima.nome}><Icone nome={proxima.icone} /></span>}
            </div>
            {proxima && <p className="suave">Próxima: {proxima.nome}, {textoFalta(proxima)}</p>}
          </div>
        </>
      )}

      <div className="bloco">
        {TIPOS_REFEICAO.map((tipo) => {
          const itens = refeicoes.filter((r) => r.tipo === tipo)
          const total = itens.reduce((s, r) => s + r.kcal, 0)
          return (
            <div key={tipo} className="refeicao">
              <div className="refeicao-topo">
                <Icone nome={tipo} className="acento" />
                <h2>{NOMES_REFEICAO[tipo]}</h2>
                {total > 0 && <span className="kcal">{Math.round(total)}</span>}
                <button
                  className="mais" aria-label={`Adicionar em ${NOMES_REFEICAO[tipo]}`}
                  onClick={() => setAdicionando({ tipo, data: dataParaRefeicao(tipo, data) })}
                >+</button>
              </div>
              {itens.map((r) => (
                <div key={r.id} className="item">
                  <span>{r.nome} <small>{r.gramas} g</small></span>
                  <span>{Math.round(r.kcal)}</span>
                  <button aria-label={`Remover ${r.nome}`} onClick={async () => { await removerRefeicao(banco, r.id); mudou() }}>×</button>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </section>
  )
}
