/** Read-only evaluation of the small arithmetic subset used by BOQ weights.
 * Never runs JavaScript, external workbooks, or arbitrary Excel functions.
 */
export function weightValues(cells: Map<string, Element>, read: (cell: Element | undefined) => string) {
  const cache = new Map<string, number>(), visiting = new Set<string>()
  function value(address: string): number {
    address = address.replaceAll('$', '')
    const saved = cache.get(address)
    if (saved !== undefined) return saved
    if (visiting.has(address) || visiting.size >= 128) throw new Error('Cyclic or overly deep weight formula.')
    const cell = cells.get(address)
    if (!cell) throw new Error('Missing weight input.')
    visiting.add(address)
    try {
      const formula = cell.getElementsByTagNameNS('*', 'f')[0]
      let result: number
      if (formula) {
        const source = formula.textContent ?? ''
        if (source.length > 10000) throw new Error('Weight formula is too long.')
        if (source.includes('!')) {
          // BOQ-weighted workbooks (BP02) pull unit-rate totals from a Weights sheet. Only the saved result of that
          // one cross-sheet cell is used; every other formula is still evaluated here, and the result is still compared
          // with the project's stored weights.
          const saved = read(cell)
          if (!saved.trim() || ![null, 'n'].includes(cell.getAttribute('t'))) throw new Error('Weight depends on a sheet without a saved value.')
          result = Number(saved)
          if (!Number.isFinite(result)) throw new Error('Invalid weight result.')
          cache.set(address, result)
          return result
        }
        const tokens = source.match(/\$?[A-Z]+\$?\d+|(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?|[A-Z]+|[+*/(),-]|\s+/g) ?? []
        if (tokens.join('') !== source) throw new Error('Unsupported weight formula.')
        const input = tokens.filter(t => !/^\s+$/.test(t)); let pos = 0, depth = 0
        const take = (token: string) => { if (input[pos++] !== token) throw new Error('Invalid weight formula.') }
        function atom(): number {
          if (++depth > 128) throw new Error('Weight formula is too deep.')
          try {
            const token = input[pos++]
            if (token === '+' || token === '-') return (token === '-' ? -1 : 1) * atom()
            if (token === '(') { const n = expression(); take(')'); return n }
            if (token === 'SUM' || token === 'IFERROR') {
              take('('); const args = [expression()]
              while (input[pos] === ',') { pos++; args.push(expression()) }
              take(')')
              if (token === 'SUM') return args.reduce((a, b) => a + b, 0)
              if (args.length !== 2) throw new Error('Invalid IFERROR weight formula.')
              return Number.isFinite(args[0]!) ? args[0]! : args[1]!
            }
            if (token && /^\$?[A-Z]+\$?\d+$/.test(token)) return value(token)
            if (token && /^(?:\d|\.)/.test(token)) return Number(token)
            throw new Error('Unsupported weight formula.')
          } finally { depth-- }
        }
        function product(): number {
          let n = atom()
          while (input[pos] === '*' || input[pos] === '/') { const op = input[pos++]; const b = atom(); n = op === '*' ? n * b : n / b }
          return n
        }
        function expression(): number {
          let n = product()
          while (input[pos] === '+' || input[pos] === '-') { const op = input[pos++]; const b = product(); n = op === '+' ? n + b : n - b }
          return n
        }
        result = expression()
        if (pos !== input.length) throw new Error('Unsupported weight formula.')
      } else {
        const raw = read(cell)
        if (!raw.trim() || ![null, 'n'].includes(cell.getAttribute('t'))) throw new Error('Invalid numeric weight input.')
        result = Number(raw)
      }
      if (!Number.isFinite(result)) throw new Error('Invalid weight result.')
      cache.set(address, result)
      return result
    } finally { visiting.delete(address) }
  }
  return value
}
