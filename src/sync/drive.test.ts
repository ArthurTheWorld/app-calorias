import { expect, test } from 'vitest'
import { clienteDrive, ErroDrive } from './drive'

type Chamada = { url: string; init: RequestInit }
function fetchFalso(respostas: (Response | (() => Response))[]) {
  const chamadas: Chamada[] = []
  const f = (async (url: string, init: RequestInit = {}) => {
    chamadas.push({ url, init })
    const r = respostas.shift()
    if (!r) throw new Error(`chamada inesperada: ${url}`)
    return typeof r === 'function' ? r() : r
  }) as unknown as typeof fetch
  return { f, chamadas }
}
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status })
const auth = (c: Chamada) => (c.init.headers as Record<string, string>).Authorization

test('procurar busca pelo nome do arquivo com o token', async () => {
  const { f, chamadas } = fetchFalso([json({ files: [{ id: 'f1', headRevisionId: 'r4' }] })])
  expect(await clienteDrive('tok', f).procurar()).toEqual({ id: 'f1', version: 'r4' })
  expect(decodeURIComponent(chamadas[0].url)).toContain("name = 'app-calorias.sqlite' and trashed = false")
  expect(auth(chamadas[0])).toBe('Bearer tok')
})

test('procurar sem resultado devolve null', async () => {
  const { f } = fetchFalso([json({ files: [] })])
  expect(await clienteDrive('tok', f).procurar()).toBeNull()
})

test('meta: 404 ou lixeira viram null; outro erro sobe', async () => {
  const { f } = fetchFalso([json({}, 404), json({ id: 'f1', headRevisionId: 'r2', trashed: true }), json({ id: 'f1', headRevisionId: 'r2', trashed: false }), json({}, 500)])
  const c = clienteDrive('tok', f)
  expect(await c.meta('f1')).toBeNull()
  expect(await c.meta('f1')).toBeNull()
  expect(await c.meta('f1')).toEqual({ id: 'f1', version: 'r2' })
  await expect(c.meta('f1')).rejects.toBeInstanceOf(ErroDrive)
})

test('criar usa a pasta existente e envia multipart', async () => {
  const { f, chamadas } = fetchFalso([json({ files: [{ id: 'pasta1' }] }), json({ id: 'f1', headRevisionId: 'r1' })])
  expect(await clienteDrive('tok', f).criar(new Uint8Array([1, 2]))).toEqual({ id: 'f1', version: 'r1' })
  expect(chamadas[1].url).toContain('upload/drive/v3/files?uploadType=multipart')
  expect(chamadas[1].init.method).toBe('POST')
  const tipo = (chamadas[1].init.headers as Record<string, string>)['Content-Type']
  expect(tipo).toMatch(/^multipart\/related; boundary=/)
  const corpo = await (chamadas[1].init.body as Blob).text()
  expect(corpo).toContain('"name":"app-calorias.sqlite"')
  expect(corpo).toContain('"parents":["pasta1"]')
  expect(corpo).toContain(`--${tipo.split('boundary=')[1]}--`)
})

test('criar cria a pasta App Calorias quando falta', async () => {
  const { f, chamadas } = fetchFalso([json({ files: [] }), json({ id: 'pasta9' }), json({ id: 'f1', headRevisionId: 'r1' })])
  await clienteDrive('tok', f).criar(new Uint8Array([1]))
  expect(JSON.parse(chamadas[1].init.body as string)).toEqual({ name: 'App Calorias', mimeType: 'application/vnd.google-apps.folder' })
  expect(await (chamadas[2].init.body as Blob).text()).toContain('"parents":["pasta9"]')
})

test('atualizar manda PATCH no mesmo id; baixar devolve os bytes', async () => {
  const { f, chamadas } = fetchFalso([json({ id: 'f1', headRevisionId: 'r5' }), new Response(new Uint8Array([7, 8, 9]))])
  const c = clienteDrive('tok', f)
  expect(await c.atualizar('f1', new Uint8Array([3]))).toEqual({ id: 'f1', version: 'r5' })
  expect(chamadas[0].url).toContain('upload/drive/v3/files/f1?uploadType=media')
  expect(chamadas[0].init.method).toBe('PATCH')
  expect(await c.baixar('f1')).toEqual(new Uint8Array([7, 8, 9]))
  expect(chamadas[1].url).toContain('files/f1?alt=media')
})

test('compara pela revisão do conteúdo (headRevisionId), não pelo version geral', async () => {
  const { f, chamadas } = fetchFalso([json({ id: 'f1', headRevisionId: 'r9', trashed: false })])
  await clienteDrive('tok', f).meta('f1')
  expect(chamadas[0].url).toContain('fields=id,headRevisionId,trashed')
})
