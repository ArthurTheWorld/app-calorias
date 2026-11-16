import { gravarBytes, lerSeqLocal, type Banco } from '../db/banco'
import { validarBancoImportado } from '../exportar'
import { decidir } from './decidir'
import type { ClienteDrive } from './drive'
import { gravarEstadoSync, lerEstadoSync } from './estado'

export type Resultado = { tipo: 'criado' | 'enviado' | 'baixado' | 'conflito' | 'nada' }

/**
 * Uma rodada de sincronização. Em 'baixado', o banco novo já está gravado no aparelho
 * e quem chamou precisa recarregar o app. Em 'conflito', nada muda até `resolver`.
 */
export async function sincronizar(banco: Banco, cliente: ClienteDrive, resolver?: 'drive' | 'celular'): Promise<Resultado> {
  const estado = await lerEstadoSync()
  const remoto = estado.fileId ? await cliente.meta(estado.fileId) : await cliente.procurar()
  const seqLocal = await lerSeqLocal()
  let acao = decidir({ remoto, estado, seqLocal })
  if (acao === 'conflito' && resolver) acao = resolver === 'drive' ? 'baixar' : 'enviar'
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
      await gravarBytes(dados)
      await gravarEstadoSync({ fileId: remoto!.id, versaoRemota: remoto!.version, seqSincronizado: await lerSeqLocal(), ultima: agora() })
      return { tipo: 'baixado' }
    }
  }
}
