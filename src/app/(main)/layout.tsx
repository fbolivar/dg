import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { FooterNotice } from '@/components/layout/footer-notice'
import { SessionHydrator } from '@/components/layout/session-hydrator'
import { DataGate } from '@/components/layout/data-gate'
import { DataProvider } from '@/shared/context/data-context'
import { verifySession, SESSION_COOKIE } from '@/shared/lib/auth'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  // Protección: solo usuarios autenticados acceden a la app.
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  const user = verifySession(token)
  if (!user) redirect('/login')

  return (
    <DataProvider>
      <SessionHydrator user={user} />
      <div className="min-h-screen bg-background">
        <Sidebar />
        <div className="lg:ml-[220px] flex flex-col min-h-screen">
          <Header />
          <main className="flex-1 pt-14 flex flex-col">
            <div className="flex-1 p-4 sm:p-6">
              <DataGate>{children}</DataGate>
            </div>
            <FooterNotice />
          </main>
        </div>
      </div>
    </DataProvider>
  )
}
