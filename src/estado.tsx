import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import type { Banco } from './db/banco'

interface Estado {
  banco: Banco
  /** Muda sempre que algo é gravado — telas usam para recarregar. */
  versao: number
  mudou: () => void
}

const Ctx = createContext<Estado | null>(null)

export function ProvedorBanco({ banco, children }: { banco: Banco; children: ReactNode }) {
  const [versao, setVersao] = useState(0)
  const mudou = useCallback(() => setVersao((v) => v + 1), [])
  return <Ctx.Provider value={{ banco, versao, mudou }}>{children}</Ctx.Provider>
}

export function useBanco(): Estado {
  const e = useContext(Ctx)
  if (!e) throw new Error('useBanco fora do ProvedorBanco')
  return e
}
