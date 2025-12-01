/**
 * SearchPage
 * Pagina di ricerca completa con risultati paginati e ordinamento
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { Loader2, Grid3x3, Camera, ChevronLeft, ChevronRight, ChevronDown, Search, Table, Grid, Package } from 'lucide-react'
import { searchApiConfig, type Card, type Set, type SearchResult, type SearchResultsResponse } from '@/config/searchApi'
import Pagination from '@/components/ui/Pagination'
import { useLanguage } from '@/contexts/LanguageContext'

type SortOption = 'relevance' | 'name' | 'price_asc' | 'price_desc'
type ViewMode = 'table' | 'card'

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { idToPreferredName, selectedLang } = useLanguage()
  
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [sort, setSort] = useState<SortOption>('relevance')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingSets, setIsLoadingSets] = useState(false) // Stato per il caricamento dei set in background
  const [results, setResults] = useState<SearchResult[]>([])
  const [allResults, setAllResults] = useState<SearchResult[]>([]) // Tutti i risultati senza filtro
  const [allSetsForFilter, setAllSetsForFilter] = useState<SearchResult[]>([]) // Tutti i risultati per estrarre tutti i set disponibili
  const [originalTotal, setOriginalTotal] = useState<number>(0) // Totale originale dei risultati (senza filtro)
  const [pagination, setPagination] = useState<{
    current_page: number
    total_pages: number
    per_page: number
    total: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Default: card su mobile, table su desktop
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768 ? 'card' : 'table'
    }
    return 'card'
  })
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 640
    }
    return false
  })
  
  // Stati per il dropdown personalizzato dei set
  const [isSetDropdownOpen, setIsSetDropdownOpen] = useState(false)
  const [setSearchQuery, setSetSearchQuery] = useState('')
  const setDropdownRef = useRef<HTMLDivElement>(null)
  const setSearchInputRef = useRef<HTMLInputElement>(null)
  const setListRef = useRef<HTMLDivElement>(null)

  // Parametri URL
  const term = searchParams.get('term')
  const ids = searchParams.get('ids')
  const lang = searchParams.get('lang') || 'en'
  const originalTerm = searchParams.get('originalTerm') || term || ''

  // Funzione per mappare il nome della carta tradotto
  const getDisplayName = useCallback((cardName: string, oracleId: string): string => {
    if (selectedLang === 'en' || !idToPreferredName || Object.keys(idToPreferredName).length === 0) {
      return cardName // Ritorna "Black Cat"
    }
    
    return idToPreferredName[oracleId] || cardName // Ritorna "mare sotterraneo" se trovato, altrimenti il nome originale
  }, [selectedLang, idToPreferredName])

  // Funzione per caricare i set in background senza bloccare l'UI
  const loadSetsInBackground = useCallback(async (
    termParam: string | null,
    idsParam: string | null,
    sortParam: SortOption,
    totalResults: number
  ) => {
    // Se ci sono pochi risultati, usa quelli già caricati
    if (totalResults <= 100) {
      return
    }

    setIsLoadingSets(true)
    
    try {
      const allSetsResults: SearchResult[] = []
      const perPageForSets = 100
      // Limita a max 10 pagine per evitare troppe richieste e rate limiting
      const maxPagesToLoad = 10
      let currentPageForSets = 1
      let totalPagesForSets = 1
      let hasMorePages = true
      
      // Carica solo le prime pagine per ottenere abbastanza set (in background)
      while (hasMorePages && currentPageForSets <= maxPagesToLoad) {
        let allSetsApiUrl = ''
        if (idsParam) {
          const allSetsParams = new URLSearchParams()
          allSetsParams.append('ids', idsParam)
          allSetsParams.append('page', currentPageForSets.toString())
          allSetsParams.append('sort', sortParam)
          allSetsParams.append('per_page', perPageForSets.toString())
          allSetsApiUrl = `${searchApiConfig.baseUrl}/api/search/by-oracle-ids-paginated?${allSetsParams.toString()}`
        } else {
          const allSetsParams = new URLSearchParams()
          if (termParam) allSetsParams.append('term', termParam)
          allSetsParams.append('page', currentPageForSets.toString())
          allSetsParams.append('sort', sortParam)
          allSetsParams.append('per_page', perPageForSets.toString())
          allSetsParams.append('lang', 'en')
          allSetsApiUrl = `${searchApiConfig.endpoints.search}?${allSetsParams.toString()}`
        }
        
        try {
          const allSetsResponse = await fetch(allSetsApiUrl, {
            headers: {
              'Content-Type': 'application/json',
            },
          })
          
          if (allSetsResponse.ok) {
            const allSetsData: SearchResultsResponse = await allSetsResponse.json()
            if (allSetsData.success && allSetsData.data) {
              const pageResults = allSetsData.data.data || []
              allSetsResults.push(...pageResults)
              
              totalPagesForSets = allSetsData.data.pagination.total_pages
              hasMorePages = currentPageForSets < totalPagesForSets
              currentPageForSets++
              
              // Aggiungi un delay tra le richieste per evitare rate limiting (solo dopo la prima pagina)
              if (currentPageForSets <= maxPagesToLoad && hasMorePages) {
                await new Promise(resolve => setTimeout(resolve, 200)) // 200ms di delay
              }
            } else {
              hasMorePages = false
            }
          } else if (allSetsResponse.status === 429) {
            // Se riceviamo 429, fermiamo il caricamento
            hasMorePages = false
          } else {
            hasMorePages = false
          }
        } catch (fetchErr) {
          // Se c'è un errore di rete, fermiamo il caricamento
          hasMorePages = false
        }
      }
      
      if (allSetsResults.length > 0) {
        setAllSetsForFilter(allSetsResults)
      }
    } catch (err) {
      // Non bloccare l'app se questa chiamata fallisce
    } finally {
      setIsLoadingSets(false)
    }
  }, [])

  // Funzione per eseguire la ricerca (ibrida: term o ids)
  const performSearch = useCallback(async () => {
    const termParam = searchParams.get('term')
    const idsParam = searchParams.get('ids')
    // NON passiamo set all'API perché filtriamo lato client
    const perPage = parseInt(searchParams.get('per_page') || '20', 10)
    
    // Se non ci sono parametri di ricerca, esci
    if (!termParam && !idsParam) {
      setResults([])
      setAllResults([])
      setAllSetsForFilter([])
      setOriginalTotal(0)
      setPagination(null)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      let apiUrl = ''

      if (idsParam) {
        // LOGICA TRADOTTA: Chiama la NUOVA API per ricerca via oracle IDs
        const params = new URLSearchParams()
        params.append('ids', idsParam)
        params.append('page', currentPage.toString())
        params.append('sort', sort)
        params.append('per_page', perPage.toString())
        // NON passiamo set perché filtriamo lato client
        apiUrl = `${searchApiConfig.baseUrl}/api/search/by-oracle-ids-paginated?${params.toString()}`
      } else {
        // LOGICA INGLESE/FALLBACK: Chiama la VECCHIA API per ricerca fulltext
      const params = new URLSearchParams()
        if (termParam) params.append('term', termParam)
      // NON passiamo set perché filtriamo lato client
      params.append('page', currentPage.toString())
      params.append('sort', sort)
      params.append('per_page', perPage.toString())
        params.append('lang', 'en') // Forza inglese per ricerca fulltext

        apiUrl = `${searchApiConfig.endpoints.search}?${params.toString()}`
      }
      
      const response = await fetch(apiUrl, {
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        if (response.status === 429) {
          const errorData = await response.json().catch(() => ({}))
          const retryAfter = errorData.retry_after || 30
          throw new Error(`Troppe richieste. Attendi ${retryAfter} secondi prima di riprovare.`)
        }
        const errorText = await response.text()
        throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`)
      }

      const data: SearchResultsResponse = await response.json()
      
      if (data.success && data.data) {
        const fetchedResults = data.data.data || []
        const totalResults = data.data.pagination.total_results
        
        setAllResults(fetchedResults) // Salva tutti i risultati della pagina corrente
        setResults(fetchedResults)
        setOriginalTotal(totalResults) // Salva il totale originale
        setPagination({
          current_page: data.data.pagination.current_page,
          total_pages: data.data.pagination.total_pages,
          per_page: data.data.pagination.per_page,
          total: totalResults, // Usa total_results dal backend
        })
        
        // Mostra subito i risultati e carica i set in background
        setIsLoading(false)
        
        // Carica i set in background senza bloccare l'UI (solo se ci sono molte pagine)
        if (totalResults > 100) {
          loadSetsInBackground(termParam, idsParam, sort, totalResults)
        }
      } else {
        throw new Error(data.error || 'Errore sconosciuto nella risposta API')
      }
    } catch (err) {
      let errorMessage = 'Errore durante la ricerca. Riprova più tardi.'
      
      if (err instanceof Error) {
        if (err.message.includes('Troppe richieste')) {
          errorMessage = err.message
        } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
          errorMessage = 'Errore di connessione. Verifica la tua connessione internet o riprova più tardi.'
        } else if (err.message.includes('HTTP error')) {
          if (err.message.includes('429')) {
            errorMessage = 'Troppe richieste. Attendi qualche secondo prima di riprovare.'
          } else {
            errorMessage = `Errore del server: ${err.message}`
          }
        } else {
          errorMessage = err.message
        }
      }
      
      setError(errorMessage)
      setResults([])
      setAllResults([])
      setAllSetsForFilter([])
      setOriginalTotal(0)
      setPagination(null)
    } finally {
      setIsLoading(false)
    }
  }, [term, ids, currentPage, sort, loadSetsInBackground]) // Non includere setFilter perché filtriamo lato client

  // Leggi parametri dall'URL
  useEffect(() => {
    const termParam = searchParams.get('term') || searchParams.get('originalTerm') || ''
    const page = parseInt(searchParams.get('page') || '1', 10)
    const sortParam = (searchParams.get('sort') || 'relevance') as SortOption

    setSearchTerm(termParam)
    setCurrentPage(page)
    setSort(sortParam)
  }, [searchParams])

  // Imposta la vista di default in base alla dimensione dello schermo solo all'avvio
  useEffect(() => {
    const isMobile = window.innerWidth < 768
    if (isMobile && viewMode === 'table') {
      setViewMode('card')
    }
  }, []) // Solo all'avvio, non dipende da viewMode per evitare loop

  // Traccia la dimensione dello schermo per la paginazione
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Gestione cambio risultati per pagina
  const handlePerPageChange = (newPerPage: number) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev)
      newParams.set('per_page', newPerPage.toString())
      newParams.set('page', '1') // Reset to first page quando cambia per_page
      return newParams
    })
    setCurrentPage(1)
  }

  // Esegui ricerca quando cambiano i parametri
  useEffect(() => {
    performSearch()
  }, [performSearch])

  // Gestione cambio pagina
  const handlePageChange = (page: number) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev)
      newParams.set('page', page.toString())
      return newParams
    })
    setCurrentPage(page)
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Gestione cambio ordinamento
  const handleSortChange = (newSort: SortOption) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev)
      newParams.set('sort', newSort)
      newParams.set('page', '1') // Reset to first page
      return newParams
    })
    setSort(newSort)
    setCurrentPage(1)
  }

  // Gestione click su risultato (carta o set)
  const handleResultClick = (result: SearchResult) => {
    if (result.type === 'set') {
      // Naviga al dettaglio set
      const set = result as Set & { type: 'set' }
      if (set.code) {
        navigate(`/set/${set.code}`)
      }
    } else {
      // È una carta
      const card = result as Card & { type?: 'card' }
      if (card.oracle_id && card.printing_id) {
        // Passa sia oracle_id che printing_id come query parameter
        const url = `/card/${card.oracle_id}?printing_id=${card.printing_id}`
        navigate(url)
      } else if (card.oracle_id) {
        // Fallback se printing_id non è disponibile
        const url = `/card/${card.oracle_id}`
        navigate(url)
      }
    }
  }

  const displayTerm = originalTerm || searchParams.get('term') || searchParams.get('set') || ''
  const setFilter = searchParams.get('set')

  // Estrai i set unici da TUTTI i risultati disponibili (non solo della pagina corrente) per il dropdown filtro
  const availableSets = useMemo(() => {
    const setsMap = new Map<string, { name: string; releaseDate: string | null }>() // Map<set_code, {name, releaseDate}>
    // Usa allSetsForFilter se disponibile (contiene tutti i risultati), altrimenti usa allResults
    // Se stiamo ancora caricando i set, usa allResults per mostrare almeno i set della pagina corrente
    const sourceForSets = allSetsForFilter.length > 0 ? allSetsForFilter : allResults
    
    sourceForSets.forEach(result => {
      if (result.type === 'set') {
        // È un set
        const set = result as Set & { type: 'set' }
        if (set.code && set.name) {
          const existing = setsMap.get(set.code)
          const setReleaseDate = set.release_date || set.released_at || null
          
          if (!existing) {
            setsMap.set(set.code, { name: set.name, releaseDate: setReleaseDate })
          }
        }
      } else {
        // È una carta
        const card = result as Card & { type?: 'card' }
        if (card.set_code && card.set_name) {
          const existing = setsMap.get(card.set_code)
          const cardReleaseDate = card.release_date || null
          
          // Se il set non esiste ancora o questa carta ha una data più vecchia, aggiorna
          if (!existing) {
            setsMap.set(card.set_code, { name: card.set_name, releaseDate: cardReleaseDate })
          } else if (cardReleaseDate && (!existing.releaseDate || cardReleaseDate < existing.releaseDate)) {
            // Usa la data più vecchia tra le carte del set come data di rilascio del set
            setsMap.set(card.set_code, { name: card.set_name, releaseDate: cardReleaseDate })
          }
        }
      }
    })
    
    // Converti in array e ordina per data di rilascio (dal più vecchio al più nuovo)
    const setsArray = Array.from(setsMap.entries())
      .map(([code, data]) => ({ code, name: data.name, releaseDate: data.releaseDate }))
      .sort((a, b) => {
        // Se entrambi hanno una data, ordina per data (dal più vecchio al più nuovo)
        if (a.releaseDate && b.releaseDate) {
          return a.releaseDate.localeCompare(b.releaseDate)
        }
        // Se solo uno ha una data, metti quello con data prima
        if (a.releaseDate && !b.releaseDate) return -1
        if (!a.releaseDate && b.releaseDate) return 1
        // Se nessuno ha una data, ordina per nome
        return a.name.localeCompare(b.name)
      })
    
    return setsArray
  }, [allSetsForFilter, allResults])

  // Filtra i risultati in base al set selezionato
  const filteredResults = useMemo(() => {
    if (!setFilter) {
      return allResults
    }
    // Usa allSetsForFilter se disponibile (contiene più risultati), altrimenti allResults
    const sourceToFilter = allSetsForFilter.length > 0 ? allSetsForFilter : allResults
    return sourceToFilter.filter(result => {
      if (result.type === 'set') {
        // I set vengono mostrati sempre (non filtrati per set_code)
        return true
      } else {
        // Filtra le carte per set_code
        const card = result as Card & { type?: 'card' }
        return card.set_code === setFilter
      }
    })
  }, [allResults, allSetsForFilter, setFilter])

  // Aggiorna i risultati quando cambia il filtro
  useEffect(() => {
    setResults(filteredResults)
    // NON aggiorniamo il totale nella paginazione quando c'è un filtro
    // Il totale originale viene mantenuto e mostrato separatamente
  }, [filteredResults, setFilter])

  // Gestione cambio filtro set
  const handleSetFilterChange = (setCode: string) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev)
      if (setCode === '') {
        newParams.delete('set')
      } else {
        newParams.set('set', setCode)
      }
      newParams.set('page', '1') // Reset to first page
      return newParams
    })
    setCurrentPage(1)
    setIsSetDropdownOpen(false)
    setSetSearchQuery('')
  }
  
  // Filtra i set in base alla query di ricerca
  const filteredSets = useMemo(() => {
    if (!setSearchQuery.trim()) {
      return availableSets
    }
    const query = setSearchQuery.toLowerCase()
    return availableSets.filter(set => 
      set.name.toLowerCase().includes(query) || 
      set.code.toLowerCase().includes(query)
    )
  }, [availableSets, setSearchQuery])
  
  // Gestione click fuori dal dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (setDropdownRef.current && !setDropdownRef.current.contains(event.target as Node)) {
        setIsSetDropdownOpen(false)
        setSetSearchQuery('')
      }
    }
    
    if (isSetDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      // Focus sull'input quando si apre il dropdown
      setTimeout(() => {
        setSearchInputRef.current?.focus()
      }, 100)
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isSetDropdownOpen])
  
  // Scroll automatico all'opzione che inizia con la lettera digitata
  useEffect(() => {
    if (isSetDropdownOpen && setSearchQuery && filteredSets.length > 0 && setListRef.current) {
      const query = setSearchQuery.toLowerCase().trim()
      if (query.length === 1) {
        // Quando si digita una singola lettera, trova la prima opzione che inizia con quella lettera
        const firstMatchingOption = setListRef.current.querySelector(`[data-set-option]`) as HTMLElement
        if (firstMatchingOption) {
          // Scroll alla prima opzione filtrata
          firstMatchingOption.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        }
      } else if (query.length > 1) {
        // Quando si digita più caratteri, scroll alla prima opzione filtrata
        const firstOption = setListRef.current.querySelector(`[data-set-option]`) as HTMLElement
        if (firstOption) {
          firstOption.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        }
      }
    }
  }, [setSearchQuery, filteredSets, isSetDropdownOpen])
  
  // Gestione digitazione diretta sul bottone (type-ahead)
  useEffect(() => {
    if (!isSetDropdownOpen) {
      const handleKeyPress = (e: KeyboardEvent) => {
        // Se si preme una lettera mentre il dropdown è chiuso, apri e cerca
        if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
          const target = e.target as HTMLElement
          // Solo se non si sta già digitando in un input
          if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
            setIsSetDropdownOpen(true)
            setSetSearchQuery(e.key)
            e.preventDefault()
          }
        }
      }
      
      document.addEventListener('keydown', handleKeyPress)
      return () => {
        document.removeEventListener('keydown', handleKeyPress)
      }
    }
  }, [isSetDropdownOpen])

  // Componente per il set nella vista griglia
  function SetViewItem({
    set,
    onSetClick
  }: {
    set: Set & { type: 'set' }
    onSetClick: (set: Set & { type: 'set' }) => void
  }) {
    return (
      <div
        className="card p-4 hover:shadow-lg transition-all duration-300 cursor-pointer group"
        onClick={() => onSetClick(set)}
      >
        {/* Icona set */}
        <div className="aspect-square mb-4 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
          {set.icon_svg_uri ? (
            <img
              src={set.icon_svg_uri}
              alt={set.name}
              className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <Package className="w-16 h-16 opacity-50" />
            </div>
          )}
        </div>

        {/* Info set */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 group-hover:text-orange-600 transition-colors line-clamp-2">
              {set.name}
            </h3>
            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded whitespace-nowrap">
              Set
            </span>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-gray-600">
            {set.set_type && (
              <span className="capitalize">{set.set_type}</span>
            )}
            {set.release_date && (
              <>
                {set.set_type && <span>•</span>}
                <span>{new Date(set.release_date).getFullYear()}</span>
              </>
            )}
          </div>

          {set.code && (
            <div className="text-xs text-gray-500 font-mono">
              {set.code.toUpperCase()}
            </div>
          )}

          <div className="pt-2">
            <Link
              to={`/set/${set.code}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-block w-full text-center px-3 py-1.5 text-xs font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded transition-colors"
            >
              Vedi dettagli
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Componente per la card nella vista griglia
  function CardViewItem({ 
    card, 
    getDisplayName, 
    onCardClick,
    selectedLang
  }: { 
    card: Card
    getDisplayName: (name: string, oracleId: string) => string
    onCardClick: (card: Card) => void
    selectedLang: string
  }) {
    // Funzione per aggiungere versionamento cache all'URL dell'immagine
    const getImageUrlWithCache = (url: string | undefined): string => {
      if (!url) return ''
      try {
        const urlObj = new URL(url)
        const cacheKey = `${card.oracle_id || 'unknown'}_${card.printing_id || 'unknown'}`
        const hash = cacheKey.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16) || 'default'
        urlObj.searchParams.set('v', hash)
        return urlObj.toString()
      } catch {
        const separator = url.includes('?') ? '&' : '?'
        const cacheKey = `${card.oracle_id || 'unknown'}_${card.printing_id || 'unknown'}`
        const hash = cacheKey.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16) || 'default'
        return `${url}${separator}v=${hash}`
      }
    }
    
    const baseImageUrl = card.image_uri_normal || card.image_uri_small || card.front_image_url
    const imageUrl = baseImageUrl ? getImageUrlWithCache(baseImageUrl) : ''
    const originalName = card.printed_name || card.name
    const displayName = getDisplayName(originalName, card.oracle_id)
    const showOriginalName = selectedLang !== 'en' && displayName !== originalName
    const price = card.price_eur 
      ? (typeof card.price_eur === 'string' ? parseFloat(card.price_eur) : card.price_eur)
      : null

    // Icona rarità
    const getRarityIcon = (rarity: string | undefined) => {
      if (!rarity) return null
      const r = rarity.toLowerCase()
      if (r.includes('mythic') || r.includes('m')) return '⭐'
      if (r.includes('rare') || r.includes('r')) return '◆'
      if (r.includes('uncommon') || r.includes('u')) return '◊'
      if (r.includes('common') || r.includes('c')) return '○'
      return '•'
    }

    return (
      <div
        className="card p-4 hover:shadow-lg transition-all duration-300 cursor-pointer group"
        onClick={() => onCardClick(card)}
      >
        {/* Immagine carta */}
        <div className="aspect-[488/680] mb-4 rounded-lg overflow-hidden bg-gray-100">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={displayName}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <Camera className="w-12 h-12 opacity-50" />
            </div>
          )}
        </div>

        {/* Info carta */}
        <div className="space-y-2">
          <div>
            <h3 className="font-semibold text-gray-900 group-hover:text-orange-600 transition-colors line-clamp-2">
              {displayName}
            </h3>
            {showOriginalName && (
              <p className="text-xs text-gray-400 mt-0.5 italic line-clamp-1">
                {originalName}
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-2 text-sm text-gray-600">
            {card.rarity && (
              <span className="flex items-center gap-1">
                <span className="text-lg">{getRarityIcon(card.rarity)}</span>
                <span className="capitalize">{card.rarity}</span>
              </span>
            )}
            {card.set_name && (
              <>
                {card.rarity && <span>•</span>}
                <span className="truncate">{card.set_name}</span>
              </>
            )}
          </div>

          {card.collector_number && (
            <div className="text-xs text-gray-500">
              #{card.collector_number}
            </div>
          )}

          {price !== null && (
            <div className="pt-2 border-t border-gray-200">
              <div className="text-lg font-bold text-orange-600">
                €{price.toFixed(2)}
              </div>
            </div>
          )}

          {card.oracle_id && (
            <div className="pt-2">
              <Link
                to={`/card/${card.oracle_id}${card.printing_id ? `?printing_id=${card.printing_id}` : ''}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-block w-full text-center px-3 py-1.5 text-xs font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded transition-colors"
              >
                Vedi dettagli
              </Link>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Componente per la riga del set nella tabella
  function SetTableRow({
    set,
    onSetClick
  }: {
    set: Set & { type: 'set' }
    onSetClick: (set: Set & { type: 'set' }) => void
  }) {
    return (
      <tr 
        className="hover:bg-gray-50 transition-colors cursor-pointer"
        onClick={() => onSetClick(set)}
      >
        {/* Icona set */}
        <td className="px-4 py-3">
          <div className="w-10 h-10 flex items-center justify-center">
            {set.icon_svg_uri ? (
              <img
                src={set.icon_svg_uri}
                alt={set.name}
                className="w-10 h-10 object-contain"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            ) : (
              <Package className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </td>

        {/* Nome */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="font-semibold text-gray-900 hover:text-orange-600 transition-colors">
              {set.name}
            </div>
            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
              Set
            </span>
          </div>
          {set.code && (
            <div className="text-xs text-gray-500 mt-1 font-mono">
              {set.code.toUpperCase()}
            </div>
          )}
        </td>

        {/* Rarità - N/A per set */}
        <td className="px-4 py-3">
          <span className="text-gray-400">-</span>
        </td>

        {/* Set - N/A per set */}
        <td className="px-4 py-3 text-sm text-gray-600">
          {set.set_type && <span className="capitalize">{set.set_type}</span>}
        </td>

        {/* Prezzo - N/A per set */}
        <td className="px-4 py-3">
          <span className="text-gray-400">-</span>
        </td>

        {/* Azioni */}
        <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
          {set.code && (
            <Link
              to={`/set/${set.code}`}
              className="inline-block px-3 py-1 text-xs font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded transition-colors"
            >
              Vedi dettagli
            </Link>
          )}
        </td>
      </tr>
    )
  }

  // Componente per la riga della tabella
  function CardTableRow({ 
    card, 
    getDisplayName, 
    onCardClick,
    selectedLang
  }: { 
    card: Card
    getDisplayName: (name: string, oracleId: string) => string
    onCardClick: (card: Card) => void
    selectedLang: string
  }) {
    const [hoveredImage, setHoveredImage] = useState(false)
    
    // Funzione per aggiungere versionamento cache all'URL dell'immagine
    const getImageUrlWithCache = (url: string | undefined): string => {
      if (!url) return ''
      try {
        const urlObj = new URL(url)
        // Aggiungi un parametro di versione basato su oracle_id e printing_id per evitare problemi di cache
        // Usa solo gli ID della carta, non il timestamp, così la cache funziona correttamente per la stessa carta
        const cacheKey = `${card.oracle_id || 'unknown'}_${card.printing_id || 'unknown'}`
        // Crea un hash semplice per il cache key (primi 16 caratteri)
        const hash = cacheKey.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16) || 'default'
        urlObj.searchParams.set('v', hash)
        return urlObj.toString()
      } catch {
        // Se l'URL non è valido, aggiungi semplicemente il parametro
        const separator = url.includes('?') ? '&' : '?'
        const cacheKey = `${card.oracle_id || 'unknown'}_${card.printing_id || 'unknown'}`
        const hash = cacheKey.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16) || 'default'
        return `${url}${separator}v=${hash}`
      }
    }
    
    const baseImageUrl = card.image_uri_normal || card.image_uri_small || card.front_image_url
    const imageUrl = baseImageUrl ? getImageUrlWithCache(baseImageUrl) : ''
    const originalName = card.printed_name || card.name // Nome inglese originale
    const displayName = getDisplayName(originalName, card.oracle_id) // Nome tradotto o originale
    const showOriginalName = selectedLang !== 'en' && displayName !== originalName // Mostra fallback solo se diverso e non inglese
    const price = card.price_eur 
      ? (typeof card.price_eur === 'string' ? parseFloat(card.price_eur) : card.price_eur)
      : null

    // Icona rarità
    const getRarityIcon = (rarity: string | undefined) => {
      if (!rarity) return null
      const r = rarity.toLowerCase()
      if (r.includes('mythic') || r.includes('m')) return '⭐'
      if (r.includes('rare') || r.includes('r')) return '◆'
      if (r.includes('uncommon') || r.includes('u')) return '◊'
      if (r.includes('common') || r.includes('c')) return '○'
      return '•'
    }

    return (
      <tr 
        className="hover:bg-gray-50 transition-colors cursor-pointer"
        onClick={() => onCardClick(card)}
      >
        {/* Icona immagine con hover */}
        <td className="px-4 py-3">
          <div 
            className="relative inline-block"
            onMouseEnter={() => setHoveredImage(true)}
            onMouseLeave={() => setHoveredImage(false)}
            onClick={(e) => e.stopPropagation()}
          >
            {imageUrl ? (
              <>
                <Camera className="w-5 h-5 text-gray-400 hover:text-orange-500 transition-colors cursor-pointer" />
                {hoveredImage && (
                  <div className="absolute left-0 top-full mt-2 z-[9999] shadow-2xl rounded-lg overflow-hidden pointer-events-none bg-white border-2 border-gray-200">
                    <img
                      src={imageUrl}
                      alt={displayName}
                      className="w-72 h-auto max-w-none"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="w-5 h-5 flex items-center justify-center text-gray-300">
                <Camera className="w-4 h-4" />
              </div>
            )}
          </div>
        </td>

        {/* Nome */}
        <td className="px-4 py-3">
          <div>
            <div className="font-semibold text-gray-900 hover:text-orange-600 transition-colors">
              {displayName}
            </div>
            {showOriginalName && (
              <div className="text-xs text-gray-400 mt-0.5 italic">
                {originalName}
              </div>
            )}
            {card.set_name && (
              <div className="text-xs text-gray-500 mt-1">
                {card.set_name}
              </div>
            )}
          </div>
        </td>

        {/* Rarità */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{getRarityIcon(card.rarity)}</span>
            {card.rarity && (
              <span className="text-sm text-gray-600 capitalize">
                {card.rarity}
              </span>
            )}
          </div>
        </td>

        {/* Set */}
        <td className="px-4 py-3 text-sm text-gray-600">
          {card.set_name || '-'}
        </td>

        {/* Prezzo */}
        <td className="px-4 py-3">
          {price !== null ? (
            <span className="font-semibold text-orange-600">
              €{price.toFixed(2)}
            </span>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </td>

        {/* Azioni */}
        <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
          {card.oracle_id && (
            <Link
              to={`/card/${card.oracle_id}${card.printing_id ? `?printing_id=${card.printing_id}` : ''}`}
              className="inline-block px-3 py-1 text-xs font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded transition-colors"
            >
              Vedi dettagli
            </Link>
          )}
        </td>
      </tr>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {displayTerm ? (
              setFilter ? (
                `Risultati per Set: ${displayTerm}`
              ) : (
                `Risultati per "${displayTerm}"`
              )
            ) : (
              'Cerca Carte'
            )}
          </h1>
          {pagination && (
            <p className="text-gray-600">
              {isLoading ? 'Ricerca in corso...' : `${originalTotal || pagination.total} risultati trovati`}
            </p>
          )}
        </div>

        {/* Filtri e Ordinamento */}
        {displayTerm && results.length > 0 && (
          <div className="mb-6 flex flex-col md:flex-row items-stretch md:items-center gap-3 md:gap-4">
            {/* Filtro per Set */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2 flex-1 md:flex-initial">
              <label htmlFor="set-filter-select" className="text-sm font-medium text-gray-700 whitespace-nowrap sm:min-w-[100px]">
                Filtra per Set:
              </label>
              {isLoadingSets && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="hidden sm:inline">Caricamento set...</span>
                  <span className="sm:hidden">Caricamento...</span>
                </div>
              )}
              {availableSets.length > 0 && (
                <div className="relative flex-1 sm:flex-initial" ref={setDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsSetDropdownOpen(!isSetDropdownOpen)}
                    className="w-full sm:w-auto px-4 py-2 bg-white border-2 border-gray-300 rounded-xl hover:border-orange-400 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer sm:min-w-[200px] flex items-center justify-between"
                  >
                    <span className="text-gray-700 truncate">
                      {setFilter 
                        ? availableSets.find(s => s.code === setFilter)?.name || 'Tutti i Set'
                        : 'Tutti i Set'
                      }
                    </span>
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform flex-shrink-0 ml-2 ${isSetDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {isSetDropdownOpen && (
                    <div className="absolute z-50 mt-2 w-full bg-white border-2 border-gray-300 rounded-xl shadow-lg overflow-hidden">
                      {/* Input di ricerca */}
                      <div className="p-2 border-b border-gray-200">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            ref={setSearchInputRef}
                            type="text"
                            value={setSearchQuery}
                            onChange={(e) => setSetSearchQuery(e.target.value)}
                            placeholder="Cerca set..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && filteredSets.length > 0) {
                                handleSetFilterChange(filteredSets[0].code)
                              } else if (e.key === 'Escape') {
                                setIsSetDropdownOpen(false)
                                setSetSearchQuery('')
                              }
                            }}
                          />
                        </div>
                      </div>
                      
                      {/* Lista set */}
                      <div 
                        ref={setListRef}
                        className="max-h-60 overflow-y-auto"
                      >
                        <button
                          type="button"
                          onClick={() => handleSetFilterChange('')}
                          className={`w-full px-4 py-2 text-left hover:bg-orange-50 transition-colors ${
                            !setFilter ? 'bg-orange-50 font-semibold' : ''
                          }`}
                        >
                          Tutti i Set
                        </button>
                        {filteredSets.length > 0 ? (
                          filteredSets.map((set) => (
                            <button
                              key={set.code}
                              type="button"
                              data-set-option
                              onClick={() => handleSetFilterChange(set.code)}
                              className={`w-full px-4 py-2 text-left hover:bg-orange-50 transition-colors ${
                                setFilter === set.code ? 'bg-orange-50 font-semibold' : ''
                              }`}
                            >
                              {set.name}
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-2 text-gray-500 text-sm">
                            Nessun set trovato
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Ordinamento */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 md:flex-initial">
              <label htmlFor="sort-select" className="text-sm font-medium text-gray-700 whitespace-nowrap sm:min-w-[90px]">
                Ordina per:
              </label>
              <select
                id="sort-select"
                value={sort}
                onChange={(e) => handleSortChange(e.target.value as SortOption)}
                className="w-full sm:w-auto flex-1 sm:flex-initial px-4 py-2 bg-white border-2 border-gray-300 rounded-xl hover:border-orange-400 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <option value="relevance">Rilevanza</option>
                <option value="name">Nome</option>
                <option value="price_asc">Prezzo: Crescente</option>
                <option value="price_desc">Prezzo: Decrescente</option>
              </select>
            </div>

            {/* Pulsanti Vista - Spostati a destra */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 md:ml-auto">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap sm:min-w-[50px]">
                Vista:
              </label>
              <div className="flex items-center gap-1 bg-white border-2 border-gray-300 rounded-xl p-1 w-full sm:w-auto justify-center sm:justify-start">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 flex-1 sm:flex-initial justify-center ${
                    viewMode === 'table'
                      ? 'bg-orange-500 text-white shadow-md'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                  title="Vista tabella"
                >
                  <Table className="w-4 h-4" />
                  <span className="text-sm font-medium hidden sm:inline">Tabella</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('card')}
                  className={`px-3 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 flex-1 sm:flex-initial justify-center ${
                    viewMode === 'card'
                      ? 'bg-orange-500 text-white shadow-md'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                  title="Vista card"
                >
                  <Grid className="w-4 h-4" />
                  <span className="text-sm font-medium hidden sm:inline">Card</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Risultati */}
        {isLoading ? (
          <div className="card p-12 text-center">
            <div className="flex flex-col items-center">
              <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-4" />
              <p className="text-gray-600">Ricerca in corso...</p>
            </div>
          </div>
        ) : error ? (
          <div className="card p-12 text-center">
            <div className="text-red-600 mb-4">
              <Grid3x3 className="w-16 h-16 mx-auto mb-4" />
              <p className="text-lg">{error}</p>
            </div>
          </div>
        ) : displayTerm && filteredResults.length === 0 && !isLoading ? (
          <div className="card p-12 text-center">
            <Grid3x3 className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600 text-lg">
              Nessun risultato trovato
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Prova con termini diversi o usa i filtri
            </p>
          </div>
        ) : displayTerm && filteredResults.length > 0 ? (
          <div className="space-y-6">
            {/* Vista Tabella */}
            {viewMode === 'table' && (
              <div className="card overflow-x-auto overflow-y-visible">
              <div className="overflow-x-auto overflow-y-visible">
                <table className="w-full">
                  <thead className="bg-orange-500 text-white">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold w-12"></th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Nome</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Rarità</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Set</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Da</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredResults.map((result, index) => {
                      if (result.type === 'set') {
                        const set = result as Set & { type: 'set' }
                        return (
                          <SetTableRow
                            key={`set-${set.code}-${index}`}
                            set={set}
                            onSetClick={(set) => handleResultClick(set)}
                          />
                        )
                      } else {
                        const card = result as Card & { type?: 'card' }
                        return (
                          <CardTableRow
                            key={card.printing_id || card.oracle_id || card.id || index}
                            card={card}
                            getDisplayName={getDisplayName}
                            onCardClick={(card) => handleResultClick(card as SearchResult)}
                            selectedLang={selectedLang}
                          />
                        )
                      }
                    })}
                  </tbody>
                </table>
                
                {/* Spazio bianco per le immagini hover + Paginazione */}
                <div className="bg-white px-4 pt-6 pb-[200px] border-t border-gray-200">
                  {pagination && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mt-[100px]">
                      {/* Items info */}
                      <div className="flex items-center gap-4">
                        <span className="text-base font-semibold text-gray-700">
                          Mostra {((pagination.current_page - 1) * pagination.per_page) + 1} - {Math.min(pagination.current_page * pagination.per_page, pagination.total)} di {pagination.total}
                        </span>
                        <select
                          value={pagination.per_page}
                          onChange={() => {}} // Disabilitato - non funziona
                          disabled
                          className="px-4 py-2 text-base font-medium border-2 border-gray-300 rounded-xl bg-white transition-all duration-200 shadow-sm cursor-not-allowed opacity-60"
                        >
                          <option value={10}>10 per pagina</option>
                          <option value={25}>25 per pagina</option>
                          <option value={50}>50 per pagina</option>
                          <option value={100}>100 per pagina</option>
                        </select>
                      </div>

                      {/* Page numbers */}
                      {pagination.total_pages > 1 && (
                        <div className="flex items-center gap-1 sm:gap-2">
                          <button
                            onClick={() => handlePageChange(pagination.current_page - 1)}
                            disabled={pagination.current_page === 1}
                            className="p-1.5 sm:p-2.5 border-2 border-gray-300 rounded-lg sm:rounded-xl bg-white hover:bg-orange-50 hover:border-orange-400 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-gray-300 transition-all duration-200 shadow-sm hover:shadow-md"
                            aria-label="Pagina precedente"
                          >
                            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700" />
                          </button>

                          {(() => {
                            const pages: (number | string)[] = []
                            const maxVisible = isMobile ? 3 : 5
                            const currentPage = pagination.current_page
                            const totalPages = pagination.total_pages

                            if (totalPages <= maxVisible) {
                              for (let i = 1; i <= totalPages; i++) {
                                pages.push(i)
                              }
                            } else {
                              if (isMobile) {
                                // Su mobile mostra solo: [1] ... [current-1] [current] [current+1] ... [last]
                                if (currentPage <= 2) {
                                  pages.push(1, 2)
                                  if (currentPage === 2) pages.push(3)
                                  if (totalPages > 3) {
                                    pages.push('ellipsis')
                                    pages.push(totalPages)
                                  }
                                } else if (currentPage >= totalPages - 1) {
                                  if (totalPages > 3) pages.push(1, 'ellipsis')
                                  pages.push(totalPages - 1, totalPages)
                                } else {
                                  pages.push(1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages)
                                }
                              } else {
                                if (currentPage <= 3) {
                                  for (let i = 1; i <= 4; i++) {
                                    pages.push(i)
                                  }
                                  pages.push('ellipsis')
                                  pages.push(totalPages)
                                } else if (currentPage >= totalPages - 2) {
                                  pages.push(1)
                                  pages.push('ellipsis')
                                  for (let i = totalPages - 3; i <= totalPages; i++) {
                                    pages.push(i)
                                  }
                                } else {
                                  pages.push(1)
                                  pages.push('ellipsis')
                                  for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                                    pages.push(i)
                                  }
                                  pages.push('ellipsis')
                                  pages.push(totalPages)
                                }
                              }
                            }

                            return pages.map((page, index) => (
                              <button
                                key={index}
                                onClick={() => typeof page === 'number' && handlePageChange(page)}
                                disabled={page === 'ellipsis'}
                                className={`min-w-[32px] sm:min-w-[44px] px-2 sm:px-4 py-1.5 sm:py-2.5 text-sm sm:text-base font-semibold rounded-lg sm:rounded-xl border-2 transition-all duration-200 ${
                                  page === currentPage
                                    ? 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-200 scale-105'
                                    : page === 'ellipsis'
                                    ? 'border-transparent cursor-default text-gray-400'
                                    : 'border-gray-300 bg-white text-gray-700 hover:bg-orange-50 hover:border-orange-400 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-gray-300 disabled:hover:shadow-sm'
                                }`}
                              >
                                {page === 'ellipsis' ? '...' : page}
                              </button>
                            ))
                          })()}

                          <button
                            onClick={() => handlePageChange(pagination.current_page + 1)}
                            disabled={pagination.current_page === pagination.total_pages}
                            className="p-1.5 sm:p-2.5 border-2 border-gray-300 rounded-lg sm:rounded-xl bg-white hover:bg-orange-50 hover:border-orange-400 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-gray-300 transition-all duration-200 shadow-sm hover:shadow-md"
                            aria-label="Pagina successiva"
                          >
                            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            )}

            {/* Vista Card */}
            {viewMode === 'card' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {filteredResults.map((result, index) => {
                    if (result.type === 'set') {
                      const set = result as Set & { type: 'set' }
                      return (
                        <SetViewItem
                          key={`set-${set.code}-${index}`}
                          set={set}
                          onSetClick={(set) => handleResultClick(set)}
                        />
                      )
                    } else {
                      const card = result as Card & { type?: 'card' }
                      return (
                        <CardViewItem
                          key={card.printing_id || card.oracle_id || card.id || index}
                          card={card}
                          getDisplayName={getDisplayName}
                          onCardClick={(card) => handleResultClick(card as SearchResult)}
                          selectedLang={selectedLang}
                        />
                      )
                    }
                  })}
                </div>

                {/* Paginazione per vista card */}
                {pagination && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-6">
                    {/* Items info */}
                    <div className="flex items-center gap-4">
                      <span className="text-base font-semibold text-gray-700">
                        Mostra {((pagination.current_page - 1) * pagination.per_page) + 1} - {Math.min(pagination.current_page * pagination.per_page, pagination.total)} di {pagination.total}
                      </span>
                      <select
                        value={pagination.per_page}
                        onChange={() => {}} // Disabilitato - non funziona
                        disabled
                        className="px-4 py-2 text-base font-medium border-2 border-gray-300 rounded-xl bg-white transition-all duration-200 shadow-sm cursor-not-allowed opacity-60"
                      >
                        <option value={10}>10 per pagina</option>
                        <option value={25}>25 per pagina</option>
                        <option value={50}>50 per pagina</option>
                        <option value={100}>100 per pagina</option>
                      </select>
                    </div>

                    {/* Page numbers */}
                    {pagination.total_pages > 1 && (
                      <div className="flex items-center gap-1 sm:gap-2">
                        <button
                          onClick={() => handlePageChange(pagination.current_page - 1)}
                          disabled={pagination.current_page === 1}
                          className="p-1.5 sm:p-2.5 border-2 border-gray-300 rounded-lg sm:rounded-xl bg-white hover:bg-orange-50 hover:border-orange-400 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-gray-300 transition-all duration-200 shadow-sm hover:shadow-md"
                          aria-label="Pagina precedente"
                        >
                          <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700" />
                        </button>

                        {(() => {
                          const pages: (number | string)[] = []
                          const isMobile = typeof window !== 'undefined' && window.innerWidth < 640
                          const maxVisible = isMobile ? 3 : 5
                          const currentPage = pagination.current_page
                          const totalPages = pagination.total_pages

                          if (totalPages <= maxVisible) {
                            for (let i = 1; i <= totalPages; i++) {
                              pages.push(i)
                            }
                          } else {
                            if (isMobile) {
                              // Su mobile mostra solo: [1] ... [current-1] [current] [current+1] ... [last]
                              if (currentPage <= 2) {
                                pages.push(1, 2)
                                if (currentPage === 2) pages.push(3)
                                if (totalPages > 3) {
                                  pages.push('ellipsis')
                                  pages.push(totalPages)
                                }
                              } else if (currentPage >= totalPages - 1) {
                                if (totalPages > 3) pages.push(1, 'ellipsis')
                                pages.push(totalPages - 1, totalPages)
                              } else {
                                pages.push(1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages)
                              }
                            } else {
                              if (currentPage <= 3) {
                                for (let i = 1; i <= 4; i++) {
                                  pages.push(i)
                                }
                                pages.push('ellipsis')
                                pages.push(totalPages)
                              } else if (currentPage >= totalPages - 2) {
                                pages.push(1)
                                pages.push('ellipsis')
                                for (let i = totalPages - 3; i <= totalPages; i++) {
                                  pages.push(i)
                                }
                              } else {
                                pages.push(1)
                                pages.push('ellipsis')
                                for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                                  pages.push(i)
                                }
                                pages.push('ellipsis')
                                pages.push(totalPages)
                              }
                            }
                          }

                          return pages.map((page, index) => (
                            <button
                              key={index}
                              onClick={() => typeof page === 'number' && handlePageChange(page)}
                              disabled={page === 'ellipsis'}
                              className={`min-w-[32px] sm:min-w-[44px] px-2 sm:px-4 py-1.5 sm:py-2.5 text-sm sm:text-base font-semibold rounded-lg sm:rounded-xl border-2 transition-all duration-200 ${
                                page === currentPage
                                  ? 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-200 scale-105'
                                  : page === 'ellipsis'
                                  ? 'border-transparent cursor-default text-gray-400'
                                  : 'border-gray-300 bg-white text-gray-700 hover:bg-orange-50 hover:border-orange-400 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-gray-300 disabled:hover:shadow-sm'
                              }`}
                            >
                              {page === 'ellipsis' ? '...' : page}
                            </button>
                          ))
                        })()}

                        <button
                          onClick={() => handlePageChange(pagination.current_page + 1)}
                          disabled={pagination.current_page === pagination.total_pages}
                          className="p-1.5 sm:p-2.5 border-2 border-gray-300 rounded-lg sm:rounded-xl bg-white hover:bg-orange-50 hover:border-orange-400 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-gray-300 transition-all duration-200 shadow-sm hover:shadow-md"
                          aria-label="Pagina successiva"
                        >
                          <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="card p-12 text-center">
            <Grid3x3 className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600 text-lg">
              Inizia a cercare carte Magic: The Gathering
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Usa la barra di ricerca in alto per trovare le tue carte preferite
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
