import pytest
from utils.normalize_md import clean_html_artifacts, normalize_markdown


def test_clean_html_list_artifacts():
    """Test cleaning of HTML list artifacts mixed into markdown"""
    dirty = "* I have an **idea.**\n</li><li>Music is a recurring theme throughout the story.\n</li><li>Nihilism is an underlying theme that connects to the music in the story."
    expected = "* I have an **idea.**\n\n* Music is a recurring theme throughout the story.\n\n* Nihilism is an underlying theme that connects to the music in the story."
    
    result = clean_html_artifacts(dirty)
    assert result == expected


def test_clean_html_nested_lists():
    """Test cleaning of nested HTML list structures"""
    dirty = """<ul><li>Item 1</li><li>Item 2</li></ul>
<li>Item 3</li>
More content"""
    expected = """* Item 1
* Item 2
* Item 3
More content"""
    
    result = clean_html_artifacts(dirty)
    assert result == expected


def test_clean_html_entities():
    """Test cleaning of HTML entities"""
    dirty = "Title &amp; subtitle &lt;test&gt; &quot;quoted&quot; &nbsp; content"
    expected = "Title & subtitle <test> \"quoted\"   content"
    
    result = clean_html_artifacts(dirty)
    assert result == expected


def test_user_corrupted_content():
    """Test the exact corrupted content from user's database"""
    dirty = """* I have an **idea.**
</li><li>Music is a recurring theme throughout the story.
</li><li>Nihilism is an underlying theme that connects to the music in the story.
</li><li>The story is told in third person to enhance creativity.
* Some chapters use first or second person for a personal feel."""
    
    result = normalize_markdown(dirty)
    
    # Should not contain any HTML artifacts
    assert "</li><li>" not in result
    assert "<li>" not in result
    assert "</li>" not in result
    
    # Should contain proper markdown bullets
    lines = result.strip().split('\n')
    for line in lines:
        if line.strip():
            assert line.startswith('* '), f"Line should start with bullet: {line}"


def test_full_normalize_with_html():
    """Test full normalization including HTML cleanup and spacing"""
    dirty = """## Setting


* Lodge


</li><li>Guild of Tarego — Operates out of the Lodge


<ul><li>Citadel</li></ul>"""
    
    result = normalize_markdown(dirty)
    
    # Should be clean markdown with proper spacing
    expected_lines = [
        "## Setting",
        "",
        "* Lodge",
        "",
        "* Guild of Tarego — Operates out of the Lodge",
        "",
        "* Citadel",
        ""
    ]
    
    result_lines = result.split('\n')
    
    # Check no HTML artifacts remain
    assert "</li><li>" not in result
    assert "<ul>" not in result
    assert "</ul>" not in result
    
    # Check proper bullet formatting
    bullet_lines = [line for line in result_lines if line.strip() and not line.startswith('#')]
    for line in bullet_lines:
        if line.strip():
            assert line.startswith('* '), f"Expected bullet point, got: {line}" 