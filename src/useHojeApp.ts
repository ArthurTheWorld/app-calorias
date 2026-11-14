import { useEffect, useState } from 'react'
import { hojeApp } from './calc/datas'

/**
 * "Hoje" do app que se atualiza sozinho: ao voltar para o app (visibilidade/foco)
 * e a cada minuto. Assim um app deixado aberto de noite acorda no dia certo depois das 05:00.
 */
export function useHojeApp(): string {
  const [hoje, setHoje] = useState(hojeApp)
  useEffect(() => {
    const atualizar = () => setHoje(hojeApp())
    document.addEventListener('visibilitychange', atualizar)
    window.addEventListener('focus', atualizar)
    const t = setInterval(atualizar, 60_000)
    return () => {
      document.removeEventListener('visibilitychange', atualizar)
      window.removeEventListener('focus', atualizar)
      clearInterval(t)
    }
  }, [])
  return hoje
}
