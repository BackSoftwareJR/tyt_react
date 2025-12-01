/**
 * LanguageProvider Context
 * Gestisce lo stato della lingua selezionata, i dizionari di traduzione e Fuse.js
 * Aggiornato per la nuova struttura JSON: array di oggetti {id, name, preferred}
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import Fuse from 'fuse.js'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/lib/api'

// Nuova struttura dati: array di oggetti con id, name (inglese), preferred (tradotto)
export interface TranslationItem {
  id: string // Oracle ID
  name: string // Nome inglese (fallback)
  preferred: string // Nome tradotto (prioritario)
}

// Mappa per ricerca rapida: id -> preferredName
export interface IdToPreferredNameMap {
  [oracleId: string]: string // oracle_id -> preferredName
}

interface LanguageContextValue {
  selectedLang: string
  setSelectedLang: (lang: string) => void
  translationData: TranslationItem[] // Array completo di traduzioni
  idToPreferredName: IdToPreferredNameMap // Mappa per ricerca rapida
  fuseDictionary: Fuse<TranslationItem> | null // Fuse.js configurato per cercare in name e preferred
  isLangLoading: boolean
  availableLangs: string[]
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined)

// Lingue disponibili
const AVAILABLE_LANGS = ['en', 'it', 'fr', 'de', 'es', 'pt']

// Mappa nomi lingua visualizzati
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  it: 'Italiano',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
  pt: 'Português',
}

interface LanguageProviderProps {
  children: React.ReactNode
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [selectedLang, setSelectedLangState] = useState<string>('en')
  const [translationData, setTranslationData] = useState<TranslationItem[]>([])
  const [idToPreferredName, setIdToPreferredName] = useState<IdToPreferredNameMap>({})
  const [fuseDictionary, setFuseDictionary] = useState<Fuse<TranslationItem> | null>(null)
  const [isLangLoading, setIsLangLoading] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  
  const fuseRef = useRef<Fuse<TranslationItem> | null>(null)
  const isLoadingRef = useRef(false) // Ref per evitare chiamate multiple simultanee
  const wasAuthenticatedRef = useRef(false) // Ref per tracciare se l'utente era autenticato prima
  const unauthenticatedInitializedRef = useRef(false) // Ref per tracciare se abbiamo già inizializzato per utenti non autenticati
  const { isAuthenticated } = useAuthStore()

  // Funzione per caricare dizionario da IndexedDB o fetch
  const loadDictionary = useCallback(async (lang: string): Promise<TranslationItem[]> => {
    // Prima prova a recuperare da IndexedDB
    try {
      const dbName = 'TakeYourTradeLangDB'
      const storeName = 'translations'
      const version = 1

      return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, version)

        request.onerror = () => {
          // Se IndexedDB non è disponibile, vai al fetch
          fetchDictionary(lang).then(resolve).catch(reject)
        }

        request.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result
          const transaction = db.transaction([storeName], 'readonly')
          const store = transaction.objectStore(storeName)
          const getRequest = store.get(lang)

          getRequest.onsuccess = () => {
            const cached = getRequest.result
            if (cached && cached.data && cached.timestamp) {
              // Verifica se la cache è ancora valida (7 giorni)
              const cacheAge = Date.now() - cached.timestamp
              const cacheMaxAge = 7 * 24 * 60 * 60 * 1000 // 7 giorni

              if (cacheAge < cacheMaxAge) {
                console.log(`✅ Dizionario ${lang} caricato da IndexedDB`)
                resolve(cached.data)
                return
              }
            }
            // Cache non valida o non presente, fetch
            fetchDictionary(lang).then(resolve).catch(reject)
          }

          getRequest.onerror = () => {
            fetchDictionary(lang).then(resolve).catch(reject)
          }
        }

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName)
          }
        }
      })
    } catch (error) {
      console.warn('IndexedDB non disponibile, uso fetch diretto:', error)
      return fetchDictionary(lang)
    }
  }, [])

  // Funzione per fare fetch del dizionario
  const fetchDictionary = async (lang: string): Promise<TranslationItem[]> => {
    const response = await fetch(`/data/lang-maps/${lang}.json`, {
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to load dictionary for ${lang}`)
    }

    const data: TranslationItem[] = await response.json()

    // Salva in IndexedDB per cache
    try {
      const dbName = 'TakeYourTradeLangDB'
      const storeName = 'translations'
      const version = 1

      const request = indexedDB.open(dbName, version)

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        const transaction = db.transaction([storeName], 'readwrite')
        const store = transaction.objectStore(storeName)
        store.put({ data, timestamp: Date.now() }, lang)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName)
        }
      }
    } catch (error) {
      console.warn('Errore salvataggio IndexedDB:', error)
    }

    return data
  }

  // Effect per caricare la lingua preferita dall'API quando l'utente è loggato
  useEffect(() => {
    // Evita chiamate multiple simultanee
    if (isLoadingRef.current) {
      return
    }

    const loadUserLanguagePreference = async () => {
      // Se l'utente non è autenticato, non fare nulla (non chiamare API e non cambiare isInitialized)
      if (!isAuthenticated) {
        // Marca come inizializzato solo la prima volta per utenti non autenticati
        if (!unauthenticatedInitializedRef.current) {
          unauthenticatedInitializedRef.current = true
        }
        return
      }

      // Se già inizializzato, non ricaricare
      if (isInitialized) {
        return
      }

      // Marca come in caricamento
      isLoadingRef.current = true
      
      try {
        // La risposta API ha questa struttura: { success: true, data: { language_pref: "it" } }
        // api.get() restituisce ApiResponse<T> dove T è il tipo di data
        // Quindi response è { success: boolean, data?: { language_pref: string } }
        const response = await api.get<{ language_pref: string }>('/profile/settings')
        
        // ⚠️ IMPORTANTE: Accedi a response.data.language_pref (non response.data.data.language_pref)
        let userLanguage = 'en'
        
        if (response.success && response.data) {
          const langPref = response.data.language_pref
          if (langPref && AVAILABLE_LANGS.includes(langPref)) {
            userLanguage = langPref
          }
        }
        
        setSelectedLangState(userLanguage)
      } catch (error: any) {
        // In caso di errore, mantieni la lingua di default (en)
        setSelectedLangState('en')
      } finally {
        isLoadingRef.current = false
        setIsInitialized(true)
      }
    }

    loadUserLanguagePreference()
  }, [isAuthenticated, isInitialized])

  // Effect per resettare isInitialized quando l'utente fa logout
  useEffect(() => {
    // Reset solo quando l'utente passa da autenticato a non autenticato (logout)
    if (wasAuthenticatedRef.current && !isAuthenticated && isInitialized) {
      setIsInitialized(false)
      isLoadingRef.current = false
    }
    // Aggiorna il ref con lo stato corrente
    wasAuthenticatedRef.current = isAuthenticated
  }, [isAuthenticated, isInitialized])

  // Effect per caricare dizionario quando cambia selectedLang
  useEffect(() => {
    if (selectedLang === 'en') {
      // Inglese: svuota dizionario e Fuse
      setTranslationData([])
      setIdToPreferredName({})
      setFuseDictionary(null)
      fuseRef.current = null
      setIsLangLoading(false)
      return
    }

    // Altre lingue: carica dizionario
    setIsLangLoading(true)

    loadDictionary(selectedLang)
      .then((data) => {
        // Crea mappa id -> preferredName per ricerca rapida
        const idToPreferredMap: IdToPreferredNameMap = {}
        data.forEach((item) => {
          idToPreferredMap[item.id] = item.preferred
        })

        // Configurazione Fuse.js per ricerca fuzzy in entrambi i campi
        // Cerca sia in 'preferred' (tradotto) che in 'name' (inglese)
        const fuse = new Fuse(data, {
          keys: ['preferred', 'name'], // Cerca in entrambi i campi
          threshold: 0.3, // Soglia di similarità (0 = esatto, 1 = molto permissivo)
          minMatchCharLength: 2,
          includeScore: true,
          includeMatches: true,
        })

        setTranslationData(data)
        setIdToPreferredName(idToPreferredMap)
        setFuseDictionary(fuse)
        fuseRef.current = fuse
        setIsLangLoading(false)
        
        console.log(`✅ Dizionario ${selectedLang} caricato: ${data.length} traduzioni`)
      })
      .catch((error) => {
        console.error(`❌ Errore caricamento dizionario ${selectedLang}:`, error)
        setIsLangLoading(false)
        // Fallback: svuota e usa inglese
        setTranslationData([])
        setIdToPreferredName({})
        setFuseDictionary(null)
        fuseRef.current = null
      })
  }, [selectedLang, loadDictionary])

  const setSelectedLang = useCallback(async (lang: string) => {
    console.log('🔍 LanguageContext - setSelectedLang chiamato', { lang, isAuthenticated, currentLang: selectedLang })
    
    // Valida che la lingua sia tra quelle disponibili
    if (!AVAILABLE_LANGS.includes(lang)) {
      console.warn(`⚠️ LanguageContext - Lingua non valida: ${lang}`)
      return
    }

    // Aggiorna lo stato locale immediatamente per una UX fluida
    console.log(`🔄 LanguageContext - Aggiornamento lingua locale a: ${lang}`)
    setSelectedLangState(lang)

    // Se l'utente è autenticato, aggiorna anche la preferenza sul backend
    if (isAuthenticated) {
      console.log(`🔍 LanguageContext - Chiamata API PATCH /profile/settings/language con language_pref: ${lang}`)
      try {
        // ⚠️ IMPORTANTE: L'API si aspetta { language_pref: "it" } non { language: "it" }
        const response = await api.patch('/profile/settings/language', { language_pref: lang })
        console.log(`✅ LanguageContext - Lingua preferita aggiornata sul backend: ${lang}`, response)
        console.log('🔍 LanguageContext - Risposta update:', response)
      } catch (error: any) {
        console.error('❌ LanguageContext - Errore nell\'aggiornamento della lingua preferita:', error)
        console.error('❌ LanguageContext - Dettagli errore:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status
        })
        // Non facciamo rollback dello stato locale, l'utente ha già visto il cambio
        // ma logghiamo l'errore per debug
      }
    } else {
      console.log('🔍 LanguageContext - Utente non autenticato, skip API call')
    }
  }, [isAuthenticated, selectedLang])

  const value: LanguageContextValue = {
    selectedLang,
    setSelectedLang,
    translationData,
    idToPreferredName,
    fuseDictionary,
    isLangLoading,
    availableLangs: AVAILABLE_LANGS,
  }

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

// Hook per usare il LanguageContext
export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}

// Export LANGUAGE_NAMES per uso esterno
export { LANGUAGE_NAMES }

