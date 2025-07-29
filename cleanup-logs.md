# Console Log Cleanup Plan

## High Priority Files to Clean:
1. **src/renderer/features/ProjectPage.tsx** - 12 console.log statements
2. **src/renderer/features/IdeaInbox.tsx** - 10 console.log statements  
3. **src/index.ts** - 15+ console.log statements

## Replace with proper logging:
```typescript
// Instead of: console.log('message')
// Use: const DEBUG = process.env.NODE_ENV === 'development'
// if (DEBUG) console.log('message')
```

## Quick fix regex:
Find: `console\.log\(`
Replace with: `// console.log(`

This keeps the logs for debugging but removes them from production.
