/**
 * MessagesSidebar Component
 * Custom sidebar for messages page with filter links
 */

import { NavLink, useLocation } from 'react-router-dom'
import { Inbox, Star, XCircle } from 'lucide-react'

export default function MessagesSidebar() {
  const location = useLocation()
  
  // Determine active filter from URL search params or default to 'all'
  const searchParams = new URLSearchParams(location.search)
  const activeFilter = searchParams.get('filter') || 'all'

  const navigationItems = [
    { 
      path: '/account/messages',
      search: '?filter=all',
      label: 'Tutte',
      icon: <Inbox className="h-4 w-4" />,
      filter: 'all'
    },
    { 
      path: '/account/messages',
      search: '?filter=important',
      label: 'Importanti',
      icon: <Star className="h-4 w-4" />,
      filter: 'important'
    },
    { 
      path: '/account/messages',
      search: '?filter=rejected',
      label: 'Rifiutate',
      icon: <XCircle className="h-4 w-4" />,
      filter: 'rejected'
    },
  ]

  return (
    <div className="bg-white rounded-2xl shadow-apple border border-gray-100 p-6 sticky top-20">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">MESSAGGI</h2>
      <nav className="space-y-1">
        {navigationItems.map((item) => {
          const isActive = activeFilter === item.filter
          return (
            <NavLink
              key={item.filter}
              to={`${item.path}${item.search}`}
              className={() =>
                `flex items-center gap-3 block px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-orange-50 text-orange-600 border-l-4 border-orange-500'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}

