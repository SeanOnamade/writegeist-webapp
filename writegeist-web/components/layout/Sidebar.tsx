'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  BookOpen,
  Feather,
  Headphones,
  Lightbulb,
  LogOut,
  Menu,
  MessagesSquare,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sun,
  X,
  type LucideIcon,
} from 'lucide-react'
import { SearchButton } from '@/components/search/SearchButton'
import { useUser } from '@/contexts/UserContext'
import { useTheme } from '@/contexts/SettingsContext'
import type { AppSettings } from '@/lib/data/settings'

interface NavItem {
  name: string
  href: string
  icon: LucideIcon
  /** Path prefixes that should mark this item active (defaults to href). */
  match?: string[]
}

const NAV_ITEMS: NavItem[] = [
  { name: 'Projects', href: '/project', icon: BookOpen, match: ['/project', '/chapters'] },
  { name: 'Ideas', href: '/ideas', icon: Lightbulb },
  { name: 'Chat', href: '/chat', icon: MessagesSquare },
  { name: 'Audio', href: '/audio', icon: Headphones },
  { name: 'Settings', href: '/settings', icon: Settings },
]

function isActive(pathname: string, item: NavItem): boolean {
  return (item.match ?? [item.href]).some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

const COLLAPSE_STORAGE_KEY = 'writegeist-sidebar-collapsed'

const THEME_CYCLE: Array<{
  value: AppSettings['theme']
  label: string
  icon: LucideIcon
}> = [
  { value: 'light', label: 'Light theme', icon: Sun },
  { value: 'dark', label: 'Dark theme', icon: Moon },
  { value: 'system', label: 'System theme', icon: Monitor },
]

function ThemeToggle({ collapsed }: { collapsed?: boolean }) {
  const { theme, setTheme } = useTheme()
  const current = THEME_CYCLE.find((t) => t.value === theme) ?? THEME_CYCLE[2]
  const next = THEME_CYCLE[(THEME_CYCLE.indexOf(current) + 1) % THEME_CYCLE.length]
  const Icon = current.icon

  return (
    <button
      onClick={() => setTheme(next.value)}
      title={`Theme: ${current.label} (click for ${next.label.toLowerCase()})`}
      className={`flex h-9 w-full items-center gap-3 rounded-md px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${
        collapsed ? 'justify-center px-0' : ''
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{current.label}</span>}
    </button>
  )
}

function NavLinks({
  pathname,
  collapsed,
  onNavigate,
}: {
  pathname: string
  collapsed?: boolean
  onNavigate?: () => void
}) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item)
        const Icon = item.icon
        return (
          <Link
            key={item.name}
            href={item.href}
            onClick={onNavigate}
            title={collapsed ? item.name : undefined}
            className={`flex h-9 items-center gap-3 rounded-md px-2.5 text-sm transition-colors ${
              collapsed ? 'justify-center px-0' : ''
            } ${
              active
                ? 'bg-primary/10 font-medium text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">{item.name}</span>}
          </Link>
        )
      })}
    </nav>
  )
}

function UserSection({ collapsed }: { collapsed?: boolean }) {
  const router = useRouter()
  const { user, signOut } = useUser()

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  if (!user) return null

  const initial = (user.email?.[0] ?? '?').toUpperCase()

  return (
    <div
      className={`flex items-center gap-2 ${collapsed ? 'flex-col' : ''}`}
      title={user.email ?? undefined}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
        {initial}
      </div>
      {!collapsed && (
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{user.email}</span>
      )}
      <button
        onClick={handleSignOut}
        title="Sign out"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_STORAGE_KEY) === '1')
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      localStorage.setItem(COLLAPSE_STORAGE_KEY, prev ? '0' : '1')
      return !prev
    })
  }

  return (
    <aside
      className={`hidden shrink-0 flex-col border-r bg-card transition-[width] duration-200 md:flex ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      <div
        className={`flex h-14 items-center border-b px-3 ${
          collapsed ? 'justify-center' : 'justify-between'
        }`}
      >
        {!collapsed && (
          <Link href="/project" className="flex min-w-0 items-center gap-2">
            <Feather className="h-5 w-5 shrink-0 text-primary" />
            <span className="truncate font-semibold tracking-tight">Writegeist</span>
          </Link>
        )}
        <button
          onClick={toggleCollapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      <div className={`flex flex-1 flex-col gap-4 overflow-y-auto p-3 ${collapsed ? 'px-2' : ''}`}>
        <SearchButton collapsed={collapsed} />
        <NavLinks pathname={pathname} collapsed={collapsed} />
      </div>

      <div className={`flex flex-col gap-2 border-t p-3 ${collapsed ? 'px-2' : ''}`}>
        <ThemeToggle collapsed={collapsed} />
        <UserSection collapsed={collapsed} />
      </div>
    </aside>
  )
}

export function MobileTopBar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <>
      <div className="flex min-h-14 shrink-0 items-center gap-3 border-b bg-background px-4 pt-safe md:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/project" className="flex items-center gap-2">
          <Feather className="h-5 w-5 text-primary" />
          <span className="font-semibold tracking-tight">Writegeist</span>
        </Link>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col border-r bg-background shadow-xl pt-safe pb-safe">
            <div className="flex h-14 items-center justify-between border-b px-4">
              <Link href="/project" className="flex items-center gap-2">
                <Feather className="h-5 w-5 text-primary" />
                <span className="font-semibold tracking-tight">Writegeist</span>
              </Link>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
              <SearchButton enableShortcut={false} />
              <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
            </div>
            <div className="flex flex-col gap-2 border-t p-3">
              <ThemeToggle />
              <UserSection />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
