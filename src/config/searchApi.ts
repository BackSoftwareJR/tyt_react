/**
 * Search API Configuration
 * Configurazione per l'API di ricerca Magic: The Gathering
 */

// Determina l'URL base in base all'ambiente
// Per ora puntiamo sempre all'API di produzione anche in sviluppo locale
// come da specifiche del progetto
const isDevelopment = import.meta.env.DEV

// Usa sempre l'API di produzione per lo sviluppo locale
const baseUrl = "https://search.takeyourtrade.com"

export default baseUrl

// Configurazione API endpoints
export const searchApiConfig = {
  baseUrl,
  endpoints: {
    health: `${baseUrl}/health`,
    search: `${baseUrl}/api/search/results`,
    autocomplete: `${baseUrl}/api/search/autocomplete`,
    searchByOracleId: (oracleId: string) => `${baseUrl}/api/search/by-oracle-id?id=${encodeURIComponent(oracleId)}`,
    searchByOracleIdsPaginated: (ids: string, page: number = 1, sort: string = 'relevance') => {
      const params = new URLSearchParams()
      params.append('ids', ids)
      params.append('page', page.toString())
      params.append('sort', sort)
      return `${baseUrl}/api/search/by-oracle-ids-paginated?${params.toString()}`
    },
    cards: `${baseUrl}/api/cards`,
    // Navigation endpoints
    sets: `${baseUrl}/api/sets`,
    set: (code: string) => `${baseUrl}/api/set/${encodeURIComponent(code)}`,
    card: (oracleId: string) => `${baseUrl}/api/card/${encodeURIComponent(oracleId)}`,
    cardPrintings: (oracleId: string) => `${baseUrl}/api/card/${encodeURIComponent(oracleId)}/printings`,
  },
  timeout: 10000, // 10 secondi
  debounceMs: 300, // 300ms di debounce per autocomplete
  maxSuggestions: 8, // Massimo 8 suggerimenti
} as const

// Tipi per le risposte API
export interface Card {
  printing_id?: string
  id?: number
  oracle_id: string
  name: string
  printed_name?: string | null
  set_name?: string
  set_code?: string
  set_id?: string
  set_translated_name?: string | null
  collector_number?: string
  rarity?: string
  image_uri_small?: string | null
  image_uri_normal?: string | null
  front_image_url?: string
  icon_svg_uri?: string | null
  type?: string
  mana_cost?: string
  cmc?: number
  power?: string
  toughness?: string
  text?: string
  oracle_text?: string
  flavor_text?: string
  artist?: string
  release_date?: string
  price?: number | string | null
  price_eur?: number | string | null
  price_usd?: number | string | null
  price_tix?: number | string | null
  legalities?: Record<string, string>
  keywords?: string[]
  colors?: string[]
  color_identity?: string[]
  supertypes?: string[]
  types?: string[]
  subtypes?: string[]
}

// Tipo Printing per autocomplete (come da documentazione API)
export interface Printing {
  printing_id: string
  oracle_id: string
  name: string
  set_name: string
  collector_number: string
  image_uri_small: string | null
  type?: 'card' // Campo opzionale per distinguere il tipo
}

export interface Set {
  code: string
  name: string
  icon_svg_uri?: string | null
  set_type?: string
  release_date?: string
  released_at?: string
  card_count?: number
  type?: 'set' // Campo opzionale per distinguere il tipo
}

// Tipo unione per risultati misti autocomplete
export type AutocompleteResult = (Printing & { type?: 'card' }) | (Set & { type: 'set' })

// AutocompleteResponse secondo la documentazione API (ora supporta risultati misti)
export interface AutocompleteResponse {
  success: boolean
  cached: boolean
  error?: string
  data: AutocompleteResult[]
}

// Tipo unione per risultati misti ricerca completa
export type SearchResult = (Card & { type?: 'card' }) | (Set & { type: 'set' })

// SearchResultsResponse per la pagina di ricerca completa (ora supporta risultati misti)
export interface SearchResultsResponse {
  success: boolean
  cached: boolean
  error?: string
  data: {
    pagination: {
      current_page: number
      total_pages: number
      total_results: number  // Nota: il backend usa total_results invece di total
      per_page: number
    }
    data: SearchResult[]
  }
}

// Legacy types for backward compatibility
export interface SearchResponse {
  query: string
  results: Card[]
  pagination: {
    page: number
    limit: number
    total: number
  }
}

export interface AutocompleteResponseOld {
  query: string
  results: Card[]
  total: number
}
