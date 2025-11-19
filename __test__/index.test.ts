import { Hoa } from 'hoa'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { language, normalizeLanguage, detectors, DEFAULT_OPTIONS } from '../src/index'
import { tinyRouter } from '@hoajs/tiny-router'
import { cookie } from '@hoajs/cookie'

describe('Language middleware', () => {
  it('should throw error when cookie plugin is not used', async () => {
    const app = new Hoa()
    app.extend(tinyRouter())
    app.use(language({
      supportedLanguages: ['en', 'fr', 'es'],
      fallbackLanguage: 'en'
    }))
    app.get('/error', ctx => {
      ctx.res.body = 'error'
    })
    const res = await app.fetch(new Request('http://localhost/error/?lang=fr'))
    expect(res.status).toBe(500)
  })
})

describe('default options', () => {
  it('should allow calling language without options', () => {
    const mw = language()
    expect(typeof mw).toBe('function')
  })
})

describe('Language middleware', () => {
  let app: Hoa

  beforeEach(() => {
    app = new Hoa()
    app.extend(tinyRouter())
    app.extend(cookie())
  })

  describe('Query Parameter Detection', () => {
    beforeEach(() => {
      app.get('/test', language({
        supportedLanguages: ['en', 'fr', 'es'],
        fallbackLanguage: 'en',
      }), (ctx) => {
        ctx.res.body = ctx.language
      })
    })

    it('should detect language from query parameter', async () => {
      const res = await app.fetch(new Request('http://localhost/test/?lang=fr'))
      expect(await res.text()).toBe('fr')
    })

    it('should ignore unsupported languages in query', async () => {
      const res = await app.fetch(new Request('http://localhost/test/?lang=de'))
      expect(await res.text()).toBe('en')
    })

    it('should handle empty query parameter', async () => {
      const res = await app.fetch(new Request('http://localhost/test/?lang='))
      expect(await res.text()).toBe('en')
    })

    it('should handle whitespace in query parameter', async () => {
      const res = await app.fetch(new Request('http://localhost/test/?lang= fr '))
      expect(await res.text()).toBe('fr')
    })

    it('should use custom query parameter name', async () => {
      app.get('/custom', language({
        supportedLanguages: ['en', 'fr', 'es'],
        fallbackLanguage: 'en',
        lookupQueryString: 'locale'
      }), (ctx) => {
        ctx.res.body = ctx.language
      })

      const res = await app.fetch(new Request('http://localhost/custom/?locale=es'))
      expect(await res.text()).toBe('es')
    })

    it('should be case sensitive when ignoreCase is false', async () => {
      app.get('/case-sensitive', language({
        supportedLanguages: ['en', 'FR', 'es'],
        fallbackLanguage: 'en',
        ignoreCase: false
      }), (ctx) => {
        ctx.res.body = ctx.language
      })

      const res = await app.fetch(new Request('http://localhost/case-sensitive/?lang=FR'))
      expect(await res.text()).toBe('FR')

      const res2 = await app.fetch(new Request('http://localhost/case-sensitive/?lang=fr'))
      expect(await res2.text()).toBe('en')
    })
  })

  describe('Cookie Detection', () => {
    beforeEach(() => {
      app.get('/test', language({
        supportedLanguages: ['en', 'fr', 'es'],
        fallbackLanguage: 'en',
        order: ['cookie']
      }), (ctx) => {
        ctx.res.body = ctx.language
      })
    })

    it('should detect language from cookie', async () => {
      const req = new Request('http://localhost/test/')
      req.headers.set('Cookie', 'language=fr')
      const res = await app.fetch(req)
      expect(await res.text()).toBe('fr')
    })

    it('should ignore unsupported languages in cookie', async () => {
      const req = new Request('http://localhost/test/')
      req.headers.set('Cookie', 'language=de')
      const res = await app.fetch(req)
      expect(await res.text()).toBe('en')
    })

    it('should use custom cookie name', async () => {
      app.get('/custom', language({
        supportedLanguages: ['en', 'fr', 'es'],
        fallbackLanguage: 'en',
        order: ['cookie'],
        lookupCookie: 'locale'
      }), (ctx) => {
        ctx.res.body = ctx.language
      })

      const req = new Request('http://localhost/custom/')
      req.headers.set('Cookie', 'locale=es')
      const res = await app.fetch(req)
      expect(await res.text()).toBe('es')
    })

    it('should handle missing cookie', async () => {
      const res = await app.fetch(new Request('http://localhost/test/'))
      expect(await res.text()).toBe('en')
    })

    it('should handle empty cookie value', async () => {
      const req = new Request('http://localhost/test/')
      req.headers.set('Cookie', 'language=')
      const res = await app.fetch(req)
      expect(await res.text()).toBe('en')
    })

    it('should handle whitespace in cookie value', async () => {
      const req = new Request('http://localhost/test/')
      req.headers.set('Cookie', 'language= fr ')
      const res = await app.fetch(req)
      expect(await res.text()).toBe('fr')
    })
  })

  describe('Header Detection', () => {
    beforeEach(() => {
      app.get('/test', language({
        supportedLanguages: ['en', 'fr', 'es', 'de'],
        fallbackLanguage: 'en',
        order: ['header']
      }), (ctx) => {
        ctx.res.body = ctx.language
      })
    })

    it('should detect language from Accept-Language header', async () => {
      const req = new Request('http://localhost/test/')
      req.headers.set('Accept-Language', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7')
      const res = await app.fetch(req)
      expect(await res.text()).toBe('fr')
    })

    it('should handle whitespace in Accept-Language header', async () => {
      const req = new Request('http://localhost/test/')
      req.headers.set('Accept-Language', ' fr-FR , fr;q=0.9 , en-US;q=0.8 ')
      const res = await app.fetch(req)
      expect(await res.text()).toBe('fr')
    })

    it('should handle multiple languages with quality values', async () => {
      const req = new Request('http://localhost/test/')
      req.headers.set('Accept-Language', 'de;q=0.9,fr;q=0.8,en;q=0.7')
      const res = await app.fetch(req)
      expect(await res.text()).toBe('de')
    })

    it('should ignore unsupported languages in header', async () => {
      const req = new Request('http://localhost/test/')
      req.headers.set('Accept-Language', 'it-IT,it;q=0.9,pt;q=0.8')
      const res = await app.fetch(req)
      expect(await res.text()).toBe('en')
    })

    it('should handle missing Accept-Language header', async () => {
      const res = await app.fetch(new Request('http://localhost/test/'))
      expect(await res.text()).toBe('en')
    })

    it('should use custom header key', async () => {
      app.get('/custom', language({
        supportedLanguages: ['en', 'fr', 'es'],
        fallbackLanguage: 'en',
        order: ['header'],
        lookupFromHeaderKey: 'x-language'
      }), (ctx) => {
        ctx.res.body = ctx.language
      })

      const req = new Request('http://localhost/custom/')
      req.headers.set('x-language', 'es')
      const res = await app.fetch(req)
      expect(await res.text()).toBe('es')
    })

    it('should handle malformed Accept-Language header', async () => {
      const req = new Request('http://localhost/test/')
      req.headers.set('Accept-Language', 'invalid-header')
      const res = await app.fetch(req)
      expect(await res.text()).toBe('en')
    })
  })

  describe('Path Detection', () => {
    beforeEach(() => {
      app.get('/:lang/test', language({
        supportedLanguages: ['en', 'fr', 'es'],
        fallbackLanguage: 'en',
        order: ['path']
      }), (ctx) => {
        ctx.res.body = ctx.language
      })
    })

    it('should detect language from URL path', async () => {
      const res = await app.fetch(new Request('http://localhost/fr/test'))
      expect(await res.text()).toBe('fr')
    })

    it('should ignore unsupported languages in path', async () => {
      const res = await app.fetch(new Request('http://localhost/de/test'))
      expect(await res.text()).toBe('en')
    })

    it('should handle custom path index', async () => {
      app.get('/api/:lang/test', language({
        supportedLanguages: ['en', 'fr', 'es'],
        fallbackLanguage: 'en',
        order: ['path'],
        lookupFromPathIndex: 1
      }), (ctx) => {
        ctx.res.body = ctx.language
      })

      const res = await app.fetch(new Request('http://localhost/api/es/test'))
      expect(await res.text()).toBe('es')
    })

    it('should handle path index out of bounds', async () => {
      app.get('/test', language({
        supportedLanguages: ['en', 'fr', 'es'],
        fallbackLanguage: 'en',
        order: ['path'],
        lookupFromPathIndex: 2
      }), (ctx) => {
        ctx.res.body = ctx.language
      })

      const res = await app.fetch(new Request('http://localhost/test'))
      expect(await res.text()).toBe('en')
    })

    it('should handle empty path segments', async () => {
      app.get('/test', language({
        supportedLanguages: ['en', 'fr', 'es'],
        fallbackLanguage: 'en',
        order: ['path'],
        lookupFromPathIndex: 2
      }), (ctx) => {
        ctx.res.body = ctx.language
      })
      const res = await app.fetch(new Request('http://localhost/test'))
      expect(await res.text()).toBe('en')
    })
  })

  describe('Language Caching', () => {
    it('should cache detected language in cookie when enabled', async () => {
      app.get('/cache', language({
        supportedLanguages: ['en', 'fr', 'es'],
        fallbackLanguage: 'en',
        order: ['querystring'],
        caches: ['cookie']
      }), (ctx) => {
        ctx.res.body = ctx.language
      })

      const res = await app.fetch(new Request('http://localhost/cache/?lang=fr'))
      expect(await res.text()).toBe('fr')
      expect(res.headers.get('Set-Cookie')).toContain('language=fr')
    })

    it('should not cache when caches is disabled', async () => {
      app.get('/no-cache', language({
        supportedLanguages: ['en', 'fr', 'es'],
        fallbackLanguage: 'en',
        order: ['querystring'],
        caches: 'aaa' as any
      }), (ctx) => {
        ctx.res.body = ctx.language
      })

      const res = await app.fetch(new Request('http://localhost/no-cache/?lang=fr'))
      expect(await res.text()).toBe('fr')
      expect(res.headers.get('Set-Cookie')).toBeNull()
    })

    it('should use custom cookie name for caching', async () => {
      app.get('/custom-cache', language({
        supportedLanguages: ['en', 'fr', 'es'],
        fallbackLanguage: 'en',
        order: ['querystring'],
        caches: ['cookie'],
        lookupCookie: 'locale'
      }), (ctx) => {
        ctx.res.body = ctx.language
      })

      const res = await app.fetch(new Request('http://localhost/custom-cache/?lang=es'))
      expect(await res.text()).toBe('es')
      expect(res.headers.get('Set-Cookie')).toContain('locale=es')
    })
  })

  describe('Detector Order and Priority', () => {
    it('should respect detector order priority', async () => {
      app.get('/priority', language({
        supportedLanguages: ['en', 'fr', 'es'],
        fallbackLanguage: 'en',
        order: ['querystring', 'cookie', 'header']
      }), (ctx) => {
        ctx.res.body = ctx.language
      })

      const req = new Request('http://localhost/priority/?lang=fr')
      req.headers.set('Cookie', 'language=es')
      req.headers.set('Accept-Language', 'en')
      const res = await app.fetch(req)
      expect(await res.text()).toBe('fr')
    })

    it('should fallback to next detector when first fails', async () => {
      app.get('/fallback', language({
        supportedLanguages: ['en', 'fr', 'es'],
        fallbackLanguage: 'en',
        order: ['querystring', 'cookie', 'header']
      }), (ctx) => {
        ctx.res.body = ctx.language
      })

      const req = new Request('http://localhost/fallback/?lang=de')
      req.headers.set('Cookie', 'language=fr')
      req.headers.set('Accept-Language', 'en')
      const res = await app.fetch(req)
      expect(await res.text()).toBe('fr')
    })

    it('should use fallback language when all detectors fail', async () => {
      app.get('/all-fail', language({
        supportedLanguages: ['en', 'fr', 'es'],
        fallbackLanguage: 'en',
        order: ['querystring', 'cookie', 'header']
      }), (ctx) => {
        ctx.res.body = ctx.language
      })

      const req = new Request('http://localhost/all-fail/?lang=de')
      req.headers.set('Cookie', 'language=it')
      req.headers.set('Accept-Language', 'pt')
      const res = await app.fetch(req)
      expect(await res.text()).toBe('en')
    })
  })

  describe('normalizeLanguage Function', () => {
    const options = {
      supportedLanguages: ['en', 'fr', 'es'],
      ignoreCase: true,
      fallbackLanguage: 'en'
    } as any

    it('should normalize valid language codes', () => {
      expect(normalizeLanguage('en', options)).toBe('en')
      expect(normalizeLanguage('FR', options)).toBe('fr')
      expect(normalizeLanguage('Es', options)).toBe('es')
    })

    it('should handle null/undefined values', () => {
      expect(normalizeLanguage(null, options)).toBeUndefined()
      expect(normalizeLanguage(undefined, options)).toBeUndefined()
    })

    it('should handle empty strings', () => {
      expect(normalizeLanguage('', options)).toBeUndefined()
      expect(normalizeLanguage('   ', options)).toBeUndefined()
    })

    it('should trim whitespace', () => {
      expect(normalizeLanguage('  fr  ', options)).toBe('fr')
    })

    it('should reject unsupported languages', () => {
      expect(normalizeLanguage('de', options)).toBeUndefined()
      expect(normalizeLanguage('it', options)).toBeUndefined()
    })

    it('should handle array inputs (return undefined)', () => {
      expect(normalizeLanguage(['en', 'fr'], options)).toBeUndefined()
    })

    it('should respect case sensitivity setting', () => {
      const caseSensitiveOptions = {
        ...options,
        ignoreCase: false,
        supportedLanguages: ['en', 'FR', 'es']
      }

      expect(normalizeLanguage('FR', caseSensitiveOptions)).toBe('FR')
      expect(normalizeLanguage('fr', caseSensitiveOptions)).toBeUndefined()
    })

    it('should apply custom language conversion', () => {
      const optionsWithConversion = {
        ...options,
        convertDetectedLanguage: (lang: string) => lang.toUpperCase()
      }

      expect(normalizeLanguage('fr', optionsWithConversion)).toBe('fr')
    })

    it('should handle conversion errors gracefully', () => {
      const optionsWithError = {
        ...options,
        convertDetectedLanguage: () => {
          throw new Error('Conversion error')
        }
      }

      expect(normalizeLanguage('fr', optionsWithError)).toBeUndefined()
    })
  })

  describe('Custom Language Conversion', () => {
    it('should apply custom conversion function', async () => {
      app.get('/convert', language({
        supportedLanguages: ['en', 'fr-FR', 'es-ES'],
        fallbackLanguage: 'en',
        convertDetectedLanguage: (lang) => {
          if (lang === 'fr') return 'fr-FR'
          if (lang === 'es') return 'es-ES'
          return lang
        }
      }), (ctx) => {
        ctx.res.body = ctx.language
      })

      const res = await app.fetch(new Request('http://localhost/convert/?lang=fr'))
      expect(await res.text()).toBe('fr-FR')
    })

    it('should handle conversion function errors', async () => {
      app.get('/convert-error', language({
        supportedLanguages: ['en', 'fr', 'es'],
        fallbackLanguage: 'en',
        convertDetectedLanguage: () => {
          throw new Error('Conversion failed')
        }
      }), (ctx) => {
        ctx.res.body = ctx.language
      })

      const res = await app.fetch(new Request('http://localhost/convert-error/?lang=fr'))
      expect(await res.text()).toBe('en')
    })
  })

  describe('Configuration Validation', () => {
    it('should throw error when fallback language not in supported languages', () => {
      expect(() => {
        language({
          supportedLanguages: ['en', 'fr'],
          fallbackLanguage: 'de'
        })
      }).toThrow('Fallback language must be included in supported languages')
    })

    it('should throw error when path index is negative', () => {
      expect(() => {
        language({
          supportedLanguages: ['en', 'fr'],
          fallbackLanguage: 'en',
          lookupFromPathIndex: -1
        })
      }).toThrow('Path index must be non-negative')
    })

    it('should throw error for invalid detector types', () => {
      expect(() => {
        language({
          supportedLanguages: ['en', 'fr'],
          fallbackLanguage: 'en',
          order: ['invalid' as any]
        })
      }).toThrow('Invalid detector type in order array')
    })
  })

  describe('Error Handling and Debug Mode', () => {
    it('should handle detector errors gracefully', async () => {
      app.get('/error', language({
        supportedLanguages: ['en', 'fr', 'es'],
        fallbackLanguage: 'en',
        debug: true
      }), (ctx) => {
        ctx.res.body = ctx.language
      })

      const res = await app.fetch(new Request('http://localhost/error/?lang=fr'))
      expect(await res.text()).toBe('fr')
    })

    it('should use fallback language when detection fails completely', async () => {
      app.get('/fallback-error', language({
        supportedLanguages: ['en', 'fr', 'es'],
        fallbackLanguage: 'en',
        debug: true
      }), (ctx) => {
        ctx.res.body = ctx.language
      })

      const res = await app.fetch(new Request('http://localhost/fallback-error/'))
      expect(await res.text()).toBe('en')
    })

    it('should log debug messages when debug mode is enabled', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation((message) => { })

      app.get('/debug', language({
        supportedLanguages: ['en', 'fr', 'es'],
        fallbackLanguage: 'en',
        debug: true
      }), (ctx) => {
        ctx.res.body = ctx.language
      })

      await app.fetch(new Request('http://localhost/debug/?lang=fr'))

      expect(consoleSpy).toHaveBeenCalledWith('Language detected from querystring: fr')
      consoleSpy.mockRestore()
    })

    it('should log debug errors when detectors fail', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { })

      const middleware = language({
        supportedLanguages: ['en', 'fr', 'es'],
        fallbackLanguage: 'en',
        debug: true,
        order: ['header']
      })

      const ctx = {
        req: {
          query: {},
          get: () => {
            throw new Error('Detector failed')
          },
          getCookie: async () => undefined,
          pathname: '/'
        },
        res: {
          setCookie: async () => { }
        },
        throw: jest.fn()
      } as any

      await middleware(ctx, async () => { })

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('should handle detector errors when debug is disabled', async () => {
      const middleware = language({
        supportedLanguages: ['en', 'fr', 'es'],
        fallbackLanguage: 'en',
        debug: false,
        order: ['header']
      })

      const ctx = {
        req: {
          query: {},
          get: () => {
            throw new Error('Detector failed')
          },
          getCookie: async () => undefined,
          pathname: '/'
        },
        res: {
          setCookie: async () => { }
        },
        throw: jest.fn()
      } as any

      await middleware(ctx, async () => { })

      expect(ctx.language).toBe('en')
    })

    it('should log cache errors when debug mode is enabled', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { })

      const middleware = language({
        supportedLanguages: ['en', 'fr', 'es'],
        fallbackLanguage: 'en',
        order: ['querystring'],
        caches: ['cookie'],
        debug: true
      })

      const ctx = {
        req: {
          query: { lang: 'fr' },
          getCookie: async () => undefined,
          pathname: '/'
        },
        res: {
          setCookie: async () => {
            throw new Error('Cache failed')
          }
        },
        throw: jest.fn()
      } as any

      await middleware(ctx, async () => { })

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('should handle cache errors when debug is disabled', async () => {
      const middleware = language({
        supportedLanguages: ['en', 'fr', 'es'],
        fallbackLanguage: 'en',
        order: ['querystring'],
        caches: ['cookie'],
        debug: false
      })

      const ctx = {
        req: {
          query: { lang: 'fr' },
          getCookie: async () => undefined,
          pathname: '/'
        },
        res: {
          setCookie: async () => {
            throw new Error('Cache failed')
          }
        },
        throw: jest.fn()
      } as any

      await middleware(ctx, async () => { })

      expect(ctx.language).toBe('fr')
    })
  })

  describe('Individual Detectors', () => {
    const mockOptions = {
      supportedLanguages: ['en', 'fr', 'es'],
      fallbackLanguage: 'en',
      lookupQueryString: 'lang',
      lookupCookie: 'language',
      lookupFromHeaderKey: 'accept-language',
      lookupFromPathIndex: 0,
      ignoreCase: true
    } as any

    it('detectFromQuery should extract language from query', () => {
      const mockCtx = {
        req: { query: { lang: 'fr' } }
      } as any

      const result = detectors.querystring(mockCtx, mockOptions)
      expect(result).toBe('fr')
    })

    it('detectFromHeader should extract language from header', () => {
      const mockCtx = {
        req: { get: jest.fn().mockReturnValue('fr-FR,fr;q=0.9,en-US;q=0.8') }
      } as any

      const result = detectors.header(mockCtx, mockOptions)
      expect(result).toBe('fr')
    })

    it('detectFromPath should extract language from path', () => {
      const mockCtx = {
        req: { pathname: '/es/test/path' }
      } as any

      const result = detectors.path(mockCtx, mockOptions)
      expect(result).toBe('es')
    })

    it('detectFromCookie should return undefined when cookie lookup returns false', async () => {
      const mockCtx = {
        req: {
          getCookie: async () => false
        }
      } as any

      const result = await detectors.cookie(mockCtx, mockOptions)
      expect(result).toBeUndefined()
    })
  })

  describe('Default Options', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_OPTIONS.order).toEqual(['querystring', 'cookie', 'header'])
      expect(DEFAULT_OPTIONS.lookupQueryString).toBe('lang')
      expect(DEFAULT_OPTIONS.lookupCookie).toBe('language')
      expect(DEFAULT_OPTIONS.lookupFromHeaderKey).toBe('accept-language')
      expect(DEFAULT_OPTIONS.lookupFromPathIndex).toBe(0)
      expect(DEFAULT_OPTIONS.caches).toEqual(['cookie'])
      expect(DEFAULT_OPTIONS.ignoreCase).toBe(true)
      expect(DEFAULT_OPTIONS.fallbackLanguage).toBe('en')
      expect(DEFAULT_OPTIONS.supportedLanguages).toEqual(['en'])
      expect(DEFAULT_OPTIONS.debug).toBe(false)
    })
  })

  describe('Integration Tests', () => {
    it('should maintain context language property', async () => {
      let detectedLanguage: string | undefined

      app.get('/context', language({
        supportedLanguages: ['en', 'fr', 'es'],
        fallbackLanguage: 'en'
      }), (ctx) => {
        detectedLanguage = ctx.language
        ctx.res.body = 'ok'
      })

      await app.fetch(new Request('http://localhost/context/?lang=fr'))
      expect(detectedLanguage).toBe('fr')
    })
  })
})
