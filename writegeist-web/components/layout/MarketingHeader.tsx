import Link from 'next/link'
import { Feather } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Slim top bar for the logged-out landing and auth pages. */
export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <Feather className="h-5 w-5 text-primary" />
          <span className="font-semibold tracking-tight">Writegeist</span>
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/signup">Sign up</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
