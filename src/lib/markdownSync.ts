import slugify from "slugify";

interface SyncPayload {
  title: string;
  text: string;
  characters: string[];
  locations: string[];
  summary: string;
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
  const outlineBullet = `**${payload.title}** – ${payload.summary}`;
  md = upsertBullets(md, hOutline, [outlineBullet]);

  // 4. Return updated Markdown
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

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
} 