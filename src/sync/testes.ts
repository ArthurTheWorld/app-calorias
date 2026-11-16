// Ajudantes de teste da sincronização.
import { abrirBanco } from '../db/banco'
import type { ClienteDrive, Remoto } from './drive'

export const TREINO = { data: '2026-11-16', tipo: 'Musculação', duracaoMin: 45, kcal: 300 }
/** Drive em memória: um arquivo só, versão sobe a cada escrita. */
export function driveFalso() {
  const d = {
    arquivo: null as { id: string; version: number; dados: Uint8Array } | null,
    antesDeGravar: null as null | (() => Promise<void>),
    meta: (r: { id: string; version: number }): Remoto => ({ id: r.id, version: String(r.version) }),
    /** Simula o PC gravando por cima pelo Drive para computador. */
    gravarPeloPc(dados: Uint8Array) { d.arquivo = { id: d.arquivo!.id, version: d.arquivo!.version + 1, dados } },
  }
  const cliente: ClienteDrive = {
    procurar: async () => (d.arquivo ? d.meta(d.arquivo) : null),
    meta: async (id) => (d.arquivo?.id === id ? d.meta(d.arquivo) : null),
    baixar: async (id) => { if (d.arquivo?.id !== id) throw new Error('404'); return d.arquivo.dados },
    criar: async (dados) => { await d.antesDeGravar?.(); d.arquivo = { id: 'f1', version: 1, dados }; return d.meta(d.arquivo) },
    atualizar: async (id, dados) => {
      await d.antesDeGravar?.()
      if (d.arquivo?.id !== id) throw new Error('404')
      d.arquivo = { id, version: d.arquivo.version + 1, dados }
      return d.meta(d.arquivo)
    },
  }
  return { d, cliente }
}

/** O PC edita o arquivo sem passar pelo IndexedDB do aparelho. */
export async function editadoNoPc(dados: Uint8Array, t: typeof TREINO): Promise<Uint8Array> {
  const pc = await abrirBanco(dados)
  pc.db.run('INSERT INTO treinos (data, tipo, duracao_min, kcal) VALUES (?, ?, ?, ?)', [t.data, t.tipo, t.duracaoMin, t.kcal])
  return pc.exportar()
}
