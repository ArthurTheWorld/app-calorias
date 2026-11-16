import { gravarBytes, lerSeqLocal, type Banco } from '../db/banco'
import { validarBancoImportado } from '../exportar'
import { decidir } from './decidir'
import type { ClienteDrive } from './drive'
import { gravarEstadoSync, lerEstadoSync } from './estado'

export type Resultado = { tipo: 'criado' | 'enviado' | 'baixado' | 'conflito' | 'sumiu' | 'nada' }
/** Escolha do usuário: lado do conflito, ou recriar o arquivo que sumiu do Drive. */
export type Escolha = 'drive' | 'celular' | 'recriar'

/**
 * Uma rodada de sincronização.
 * - 'baixado': o banco novo já está no aparelho, o `banco` em memória foi congelado; quem chamou recarrega.
 * - 'conflito': nada muda até o usuário escolher o lado.
 * - 'sumiu': o arquivo conhecido não existe mais no Drive; só recria com 'recriar' (evita duas cópias).
 */
export async function sincronizar(banco: Banco, cliente: ClienteDrive, escolha?: Escolha): Promise<Resultado> {
  const estado = await lerEstadoSync()
  const remoto = estado.fileId ? await cliente.meta(estado.fileId) : await cliente.procurar()
  if (remoto === null && estado.fileId !== null && escolha !== 'recriar') return { tipo: 'sumiu' }
  const seqLocal = await lerSeqLocal()
  let acao = decidir({ remoto, estado, seqLocal })
  if (acao === 'conflito' && (escolha === 'drive' || escolha === 'celular')) acao = escolha === 'drive' ? 'baixar' : 'enviar'
  const agora = () => new Date().toISOString()

  switch (acao) {
    case 'nada':
      await gravarEstadoSync({ fileId: remoto!.id, ultima: agora() })
      return { tipo: 'nada' }
    case 'conflito':
      return { tipo: 'conflito' }
    case 'criar':
    case 'enviar': {
      // O contador é lido antes de exportar: gravações durante o envio ficam pendentes.
      const dados = banco.exportar()
      const r = acao === 'criar' ? await cliente.criar(dados) : await cliente.atualizar(remoto!.id, dados)
      await gravarEstadoSync({ fileId: r.id, versaoRemota: r.version, seqSincronizado: seqLocal, ultima: agora() })
      return { tipo: acao === 'criar' ? 'criado' : 'enviado' }
    }
    case 'baixar': {
      const dados = await cliente.baixar(remoto!.id)
      if (!(await validarBancoImportado(dados))) throw new Error('O arquivo do Drive não é um backup deste app.')
      // Gravou algo no celular enquanto baixava: não sobrescreve, pergunta.
      if ((await lerSeqLocal()) !== seqLocal) return { tipo: 'conflito' }
      banco.congelar()
      await gravarBytes(dados)
      await gravarEstadoSync({ fileId: remoto!.id, versaoRemota: remoto!.version, seqSincronizado: await lerSeqLocal(), ultima: agora() })
      return { tipo: 'baixado' }
    }
  }
}
