/**
 * Hook per recuperare il dettaglio di una carta con ristampa selezionata opzionale
 */

import { useState, useEffect } from 'react'
import { searchApiConfig } from '@/config/searchApi'
import type { CardDetailResponse, NavigationCardInfo, NavigationPrinting } from '@/types'

interface UseCardDetailOptions {
  printingId?: string | null
}

export function useCardDetail(oracleId: string, options: UseCardDetailOptions = {}) {
  const { printingId } = options
  const [cardInfo, setCardInfo] = useState<NavigationCardInfo | null>(null)
  const [selectedPrinting, setSelectedPrinting] = useState<NavigationPrinting | null>(null)
  const [printings, setPrintings] = useState<NavigationPrinting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cached, setCached] = useState(false)

  useEffect(() => {
    if (!oracleId) {
      setLoading(false)
      return
    }

    async function fetchCardDetail() {
      try {
        setLoading(true)
        setError(null)

        let url = searchApiConfig.endpoints.card(oracleId)
        if (printingId) {
          url += `?printing_id=${encodeURIComponent(printingId)}`
        }

        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
          },
        })

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Carta non trovata')
          }
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data: CardDetailResponse = await response.json()

        if (data.success && data.data) {
          setCardInfo(data.data.card_info)
          setPrintings(data.data.printings || [])
          setCached(data.cached || false)

          // Se abbiamo passato un printingId specifico e l'API restituisce selected_printing
          if (data.data.selected_printing) {
            setSelectedPrinting(data.data.selected_printing)
          } 
          // Se abbiamo passato un printingId ma l'API non restituisce selected_printing,
          // cerca quella specifica printing nell'array printings
          else if (printingId && data.data.printings && data.data.printings.length > 0) {
            const foundPrinting = data.data.printings.find(p => p.id === printingId)
            if (foundPrinting) {
              setSelectedPrinting(foundPrinting)
            } else {
              // Fallback: usa la prima solo se non abbiamo trovato quella specifica
              setSelectedPrinting(data.data.printings[0])
            }
          }
          // Se NON abbiamo passato printingId e non c'è selected_printing, usa la prima come fallback
          else if (!printingId && data.data.printings && data.data.printings.length > 0) {
            setSelectedPrinting(data.data.printings[0])
          } else {
            setSelectedPrinting(null)
          }
        } else {
          throw new Error(data.error || 'Failed to fetch card detail')
        }
      } catch (err: any) {
        setError(err.message || 'Error fetching card detail')
        setCardInfo(null)
        setSelectedPrinting(null)
        setPrintings([])
      } finally {
        setLoading(false)
      }
    }

    fetchCardDetail()
  }, [oracleId, printingId])

  // Se ancora non c'è selectedPrinting dopo il fetch E non abbiamo richiesto un printingId specifico,
  // prova a recuperare dalla pagina ristampe
  useEffect(() => {
    // NON fare fetch se:
    // - Non c'è oracleId
    // - Sta ancora caricando
    // - Già abbiamo selectedPrinting
    // - Abbiamo richiesto un printingId specifico (non vogliamo sovrascrivere)
    // - Già abbiamo printings
    if (!oracleId || loading || selectedPrinting || printingId || printings.length > 0) {
      return
    }

    async function fetchFirstPrinting() {
      try {
        const response = await fetch(
          searchApiConfig.endpoints.cardPrintings(oracleId),
          {
            headers: {
              'Accept': 'application/json',
            },
          }
        )

        if (response.ok) {
          const data = await response.json()
          if (data.success && data.data?.printings && data.data.printings.length > 0) {
            setSelectedPrinting(data.data.printings[0])
            setPrintings(data.data.printings)
          }
        }
      } catch (err) {
        // Silently fail - già abbiamo gestito l'errore principale
      }
    }

    fetchFirstPrinting()
  }, [oracleId, loading, selectedPrinting, printingId, printings.length])

  return { cardInfo, selectedPrinting, printings, loading, error, cached }
}

