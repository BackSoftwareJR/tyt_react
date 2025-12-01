/**
 * Router Configuration
 * Configurazione routing dell'applicazione con React Router DOM
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from '@/components/ui/ProtectedRoute'

// Layout
import MainLayout from './MainLayout'

// Pages - Public
import HomePage from '@/pages/HomePage'
import HealthPage from '@/pages/HealthPage'
import LoginPage from '@/pages/Auth/LoginPage'
import RegisterPage from '@/pages/Auth/RegisterPage'
import VerifyEmailPage from '@/pages/Auth/VerifyEmailPage'
import ForgotPasswordPage from '@/pages/Auth/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/Auth/ResetPasswordPage'
import SuccessPage from '@/pages/SuccessPage'
import ErrorPage from '@/pages/ErrorPage'

// Pages - Protected
import DashboardPage from '@/pages/Dashboard/DashboardPage'
import CollectionPage from '@/pages/Collection/CollectionPage'
import CardsSearchPage from '@/pages/Cards/CardsSearchPage'
import CardDetailPage from '@/pages/Cards/CardDetailPage'
import CardPrintingsPage from '@/pages/Cards/CardPrintingsPage'
import SearchPage from '@/pages/SearchPage'
import SocialFeedPage from '@/pages/Social/SocialFeedPage'
import ChatPage from '@/pages/Chat/ChatPage'
import AdminDashboardPage from '@/pages/Admin/AdminDashboardPage'
import AccountPage from '@/pages/Account/AccountPage'
import LegalPage from '@/pages/Legal/LegalPage'

// Pages - Sets (Public)
import SetListPage from '@/pages/Sets/SetListPage'
import SetDetailPage from '@/pages/Sets/SetDetailPage'

// Account Layout and Pages
import AccountLayout from '@/pages/Account/AccountLayout'
import AccountProfilePage from '@/pages/Account/Profile/AccountProfilePage'
import AccountAddressesPage from '@/pages/Account/Addresses/AccountAddressesPage'
import AccountCreditPage from '@/pages/Account/Credit/AccountCreditPage'
import AccountTransactionsPage from '@/pages/Account/Transactions/AccountTransactionsPage'
import AccountSecurityPage from '@/pages/Account/Security/AccountSecurityPage'
import AccountSettingsPage from '@/pages/Account/Settings/AccountSettingsPage'
import AccountDownloadsPage from '@/pages/Account/Downloads/AccountDownloadsPage'
import AccountMessagesPage from '@/pages/Account/Messages/AccountMessagesPage'
import MessagesPage from '@/pages/Messages/MessagesPage'
import AccountSynchronizationPage from '@/pages/Account/Synchronization/SynchronizationPage'
import AccountSynchronizationTermsPage from '@/pages/Account/Synchronization/SynchronizationTermsPage'

export default function Router() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        {/* Public Routes */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/health" element={<HealthPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/success" element={<SuccessPage />} />
          <Route path="/error" element={<ErrorPage />} />
          <Route path="/legal" element={<LegalPage />} />
          
          {/* Public Search Routes */}
          <Route path="/search" element={<SearchPage />} />
          <Route path="/card/:oracle_id" element={<CardDetailPage />} />
          <Route path="/card/:oracle_id/printings" element={<CardPrintingsPage />} />
          
          {/* Public Set Routes */}
          <Route path="/sets" element={<SetListPage />} />
          <Route path="/set/:setCode" element={<SetDetailPage />} />
          
          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/collection"
            element={
              <ProtectedRoute>
                <CollectionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cards/search"
            element={
              <ProtectedRoute>
                <CardsSearchPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/social"
            element={
              <ProtectedRoute>
                <SocialFeedPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/messages"
            element={
              <ProtectedRoute>
                <MessagesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account-old"
            element={
              <ProtectedRoute>
                <AccountPage />
              </ProtectedRoute>
            }
          />

          {/* Account Messages - Separate page with custom sidebar */}
          <Route
            path="/account/messages"
            element={
              <ProtectedRoute>
                <AccountMessagesPage />
              </ProtectedRoute>
            }
          />

          {/* Account Routes with nested layout */}
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <AccountLayout />
              </ProtectedRoute>
            }
          >
            {/* Default route - shows profile */}
            <Route index element={<AccountProfilePage />} />
            <Route path="profile" element={<AccountProfilePage />} />
            <Route path="addresses" element={<AccountAddressesPage />} />
            <Route path="credit" element={<AccountCreditPage />} />
            <Route path="transactions" element={<AccountTransactionsPage />} />
            <Route path="security" element={<AccountSecurityPage />} />
            <Route path="settings" element={<AccountSettingsPage />} />
            <Route path="downloads" element={<AccountDownloadsPage />} />
            <Route path="synchronization" element={<AccountSynchronizationPage />} />
            <Route path="synchronization/terms" element={<AccountSynchronizationTermsPage />} />
          </Route>

          {/* Catch all - 404 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

