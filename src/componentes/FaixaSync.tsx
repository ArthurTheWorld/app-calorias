import { useSync } from '../sync/useSync'

/** Faixa discreta no topo: pedido de toque, pergunta de conflito e avisos da sincronização. */
export function FaixaSync() {
  const s = useSync()
  if (!s.ativo) return null
  if (s.conflito) {
    return (
      <div className="faixa-sync" role="status">
        <p>O Drive e o celular mudaram desde a última sincronização. Qual versão manter?</p>
        <div className="botoes">
          <button disabled={s.ocupado} onClick={() => s.resolver('drive')}>Usar a do Drive</button>
          <button className="secundario" disabled={s.ocupado} onClick={() => s.resolver('celular')}>Manter a do celular</button>
        </div>
      </div>
    )
  }
  if (s.sumiu) {
    return (
      <div className="faixa-sync" role="status">
        <p>Não achei o arquivo do app no Drive.</p>
        <button className="discreto" disabled={s.ocupado} onClick={() => s.recriar()}>Criar de novo no Drive</button>
      </div>
    )
  }
  if (s.precisaToque) {
    return (
      <div className="faixa-sync">
        {s.msg && <p role="status">{s.msg}</p>}
        <button className="discreto" disabled={s.ocupado} onClick={() => s.sincronizarAgora()}>Drive: toque para sincronizar</button>
      </div>
    )
  }
  if (s.msg) return <div className="faixa-sync" role="status"><p>{s.msg}</p></div>
  return null
}
