/**
 * CardDetailPage
 * Pagina di dettaglio per una singola carta Magic: The Gathering
 */

import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Loader2, AlertCircle, Plus, Heart, Share2, Facebook, Twitter, Mail, ArrowLeftRight, Package, X, Upload, ShoppingCart, Filter, MapPin, Languages, Star, Image as ImageIcon, Camera } from 'lucide-react'
import ReactCountryFlag from 'react-country-flag'
import { useCardDetail } from '@/hooks/useCardDetail'
import { useAuthStore } from '@/store/authStore'
import type { NavigationPrinting } from '@/types'

// Mappa codici lingua ai nomi visualizzati
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  it: 'Italiano',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
  pt: 'Português',
  ja: '日本語',
  ko: '한국어',
  ru: 'Русский',
  zh: '中文',
}

const LANGUAGE_FLAG_CODES: Record<string, string> = {
  en: 'GB',
  it: 'IT',
  de: 'DE',
  fr: 'FR',
  es: 'ES',
  pt: 'PT',
  ja: 'JP',
  ko: 'KR',
  ru: 'RU',
  zh: 'CN',
  zh_hans: 'CN',
  zh_hant: 'TW',
}

const normalizeCountryCode = (code?: string): string => {
  if (!code) return 'US'
  const upper = code.toUpperCase()
  if (upper.length === 2) return upper
  if (upper.length === 3) return upper.slice(0, 2)
  return 'US'
}

const getLanguageFlagCode = (langCode: string): string => {
  const lower = langCode.toLowerCase()
  return LANGUAGE_FLAG_CODES[lower] || LANGUAGE_FLAG_CODES[lower.split('-')[0]] || 'US'
}

const FlagIcon = ({
  code,
  label,
  className,
  noBorder = false,
}: {
  code: string
  label: string
  className?: string
  noBorder?: boolean
}) => (
  <span
    className={`inline-flex items-center justify-center rounded-sm ${
      noBorder ? 'bg-transparent p-0 shadow-none' : 'border border-gray-200 bg-white p-0.5 shadow-sm'
    } ${className ?? ''}`}
  >
    <ReactCountryFlag
      svg
      countryCode={normalizeCountryCode(code)}
      aria-label={label}
      title={label}
      style={{ width: '1.5rem', height: '1.1rem' }}
      className="rounded-[2px]"
    />
  </span>
)

export default function CardDetailPage() {
  const { oracle_id } = useParams<{ oracle_id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const printingId = searchParams.get('printing_id')
  const { isAuthenticated } = useAuthStore()
  
  // Stato per la lingua selezionata (default: inglese)
  const [selectedLang, setSelectedLang] = useState<string>('en')
  const [activeTab, setActiveTab] = useState<'info' | 'sell' | 'wants'>('info')
  const [isCollectionModalOpen, setCollectionModalOpen] = useState(false)
  const [collectionForm, setCollectionForm] = useState({
    condition: 'NM',
    language: 'en',
    quantity: 1,
    price: '',
    notes: '',
    imageFile: null as File | null,
    isFoil: 'no',
  })
  
  const { cardInfo, selectedPrinting: initialSelectedPrinting, printings: allPrintings, loading, error, cached } = useCardDetail(
    oracle_id || '',
    { printingId }
  )

  // Determina la selectedPrinting basata sulla lingua selezionata (prima del filtro)
  const currentSelectedPrinting = useMemo(() => {
    if (printingId && allPrintings.length > 0) {
      const foundPrinting = allPrintings.find(p => p.id === printingId)
      if (foundPrinting) {
        return foundPrinting
      }
    }
    
    if (initialSelectedPrinting) {
      return initialSelectedPrinting
    }
    
    if (allPrintings.length > 0) {
      return allPrintings[0]
    }
    
    return null
  }, [printingId, allPrintings, initialSelectedPrinting])

  // Estrai le lingue disponibili SOLO per le printings dello stesso set della printing selezionata
  const availableLangs = useMemo(() => {
    if (!allPrintings || allPrintings.length === 0 || !currentSelectedPrinting) return ['en']
    
    const currentSetCode = currentSelectedPrinting.set_code
    
    const langs = new Set<string>()
    allPrintings.forEach(p => {
      if (p.set_code === currentSetCode) {
        const lang = p.lang || 'en'
        langs.add(lang)
      }
    })
    
    const sortedLangs = Array.from(langs).sort()
    return sortedLangs.length > 0 ? sortedLangs : ['en']
  }, [allPrintings, currentSelectedPrinting])

  // Filtra le printings in base alla lingua selezionata E allo stesso set della printing corrente
  const filteredPrintings = useMemo(() => {
    if (!allPrintings || allPrintings.length === 0 || !currentSelectedPrinting) return []
    
    const currentSetCode = currentSelectedPrinting.set_code
    
    return allPrintings.filter(p => {
      const printingLang = p.lang || 'en'
      return printingLang === selectedLang && p.set_code === currentSetCode
    })
  }, [allPrintings, selectedLang, currentSelectedPrinting])

  // Determina la selectedPrinting basata sulla lingua selezionata
  const selectedPrinting = useMemo(() => {
    if (printingId && filteredPrintings.length > 0) {
      const foundPrinting = filteredPrintings.find(p => p.id === printingId)
      if (foundPrinting) {
        return foundPrinting
      }
    }
    
    if (currentSelectedPrinting) {
      const currentLang = currentSelectedPrinting.lang || 'en'
      const currentSetCode = currentSelectedPrinting.set_code
      if (currentLang === selectedLang && currentSelectedPrinting.set_code === currentSetCode) {
        const stillExists = filteredPrintings.some(p => p.id === currentSelectedPrinting.id)
        if (stillExists) {
          return currentSelectedPrinting
        }
      }
    }
    
    if (filteredPrintings.length > 0) {
      return filteredPrintings[0]
    }
    
    return currentSelectedPrinting
  }, [printingId, filteredPrintings, currentSelectedPrinting, selectedLang])

  // Inizializza selectedLang quando arriva un printingId dalla URL
  useEffect(() => {
    if (initialSelectedPrinting && availableLangs.length > 0) {
      const printingLang = initialSelectedPrinting.lang || 'en'
      if (availableLangs.includes(printingLang) && printingLang !== selectedLang) {
        setSelectedLang(printingLang)
      }
    }
  }, [initialSelectedPrinting, availableLangs])

  // Aggiorna selectedLang quando cambiano le printings disponibili
  useEffect(() => {
    if (availableLangs.length > 0) {
      if (!availableLangs.includes(selectedLang)) {
        const newLang = availableLangs.includes('en') ? 'en' : availableLangs[0]
        setSelectedLang(newLang)
      }
      setCollectionForm((prev) => ({
        ...prev,
        language: availableLangs.includes(prev.language) ? prev.language : availableLangs.includes('en') ? 'en' : availableLangs[0],
      }))
    }
  }, [availableLangs, selectedLang])

  // Mantieni sincronizzata la lingua del form con la lingua selezionata
  useEffect(() => {
    setCollectionForm((prev) => ({
      ...prev,
      language: selectedLang,
    }))
  }, [selectedLang])

  const conditionOptions = [
    { value: 'NM', label: 'Near Mint (NM)' },
    { value: 'EX', label: 'Excellent (EX)' },
    { value: 'SP', label: 'Slightly Played (SP)' },
    { value: 'LP', label: 'Lightly Played (LP)' },
    { value: 'GD', label: 'Good (GD)' },
    { value: 'PL', label: 'Played (PL)' },
    { value: 'PO', label: 'Poor (PO)' },
  ]

  const conditionStyles: Record<string, string> = {
    NM: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
    SP: 'bg-lime-50 text-lime-600 border border-lime-200',
    MP: 'bg-amber-50 text-amber-600 border border-amber-200',
    LP: 'bg-yellow-50 text-yellow-600 border border-yellow-200',
    PL: 'bg-blue-50 text-blue-600 border border-blue-200',
    EX: 'bg-teal-50 text-teal-600 border border-teal-200',
    GD: 'bg-slate-50 text-slate-600 border border-slate-200',
    PO: 'bg-rose-50 text-rose-600 border border-rose-200',
  }

  type PlaceholderVendor = {
    id: number
    name: string
    rating: string
    countryCode: string
    languageCode: string
    condition: string
    hasPhoto: boolean
    previewImage: string
    info: string
    price: string
    quantityAvailable: number
    canTrade: boolean
  }

  const placeholderVendors = useMemo<PlaceholderVendor[]>(() => [
    {
      id: 1,
      name: 'KEEPSEVEN',
      rating: '43K',
      countryCode: 'DE',
      languageCode: 'en',
      condition: 'PO',
      hasPhoto: false,
      previewImage: 'https://images.unsplash.com/photo-1543362906-acfc16c67564?auto=format&fit=crop&w=320&q=60',
      info: '##A098.258##',
      price: '76,47 €',
      quantityAvailable: 1,
      canTrade: true,
    },
    {
      id: 2,
      name: 'RacoonRises',
      rating: '147K',
      countryCode: 'DE',
      languageCode: 'en',
      condition: 'PO',
      hasPhoto: false,
      previewImage: 'https://images.unsplash.com/photo-1600952841320-db92ec4047bd?auto=format&fit=crop&w=320&q=60',
      info: 'Special DjF | Khajit has wares if you h...',
      price: '76,48 €',
      quantityAvailable: 1,
      canTrade: false,
    },
    {
      id: 3,
      name: 'Olli-Baba',
      rating: '318K',
      countryCode: 'DE',
      languageCode: 'en',
      condition: 'GD',
      hasPhoto: false,
      previewImage: 'https://images.unsplash.com/photo-1519995451813-39e29e054914?auto=format&fit=crop&w=320&q=60',
      info: 'Special collection available.',
      price: '89,99 €',
      quantityAvailable: 1,
      canTrade: true,
    },
    {
      id: 4,
      name: 'kml666',
      rating: '891',
      countryCode: 'GB',
      languageCode: 'en',
      condition: 'LP',
      hasPhoto: false,
      previewImage: 'https://images.unsplash.com/photo-1529158062015-cad636e69505?auto=format&fit=crop&w=320&q=60',
      info: 'MTG is our love. Cheap shipping. (1)',
      price: '111,07 €',
      quantityAvailable: 1,
      canTrade: false,
    },
    {
      id: 5,
      name: 'RubyTrade',
      rating: '2K',
      countryCode: 'CZ',
      languageCode: 'en',
      condition: 'LP',
      hasPhoto: false,
      previewImage: 'https://images.unsplash.com/photo-1563298723-dcfebaa392e3?auto=format&fit=crop&w=320&q=60',
      info: 'MTG is our love. Cheap shipping. (1)',
      price: '113,99 €',
      quantityAvailable: 1,
      canTrade: true,
    },
    {
      id: 6,
      name: 'DonMTG',
      rating: '169K',
      countryCode: 'DE',
      languageCode: 'en',
      condition: 'LP',
      hasPhoto: true,
      previewImage: 'https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=320&q=60',
      info: 'Playin by Magic Bazar, all cards best quality.',
      price: '114,99 €',
      quantityAvailable: 1,
      canTrade: false,
    },
    {
      id: 7,
      name: 'peperoni',
      rating: '10',
      countryCode: 'PT',
      languageCode: 'en',
      condition: 'PO',
      hasPhoto: true,
      previewImage: 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=320&q=60',
      info: 'Bak /// LP',
      price: '120,00 €',
      quantityAvailable: 1,
      canTrade: true,
    },
    {
      id: 8,
      name: 'Olli-Baba',
      rating: '318K',
      countryCode: 'DE',
      languageCode: 'en',
      condition: 'LP',
      hasPhoto: false,
      previewImage: 'https://images.unsplash.com/photo-1473181488821-2d23949a045a?auto=format&fit=crop&w=320&q=60',
      info: 'Playin by Magic Bazar, all cards best quality.',
      price: '129,99 €',
      quantityAvailable: 3,
      canTrade: false,
    },
    {
      id: 9,
      name: 'Playin',
      rating: '123K',
      countryCode: 'FR',
      languageCode: 'en',
      condition: 'PL',
      hasPhoto: true,
      previewImage: 'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?auto=format&fit=crop&w=320&q=60',
      info: 'Playin by Magic Bazar, all cards best quality.',
      price: '149,99 €',
      quantityAvailable: 3,
      canTrade: true,
    },
    {
      id: 10,
      name: 'beldegor',
      rating: '140',
      countryCode: 'CH',
      languageCode: 'en',
      condition: 'PL',
      hasPhoto: false,
      previewImage: 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=320&q=60',
      info: 'Bought in 1995',
      price: '180,00 €',
      quantityAvailable: 1,
      canTrade: false,
    },
    {
      id: 11,
      name: 'MTGpriest',
      rating: '306',
      countryCode: 'GB',
      languageCode: 'en',
      condition: 'NM',
      hasPhoto: false,
      previewImage: 'https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=320&q=60',
      info: 'Ask for pics. Really nice card!',
      price: '186,94 €',
      quantityAvailable: 1,
      canTrade: true,
    },
    {
      id: 12,
      name: 'LondonMagicTraders',
      rating: '4K',
      countryCode: 'GB',
      languageCode: 'en',
      condition: 'LP',
      hasPhoto: true,
      previewImage: 'https://images.unsplash.com/photo-1531256456869-ce942a665e80?auto=format&fit=crop&w=320&q=60',
      info: 'HEAVILY PLAYED (see Photos)',
      price: '187,03 €',
      quantityAvailable: 1,
      canTrade: false,
    },
    {
      id: 13,
      name: 'goodman123',
      rating: '4K',
      countryCode: 'DE',
      languageCode: 'en',
      condition: 'GD',
      hasPhoto: false,
      previewImage: 'https://images.unsplash.com/photo-1549923476-35262b5833ad?auto=format&fit=crop&w=320&q=60',
      info: 'Ask for pics. Really nice card!',
      price: '194,48 €',
      quantityAvailable: 1,
      canTrade: true,
    },
    {
      id: 14,
      name: 'Dobi-trading-DE',
      rating: '262K',
      countryCode: 'DE',
      languageCode: 'en',
      condition: 'GD',
      hasPhoto: false,
      previewImage: 'https://images.unsplash.com/photo-1521579971123-1192931a1452?auto=format&fit=crop&w=320&q=60',
      info: 'Beauty!',
      price: '194,98 €',
      quantityAvailable: 1,
      canTrade: false,
    },
    {
      id: 15,
      name: 'malinjacques',
      rating: '2K',
      countryCode: 'FR',
      languageCode: 'fr',
      condition: 'PL',
      hasPhoto: false,
      previewImage: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=320&q=60',
      info: 'Beauty!',
      price: '195,00 €',
      quantityAvailable: 1,
      canTrade: true,
    },
    {
      id: 16,
      name: 'ItalPlay',
      rating: '12K',
      countryCode: 'IT',
      languageCode: 'it',
      condition: 'EX',
      hasPhoto: true,
      previewImage: 'https://images.unsplash.com/photo-1522012063384-1a70c4f6ccaa?auto=format&fit=crop&w=320&q=60',
      info: 'Chiedi foto, carta splendida!',
      price: '199,00 €',
      quantityAvailable: 2,
      canTrade: false,
    },
    {
      id: 17,
      name: 'LisbonCards',
      rating: '3K',
      countryCode: 'PT',
      languageCode: 'pt',
      condition: 'LP',
      hasPhoto: true,
      previewImage: 'https://images.unsplash.com/photo-1473186578172-c141e6798cf4?auto=format&fit=crop&w=320&q=60',
      info: 'Fotos disponibili su richiesta.',
      price: '205,00 €',
      quantityAvailable: 1,
      canTrade: true,
    },
    {
      id: 18,
      name: 'MadridCollectibles',
      rating: '21K',
      countryCode: 'ES',
      languageCode: 'es',
      condition: 'NM',
      hasPhoto: false,
      previewImage: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=320&q=60',
      info: 'Nueva colección disponible hoy.',
      price: '212,00 €',
      quantityAvailable: 1,
      canTrade: false,
    },
    {
      id: 19,
      name: 'TokyoVault',
      rating: '54K',
      countryCode: 'JP',
      languageCode: 'ja',
      condition: 'NM',
      hasPhoto: true,
      previewImage: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=320&q=60',
      info: 'シングルカード最新入荷。',
      price: '215,00 €',
      quantityAvailable: 1,
      canTrade: true,
    },
    {
      id: 20,
      name: 'NordicDecks',
      rating: '7K',
      countryCode: 'SE',
      languageCode: 'en',
      condition: 'SP',
      hasPhoto: false,
      previewImage: 'https://images.unsplash.com/photo-1526481280695-3c469928b67b?auto=format&fit=crop&w=320&q=60',
      info: 'Nordic shipping available.',
      price: '219,50 €',
      quantityAvailable: 1,
      canTrade: false,
    },
  ], [])

  const [conditionFilter, setConditionFilter] = useState<string>('all')
  const [countryFilter, setCountryFilter] = useState<string>('all')
  const [languageFilter, setLanguageFilter] = useState<string>('all')
  const [activeFilterPanel, setActiveFilterPanel] = useState<'condition' | 'country' | 'language' | null>(null)

  const conditionLabelMap = useMemo(() => {
    const map: Record<string, string> = {}
    conditionOptions.forEach((option) => {
      map[option.value] = option.label
    })
    return map
  }, [conditionOptions])

  const availableConditions = useMemo(() => {
    const unique = new Set<string>()
    placeholderVendors.forEach((vendor) => unique.add(vendor.condition))
    return Array.from(unique)
      .filter((value) => value in conditionLabelMap)
      .sort((a, b) => {
        const order = ['NM', 'EX', 'SP', 'LP', 'GD', 'PL', 'PO']
        return order.indexOf(a) - order.indexOf(b)
      })
  }, [conditionLabelMap, placeholderVendors])

  const availableCountries = useMemo(() => {
    const unique = new Set<string>()
    placeholderVendors.forEach((vendor) => unique.add(vendor.countryCode))
    return Array.from(unique).sort()
  }, [placeholderVendors])

  const languageFilterOptions = useMemo(() => {
    const matching = new Set<string>()
    availableLangs.forEach((lang) => {
      if (placeholderVendors.some((vendor) => vendor.languageCode === lang)) {
        matching.add(lang)
      }
    })

    if (matching.size === 0) {
      placeholderVendors.forEach((vendor) => matching.add(vendor.languageCode))
    }

    return Array.from(matching).sort()
  }, [availableLangs, placeholderVendors])

  useEffect(() => {
    if (languageFilter !== 'all' && !languageFilterOptions.includes(languageFilter)) {
      setLanguageFilter('all')
    }
  }, [languageFilter, languageFilterOptions])

  const filteredVendors = useMemo(() => {
    return placeholderVendors.filter((vendor) => {
      const matchCondition = conditionFilter === 'all' || vendor.condition === conditionFilter
      const matchCountry = countryFilter === 'all' || vendor.countryCode === countryFilter
      const matchLanguage = languageFilter === 'all' || vendor.languageCode === languageFilter
      return matchCondition && matchCountry && matchLanguage
    })
  }, [placeholderVendors, conditionFilter, countryFilter, languageFilter])

  const buildFilterButtonClasses = (isActive: boolean) =>
    `rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
      isActive
        ? 'bg-orange-500 text-white shadow-sm'
        : 'border border-gray-200 bg-white text-gray-600 hover:border-orange-400 hover:text-orange-500'
    }`

  const toggleFilterPanel = (panel: 'condition' | 'country' | 'language') => {
    setActiveFilterPanel((prev) => (prev === panel ? null : panel))
  }


  const handleCollectionInputChange = (field: 'condition' | 'language' | 'quantity' | 'price' | 'notes' | 'isFoil', value: string) => {
    setCollectionForm((prev) => ({
      ...prev,
      [field]: field === 'quantity' ? Math.max(1, parseInt(value || '1', 10)) : value,
    }))
  }

  const handleCollectionImageChange = (file: File | null) => {
    setCollectionForm((prev) => ({
      ...prev,
      imageFile: file,
    }))
  }

  const resetCollectionForm = () => {
    setCollectionForm({
      condition: 'NM',
      language: availableLangs.includes(selectedLang) ? selectedLang : availableLangs[0] || 'en',
      quantity: 1,
      price: '',
      notes: '',
      imageFile: null,
      isFoil: 'no',
    })
  }

  const openCollectionModal = () => {
    resetCollectionForm()
    setCollectionModalOpen(true)
  }

  const closeCollectionModal = () => {
    setCollectionModalOpen(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="card p-12 text-center">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Caricamento dettaglio carta...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="card p-12 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Errore</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button onClick={() => navigate(-1)} className="btn-primary">
              Torna indietro
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!cardInfo) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="card p-12 text-center">
            <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Carta non trovata</h2>
            <p className="text-gray-600 mb-6">La carta richiesta non esiste o è stata rimossa.</p>
            <button onClick={() => navigate(-1)} className="btn-primary">
              Torna indietro
            </button>
          </div>
        </div>
      </div>
    )
  }

  const cardName = cardInfo.name || 'Carta Sconosciuta'
  const setName = selectedPrinting?.set_name || ''
  const cardType = cardInfo.type_line || ''
  const collectorNumber = selectedPrinting?.collector_number || ''
  const rarity = selectedPrinting?.rarity || ''
  const price = selectedPrinting?.eur ? parseFloat(selectedPrinting.eur).toFixed(2) : '0.00'
  const reprintsCount = allPrintings.length

  return (
    <>
      <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Breadcrumb e Support */}
        <div className="flex items-center justify-between mb-6">
          <nav className="text-sm text-gray-600">
          <Link to="/" className="hover:text-gray-900 transition-colors">
              Prodotti (Magic: The Gathering)
          </Link>
          {' / '}
          <Link to="/search" className="hover:text-gray-900 transition-colors">
              Singles
            </Link>
            {setName && (
              <>
                {' / '}
                <Link to={`/set/${selectedPrinting?.set_code}`} className="hover:text-gray-900 transition-colors">
                  {setName}
                </Link>
              </>
            )}
            {' / '}
            <span className="text-gray-900">{cardName}</span>
          </nav>
          <Link to="/support" className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
            <span>?</span>
            <span>Contattare il Support</span>
          </Link>
        </div>

        {/* Titolo Carta */}
        <div className="mb-4">
          <h1 className="text-3xl font-bold text-orange-600 mb-1">{cardName}</h1>
          <p className="text-gray-500 text-sm">
            {setName && `${setName} - `}
            {cardType && `${cardType} - `}
            Singles
          </p>
        </div>

        {/* Pulsanti Azione Principali */}
        {isAuthenticated && (
          <div className="flex justify-center gap-3 mb-6">
            <button
              onClick={() => setActiveTab('info')}
              className={`px-6 py-3 text-sm font-semibold transition-all duration-200 rounded-lg flex items-center gap-2 ${
                activeTab === 'info'
                  ? 'bg-orange-500 text-white shadow-md hover:bg-orange-600'
                  : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-orange-400 hover:bg-orange-50'
              }`}
            >
              <ArrowLeftRight className="w-4 h-4" />
              Scambiare
            </button>
          <button
              onClick={() => setActiveTab('sell')}
              className={`px-6 py-3 text-sm font-semibold transition-all duration-200 rounded-lg flex items-center gap-2 ${
                activeTab === 'sell'
                  ? 'bg-orange-500 text-white shadow-md hover:bg-orange-600'
                  : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-orange-400 hover:bg-orange-50'
              }`}
          >
              <Plus className="w-4 h-4" />
              Vendere
          </button>
                  <button
              onClick={() => {
                setActiveTab('wants')
                openCollectionModal()
              }}
              className={`px-6 py-3 text-sm font-semibold transition-all duration-200 rounded-lg flex items-center gap-2 ${
                activeTab === 'wants'
                  ? 'bg-orange-500 text-white shadow-md hover:bg-orange-600'
                  : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-orange-400 hover:bg-orange-50'
                    }`}
                  >
              <Package className="w-4 h-4" />
              Collezione
                  </button>
            </div>
          )}

        {/* Layout a tre colonne */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Colonna Sinistra - Immagine Carta */}
          <div className="space-y-4">
            {/* Immagine Carta (più piccola) */}
            <div className="aspect-[488/680] max-w-xs mx-auto lg:mx-0 rounded-lg overflow-hidden bg-gray-100 shadow-md">
              {selectedPrinting?.image_uri_normal || selectedPrinting?.image_uri_small ? (
                <img
                  src={selectedPrinting.image_uri_normal || selectedPrinting.image_uri_small!}
                  alt={cardName}
                  className="w-full h-full object-cover"
                  key={selectedPrinting.id} // Force re-render quando cambia la printing
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <span className="text-lg">Immagine non disponibile</span>
                </div>
              )}
            </div>

            {/* Selettori Lingua */}
            {availableLangs.length > 1 && (
              <div className="max-w-xs mx-auto lg:mx-0">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Lingua disponibile:
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableLangs.map((lang) => {
                    // Trova la printing per questa lingua nello stesso set
                    const printingForLang = currentSelectedPrinting 
                      ? allPrintings.find(p => 
                          p.lang === lang && 
                          p.set_code === currentSelectedPrinting.set_code
                        )
                      : null

                    return (
                <button
                        key={lang}
                        onClick={() => {
                          setSelectedLang(lang)
                          // Aggiorna l'URL con il nuovo printing_id se disponibile
                          if (printingForLang && printingForLang.id !== printingId) {
                            navigate(`/card/${oracle_id}?printing_id=${printingForLang.id}`, { replace: true })
                          }
                        }}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                          selectedLang === lang
                            ? 'bg-orange-500 text-white shadow-md'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                        }`}
                      >
                        {LANGUAGE_NAMES[lang] || lang.toUpperCase()}
                </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Colonna Centrale - Proprietà Carta */}
          <div className="space-y-4">
            {/* Proprietà Carta */}
            <div className="space-y-2 text-sm">
              {rarity && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 font-medium min-w-[100px]">Rarità:</span>
                  <span className="text-gray-900 capitalize">{rarity}</span>
                </div>
              )}
              {collectorNumber && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 font-medium min-w-[100px]">Numero:</span>
                  <span className="text-gray-900">{collectorNumber}</span>
                </div>
              )}
              {setName && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 font-medium min-w-[100px]">Stampata in:</span>
                  <Link
                    to={`/set/${selectedPrinting?.set_code}`}
                    className="text-orange-600 hover:text-orange-700 underline"
                  >
                    {setName}
                  </Link>
                  </div>
                )}
              {reprintsCount > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 font-medium min-w-[100px]">Ristampe:</span>
                  <Link
                    to={`/card/${oracle_id}/printings`}
                    className="text-orange-600 hover:text-orange-700 underline"
                  >
                    Mostra le ristampe ({reprintsCount})
                  </Link>
                  </div>
                )}
              <div className="flex items-center gap-2">
                <span className="text-gray-600 font-medium min-w-[100px]">Articoli disponibili:</span>
                <span className="text-gray-900">2757</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-600 font-medium min-w-[100px]">Da:</span>
                <span className="text-gray-900 font-semibold">{price} €</span>
              </div>
            </div>

            {/* Pulsanti sotto le informazioni */}
            <div className="flex flex-col gap-2 pt-2">
              {reprintsCount > 0 && (
                <Link
                  to={`/card/${oracle_id}/printings`}
                  className="w-full bg-gray-50 text-gray-700 py-2.5 px-4 rounded-lg font-medium hover:bg-gray-100 transition-all duration-200 text-center border border-gray-200 hover:border-gray-300 hover:shadow-sm"
                >
                  Vedi le ristampe
                </Link>
              )}
              {selectedPrinting?.set_code && (
                <Link
                  to={`/set/${selectedPrinting.set_code}`}
                  className="w-full bg-gray-50 text-gray-700 py-2.5 px-4 rounded-lg font-medium hover:bg-gray-100 transition-all duration-200 text-center border border-gray-200 hover:border-gray-300 hover:shadow-sm"
                >
                  Vedi set completo
                </Link>
              )}
            </div>

            {/* Rules Text */}
            {cardInfo.oracle_text && (
              <div className="pt-3 border-t border-gray-200">
                <h3 className="text-base font-semibold text-gray-900 mb-2">Rules text</h3>
                <p className="text-gray-700 text-sm whitespace-pre-wrap">{cardInfo.oracle_text}</p>
              </div>
            )}
          </div>

          {/* Colonna Destra - Grafico, Prezzi, Azioni */}
          <div className="space-y-4">
            {/* Grafico Prezzo (Placeholder) */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-base font-semibold text-gray-900 mb-3">Prezzo medio di vendita</h3>
              <div className="h-48 bg-gray-100 rounded flex items-center justify-center">
                <p className="text-gray-400 text-sm">Grafico placeholder</p>
              </div>
            </div>

            {/* Prezzi Medi */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                <span className="text-gray-600">Tendenza di prezzo:</span>
                <span className="font-semibold text-gray-900">0,64 €</span>
                  </div>
                  <div className="flex justify-between">
                <span className="text-gray-600">Prezzo medio 30 giorni:</span>
                <span className="font-semibold text-gray-900">0,55 €</span>
                  </div>
                  <div className="flex justify-between">
                <span className="text-gray-600">Prezzo medio 7 giorni:</span>
                <span className="font-semibold text-gray-900">0,62 €</span>
                  </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Prezzo medio 1 giorno:</span>
                <span className="font-semibold text-gray-900">0,57 €</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sezione Venditori */}
        <div className="mt-8 flex gap-5">
          <div className="relative">
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
              <button
                type="button"
                onClick={() => toggleFilterPanel('condition')}
                className={`relative flex h-12 w-12 items-center justify-center rounded-xl border transition-all ${
                  activeFilterPanel === 'condition'
                    ? 'border-orange-500 bg-orange-500 text-white shadow-md'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-orange-400 hover:text-orange-500'
                }`}
              >
                <Filter className="h-5 w-5" />
                {conditionFilter !== 'all' && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-orange-500 ring-2 ring-white" />
                )}
              </button>
              <button
                type="button"
                onClick={() => toggleFilterPanel('country')}
                className={`relative flex h-12 w-12 items-center justify-center rounded-xl border transition-all ${
                  activeFilterPanel === 'country'
                    ? 'border-orange-500 bg-orange-500 text-white shadow-md'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-orange-400 hover:text-orange-500'
                }`}
              >
                <MapPin className="h-5 w-5" />
                {countryFilter !== 'all' && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-orange-500 ring-2 ring-white" />
                )}
              </button>
              <button
                type="button"
                onClick={() => toggleFilterPanel('language')}
                className={`relative flex h-12 w-12 items-center justify-center rounded-xl border transition-all ${
                  activeFilterPanel === 'language'
                    ? 'border-orange-500 bg-orange-500 text-white shadow-md'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-orange-400 hover:text-orange-500'
                }`}
              >
                <Languages className="h-5 w-5" />
                {languageFilter !== 'all' && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-orange-500 ring-2 ring-white" />
                )}
              </button>
            </div>

            {activeFilterPanel && (
              <div className="absolute left-[76px] top-0 z-30 w-64 rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">
                    {activeFilterPanel === 'condition' && 'Filtra per condizione'}
                    {activeFilterPanel === 'country' && 'Filtra per nazione'}
                    {activeFilterPanel === 'language' && 'Filtra per lingua'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveFilterPanel(null)}
                    className="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                    aria-label="Chiudi filtri"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {activeFilterPanel === 'condition' && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setConditionFilter('all')
                        setActiveFilterPanel(null)
                      }}
                      className={buildFilterButtonClasses(conditionFilter === 'all')}
                    >
                      Tutte
                    </button>
                    {availableConditions.map((condition) => (
                      <button
                        key={condition}
                        type="button"
                        onClick={() => {
                          setConditionFilter(condition)
                          setActiveFilterPanel(null)
                        }}
                        className={buildFilterButtonClasses(conditionFilter === condition)}
                      >
                        {condition}
                      </button>
                    ))}
                  </div>
                )}

                {activeFilterPanel === 'country' && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCountryFilter('all')
                        setActiveFilterPanel(null)
                      }}
                      className={buildFilterButtonClasses(countryFilter === 'all')}
                    >
                      Tutte
                    </button>
                    {availableCountries.map((country) => (
                      <button
                        key={country}
                        type="button"
                        onClick={() => {
                          setCountryFilter(country)
                          setActiveFilterPanel(null)
                        }}
                        className={`${buildFilterButtonClasses(countryFilter === country)} flex items-center gap-2`}
                      >
                        <FlagIcon code={country} label={`Paese: ${country}`} />
                        <span className="text-xs font-medium text-gray-600">{country.toUpperCase()}</span>
                      </button>
                    ))}
                  </div>
                )}

                {activeFilterPanel === 'language' && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setLanguageFilter('all')
                        setActiveFilterPanel(null)
                      }}
                      className={buildFilterButtonClasses(languageFilter === 'all')}
                    >
                      Tutte
                    </button>
                    {languageFilterOptions.map((language) => (
                      <button
                        key={language}
                        type="button"
                        onClick={() => {
                          setLanguageFilter(language)
                          setActiveFilterPanel(null)
                        }}
                        className={buildFilterButtonClasses(languageFilter === language)}
                      >
                        {LANGUAGE_NAMES[language] || language.toUpperCase()}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-3 text-white">
              <h2 className="text-sm font-semibold uppercase tracking-wide">Informazioni sul prodotto</h2>
              <span className="text-sm font-semibold uppercase tracking-wide">Offerta</span>
            </div>
            <div className="overflow-x-auto overflow-y-visible">
              <table className="w-full min-w-[1020px] table-fixed">
                <colgroup>
                  <col className="w-[28%]" />
                  <col className="w-[20%]" />
                  <col className="w-[26%]" />
                  <col className="w-[18%]" />
                  <col className="w-[8%]" />
                </colgroup>
                <thead className="bg-gray-50">
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-6 py-2.5">Venditore</th>
                    <th className="px-6 py-2.5">Condizione &amp; Lingua</th>
                    <th className="px-6 py-2.5">Informazioni sul prodotto</th>
                    <th className="px-6 py-2.5 text-right">Offerta</th>
                    <th className="px-4 py-2.5 text-center">Scambi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVendors.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-6 text-center text-sm text-gray-600">
                        Nessun venditore corrisponde ai filtri selezionati.
                      </td>
                    </tr>
                  ) : (
                    filteredVendors.map((vendor, index) => {
                      const conditionLabel = conditionLabelMap[vendor.condition] || vendor.condition
                      const languageName = LANGUAGE_NAMES[vendor.languageCode] || vendor.languageCode.toUpperCase()
                      const languageFlagCode = getLanguageFlagCode(vendor.languageCode)

                      return (
                      <tr
                        key={vendor.id}
                        className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} border-b border-gray-200 last:border-b-0 hover:bg-orange-50 transition-colors`}
                      >
                        <td className="px-6 py-3 align-top">
                          <div className="flex items-center gap-3">
                            <span
                              className="inline-flex items-center gap-1 rounded-md bg-orange-50 px-1.5 py-0.5 text-[11px] font-semibold text-orange-600 shadow-sm"
                              title={`Vendite totali: ${vendor.rating}`}
                            >
                              <Star className="h-2.5 w-2.5" />
                              <span className="tracking-tight">{vendor.rating}</span>
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-gray-900">{vendor.name}</span>
                              <FlagIcon code={vendor.countryCode} label={`Paese venditore: ${vendor.countryCode}`} />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3 align-top">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                            <span
                              className={`inline-flex items-center justify-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide shadow-sm ${
                                conditionStyles[vendor.condition] ?? 'bg-gray-100 text-gray-600 border border-gray-200'
                              }`}
                              title={conditionLabel}
                            >
                              {vendor.condition}
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-medium text-gray-700 shadow-sm">
                              <FlagIcon
                                code={languageFlagCode}
                                label={`Lingua: ${languageName}`}
                                noBorder
                                className="h-3.5 w-5"
                              />
                              {languageName}
                            </span>
                            {vendor.hasPhoto && (
                              <div className="group relative inline-flex">
                                <Camera className="h-5 w-5 text-indigo-600 cursor-pointer" />
                                <div className="absolute left-1/2 top-6 z-40 hidden w-[240px] -translate-x-1/2 rounded-2xl border border-gray-200 bg-white/95 p-2 shadow-2xl backdrop-blur-sm group-hover:flex">
                                  <img
                                    src={vendor.previewImage}
                                    alt={`Anteprima ${vendor.name}`}
                                    className="aspect-[488/680] w-full rounded-xl object-cover"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-3 align-top">
                          <p className="max-w-[420px] truncate text-sm text-gray-700" title={vendor.info}>
                            {vendor.info}
                          </p>
                        </td>
                        <td className="px-6 py-3 align-top">
                          <div className="flex items-center justify-end gap-3">
                            <span className="text-sm font-semibold text-gray-900">{vendor.price}</span>
                            {vendor.quantityAvailable > 1 ? (
                              <select className="h-8 rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-700 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-300">
                                {Array.from({ length: Math.min(10, vendor.quantityAvailable) }, (_, idx) => idx + 1).map((option) => (
                                  <option key={`${vendor.id}-${option}`} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-xs text-gray-500">Qtà {vendor.quantityAvailable}</span>
                            )}
                            <button className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-orange-400">
                              <ShoppingCart className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex items-center justify-center">
                            {vendor.canTrade && (
                              <button
                                className="inline-flex items-center gap-1 rounded-md bg-orange-50 px-2 py-1.5 text-[11px] font-semibold text-orange-600 shadow-sm transition-all hover:bg-orange-100 hover:shadow-md"
                                title="Scambia"
                              >
                                <ArrowLeftRight className="h-3.5 w-3.5" />
                                <span>Scambia</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                  )}
                </tbody>
              </table>
              {/* Spazio bianco in fondo alla tabella per l'immagine hover */}
              <div className="h-[400px]"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

      {/* Modal Collezione */}
      {isCollectionModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 px-4 py-6">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Aggiungi alla collezione</h2>
                <p className="text-sm text-gray-500">
                  {cardName} • {setName} {selectedPrinting?.collector_number ? `#${selectedPrinting.collector_number}` : ''}
                </p>
              </div>
              <button
                onClick={closeCollectionModal}
                className="p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                aria-label="Chiudi modale collezione"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Condizione */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Condizione</label>
                  <div className="bg-gray-50 rounded-xl p-2 border border-gray-200">
                    <div className="grid grid-cols-1 gap-2">
                      {conditionOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => handleCollectionInputChange('condition', option.value)}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                            collectionForm.condition === option.value
                              ? 'bg-orange-500 text-white shadow-sm'
                              : 'bg-white text-gray-700 border border-gray-200 hover:border-orange-400'
                          }`}
                          type="button"
                        >
                          <span>{option.label}</span>
                          {collectionForm.condition === option.value && <span className="text-xs uppercase">Scelta</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Lingua */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Lingua</label>
                  <div className="bg-white border border-gray-200 rounded-xl px-3 py-2.5">
                    <select
                      value={collectionForm.language}
                      onChange={(e) => handleCollectionInputChange('language', e.target.value)}
                      className="w-full bg-transparent text-sm text-gray-700 focus:outline-none"
                    >
                      {availableLangs.map((lang) => (
                        <option key={lang} value={lang}>
                          {LANGUAGE_NAMES[lang] || lang.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Quantità */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Quantità</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCollectionInputChange('quantity', String(Math.max(1, collectionForm.quantity - 1)))}
                      className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 text-gray-600 hover:border-orange-400 hover:text-orange-500"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={collectionForm.quantity}
                      onChange={(e) => handleCollectionInputChange('quantity', e.target.value)}
                      className="flex-1 h-10 text-center border border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-200 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => handleCollectionInputChange('quantity', String(collectionForm.quantity + 1))}
                      className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 text-gray-600 hover:border-orange-400 hover:text-orange-500"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Prezzo */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Prezzo di acquisto (€)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={collectionForm.price}
                    onChange={(e) => handleCollectionInputChange('price', e.target.value)}
                    placeholder="0,00"
                    className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                  />
                </div>

                {/* Foil */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Foil</label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => handleCollectionInputChange('isFoil', 'yes')}
                      className={`flex-1 h-10 rounded-xl border text-sm font-medium transition-all ${
                        collectionForm.isFoil === 'yes'
                          ? 'border-orange-500 bg-orange-50 text-orange-600'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-orange-400 hover:text-orange-500'
                      }`}
                    >
                      Sì
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCollectionInputChange('isFoil', 'no')}
                      className={`flex-1 h-10 rounded-xl border text-sm font-medium transition-all ${
                        collectionForm.isFoil === 'no'
                          ? 'border-orange-500 bg-orange-50 text-orange-600'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-orange-400 hover:text-orange-500'
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>
              </div>

              {/* Note */}
              <div className="mt-5">
                <label className="text-sm font-medium text-gray-700 mb-2 block">Note (opzionale)</label>
                <textarea
                  value={collectionForm.notes}
                  onChange={(e) => handleCollectionInputChange('notes', e.target.value)}
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-200 resize-none"
                  placeholder="Aggiungi note su questa ristampa..."
                />
              </div>

              {/* Foto */}
              <div className="mt-5">
                <label className="text-sm font-medium text-gray-700 mb-2 block">Foto</label>
                <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-300 rounded-2xl py-6 cursor-pointer hover:border-orange-400 transition-colors">
                  <Upload className="w-8 h-8 text-gray-400" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-700">Carica una foto</p>
                    <p className="text-xs text-gray-500">JPG, PNG fino a 5MB</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleCollectionImageChange(e.target.files ? e.target.files[0] : null)}
                  />
                </label>
                {collectionForm.imageFile && (
                  <p className="mt-2 text-xs text-gray-500">
                    Selezionata: <span className="font-medium text-gray-700">{collectionForm.imageFile.name}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50 rounded-b-2xl">
              <button
                onClick={closeCollectionModal}
                className="text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
              >
                Annulla
              </button>
              <button
                className="px-5 py-2 text-sm font-semibold text-white bg-orange-500 rounded-lg shadow-sm hover:bg-orange-600 transition-all"
              >
                Aggiungi alla collezione
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
