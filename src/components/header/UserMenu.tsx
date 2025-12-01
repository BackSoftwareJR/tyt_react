/**
 * UserMenu Component
 * Menu dropdown per utenti loggati (Account, Vendite, Acquisti, Carrello)
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User,
  ChevronDown,
  MessageCircle,
  CreditCard,
  ShoppingBag,
  Folder,
  TrendingUp,
  Gavel,
  PlusCircle,
  ShoppingCart,
  Bookmark,
  Gift,
  RefreshCcw,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { formatPrice } from '@/lib/utils'

export default function UserMenu() {
  const { user } = useAuthStore()
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)

  const toggleDropdown = (dropdownName: string) => {
    setActiveDropdown(activeDropdown === dropdownName ? null : dropdownName)
  }

  const closeAllDropdowns = () => {
    setActiveDropdown(null)
  }

  // Chiudi dropdown quando si clicca fuori
  useEffect(() => {
    const handleClickOutside = () => {
      closeAllDropdowns()
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const dropdownVariants = {
    hidden: { opacity: 0, y: -10, scale: 0.95 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 24,
      }
    },
    exit: { 
      opacity: 0, 
      y: -10,
      scale: 0.95,
      transition: {
        duration: 0.15
      }
    }
  }

  return (
    <div className="hidden lg:flex items-center gap-6">
      {/* 1. Account Dropdown */}
      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation()
            toggleDropdown('account')
          }}
          className="flex items-center gap-2 px-4 py-2.5 min-h-[48px]
                   bg-white border-2 border-orange-500 text-gray-700 rounded-lg
                   font-semibold text-[14px]
                   hover:bg-orange-50/50 hover:shadow-[0_0_16px_rgba(255,165,0,0.3)]
                   transition-all duration-200"
        >
          <User className="w-4 h-4 text-orange-500" />
          <span className="text-gray-900">{user?.username || 'Account'}</span>
          <ChevronDown className={`w-4 h-4 text-orange-500 transition-transform duration-200 ${
            activeDropdown === 'account' ? 'rotate-180' : ''
          }`} />
        </button>

        <AnimatePresence>
          {activeDropdown === 'account' && (
            <motion.div
              variants={dropdownVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="absolute top-[calc(100%+8px)] left-0 w-56 bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] overflow-hidden z-50"
            >
              <Link 
                to="/account" 
                className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors duration-150"
              >
                <User className="w-4 h-4 text-orange-500" />
                <span className="font-medium">Account</span>
              </Link>
              <Link 
                to="/account/synchronization" 
                className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors duration-150"
              >
                <RefreshCcw className="w-4 h-4 text-orange-500" />
                <span className="font-medium">Sincronizzazione</span>
              </Link>
              <Link 
                to="/messages" 
                className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors duration-150"
              >
                <MessageCircle className="w-4 h-4 text-orange-500" />
                <span className="font-medium">I miei messaggi</span>
              </Link>
              <Link 
                to="/account/credit" 
                className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors duration-150"
              >
                <CreditCard className="w-4 h-4 text-orange-500" />
                <span className="font-medium">Credito</span>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 2. Vendite Dropdown */}
      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation()
            toggleDropdown('sales')
          }}
          className="flex items-center gap-2 px-4 py-2.5 min-h-[48px]
                   bg-white border-2 border-orange-500 text-gray-700 rounded-lg
                   font-semibold text-[14px]
                   hover:bg-orange-50/50 hover:shadow-[0_0_16px_rgba(255,165,0,0.3)]
                   transition-all duration-200"
        >
          <ShoppingBag className="w-4 h-4 text-orange-500" />
          <span className="text-gray-900">VENDITE</span>
          <ChevronDown className={`w-4 h-4 text-orange-500 transition-transform duration-200 ${
            activeDropdown === 'sales' ? 'rotate-180' : ''
          }`} />
        </button>

        <AnimatePresence>
          {activeDropdown === 'sales' && (
            <motion.div
              variants={dropdownVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="absolute top-[calc(100%+8px)] left-0 w-56 bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] overflow-hidden z-50"
            >
              <Link 
                to="/collection" 
                className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors duration-150"
              >
                <Folder className="w-4 h-4 text-orange-500" />
                <span className="font-medium">Collezione</span>
              </Link>
              <Link 
                to="/sales" 
                className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors duration-150"
              >
                <TrendingUp className="w-4 h-4 text-orange-500" />
                <span className="font-medium">Le mie vendite</span>
              </Link>
              <Link 
                to="/offers" 
                className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors duration-150"
              >
                <Gavel className="w-4 h-4 text-orange-500" />
                <span className="font-medium">Le mie offerte</span>
              </Link>
              <Link 
                to="/sell" 
                className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors duration-150"
              >
                <PlusCircle className="w-4 h-4 text-orange-500" />
                <span className="font-medium">Vendi prodotti</span>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3. Acquisti Dropdown */}
      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation()
            toggleDropdown('purchases')
          }}
          className="flex items-center gap-2 px-4 py-2.5 min-h-[48px]
                   bg-white border-2 border-orange-500 text-gray-700 rounded-lg
                   font-semibold text-[14px]
                   hover:bg-orange-50/50 hover:shadow-[0_0_16px_rgba(255,165,0,0.3)]
                   transition-all duration-200"
        >
          <ShoppingCart className="w-4 h-4 text-orange-500" />
          <span className="text-gray-900">ACQUISTI</span>
          <ChevronDown className={`w-4 h-4 text-orange-500 transition-transform duration-200 ${
            activeDropdown === 'purchases' ? 'rotate-180' : ''
          }`} />
        </button>

        <AnimatePresence>
          {activeDropdown === 'purchases' && (
            <motion.div
              variants={dropdownVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="absolute top-[calc(100%+8px)] left-0 w-56 bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] overflow-hidden z-50"
            >
              <Link 
                to="/purchases" 
                className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors duration-150"
              >
                <ShoppingCart className="w-4 h-4 text-orange-500" />
                <span className="font-medium">I miei acquisti</span>
              </Link>
              <Link 
                to="/saved-cards" 
                className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors duration-150"
              >
                <Bookmark className="w-4 h-4 text-orange-500" />
                <span className="font-medium">Carte salvate</span>
              </Link>
              <Link 
                to="/offers-received" 
                className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors duration-150"
              >
                <Gift className="w-4 h-4 text-orange-500" />
                <span className="font-medium">Offerte ricevute</span>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 4. Carrello */}
      <div className="flex items-center gap-2 px-4 py-2.5 min-h-[48px]
                    bg-white border-2 border-orange-500 text-gray-700 rounded-lg
                    font-semibold text-[14px]
                    hover:bg-orange-50/50 hover:shadow-[0_0_16px_rgba(255,165,0,0.3)]
                    transition-all duration-200 cursor-pointer"
      >
        <CreditCard className="w-4 h-4 text-orange-500" />
        <span className="text-gray-900">[{formatPrice(user?.balance || 0)}]</span>
      </div>
    </div>
  )
}

