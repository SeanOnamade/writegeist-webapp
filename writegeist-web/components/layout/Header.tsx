'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { SearchButton } from '@/components/search/SearchButton'
import { auth } from '@/lib/supabase/auth'
import type { User } from '@supabase/supabase-js'

const navigation = [
  { name: 'Home', href: '/' },
  { name: 'Projects', href: '/project' },
  { name: 'Ideas', href: '/ideas' },
  { name: 'Chat', href: '/chat' },
  { name: 'Audio', href: '/audio' },
  { name: 'Settings', href: '/settings' },
]

const allNavigation = [
  { name: 'Home', href: '/' },
  { name: 'Projects', href: '/project' },
  { name: 'Ingest', href: '/ingest' },
  { name: 'Ideas', href: '/ideas' },
  { name: 'Chat', href: '/chat' },
  { name: 'Audio', href: '/audio' },
  { name: 'Settings', href: '/settings' },
]

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    // Get initial user
    auth.getCurrentUser().then((user) => {
      setUser(user)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = auth.onAuthStateChange((user) => {
      setUser(user)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    await auth.signOut()
    router.push('/')
  }

  const closeMobileMenu = () => {
    setMobileMenuOpen(false)
  }

  // Choose navigation based on screen size and content
  const desktopNavigation = allNavigation
  const mobileNavigation = navigation // Excludes Ingest as requested

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Left: Logo */}
          <Link href="/" className="flex items-center space-x-2 flex-shrink-0">
            <span className="text-xl font-bold">Writegeist</span>
          </Link>
          
          {/* Center: Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            {desktopNavigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  pathname === item.href
                    ? 'text-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </nav>
          
          {/* Right: Search + Auth + Mobile Menu */}
          <div className="flex items-center space-x-2">
            {/* Search */}
            {user && (
              <div className="hidden sm:block">
                <SearchButton />
              </div>
            )}
            
            {/* Auth */}
            {loading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            ) : user ? (
              <div className="flex items-center space-x-2">
                {/* Email - hidden on mobile */}
                <span className="hidden lg:block text-sm text-muted-foreground truncate max-w-[120px]">
                  {user.email}
                </span>
                {/* Desktop Sign Out */}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleSignOut}
                  className="hidden md:inline-flex"
                >
                  Sign Out
                </Button>
              </div>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
                  <Link href="/login">Sign In</Link>
                </Button>
                <Button size="sm" asChild className="hidden sm:inline-flex">
                  <Link href="/signup">Sign Up</Link>
                </Button>
                <Button variant="ghost" size="sm" asChild className="sm:hidden">
                  <Link href="/login">Log In</Link>
                </Button>
                <Button size="sm" asChild className="sm:hidden">
                  <Link href="/signup">Sign Up</Link>
                </Button>
              </>
            )}

            {/* Mobile Menu Button */}
            {user && (
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden p-2"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                <span className="sr-only">Toggle menu</span>
                <div className="w-6 h-6 flex flex-col justify-center items-center">
                  <div className={`w-5 h-0.5 bg-current transition-all duration-200 ${mobileMenuOpen ? 'rotate-45 translate-y-1' : ''}`}></div>
                  <div className={`w-5 h-0.5 bg-current transition-all duration-200 mt-1 ${mobileMenuOpen ? 'opacity-0' : ''}`}></div>
                  <div className={`w-5 h-0.5 bg-current transition-all duration-200 mt-1 ${mobileMenuOpen ? '-rotate-45 -translate-y-1' : ''}`}></div>
                </div>
              </Button>
            )}
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {user && mobileMenuOpen && (
          <div className="md:hidden border-t bg-background/95 backdrop-blur">
            <nav className="px-4 py-2 space-y-1">
              {/* Search on mobile */}
              <div className="sm:hidden py-2">
                <SearchButton />
              </div>
              
              {mobileNavigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={closeMobileMenu}
                  className={`block px-3 py-2 rounded-md text-base font-medium transition-colors hover:bg-muted ${
                    pathname === item.href
                      ? 'text-foreground bg-muted'
                      : 'text-muted-foreground'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
              
              {/* Mobile Sign Out */}
              <div className="border-t border-muted mt-2 pt-2">
                <button
                  onClick={() => {
                    handleSignOut()
                    closeMobileMenu()
                  }}
                  className="block w-full text-left px-3 py-2 rounded-md text-base font-medium transition-colors hover:bg-muted text-muted-foreground"
                >
                  Sign Out
                </button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
