import type { HoaContext, HoaMiddleware } from 'hoa'
import { parseAccept } from './utils.ts'

declare module 'hoa' {
  interface HoaContext {
    language: string
  }

  interface HoaRequest {
    getCookie(name: string): Promise<string | undefined | false>
  }

  interface HoaResponse {
    setCookie(name: string, value: string): Promise<void>
  }
}

export type DetectorType = 'path' | 'querystring' | 'cookie' | 'header'

export type CacheType = 'cookie'

export interface DetectorOptions {
  /** Order of language detection strategies */
  order: DetectorType[]
  /** Query parameter name for language */
  lookupQueryString: string
  /** Cookie name for language */
  lookupCookie: string
  /** Index in URL path where language code appears */
  lookupFromPathIndex: number
  /** Header key for language detection */
  lookupFromHeaderKey: string
  /** Caching strategies */
  caches: CacheType[] | false
  /** Cookie configuration options */
  /** Whether to ignore case in language codes */
  ignoreCase: boolean
  /** Default language if none detected */
  fallbackLanguage: string
  /** List of supported language codes */
  supportedLanguages: string[]
  /** Optional function to transform detected language codes */
  convertDetectedLanguage?: (lang: string) => string
  /** Enable debug logging */
  debug?: boolean
}

export const DEFAULT_OPTIONS: DetectorOptions = {
  order: ['querystring', 'cookie', 'header'],
  lookupQueryString: 'lang',
  lookupCookie: 'language',
  lookupFromHeaderKey: 'accept-language',
  lookupFromPathIndex: 0,
  caches: ['cookie'],
  ignoreCase: true,
  fallbackLanguage: 'en',
  supportedLanguages: ['en'],
  debug: false,
}

/**
 * Language detector middleware for Hoa.
 * @param {DetectorOptions} [userOptions] - The options to use.
 * @returns {HoaMiddleware} The middleware handler function
 */
export const language = (userOptions: Partial<DetectorOptions> = {}): HoaMiddleware => {
  const options: DetectorOptions = {
    ...DEFAULT_OPTIONS,
    ...userOptions,
  }
  validateOptions(options)
  return async function languageMiddleware (ctx: HoaContext, next) {
    validateCookiePlugin(ctx)
    ctx.language = await detectLanguage(ctx, options)

    await next()
  }
}
export default language

function parseAcceptLanguage (header: string): Array<{ lang: string; q: number }> {
  return parseAccept(header).map(({ type, q }) => ({ lang: type, q }))
}

/**
 * Detects language from query parameter
 */
export const detectFromQuery = (ctx: HoaContext, options: DetectorOptions): string | undefined => {
  const query = ctx.req.query[options.lookupQueryString]
  return normalizeLanguage(query, options)
}

/**
 * Detects language from cookie
 */
export const detectFromCookie = async (ctx: HoaContext, options: DetectorOptions): Promise<string | undefined> => {
  const cookie = await ctx.req.getCookie(options.lookupCookie)
  if (cookie === false) {
    return undefined
  }
  return normalizeLanguage(cookie, options)
}

/**
 * Detects language from Accept-Language header
 */
export function detectFromHeader (ctx: HoaContext, options: DetectorOptions): string | undefined {
  const acceptLanguage = ctx.req.get(options.lookupFromHeaderKey)
  if (!acceptLanguage) {
    return undefined
  }

  const languages = parseAcceptLanguage(acceptLanguage)
  for (const { lang } of languages) {
    const normalizedLang = normalizeLanguage(lang, options)
    if (normalizedLang) {
      return normalizedLang
    }
  }
  return undefined
}

/**
 * Detects language from URL path
 */
export function detectFromPath (ctx: HoaContext, options: DetectorOptions): string | undefined {
  const pathSegments = ctx.req.pathname.split('/').filter(Boolean)
  const langSegment = pathSegments[options.lookupFromPathIndex]
  return normalizeLanguage(langSegment, options)
}

/**
 * Collection of all language detection strategies
 */
export const detectors = {
  querystring: detectFromQuery,
  cookie: detectFromCookie,
  header: detectFromHeader,
  path: detectFromPath,
} as const

const detectLanguage = async (ctx: HoaContext, options: DetectorOptions): Promise<string> => {
  let detectedLang: string | undefined

  for (const detectorName of options.order) {
    const detector = detectors[detectorName]
    try {
      detectedLang = await detector(ctx, options)
      if (detectedLang) {
        if (options.debug) {
          console.log(`Language detected from ${detectorName}: ${detectedLang}`)
        }
        break
      }
    } catch (error) {
      if (options.debug) {
        console.error(`Error in ${detectorName} detector:`, error)
      }
      continue
    }
  }

  if (!detectedLang) {
    if (options.debug) {
      console.error('Language detection failed')
    }
  }
  const finalLang = detectedLang || options.fallbackLanguage

  if (detectedLang && options.caches) {
    await cacheLanguage(ctx, finalLang, options)
  }

  return finalLang
}

async function cacheLanguage (ctx: HoaContext, language: string, options: DetectorOptions): Promise<void> {
  if (!Array.isArray(options.caches) || !options.caches.includes('cookie')) {
    return
  }

  try {
    await ctx.res.setCookie(options.lookupCookie, language)
  } catch (error) {
    if (options.debug) {
      console.error('Failed to cache language:', error)
    }
  }
}

export const normalizeLanguage = (
  lang: string | null | undefined | string[],
  options: DetectorOptions
): string | undefined => {
  if (!lang) {
    return undefined
  }
  if (Array.isArray(lang)) {
    return undefined
  }
  try {
    let normalizedLang = lang.trim()
    if (options.convertDetectedLanguage) {
      normalizedLang = options.convertDetectedLanguage(normalizedLang)
    }

    const compLang = options.ignoreCase ? normalizedLang.toLowerCase() : normalizedLang
    const compSupported = options.supportedLanguages.map((l) =>
      options.ignoreCase ? l.toLowerCase() : l
    )

    const matchedLang = compSupported.find((l) => l === compLang)
    return matchedLang ? options.supportedLanguages[compSupported.indexOf(matchedLang)] : undefined
  } catch {
    return undefined
  }
}

function validateOptions (options: DetectorOptions): void {
  if (!options.supportedLanguages.includes(options.fallbackLanguage)) {
    throw new Error('Fallback language must be included in supported languages')
  }

  if (options.lookupFromPathIndex < 0) {
    throw new Error('Path index must be non-negative')
  }

  if (!options.order.every((detector) => Object.keys(detectors).includes(detector))) {
    throw new Error('Invalid detector type in order array')
  }
}

function validateCookiePlugin (ctx: HoaContext): void {
  if (!ctx.req.getCookie || !ctx.res.setCookie) {
    ctx.throw(500, 'Cookie plugin (eg: @hoajs/cookie) is required')
  }
}
