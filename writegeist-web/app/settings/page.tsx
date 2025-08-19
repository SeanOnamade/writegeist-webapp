'use client'

import { useState } from 'react'
import { UserProfile } from '@/components/settings/UserProfile'
import { AppSettings } from '@/components/settings/AppSettings'
import { Button } from '@/components/ui/button'

type SettingsTab = 'profile' | 'app' | 'data' | 'billing'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')

  const tabs = [
    { id: 'profile' as const, label: 'Profile', description: 'Personal information and avatar' },
    { id: 'app' as const, label: 'Application', description: 'Writing preferences and AI settings' },
    { id: 'data' as const, label: 'Data & Privacy', description: 'Export, backup, and privacy settings' },
    { id: 'billing' as const, label: 'Billing', description: 'Subscription and payment information' }
  ]

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return <UserProfile />
      case 'app':
        return <AppSettings />
      case 'data':
        return <DataSettings />
      case 'billing':
        return <BillingSettings />
      default:
        return <UserProfile />
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Navigation */}
        <div className="lg:w-64 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <div>
                  <div className="font-medium">{tab.label}</div>
                  <div className="text-xs opacity-75">{tab.description}</div>
                </div>
              </button>
            ))}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          <div className="bg-card border rounded-lg p-6">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  )
}

// Placeholder components for other settings tabs
function DataSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Data & Privacy</h3>
        <p className="text-sm text-muted-foreground">
          Manage your data, backups, and privacy preferences.
        </p>
      </div>

      <div className="space-y-4">
        <div className="p-4 border rounded-lg">
          <h4 className="font-medium mb-2">Export Data</h4>
          <p className="text-sm text-muted-foreground mb-3">
            Download all your projects, chapters, and ideas as JSON files.
          </p>
          <Button variant="outline">Export All Data</Button>
        </div>

        <div className="p-4 border rounded-lg">
          <h4 className="font-medium mb-2">Automatic Backups</h4>
          <p className="text-sm text-muted-foreground mb-3">
            Your data is automatically backed up to secure cloud storage.
          </p>
          <div className="flex items-center space-x-2">
            <input type="checkbox" id="autoBackup" defaultChecked className="rounded" />
            <label htmlFor="autoBackup" className="text-sm">Enable automatic backups</label>
          </div>
        </div>

        <div className="p-4 border rounded-lg border-red-200">
          <h4 className="font-medium mb-2 text-red-800">Delete Account</h4>
          <p className="text-sm text-muted-foreground mb-3">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
          <Button variant="destructive">Delete Account</Button>
        </div>
      </div>
    </div>
  )
}

function BillingSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Billing & Subscription</h3>
        <p className="text-sm text-muted-foreground">
          Manage your subscription and payment information.
        </p>
      </div>

      <div className="space-y-4">
        <div className="p-4 border rounded-lg">
          <h4 className="font-medium mb-2">Current Plan</h4>
          <p className="text-sm text-muted-foreground mb-3">
            You are currently on the <strong>Free Plan</strong>.
          </p>
          <Button>Upgrade to Pro</Button>
        </div>

        <div className="p-4 border rounded-lg">
          <h4 className="font-medium mb-2">Usage</h4>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Usage tracking will be available when billing is implemented.</p>
          </div>
        </div>

        <div className="p-4 border rounded-lg">
          <h4 className="font-medium mb-2">Payment Method</h4>
          <p className="text-sm text-muted-foreground mb-3">
            No payment method on file.
          </p>
          <Button variant="outline">Add Payment Method</Button>
        </div>
      </div>
    </div>
  )
}