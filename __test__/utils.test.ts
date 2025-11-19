import { parseAccept } from '../src/utils.ts'
import { describe, it, expect } from '@jest/globals'
describe('parseAccept Comprehensive Tests', () => {
  describe('Basic Functionality', () => {
    it('parses simple accept header', () => {
      const header = 'text/html,application/json;q=0.9'
      expect(parseAccept(header)).toEqual([
        { type: 'text/html', params: {}, q: 1 },
        { type: 'application/json', params: { q: '0.9' }, q: 0.9 },
      ])
    })

    it('handles missing header', () => {
      expect(parseAccept('')).toEqual([])

      expect(parseAccept(undefined as any)).toEqual([])

      expect(parseAccept(null as any)).toEqual([])
    })
  })

  describe('Quality Values', () => {
    it('handles extreme q values', () => {
      const header = 'a;q=999999,b;q=-99999,c;q=Infinity,d;q=-Infinity,e;q=NaN'
      const result = parseAccept(header)
      expect(result.map((x) => x.q)).toEqual([1, 1, 1, 0, 0])
    })

    it('handles malformed q values', () => {
      const header = 'a;q=,b;q=invalid,c;q=1.2.3,d;q=true,e;q="0.5"'
      const result = parseAccept(header)
      expect(result.every((x) => x.q >= 0 && x.q <= 1)).toBe(true)
    })

    it('treats empty q value as default quality', () => {
      const header = 'type;q='
      const result = parseAccept(header)
      expect(result[0].params.q).toBe('')
      expect(result[0].q).toBe(1)
    })

    it('preserves original q string in params', () => {
      const header = 'type;q=invalid'
      const result = parseAccept(header)
      expect(result[0].params.q).toBe('invalid')
      expect(result[0].q).toBe(1) // Normalized q value
    })
  })

  describe('Parameter Handling', () => {
    it('handles complex parameters', () => {
      const header = 'type;a=1;b="2";c=\'3\';d="semi;colon";e="nested"quoted""'
      const result = parseAccept(header)
      expect(result[0].params).toEqual({
        a: '1',
        b: '"2"',

        c: "'3'",
        d: '"semi;colon"',
        e: '"nested"quoted""',
      })
    })

    it('handles malformed parameters', () => {
      const header = 'type;=value;;key=;=;====;key====value'
      const result = parseAccept(header)
      expect(result[0].type).toBe('type')
      expect(Object.keys(result[0].params).length).toBe(1)
      expect(result[0].params.key).toBe('')
    })

    it('handles duplicate parameters', () => {
      const header = 'type;key=1;key=2;KEY=3'
      const result = parseAccept(header)
      expect(result[0].params.key).toBe('2')
      expect(result[0].params.KEY).toBe('3')
    })
  })

  describe('Media Type Edge Cases', () => {
    it('handles malformed media types', () => {
      const headers = [
        '*/html',
        'text/*mal/formed',
        '/partial',
        'missing/',
        'inv@lid/type',
        'text/(html)',
        'text/html?invalid',
      ]
      headers.forEach((header) => {
        const result = parseAccept(header)
        expect(result[0].type).toBe(header)
      })
    })

    it('handles extremely long types', () => {
      const longType = 'a'.repeat(10000) + '/' + 'b'.repeat(10000)
      const result = parseAccept(longType)
      expect(result[0].type).toBe(longType)
    })
  })

  describe('Delimiter Edge Cases', () => {
    it('handles multiple consecutive delimiters', () => {
      const header = 'a,,,,b;q=0.9,,,,c;q=0.8,,,,'
      const result = parseAccept(header)
      expect(result.map((x) => x.type)).toEqual(['a', 'b', 'c'])
    })

    it('handles unusual whitespace', () => {
      const header = '\n\t a \t\n ; \n\t q=0.9 \t\n , \n\t b \t\n'
      const result = parseAccept(header)
      expect(result.map((x) => x.type)).toEqual(['b', 'a'])
    })
  })

  describe('Security Cases', () => {
    it('handles potential injection patterns', () => {
      const headers = [
        'type;q=0.9--',
        'type;q=0.9;drop table users',
        'type;__|;q=0.9',
        'text/html"><script>alert(1)</script>',
        // eslint-disable-next-line no-template-curly-in-string
        'application/json${process.env}',
      ]
      headers.forEach((header) => {
        expect(() => parseAccept(header)).not.toThrow()
      })
    })

    it('handles extremely large input', () => {
      const header = 'a;q=0.9,'.repeat(100000)
      expect(() => parseAccept(header)).not.toThrow()
    })
  })

  describe('Unicode and Special Characters', () => {
    it('handles unicode in types and parameters', () => {
      const header = '🌐/😊;param=🔥;q=0.9'
      const result = parseAccept(header)
      expect(result[0].type).toBe('🌐/😊')
      expect(result[0].params.param).toBe('🔥')
    })

    it('handles special characters', () => {
      const header = 'type;param=\x00\x01\x02\x03'
      const result = parseAccept(header)
      expect(result[0].params.param).toBe('\x00\x01\x02\x03')
    })
  })

  describe('Sort Stability', () => {
    it('maintains stable sort for equal q values', () => {
      const header = 'a;q=0.9,b;q=0.9,c;q=0.9,d;q=0.9'
      const result = parseAccept(header)
      expect(result.map((x) => x.type)).toEqual(['a', 'b', 'c', 'd'])
    })

    it('handles mixed priorities correctly', () => {
      const header = 'd;q=0.8,b;q=0.9,c;q=0.8,a;q=0.9'
      const result = parseAccept(header)
      expect(result.map((x) => x.type)).toEqual(['b', 'a', 'd', 'c'])
    })
  })
})
