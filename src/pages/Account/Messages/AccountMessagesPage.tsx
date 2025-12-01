import { MessageCircle } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import MessagesSidebar from '@/components/messages/MessagesSidebar'

export default function AccountMessagesPage() {
  const [searchParams] = useSearchParams()
  const filter = searchParams.get('filter') || 'all'

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <MessageCircle className="h-8 w-8 text-orange-500" />
            I miei messaggi
          </h1>
          <p className="text-gray-600">
            Gestisci le tue conversazioni e comunicazioni con gli altri utenti
          </p>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Left Column */}
          <div className="lg:col-span-1">
            <MessagesSidebar />
          </div>

          {/* Content - Right Column */}
          <div className="lg:col-span-3">
            <div className="space-y-6">
              {/* Filter indicator */}
              <div className="bg-white rounded-2xl shadow-apple border border-gray-100 p-4">
                <p className="text-sm text-gray-600">
                  {filter === 'all' && 'Mostrando tutti i messaggi'}
                  {filter === 'important' && 'Mostrando solo i messaggi importanti'}
                  {filter === 'rejected' && 'Mostrando solo i messaggi rifiutati'}
                </p>
              </div>

              {/* Messages content */}
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-8 py-12 text-center shadow-sm">
                <MessageCircle className="mx-auto h-12 w-12 text-orange-400" />
                <h2 className="mt-4 text-lg font-semibold text-gray-900">Nessun messaggio al momento</h2>
                <p className="mt-2 text-sm text-gray-600">
                  Questa sezione è in arrivo: presto potrai leggere e rispondere ai messaggi dai tuoi contatti.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}



