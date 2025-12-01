import { useState } from 'react'
import { MessageCircle, Star, Ban, Inbox } from 'lucide-react'

type MessageFilter = 'all' | 'important' | 'refused'

const FILTERS: Array<{ id: MessageFilter; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'all', label: 'Tutte', icon: Inbox },
  { id: 'important', label: 'Importanti', icon: Star },
  { id: 'refused', label: 'Rifiutate', icon: Ban },
]

export default function MessagesPage() {
  const [activeFilter, setActiveFilter] = useState<MessageFilter>('all')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 lg:flex-row">
        <aside className="w-full max-w-xs shrink-0">
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500">
                <MessageCircle className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Messaggi</h1>
                <p className="text-sm text-gray-500">Gestisci le conversazioni con gli altri utenti.</p>
              </div>
            </div>
            <nav className="space-y-2">
              {FILTERS.map(({ id, label, icon: Icon }) => {
                const isActive = activeFilter === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveFilter(id)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-orange-500'}`} />
                    {label}
                  </button>
                )
              })}
            </nav>
          </div>
        </aside>

        <main className="flex-1">
          <div className="rounded-3xl border border-dashed border-gray-300 bg-white/80 px-8 py-16 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-orange-500/10 text-orange-500">
              <MessageCircle className="h-8 w-8" />
            </div>
            <h2 className="mt-6 text-2xl font-semibold text-gray-900">Nessun messaggio nella sezione “{FILTERS.find(f => f.id === activeFilter)?.label}”</h2>
            <p className="mt-3 text-sm text-gray-600">
              Stiamo lavorando alla nuova piattaforma di messaggistica. Qui potrai trovare le tue conversazioni, filtrare i messaggi importanti o
              rifiutati e gestire le richieste in modo rapido.
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}



