/**
 * useHybridAutocomplete Hook
 * Hook per ricerca multilingua ibrida con Fuse.js e API fallback
 * Aggiornato per la nuova struttura JSON: array di oggetti {id, name, preferred}
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { searchApiConfig, type AutocompleteResponse, type Printing, type Card, type Set, type AutocompleteResult } from '@/config/searchApi'
import { useLanguage } from '@/contexts/LanguageContext'

interface UseHybridAutocompleteOptions {
  debounceMs?: number
  minLength?: number
}

// Estendiamo Printing per includere il nome originale inglese come fallback
export interface PrintingWithTranslation extends Printing {
  originalName?: string // Nome inglese originale (per fallback)
  preferredName?: string // Nome tradotto (prioritario)
  type?: 'card' // Tipo per distinguere le carte
}

// Tipo per risultati misti (carte e set)
export type AutocompleteResultWithTranslation = PrintingWithTranslation | (Set & { type: 'set' })

interface UseHybridAutocompleteResult {
  results: AutocompleteResultWithTranslation[]
  loading: boolean
  error: string | null
  cached: boolean
  translatedName: string | null // Nome tradotto trovato (es. "mare sotterraneo")
}

export function useHybridAutocomplete(
  term: string,
  options: UseHybridAutocompleteOptions = {}
): UseHybridAutocompleteResult {
  const {
    debounceMs = 300,
    minLength = 2,
  } = options

  const { selectedLang, fuseDictionary, idToPreferredName, isLangLoading } = useLanguage()

  const [results, setResults] = useState<AutocompleteResultWithTranslation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cached, setCached] = useState(false)
  const [translatedName, setTranslatedName] = useState<string | null>(null)
  
  const abortControllerRef = useRef<AbortController | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rateLimitRef = useRef<{ blocked: boolean; until: number }>({ blocked: false, until: 0 })

  // Funzione per chiamare API standard inglese
  const fetchEnglishAutocomplete = useCallback(async (searchTerm: string): Promise<AutocompleteResponse> => {
    // Controlla se siamo in rate limit
    if (rateLimitRef.current.blocked && Date.now() < rateLimitRef.current.until) {
      const waitTime = Math.ceil((rateLimitRef.current.until - Date.now()) / 1000)
      throw new Error(`Troppe richieste. Attendi ${waitTime} secondi.`)
    }

    const url = `${searchApiConfig.endpoints.autocomplete}?term=${encodeURIComponent(searchTerm.trim())}`
    
    const response = await fetch(url, {
      signal: abortControllerRef.current?.signal,
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      if (response.status === 429) {
        // Gestisci rate limiting: blocca le richieste per 30 secondi
        const retryAfter = 30 // secondi
        rateLimitRef.current = {
          blocked: true,
          until: Date.now() + (retryAfter * 1000)
        }
        throw new Error(`Troppe richieste. Attendi ${retryAfter} secondi.`)
      }
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    // Reset rate limit se la richiesta è andata a buon fine
    rateLimitRef.current = { blocked: false, until: 0 }

    return response.json()
  }, [])

  // Funzione per chiamare API by-oracle-id con più ID separati da virgola
  const fetchByOracleIds = useCallback(async (oracleIds: string[]): Promise<AutocompleteResponse> => {
    // Controlla se siamo in rate limit
    if (rateLimitRef.current.blocked && Date.now() < rateLimitRef.current.until) {
      const waitTime = Math.ceil((rateLimitRef.current.until - Date.now()) / 1000)
      throw new Error(`Troppe richieste. Attendi ${waitTime} secondi.`)
    }

    // Usa l'endpoint by-oracle-ids-paginated che accetta più ID
    // Per l'autocomplete, usiamo page=1 e limitiamo i risultati
    const idsParam = oracleIds.join(',')
    const url = searchApiConfig.endpoints.searchByOracleIdsPaginated(idsParam, 1, 'relevance')
    
    const response = await fetch(url, {
      signal: abortControllerRef.current?.signal,
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      if (response.status === 429) {
        // Gestisci rate limiting: blocca le richieste per 30 secondi
        const retryAfter = 30 // secondi
        rateLimitRef.current = {
          blocked: true,
          until: Date.now() + (retryAfter * 1000)
        }
        throw new Error(`Troppe richieste. Attendi ${retryAfter} secondi.`)
      }
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    // Reset rate limit se la richiesta è andata a buon fine
    rateLimitRef.current = { blocked: false, until: 0 }

    const responseData = await response.json()
    
    // L'endpoint paginated restituisce una struttura diversa:
    // { success, cached, data: { pagination: {...}, data: Card[] } }
    // Dobbiamo convertire Card[] in Printing[] e poi al formato AutocompleteResponse
    if (responseData.success && responseData.data && Array.isArray(responseData.data.data)) {
      const cards: Card[] = responseData.data.data
      
      // Converti Card[] in Printing[]
      const printings: Printing[] = cards
        .filter(card => card.oracle_id && card.printing_id) // Filtra solo le carte valide
        .map(card => ({
          printing_id: card.printing_id!,
          oracle_id: card.oracle_id,
          name: card.name,
          set_name: card.set_name || '',
          collector_number: card.collector_number || '',
          // Usa image_uri_small se disponibile, altrimenti prova front_image_url o image_uri_normal
          image_uri_small: card.image_uri_small || card.front_image_url || card.image_uri_normal || null,
        }))
      
      return {
        success: true,
        cached: responseData.cached || false,
        data: printings,
      }
    }
    
    // Fallback: prova con il formato standard (se restituisce direttamente Printing[])
    if (responseData.success && Array.isArray(responseData.data)) {
      return responseData
    }
    
    // Se non è nessuno dei formati attesi, restituisci errore
    return {
      success: false,
      cached: false,
      error: 'Formato risposta API non riconosciuto',
      data: [],
    }
  }, [])

  // Funzione principale di ricerca
  const performSearch = useCallback(async (searchTerm: string) => {
    // Reset error e translatedName
    setError(null)
    setTranslatedName(null)

    // Se il termine è troppo corto, reset
    if (searchTerm.trim().length < minLength) {
      setResults([])
      setLoading(false)
      setCached(false)
      return
    }

    // Cancella richiesta precedente
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Crea nuovo AbortController
    const controller = new AbortController()
    abortControllerRef.current = controller

    setLoading(true)

    try {
      // CASO 1: Lingua inglese (default) - usa API standard
      if (selectedLang === 'en') {
        const data = await fetchEnglishAutocomplete(searchTerm)
        
        if (!controller.signal.aborted) {
          if (data.success && Array.isArray(data.data)) {
            // Processa risultati misti (carte e set)
            const processedResults: AutocompleteResultWithTranslation[] = data.data.map((result: AutocompleteResult) => {
              if (result.type === 'set') {
                // È un set, restituiscilo così com'è
                return { ...result, type: 'set' } as Set & { type: 'set' }
              } else {
                // È una carta (Printing)
                return { ...result, type: 'card' } as PrintingWithTranslation
              }
            })
            setResults(processedResults)
            setCached(data.cached || false)
            setError(null)
            setTranslatedName(null) // Nessuna traduzione per inglese
          } else {
            setResults([])
            setCached(false)
            setError(data.error || 'Errore durante la ricerca')
          }
        }
        return
      }

      // CASO 2: Altre lingue - usa ricerca ibrida con Fuse.js
      // Aspetta che il dizionario sia caricato
      if (isLangLoading || !fuseDictionary || !idToPreferredName || Object.keys(idToPreferredName).length === 0) {
        // Dizionario non ancora caricato: aspetta o fallback a ricerca inglese
        if (isLangLoading) {
          // Aspetta che il dizionario finisca di caricare
          return
        }
        const data = await fetchEnglishAutocomplete(searchTerm)
        
        if (!controller.signal.aborted) {
          if (data.success && Array.isArray(data.data)) {
            // Processa risultati misti
            const processedResults: AutocompleteResultWithTranslation[] = data.data.map((result: AutocompleteResult) => {
              if (result.type === 'set') {
                return { ...result, type: 'set' } as Set & { type: 'set' }
              } else {
                return { ...result, originalName: result.name, type: 'card' } as PrintingWithTranslation
              }
            })
            setResults(processedResults)
            setCached(data.cached || false)
            setError(null)
            setTranslatedName(null)
          } else {
            setResults([])
            setCached(false)
            setError(data.error || 'Errore durante la ricerca')
          }
        }
        return
      }

      // Cerca nel dizionario Fuse.js (cerca sia in 'preferred' che in 'name')
      const fuseResults = fuseDictionary.search(searchTerm.trim(), { limit: 10 })

      // CASO 2a: Nessun risultato nel dizionario - FALLBACK a ricerca inglese
      if (fuseResults.length === 0) {
        const data = await fetchEnglishAutocomplete(searchTerm)
        
        if (!controller.signal.aborted) {
          if (data.success && Array.isArray(data.data)) {
            // Processa risultati misti
            const processedResults: AutocompleteResultWithTranslation[] = data.data.map((result: AutocompleteResult) => {
              if (result.type === 'set') {
                return { ...result, type: 'set' } as Set & { type: 'set' }
              } else {
                return { ...result, originalName: result.name, type: 'card' } as PrintingWithTranslation
              }
            })
            setResults(processedResults)
            setCached(data.cached || false)
            setError(null)
            setTranslatedName(null)
          } else {
            setResults([])
            setCached(false)
            setError(data.error || 'Errore durante la ricerca')
          }
        }
        return
      }

      // CASO 2b: Trovati risultati nel dizionario - traduzione riuscita!
      // Estrai gli Oracle IDs unici dai risultati Fuse.js
      const oracleIds = [...new Set(fuseResults.map(result => result.item.id))]
      
      // Crea mappa id -> preferredName per mappare i risultati
      const idToPreferredMap: Record<string, string> = {}
      fuseResults.forEach(result => {
        idToPreferredMap[result.item.id] = result.item.preferred
      })

      // Chiama API by-oracle-id con tutti gli ID trovati
      const data = await fetchByOracleIds(oracleIds)
      
      if (!controller.signal.aborted) {
        if (data.success && Array.isArray(data.data)) {
          // Mappa i risultati sostituendo il nome con il preferredName quando disponibile
          // Nota: fetchByOracleIds restituisce solo carte, non set
          const mappedResults: AutocompleteResultWithTranslation[] = data.data
            .filter((result): result is Printing => result.type !== 'set')
            .map((printing: Printing) => {
              const preferredName = idToPreferredMap[printing.oracle_id]
              return {
                ...printing, // Preserva tutti i campi incluso image_uri_small
                name: preferredName || printing.name, // Usa preferredName se disponibile, altrimenti name originale
                preferredName: preferredName || undefined,
                originalName: printing.name, // Salva sempre il nome inglese originale
                type: 'card' as const,
              }
            })
          
          setResults(mappedResults)
          setCached(data.cached || false)
          setError(null)
          // Imposta il primo nome tradotto trovato come translatedName
          setTranslatedName(fuseResults[0]?.item?.preferred || null)
        } else {
          setResults([])
          setCached(false)
          setError(data.error || 'Errore durante la ricerca')
        }
      }
    } catch (err) {
      // Ignora errori di cancellazione
      if (err instanceof Error && err.name !== 'AbortError') {
        let errorMessage = 'Errore durante la ricerca'
        
        if (err.message.includes('Troppe richieste')) {
          errorMessage = err.message
        } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
          errorMessage = 'Errore di connessione'
        } else if (err.message.includes('HTTP error')) {
          if (err.message.includes('429')) {
            errorMessage = 'Troppe richieste. Attendi qualche secondo prima di riprovare.'
          } else {
            errorMessage = `Errore del server: ${err.message}`
          }
        }
        
        setError(errorMessage)
        setResults([])
        setCached(false)
      }
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        setLoading(false)
      }
    }
  }, [selectedLang, fuseDictionary, idToPreferredName, isLangLoading, minLength, fetchEnglishAutocomplete, fetchByOracleIds])

  // Effect per debounce
  useEffect(() => {
    // Cancella timeout precedente
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Debounce: aspetta prima di eseguire la ricerca
    timeoutRef.current = setTimeout(() => {
      performSearch(term)
    }, debounceMs)

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [term, performSearch, debounceMs])

  // Cleanup al unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return { results, loading, error, cached, translatedName }
}

