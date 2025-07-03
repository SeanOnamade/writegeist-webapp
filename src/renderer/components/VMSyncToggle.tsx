import React, { useState } from 'react';
import { Button } from '../../components/ui/button';

export const VMSyncToggle: React.FC = () => {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const syncToVM = async () => {
    if (syncing) return;
    
    setSyncing(true);
    try {
      // Run the sync script via node
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      await execAsync('npm run sync-db');
      setLastSync(new Date());
      console.log('VM sync completed successfully');
    } catch (error) {
      console.error('VM sync failed:', error);
      alert('VM sync failed. Check console for details.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-gray-100 rounded">
      <Button 
        onClick={syncToVM} 
        disabled={syncing}
        size="sm"
        variant="outline"
      >
        {syncing ? '🔄 Syncing...' : '📡 Sync to VM'}
      </Button>
      
      {lastSync && (
        <span className="text-sm text-gray-600">
          Last sync: {lastSync.toLocaleTimeString()}
        </span>
      )}
      
      <span className="text-xs text-gray-500">
        (for n8n workflows)
      </span>
    </div>
  );
}; 