# Calorias

App pessoal de contagem de calorias (PWA para Android), inspirado no Yazio.

- Registro de refeições com a base TACO (Unicamp) + alimentos próprios
- Gasto diário (Mifflin-St Jeor × 1,2 + treinos) e meta de déficit (nunca abaixo do basal)
- Treinos com estimativa por MET
- Histórico: calendário mensal, sequência de dias em déficit, resumo por mês
- Banco SQLite no próprio celular, exportável (`.sqlite` e CSV) e importável como backup

## Rodar

```bash
npm install
npm run dev      # http://localhost:5173/app-calorias/
npx vitest run   # testes
npm run build    # gera dist/
```

Dados da TACO: `data/TACO.json` (via github.com/marcelosanto/tabela_taco, MIT) → `node scripts/gerar-taco.ts` → `public/taco.json`.

Deploy: push na `main` publica no GitHub Pages (`.github/workflows/deploy.yml`).
No Android: abrir o link no Chrome → menu ⋮ → "Instalar app".
