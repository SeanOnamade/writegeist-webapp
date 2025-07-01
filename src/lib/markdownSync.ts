import slugify from "slugify";

interface SyncPayload {
  title: string;
  text: string;
  characters: string[];
  locations: string[];
  summary: string;
  tropes?: string[];
}

export function smartInsert(md: string, payload: SyncPayload): string {
  // 1. Collect all existing H2 headings with regex
  const headings = [...md.matchAll(/^## (.+)$/gm)].map(m => m[1].trim());

  // 2. Resolve target headings
  const hCharacters = findHeading(headings, ["character"]) || "Characters";
  const hSetting = findHeading(headings, ["setting", "location", "place"]) || "Setting";
  const hOutline = findHeading(headings, ["outline"]) || "Full Outline";

  // 3. Upsert sections and bullets
  md = upsertBullets(md, hCharacters, payload.characters);
  md = upsertBullets(md, hSetting, payload.locations);
  
  // 4. Create enhanced outline bullet with proper summary
  const outlineBullet = `**${payload.title}** – ${payload.summary}`;
  const summaryBullet = `  * _Summary_: ${payload.summary}`;
  
  // Insert outline bullet and summary
  md = upsertBullets(md, hOutline, [outlineBullet]);
  md = upsertSummaryBullet(md, hOutline, outlineBullet, summaryBullet);

  // 5. Return updated Markdown
  return md;
}

function findHeading(list: string[], keywords: string[]): string | undefined {
  return list.find(h => keywords.some(k => h.toLowerCase().includes(k.toLowerCase())));
}

function upsertBullets(md: string, heading: string, items: string[]): string {
  if (!items.length) return md;
  
  // Ensure the heading exists
  if (!md.includes(`## ${heading}`)) {
    md += `\n\n## ${heading}\n`;
  }
  
  // Find the section content
  const sectionRegex = new RegExp(`(## ${escapeRegExp(heading)}[\\s\\S]*?)(?=\\n## |$)`, "m");
  const match = md.match(sectionRegex);
  let section = match ? match[0] : `## ${heading}`;
  
  // Add items that don't already exist
  items.forEach(item => {
    const itemRegex = new RegExp(`^[*-]\\s+.*${escapeRegExp(item)}`, "im");
    if (!itemRegex.test(section)) {
      // Add bullet point
      if (!section.endsWith('\n')) {
        section += '\n';
      }
      section += `* ${item}\n`;
    }
  });
  
  // Replace the section in the markdown
  if (match) {
    return md.replace(sectionRegex, section);
  } else {
    return md + section;
  }
}

function upsertSummaryBullet(md: string, heading: string, parentBullet: string, summaryBullet: string): string {
  // Find the section content
  const sectionRegex = new RegExp(`(## ${escapeRegExp(heading)}[\\s\\S]*?)(?=\\n## |$)`, "m");
  const match = md.match(sectionRegex);
  
  if (!match) return md;
  
  let section = match[0];
  
  // Look for the parent bullet to add summary beneath
  const bulletRegex = new RegExp(`^[*-]\\s+.*${escapeRegExp(parentBullet.replace(/\*\*/g, ''))}.*$`, "m");
  const bulletMatch = section.match(bulletRegex);
  
  if (bulletMatch) {
    const bulletLine = bulletMatch[0];
    // Check if summary already exists
    const summaryRegex = new RegExp(`\\s+\\*\\s+_Summary_:`, "m");
    const nextBulletRegex = new RegExp(`^[*-]\\s+`, "m");
    
    // Find the position after the bullet line
    const bulletIndex = section.indexOf(bulletLine);
    const afterBullet = section.substring(bulletIndex + bulletLine.length);
    
    // Check if summary already exists immediately after this bullet
    if (!summaryRegex.test(afterBullet.split('\n')[1] || '')) {
      // Insert summary bullet on the next line
      const insertIndex = bulletIndex + bulletLine.length;
      section = section.slice(0, insertIndex) + '\n' + summaryBullet + section.slice(insertIndex);
    }
  }
  
  // Replace the section in the markdown
  return md.replace(sectionRegex, section);
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
} 