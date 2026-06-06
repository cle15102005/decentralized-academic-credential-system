import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { WagmiProvider }                           from 'wagmi'
import { QueryClient, QueryClientProvider }        from '@tanstack/react-query'
import { config }     from './wagmi.config'
import Layout         from './components/Layout'
import HomePage       from './pages/HomePage'
import IssuePage      from './pages/IssuePage'
import ProvePage      from './pages/ProvePage'
import VerifyPage     from './pages/VerifyPage'

const queryClient = new QueryClient()

export default function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/"        element={<HomePage />}  />
              <Route path="/issue"   element={<IssuePage />} />
              <Route path="/prove"   element={<ProvePage />} />
              <Route path="/verify"  element={<VerifyPage />}/>
              <Route path="*"        element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
