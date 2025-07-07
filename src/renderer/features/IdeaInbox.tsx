import React, { useState, useRef, useEffect } from 'react';
import { Lightbulb, Send, Clock, CheckCircle, XCircle, Zap, AlertTriangle, Navigation } from 'lucide-react';
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const submitIdea = async () => {
    if (!ideaText.trim() || isSubmitting) return;

    const newIdea: SubmittedIdea = {
      id: Date.now().toString(),
      content: ideaText.trim(),
      timestamp: new Date(),
      status: 'submitting'
    };

    setSubmittedIdeas(prev => [newIdea, ...prev]);
    setIsSubmitting(true);

    try {
      // Submit to n8n webhook
      const response = await fetch('https://n8n-writegeist-u50080.vm.elestio.app/webhook/idea-inbox', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idea: ideaText.trim(),
          timestamp: new Date().toISOString()
        }),
      });

      if (response.ok) {
        // Update status to processing
        setSubmittedIdeas(prev => 
          prev.map(idea => 
            idea.id === newIdea.id 
              ? { ...idea, status: 'processing' }
              : idea
          )
        );

        // Simulate processing time, then sync database and mark as completed
        setTimeout(async () => {
          try {
            // First mark as syncing
            setSubmittedIdeas(prev => 
              prev.map(idea => 
                idea.id === newIdea.id 
                  ? { ...idea, status: 'syncing' }
                  : idea
              )
            );

            // Then sync the database from VM to get the processed idea
            console.log('Syncing database from VM to get processed idea...');
            
            // Add timeout to prevent hanging
            const syncPromise = (window.api as any).syncFromVM();
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Sync timeout')), 30000)
            );
            
            const syncResult = await Promise.race([syncPromise, timeoutPromise]);
            
            if (syncResult.success) {
              console.log('Database synced successfully! Processed idea should now be visible.');
              
              // Mark as completed
              setSubmittedIdeas(prev => 
                prev.map(idea => 
                  idea.id === newIdea.id 
                    ? { ...idea, status: 'completed' }
                    : idea
                )
              );
              
              // Notify other components of database update
              window.dispatchEvent(new CustomEvent('database-updated'));
            } else {
              console.error('Database sync failed:', syncResult.error);
              
              // Mark as error if sync failed
              setSubmittedIdeas(prev => 
                prev.map(idea => 
                  idea.id === newIdea.id 
                    ? { ...idea, status: 'error' }
                    : idea
                )
              );
            }
          } catch (error) {
            console.error('Error during post-processing sync:', error);
            
            // Mark as error if sync crashed
            setSubmittedIdeas(prev => 
              prev.map(idea => 
                idea.id === newIdea.id 
                  ? { ...idea, status: 'error' }
                  : idea
              )
            );
          }
        }, 5000); // Give it 5 seconds for the n8n workflow to complete

        setIdeaText('');
        textareaRef.current?.focus();
      } else {
        throw new Error('Failed to submit idea');
      }
    } catch (error) {
      console.error('Error submitting idea:', error);
      setSubmittedIdeas(prev => 
        prev.map(idea => 
          idea.id === newIdea.id 
            ? { ...idea, status: 'error' }
            : idea
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusIcon = (status: SubmittedIdea['status']) => {
    switch (status) {
      case 'submitting': return <Send className="h-4 w-4" />;
      case 'processing': return <Zap className="h-4 w-4 animate-pulse" />;
      case 'syncing': return <Clock className="h-4 w-4 animate-spin" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'error': return <XCircle className="h-4 w-4" />;
      default: return <Lightbulb className="h-4 w-4" />;
    }
  };

  const getStatusText = (status: SubmittedIdea['status']) => {
    switch (status) {
      case 'submitting': return 'Submitting to AI...';
      case 'processing': return 'AI is organizing your idea...';
      case 'syncing': return 'Updating your project...';
      case 'completed': return 'Added to your project!';
      case 'error': return 'Failed to submit';
      default: return 'Unknown';
    }
  };

  const getStatusColor = (status: SubmittedIdea['status']) => {
    switch (status) {
      case 'submitting': return 'text-blue-400';
      case 'processing': return 'text-yellow-400';
      case 'syncing': return 'text-purple-400';
      case 'completed': return 'text-green-400';
      case 'error': return 'text-red-400';
      default: return 'text-neutral-400';
    }
  };

  return (
    <div className="flex-1 p-6">
      <div className="max-w-4xl mx-auto">
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
              <span>Safe to navigate once all ideas show "Added to your project!"</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 mb-6">
          <Lightbulb className="h-6 w-6 text-yellow-500" />
          <div>
            <h1 className="text-2xl font-bold text-neutral-100">Idea Inbox</h1>
            <p className="text-neutral-400 text-sm">Submit ideas and let AI organize them into your project</p>
          </div>
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
              disabled={isSubmitting}
            />
            <div className="flex justify-between items-center">
              <span className="text-sm text-neutral-400">
                {hasIdeasInProgress ? (
                  "⏳ Wait for current ideas to finish before submitting new ones"
                ) : (
                  "🤖 AI will automatically organize this into the right section"
                )}
              </span>
              <Button 
                onClick={submitIdea}
                disabled={!ideaText.trim() || isSubmitting || hasIdeasInProgress}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                title={hasIdeasInProgress ? "Please wait for current ideas to finish processing" : ""}
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
                <strong>Analyze:</strong> AI reads your idea and determines the best section (Characters, Setting, etc.)
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-400 font-semibold">2.</span>
              <div>
                <strong>Research:</strong> Fetches existing content from that section
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
                <strong>Update:</strong> Adds the refined content to your project automatically
              </div>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-800/20 rounded border border-blue-600/30">
            <p className="text-xs text-blue-300">
              <strong>💡 Tip:</strong> After submitting an idea, check your project sections to see how AI has integrated it!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}; 