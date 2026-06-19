import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { FooterNotice } from '@/components/layout/footer-notice'
import { DataProvider } from '@/shared/context/data-context'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <DataProvider>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <div className="lg:ml-[220px] flex flex-col min-h-screen">
          <Header />
          <main className="flex-1 pt-14 flex flex-col">
            <div className="flex-1 p-4 sm:p-6">
              {children}
            </div>
            <FooterNotice />
          </main>
        </div>
      </div>
    </DataProvider>
  )
}
