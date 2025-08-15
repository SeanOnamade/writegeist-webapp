import pytest
from utils.normalize_md import normalize_markdown


def test_user_scenario():
    """Test the exact scenario the user is experiencing"""
    # This is the exact content the user is seeing with extra blank lines
    dirty_content = """Ideas-Notes





I have an idea.





Music is a recurring theme throughout the story.



Nihilism is an underlying theme that connects to the music in the story.



The story is told in third person to enhance creativity.





Some chapters use first or second person for a personal feel.

Setting





Lodge





Guild of Tarego — Operates out of the Lodge — Located on the southern-most part of the blood coast"""
    
    result = normalize_markdown(dirty_content)
    
    # Check that we don't have more than 2 consecutive newlines
    assert "\n\n\n" not in result, f"Found triple newlines in: {repr(result)}"
    
    # Check that we have proper spacing between sections
    lines = result.split('\n')
    max_consecutive_blanks = 0
    current_blanks = 0
    
    for line in lines:
        if line.strip() == "":
            current_blanks += 1
        else:
            max_consecutive_blanks = max(max_consecutive_blanks, current_blanks)
            current_blanks = 0
    
    # Should have at most 2 consecutive blank lines
    assert max_consecutive_blanks <= 2, f"Found {max_consecutive_blanks} consecutive blank lines"
    
    # Print the result for debugging
    print("Normalized result:")
    print(repr(result))


def test_simple_excessive_blanks():
    """Test simple case of excessive blank lines"""
    dirty = "Line1\n\n\n\n\n\nLine2"
    result = normalize_markdown(dirty)
    expected = "Line1\n\nLine2\n"
    assert result == expected, f"Expected {repr(expected)}, got {repr(result)}" 