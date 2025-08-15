import re

def clean_html_artifacts(text: str) -> str:
    """
    Remove HTML artifacts that might be mixed into markdown content.
    """
    if not text:
        return ""
    
    # Remove HTML list artifacts that commonly get mixed in
    text = re.sub(r'</li><li>', '\n* ', text)
    text = re.sub(r'</?ul>', '', text)
    text = re.sub(r'</?ol>', '', text)
    text = re.sub(r'<li[^>]*>', '* ', text)
    text = re.sub(r'</li>', '', text)
    
    # Remove any remaining HTML tags
    text = re.sub(r'<[^>]*>', '', text)
    
    # Decode HTML entities
    text = text.replace('&lt;', '<')
    text = text.replace('&gt;', '>')
    text = text.replace('&amp;', '&')
    text = text.replace('&quot;', '"')
    text = text.replace('&#39;', "'")
    text = text.replace('&nbsp;', ' ')
    
    return text


def normalize_markdown(text: str) -> str:
    """
    Normalize markdown text by:
    - Cleaning HTML artifacts
    - Collapsing 3+ consecutive blank lines to 2 blank lines
    - Removing trailing whitespace from lines
    - Ensuring consistent spacing
    - Cleaning up malformed bullet points
    """
    if not text:
        return ""
    
    # Clean HTML artifacts first
    text = clean_html_artifacts(text)
    
    # Convert Windows line endings to Unix
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    
    # Remove trailing whitespace from each line
    text = re.sub(r'[ \t]+$', '', text, flags=re.MULTILINE)
    
    # Clean up malformed bullet points
    # Remove standalone asterisks that aren't part of proper bullet points
    lines = text.split('\n')
    cleaned_lines = []
    
    for i, line in enumerate(lines):
        # Skip standalone asterisks (lines with only * and optional whitespace)
        if line.strip() == '*':
            continue
        
        # Fix bullet points that start with multiple asterisks
        if re.match(r'^\s*\*\s*\*\s+', line):
            # Convert "* * content" to "* content"
            line = re.sub(r'^\s*\*\s*\*\s+', '* ', line)
        
        cleaned_lines.append(line)
    
    text = '\n'.join(cleaned_lines)
    
    # Collapse 3+ consecutive blank lines to 2 blank lines
    # This handles multiple patterns of blank lines
    text = re.sub(r'\n\s*\n\s*\n\s*\n+', '\n\n', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    # Remove any leading blank lines
    text = text.lstrip('\n')
    
    # Ensure file ends with exactly one newline
    text = text.rstrip() + '\n'
    
    return text 