import pytest
from utils.normalize_md import normalize_markdown


def test_collapse_blank_lines():
    """Test that excessive blank lines are collapsed to 2 blank lines"""
    dirty = "Line1\n\n\n\nLine2\n\n\n\n\nLine3"
    expected = "Line1\n\nLine2\n\nLine3\n"
    assert normalize_markdown(dirty) == expected


def test_remove_trailing_whitespace():
    """Test that trailing whitespace is removed from lines"""
    dirty = "Line1   \nLine2\t\t\n   Line3   "
    expected = "Line1\nLine2\n   Line3\n"
    assert normalize_markdown(dirty) == expected


def test_header_spacing():
    """Test that excessive blank lines around headers are collapsed"""
    dirty = "# Header 1\n\n\n\n## Header 2\n### Header 3\n\nContent"
    expected = "# Header 1\n\n## Header 2\n### Header 3\n\nContent\n"
    assert normalize_markdown(dirty) == expected


def test_empty_input():
    """Test that empty input returns empty string"""
    assert normalize_markdown("") == ""


def test_single_newline_preserved():
    """Test that single newlines are preserved"""
    dirty = "Line1\nLine2\nLine3"
    expected = "Line1\nLine2\nLine3\n"
    assert normalize_markdown(dirty) == expected


def test_bullet_list_spacing():
    """Test that bullet lists maintain proper spacing"""
    dirty = "* Item 1\n\n\n* Item 2\n* Item 3\n\n\n\n\n* Item 4"
    expected = "* Item 1\n\n* Item 2\n* Item 3\n\n* Item 4\n"
    assert normalize_markdown(dirty) == expected


def test_mixed_content():
    """Test complex markdown with mixed content"""
    dirty = """# Project Title   


## Ideas-Notes   

* Idea 1   
* Idea 2   


## Characters   

**John Doe**   
- Age: 30   
- Role: Protagonist   



## Setting   

The story takes place...   

"""
    result = normalize_markdown(dirty)
    
    # Should have proper spacing and no trailing whitespace
    assert "   \n" not in result  # No trailing spaces
    assert "\n\n\n" not in result  # No more than 2 consecutive newlines
    assert result.endswith("\n")  # Ends with single newline
    assert not result.startswith("\n")  # No leading newlines


def test_preserve_code_blocks():
    """Test that code blocks are preserved properly"""
    dirty = """## Code Example

```python
def hello():
    print("Hello")
```

More text"""
    result = normalize_markdown(dirty)
    assert "```python" in result
    assert "```" in result 