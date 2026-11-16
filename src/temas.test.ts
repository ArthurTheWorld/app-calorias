import { beforeEach, expect, test } from 'vitest'
import { aplicarTema, escolherTema, temaSalvo, TEMAS } from './temas'

const acento = () => document.documentElement.style.getPropertyValue('--acento')
beforeEach(() => {
  localStorage.clear()
  document.documentElement.style.removeProperty('--acento')
})

test('cinco temas, roxo primeiro, cores da spec', () => {
  expect(TEMAS.map((t) => [t.id, t.nome, t.acento])).toEqual([
    ['roxo', 'Roxo', '#c77dff'],
    ['verde', 'Verde', '#5cf08a'],
    ['rosa', 'Rosa neon', '#ff4fd8'],
    ['vermelho', 'Vermelho', '#ff5a5a'],
    ['laranja', 'Laranja', '#ff9f43'],
  ])
})

test('sem escolha salva: roxo; escolher grava e aplica na hora', () => {
  expect(temaSalvo()).toBe('roxo')
  escolherTema('verde')
  expect(temaSalvo()).toBe('verde')
  expect(acento()).toBe('#5cf08a')
})

test('aplicarTema usa o salvo; valor desconhecido ou armazenamento quebrado volta ao roxo', () => {
  localStorage.setItem('tema', 'laranja')
  aplicarTema()
  expect(acento()).toBe('#ff9f43')
  localStorage.setItem('tema', 'azul-que-nao-existe')
  aplicarTema()
  expect(acento()).toBe('#c77dff')
})
