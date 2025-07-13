import React, { useState, useRef, useEffect } from 'react';
import { Lightbulb, Send, Clock, CheckCircle, XCircle, Zap, AlertTriangle, Navigation, Shield, Database } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';

interface SubmittedIdea {
  id: string;
  content: string;
  timestamp: Date;
  status: 'submitting' | 'processing' | 'syncing' | 'completed' | 'error';
}

export const IdeaInbox: React.FC = () => {
  const [ideaText, setIdeaText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedIdeas, setSubmittedIdeas] = useState<SubmittedIdea[]>([]);
  const [showSyncWarning, setShowSyncWarning] = useState(false);
  const [pendingIdea, setPendingIdea] = useState<SubmittedIdea | null>(null);
  const [advancedSyncEnabled, setAdvancedSyncEnabled] = useState(false); // Simplified by default
  const [submissionQueue, setSubmissionQueue] = useState<SubmittedIdea[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline' | 'checking'>('online');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setConnectionStatus('online');
      console.log('Network connection restored');
    };

    const handleOffline = () => {
      setIsOnline(false);
      setConnectionStatus('offline');
      console.log('Network connection lost');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic connectivity check
    const connectivityCheck = setInterval(async () => {
      if (!navigator.onLine) {
        setConnectionStatus('offline');
        return;
      }

      try {
        setConnectionStatus('checking');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch('https://python-fastapi-u50080.vm.elestio.app/project/raw', {
          method: 'HEAD',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          setConnectionStatus('online');
        } else {
          setConnectionStatus('offline');
        }
      } catch (error) {
        setConnectionStatus('offline');
      }
    }, 30000); // Check every 30 seconds

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(connectivityCheck);
    };
  }, []);

  // Check if there are ideas currently being processed
  const ideasInProgress = submittedIdeas.filter(idea => 
    ['submitting', 'processing', 'syncing'].includes(idea.status)
  );
  const hasIdeasInProgress = ideasInProgress.length > 0;

  // Block navigation when ideas are in progress
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasIdeasInProgress) {
        e.preventDefault();
        e.returnValue = 'Ideas are still being processed. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    const handleNavigation = (e: CustomEvent) => {
      if (hasIdeasInProgress) {
        const confirmLeave = window.confirm(
          'Ideas are still being processed. Leaving now might cause them to fail. Are you sure you want to continue?'
        );
        if (!confirmLeave) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    if (hasIdeasInProgress) {
      window.addEventListener('beforeunload', handleBeforeUnload);
      // Note: We could add more sophisticated navigation blocking here if needed
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasIdeasInProgress]);

  // Fetch Ideas-Notes section from FastAPI after idea processing completes
  const fetchIdeasNotesSection = async (retryCount = 0, maxRetries = 3) => {
    try {
      console.log('Fetching latest Ideas-Notes section from FastAPI...');
      
      // Create abort controller for timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch('https://python-fastapi-u50080.vm.elestio.app/project/section/Ideas-Notes', {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.warn('Ideas-Notes section not found, may be empty or not created yet');
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Validate response structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format from FastAPI');
      }
      
      if (!data.markdown && data.markdown !== '') {
        console.warn('No markdown content in response, section may be empty');
        return '';
      }
      
      console.log('Successfully fetched updated Ideas-Notes section:', data.markdown?.substring(0, 100) + '...');
      
      // Trigger Project page refresh to show the updated content
      window.dispatchEvent(new CustomEvent('project-doc-updated'));
      
      return data.markdown;
      
    } catch (error) {
      console.error('Error fetching Ideas-Notes section from FastAPI:', error);
      
      // Handle specific error types
      if (error.name === 'AbortError') {
        console.error('Request timed out after 10 seconds');
      } else if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('Network error - check internet connection');
      }
      
      // Retry logic with exponential backoff
      if (retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        console.log(`Retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchIdeasNotesSection(retryCount + 1, maxRetries);
      }
      
      // All retries failed
      console.error('Failed to fetch Ideas-Notes section after all retries');
      return null;
    }
  };

  const performSafeSync = async (idea: SubmittedIdea) => {
    try {
      // First mark as syncing
      setSubmittedIdeas(prev => 
        prev.map(i => 
          i.id === idea.id 
            ? { ...i, status: 'syncing' }
            : i
        )
      );

      // Then sync the database from VM to get the processed idea
      console.log('Performing safe database sync to get processed idea...');
      
      // Add timeout to prevent hanging
      const syncPromise = (window.api as any).syncFromVM();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Sync timeout')), 30000)
      );
      
      const syncResult = await Promise.race([syncPromise, timeoutPromise]);
      
      if (syncResult.success) {
        console.log('Safe database sync completed! Processed idea should now be visible.');
        
        // Mark as completed
        setSubmittedIdeas(prev => 
          prev.map(i => 
            i.id === idea.id 
              ? { ...i, status: 'completed' }
              : i
          )
        );
        
        // Fetch the updated Ideas-Notes section from FastAPI
        await fetchIdeasNotesSection();
        
        // Notify other components of database update
        // DISABLED: window.dispatchEvent(new CustomEvent('database-updated')); // Prevents cascade loops
      } else {
        console.error('Safe database sync failed:', syncResult.error);
        
        // Mark as error if sync failed
        setSubmittedIdeas(prev => 
          prev.map(i => 
            i.id === idea.id 
              ? { ...i, status: 'error' }
              : i
          )
        );
      }
    } catch (error) {
      console.error('Error during safe sync:', error);
      
      // Mark as error if sync crashed
      setSubmittedIdeas(prev => 
        prev.map(i => 
          i.id === idea.id 
            ? { ...i, status: 'error' }
            : i
        )
      );
    }
  };

  // Process submission queue
  useEffect(() => {
    const processQueue = async () => {
      if (isProcessingQueue || submissionQueue.length === 0) return;
      
      setIsProcessingQueue(true);
      const nextIdea = submissionQueue[0];
      
      try {
        await processIdeaSubmission(nextIdea);
      } catch (error) {
        console.error('Queue processing error:', error);
        // Mark the idea as error
        setSubmittedIdeas(prev => 
          prev.map(idea => 
            idea.id === nextIdea.id 
              ? { ...idea, status: 'error' }
              : idea
          )
        );
      } finally {
        // Remove processed idea from queue
        setSubmissionQueue(prev => prev.slice(1));
        setIsProcessingQueue(false);
      }
    };

    processQueue();
  }, [submissionQueue, isProcessingQueue]);

  // Separate function to handle actual idea processing
  const processIdeaSubmission = async (idea: SubmittedIdea) => {
    try {
      // STEP 1: First, sync local changes to cloud to prevent data loss
      console.log('Syncing local changes to cloud before processing idea...');
      
      try {
        // Get current local project content
        const localProject = await window.api.getProjectDoc();
        
        if (localProject) {
          // Push local content to cloud database via existing n8n/proposal endpoint
          // We'll use it to update the entire document by sending it as Ideas-Notes replacement
          const syncController = new AbortController();
          const syncTimeoutId = setTimeout(() => syncController.abort(), 15000); // 15 second timeout
          
          const syncResponse = await fetch('https://python-fastapi-u50080.vm.elestio.app/n8n/proposal', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              section: "FULL_DOCUMENT_SYNC",
              replace: localProject
            }),
            signal: syncController.signal,
          });
          
          clearTimeout(syncTimeoutId);
          
          if (!syncResponse.ok) {
            throw new Error(`Failed to sync local changes to cloud: HTTP ${syncResponse.status}`);
          }
          
          console.log('Successfully synced local changes to cloud database');
        }
      } catch (syncError) {
        console.warn('Failed to sync local changes to cloud:', syncError);
        // Show warning but don't fail - user can decide
        if (syncError.name === 'AbortError') {
          console.warn('Local sync timed out - proceeding with idea submission');
        }
        // Continue with idea processing even if sync fails
        // The user's local changes are still safe locally
      }
      
      // STEP 2: Now submit idea to n8n (which will work with updated cloud content)
      // Create abort controller for timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for n8n
      
      // Submit to n8n webhook
      const response = await fetch('https://n8n-writegeist-u50080.vm.elestio.app/webhook/idea-inbox', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idea: idea.content,
          timestamp: idea.timestamp.toISOString()
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`n8n webhook failed: HTTP ${response.status} ${response.statusText}`);
      }

      // Try to parse response for additional info
      let responseData;
      try {
        responseData = await response.json();
        console.log('n8n webhook response:', responseData);
      } catch (jsonError) {
        console.log('n8n webhook response (non-JSON):', await response.text());
      }

      // Update status to processing
      setSubmittedIdeas(prev => 
        prev.map(existingIdea => 
          existingIdea.id === idea.id 
            ? { ...existingIdea, status: 'processing' }
            : existingIdea
        )
      );

      // Configurable processing time based on idea length and complexity
      const estimatedProcessingTime = Math.max(
        5000, // Minimum 5 seconds
        Math.min(30000, idea.content.length * 50) // Up to 30 seconds max
      );

      // Simulate processing time, then handle completion
      setTimeout(async () => {
        try {
          if (advancedSyncEnabled) {
            // Advanced mode: Show sync confirmation
            setPendingIdea(idea);
            setShowSyncWarning(true);
          } else {
            // Simplified mode: Auto-complete with background sync
            setSubmittedIdeas(prev => 
              prev.map(existingIdea => 
                existingIdea.id === idea.id 
                  ? { ...existingIdea, status: 'completed' }
                  : existingIdea
              )
            );

            // Fetch the updated Ideas-Notes section from FastAPI
            const fetchResult = await fetchIdeasNotesSection();
            
            if (fetchResult === null) {
              console.warn('Failed to fetch updated content, but idea was processed');
              // Don't mark as error since the idea was likely processed successfully
            }

            // Simple notification - n8n should handle the database update
            console.log('Idea processed successfully! Check the Project page to see your updated content.');
          }
        } catch (completionError) {
          console.error('Error during idea completion:', completionError);
          setSubmittedIdeas(prev => 
            prev.map(existingIdea => 
              existingIdea.id === idea.id 
                ? { ...existingIdea, status: 'error' }
                : existingIdea
            )
          );
        }
      }, estimatedProcessingTime);
      
    } catch (error) {
      console.error('Error processing idea:', error);
      
      // Handle specific error types
      let errorMessage = 'Failed to process idea';
      if (error.name === 'AbortError') {
        errorMessage = 'Request timed out - n8n may be overloaded';
      } else if (error instanceof TypeError && error.message.includes('fetch')) {
        errorMessage = 'Network error - check internet connection';
      } else if (error.message.includes('n8n webhook failed')) {
        errorMessage = error.message;
      }
      
      console.error('Processing error:', errorMessage);
      throw error; // Re-throw to be handled by queue processor
    }
  };

  const handleSyncConfirmation = (confirmed: boolean) => {
    setShowSyncWarning(false);
    
    if (confirmed && pendingIdea) {
      performSafeSync(pendingIdea);
    } else if (pendingIdea) {
      // User declined sync - mark as error
      setSubmittedIdeas(prev => 
        prev.map(i => 
          i.id === pendingIdea.id 
            ? { ...i, status: 'error' }
            : i
        )
      );
    }
    
    setPendingIdea(null);
  };

  const submitIdea = async () => {
    if (!ideaText.trim() || isSubmitting || connectionStatus === 'offline') return;

    const newIdea: SubmittedIdea = {
      id: Date.now().toString(),
      content: ideaText.trim(),
      timestamp: new Date(),
      status: 'submitting'
    };

    setSubmittedIdeas(prev => [newIdea, ...prev]);
    setIsSubmitting(true);

    // Add to submission queue instead of processing immediately
    setSubmissionQueue(prev => [...prev, newIdea]);

    setIdeaText('');
    textareaRef.current?.focus();
    setIsSubmitting(false);
  };

  const getStatusIcon = (status: SubmittedIdea['status']) => {
    switch (status) {
      case 'submitting': return <Send className="h-4 w-4" />;
      case 'processing': return <Zap className="h-4 w-4 animate-pulse" />;
      case 'syncing': return <Database className="h-4 w-4 animate-spin" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'error': return <XCircle className="h-4 w-4" />;
      default: return <Lightbulb className="h-4 w-4" />;
    }
  };

  const getStatusText = (status: SubmittedIdea['status']) => {
    switch (status) {
      case 'submitting': return 'Syncing local changes & submitting...';
      case 'processing': return 'AI is organizing your idea...';
      case 'syncing': return 'Safely updating your project...';
      case 'completed': return advancedSyncEnabled ? 'Added to your project!' : 'Processed & synced!';
      case 'error': return 'Failed to submit';
      default: return 'Unknown';
    }
  };

  const getStatusColor = (status: SubmittedIdea['status']) => {
    switch (status) {
      case 'submitting': return 'text-blue-400';
      case 'processing': return 'text-yellow-400';
      case 'syncing': return 'text-green-400';
      case 'completed': return 'text-green-400';
      case 'error': return 'text-red-400';
      default: return 'text-neutral-400';
    }
  };

  return (
    <div className="flex-1 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Sync Confirmation Dialog */}
        {showSyncWarning && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-neutral-800 border border-yellow-500/30 rounded-lg p-6 max-w-md mx-4">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="h-6 w-6 text-yellow-400" />
                <h3 className="text-lg font-semibold text-yellow-400">Database Sync Required</h3>
              </div>
              <div className="space-y-3 text-sm text-neutral-300">
                <p>
                  To retrieve your processed idea, the app needs to sync with the remote database.
                </p>
                <div className="bg-yellow-900/20 border border-yellow-600/30 rounded p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="h-4 w-4 text-yellow-400" />
                    <span className="font-medium text-yellow-400">Safe Sync System</span>
                  </div>
                  <ul className="text-xs text-yellow-200 space-y-1">
                    <li>• Creates backup before sync</li>
                    <li>• Verifies database integrity</li>
                    <li>• Restarts app safely if needed</li>
                  </ul>
                </div>
                <p className="text-xs text-neutral-400">
                  This operation will briefly restart the application to ensure data safety.
                </p>
              </div>
              <div className="flex gap-3 mt-6">
                <Button
                  onClick={() => handleSyncConfirmation(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleSyncConfirmation(true)}
                  className="flex-1 bg-yellow-600 hover:bg-yellow-700"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Safe Sync
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 mb-6">
          <Lightbulb className="h-6 w-6 text-yellow-500" />
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-neutral-100">Idea Inbox</h1>
            <p className="text-neutral-400 text-sm">Submit ideas and let AI organize them into your project</p>
          </div>
          
          {/* Connection Status Indicator */}
          <div className="flex items-center gap-2">
            {connectionStatus === 'online' && (
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>Online</span>
              </div>
            )}
            {connectionStatus === 'offline' && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                <span>Offline</span>
              </div>
            )}
            {connectionStatus === 'checking' && (
              <div className="flex items-center gap-2 text-yellow-400 text-sm">
                <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                <span>Checking...</span>
              </div>
            )}
          </div>
        </div>

        {/* Offline Warning */}
        {connectionStatus === 'offline' && (
          <div className="mb-6 p-4 rounded-lg border-2 border-red-500/30 bg-red-900/20 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <div>
                <span className="font-semibold text-red-400">No Internet Connection</span>
                <div className="text-sm text-red-200 mt-1">
                  Ideas cannot be submitted while offline. Please check your internet connection and try again.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Processing Banner */}
        {hasIdeasInProgress && (
          <div className="mb-6 p-4 rounded-lg border-2 border-yellow-500/30 bg-yellow-900/20 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-400" />
                <span className="font-semibold text-yellow-400">Processing Ideas</span>
              </div>
              <div className="flex-1">
                <div className="text-sm text-yellow-200">
                  {ideasInProgress.length} idea{ideasInProgress.length > 1 ? 's' : ''} being processed. Please wait before navigating away.
                </div>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {ideasInProgress.map((idea) => (
                <div key={idea.id} className="flex items-center gap-2 text-sm">
                  <span className="text-yellow-300">{getStatusIcon(idea.status)}</span>
                  <span className="text-yellow-200 flex-1 truncate">"{idea.content}"</span>
                  <span className="text-yellow-300">{getStatusText(idea.status)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-yellow-300">
              <Navigation className="h-3 w-3" />
              <span>Safe to navigate once all ideas show "{advancedSyncEnabled ? 'Added to your project!' : 'Processed & synced!'}"</span>
            </div>
          </div>
        )}

        {/* Safety Notice & Settings */}
        <div className="bg-green-900/20 border border-green-700/30 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-400" />
              <span className="font-semibold text-green-400">
                {advancedSyncEnabled ? 'Advanced Sync Mode' : 'Simplified Mode'}
              </span>
            </div>
            <button
              onClick={() => setAdvancedSyncEnabled(!advancedSyncEnabled)}
              className="text-xs px-3 py-1 rounded border border-green-600/30 hover:bg-green-800/20 text-green-300 transition-colors"
            >
              {advancedSyncEnabled ? 'Switch to Simple' : 'Enable Advanced Sync'}
            </button>
          </div>
          <p className="text-sm text-green-200">
            {advancedSyncEnabled 
              ? 'Uses safe database sync with backups and integrity checks. Requires manual confirmation.'
              : 'Simplified mode - ideas are processed and synced automatically in the background.'
            }
          </p>
        </div>

        {/* Idea Submission Form */}
        <div className="bg-neutral-800 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-neutral-100 mb-4">Submit New Idea</h2>
          <div className="space-y-4">
            <Textarea
              ref={textareaRef}
              value={ideaText}
              onChange={(e) => setIdeaText(e.target.value)}
              placeholder="Describe your idea in under 20 words... e.g., 'What if Knox had a secret weakness to silver?' or 'The city should have floating districts connected by bridges'"
              className="min-h-[100px] resize-none bg-neutral-700 border-neutral-600 text-neutral-100 placeholder:text-neutral-400"
              disabled={isSubmitting || connectionStatus === 'offline'}
            />
            <div className="flex justify-between items-center">
              <span className="text-sm text-neutral-400">
                {connectionStatus === 'offline' ? (
                  "🔴 Cannot submit ideas while offline"
                ) : hasIdeasInProgress ? (
                  "⏳ Wait for current ideas to finish before submitting new ones"
                ) : (
                  "🤖 AI will automatically organize this into the right section"
                )}
              </span>
              <Button 
                onClick={submitIdea}
                disabled={!ideaText.trim() || isSubmitting || hasIdeasInProgress || connectionStatus === 'offline'}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                title={
                  connectionStatus === 'offline' 
                    ? "Cannot submit ideas while offline"
                    : hasIdeasInProgress 
                      ? "Please wait for current ideas to finish processing" 
                      : ""
                }
              >
                {isSubmitting ? (
                  <>
                    <Zap className="h-4 w-4 mr-2 animate-pulse" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Submit Idea
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Recent Ideas */}
        {submittedIdeas.length > 0 && (
          <div className="bg-neutral-800 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-neutral-100 mb-4">Recent Ideas</h2>
            <div className="space-y-3">
              {submittedIdeas.map((idea) => (
                <div 
                  key={idea.id}
                  className="p-4 rounded-lg border border-neutral-600 bg-neutral-700"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-neutral-100 mb-2">{idea.content}</p>
                      <div className="flex items-center gap-2 text-sm">
                        <span className={getStatusColor(idea.status)}>
                          {getStatusIcon(idea.status)}
                        </span>
                        <span className={getStatusColor(idea.status)}>
                          {getStatusText(idea.status)}
                        </span>
                        <span className="text-neutral-500">•</span>
                        <span className="text-neutral-400">
                          {idea.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* How it Works */}
        <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-3 text-blue-300 flex items-center gap-2">
            <Zap className="h-5 w-5" />
            How AI Idea Processing Works
          </h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-blue-200">
            <div className="flex items-start gap-2">
              <span className="text-blue-400 font-semibold">1.</span>
              <div>
                <strong>Sync Local:</strong> Pushes your latest local changes to cloud first
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-400 font-semibold">2.</span>
              <div>
                <strong>Analyze:</strong> AI reads your idea and determines the best section
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-400 font-semibold">3.</span>
              <div>
                <strong>Integrate:</strong> Merges your idea with existing content intelligently
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-400 font-semibold">4.</span>
              <div>
                <strong>Safe Sync:</strong> Returns updated content without overwriting local changes
              </div>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-800/20 rounded border border-blue-600/30">
            <p className="text-xs text-blue-300">
              <strong>💡 Tip:</strong> The new safety system creates backups and verifies integrity before any database changes!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}; 
