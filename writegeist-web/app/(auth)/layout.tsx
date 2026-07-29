import { MarketingHeader } from '@/components/layout/MarketingHeader'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MarketingHeader />
      {children}
    </>
  )
}
