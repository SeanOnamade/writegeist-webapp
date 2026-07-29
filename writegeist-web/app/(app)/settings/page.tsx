'use client'

import { useState } from 'react'
import { UserProfile } from '@/components/settings/UserProfile'
import { AppSettings } from '@/components/settings/AppSettings'
import { StorageUsage } from '@/components/settings/StorageUsage'

type SettingsTab = 'profile' | 'app' | 'data'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')

  const tabs = [
    { id: 'profile' as const, label: 'Profile', description: 'Personal information and avatar' },
    { id: 'app' as const, label: 'Application', description: 'Writing preferences and AI settings' },
    { id: 'data' as const, label: 'Data', description: 'Storage usage' }
  ]

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return <UserProfile />
      case 'app':
        return <AppSettings />
      case 'data':
        return <DataSettings />
      default:
        return <UserProfile />
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account settings and preferences.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:w-64 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-primary/10 text-primary'
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
        <div className="flex-1 min-w-0">
          <div className="bg-card border rounded-lg p-6 shadow-sm">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  )
}

function DataSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Data</h3>
        <p className="text-sm text-muted-foreground">
          Monitor your storage usage across different content types.
        </p>
      </div>

      <div className="p-4 border rounded-lg">
        <h4 className="font-medium mb-2">Storage Usage</h4>
        <StorageUsage />
      </div>
    </div>
  )
}
