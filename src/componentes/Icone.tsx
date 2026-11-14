import type { NomeIcone } from '../calc/conquistas'

const TRACOS: Record<NomeIcone, string[]> = {
  cafe: ['M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z', 'M16 11h2a2 2 0 0 1 0 4h-2', 'M8 3v3M12 3v3'],
  almoco: ['M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8', 'M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5'],
  lanche: ['M3 18h18', 'M7 18a5 5 0 0 1 10 0', 'M12 7v3M5 11l1.5 1.5M19 11l-1.5 1.5'],
  jantar: ['M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z'],
  madrugada: ['M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6'],
  estrela: ['M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z'],
  chama: ['M12 21a6 6 0 0 0 6-6c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-3-2 2-3 4-3 7a6 6 0 0 0 6 6z'],
  calendario: ['M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', 'M3 10h18M8 3v4M16 3v4'],
  trofeu: ['M8 4h8v5a4 4 0 0 1-8 0z', 'M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8'],
  haltere: ['M6 8v8M3 10v4M18 8v8M21 10v4M6 12h12'],
  hoje: ['M12 3a9 9 0 1 0 9 9', 'M12 7v5l3 2'],
  perfil: ['M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8', 'M4 21a8 8 0 0 1 16 0'],
}

/** Ícone de linha; herda a cor do texto. */
export function Icone({ nome, className }: { nome: NomeIcone; className?: string }) {
  return (
    <svg
      className={`icone${className ? ` ${className}` : ''}`} viewBox="0 0 24 24" width="18" height="18"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden
    >
      {TRACOS[nome].map((d) => <path key={d} d={d} />)}
    </svg>
  )
}
