/**
 * frontend/src/App.tsx
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { WagmiProvider }                           from 'wagmi'
import { QueryClient, QueryClientProvider }        from '@tanstack/react-query'
import { useEffect } from 'react'
import { useReconnect } from 'wagmi'
import { config }     from './wagmi.config'
import Layout         from './components/Layout'
import HomePage       from './pages/HomePage'
import IssuePage      from './pages/IssuePage'
import ProvePage      from './pages/ProvePage'
import VerifyPage     from './pages/VerifyPage'
import AdminPage      from './pages/AdminPage'
import CredentialsPage from './pages/CredentialsPage'

const queryClient = new QueryClient()

/** Restore MetaMask session so walletClient is ready for contract writes. */
function WalletReconnect() {
  const { reconnect } = useReconnect()
  useEffect(() => { reconnect() }, [reconnect])
  return null
}

export default function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <WalletReconnect />
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/"        element={<HomePage />}  />
              <Route path="/issue"       element={<IssuePage />} />
              <Route path="/credentials" element={<CredentialsPage />} />
              <Route path="/prove"       element={<ProvePage />} />
              <Route path="/verify"  element={<VerifyPage />}/>
              <Route path="/admin"   element={<AdminPage />} />
              <Route path="*"        element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
