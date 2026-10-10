import pytest
from pydantic import ValidationError

from app.schemas.notes import NoteCreateRequest, NoteUpdateRequest


class TestCreateNoteRequestSchema:
    """Test suite for CreateNoteRequest Pydantic schema."""

    # --- valid input passes through ---

    def test_valid_plain_text_unchanged(self):
        """Plain text with no HTML should not be modified."""
        req = NoteCreateRequest(content='Just a normal note')
        assert req.content == 'Just a normal note'

    def test_valid_unicode_preserved(self):
        """Unicode characters should be stored untouched."""
        text = 'Unicode: 你好 مرحبا שלום'
        req = NoteCreateRequest(content=text)
        assert req.content == text

    def test_valid_symbols_and_inner_spaces_preserved(self):
        text = 'Costs €5 × 2 ≥ £8, ok?'
        req = NoteCreateRequest(content=text)
        assert req.content == text

    def test_valid_exactly_256_chars(self):
        """Boundary: exactly max_length should be accepted."""
        text = 'a' * 256
        req = NoteCreateRequest(content=text)
        assert len(req.content) == 256

    def test_valid_single_char(self):
        """Boundary: single character (min_length) should be accepted."""
        req = NoteCreateRequest(content='x')
        assert req.content == 'x'

    # --- stored verbatim; React escapes it on output ---

    @pytest.mark.parametrize('text', [
        'use <b> for bold',
        "<script>alert('xss')</script>",
        'if a < b && b > c',
        'Bob & Jane',
    ])
    def test_markup_stored_verbatim(self, text):
        req = NoteCreateRequest(content=text)
        assert req.content == text

    def test_trims_surrounding_whitespace(self):
        req = NoteCreateRequest(content='  padded  ')
        assert req.content == 'padded'

    # --- validation rejections (these must raise, not silently pass) ---

    def test_rejects_empty_string(self):
        """Empty content violates min_length=1."""
        with pytest.raises(ValidationError):
            NoteCreateRequest(content='')

    def test_rejects_over_256_chars(self):
        """Content longer than 256 chars violates max_length."""
        with pytest.raises(ValidationError):
            NoteCreateRequest(content='x' * 257)

    @pytest.mark.parametrize('text', [
        'Launch 🚀',                 # beyond the Basic Multilingual Plane
        'Love \u2764',               # heavy heart, a symbol emoji
        'Copyright ©',
        '20°',
        'Key 1\u20e3',               # keycap: 1 + combining enclosing keycap
        'Text\ufe0f',                # emoji variation selector
        'a\u200db',                  # zero-width joiner
        'Line 1\nLine 2',            # control characters
        'Tab\there',
        'Old \U00020000',            # a CJK letter beyond the Basic Multilingual Plane
    ])
    def test_rejects_emoji_symbols_and_control_characters(self, text):
        with pytest.raises(ValidationError, match='Note must not contain emoji'):
            NoteCreateRequest(content=text)

    def test_rejects_extra_fields(self):
        """extra='forbid' must reject unknown keys."""
        with pytest.raises(ValidationError):
            NoteCreateRequest(content='valid', extra_field='bad')

    def test_rejects_whitespace_only(self):
        """Whitespace-only content is trimmed to '', which violates min_length=1."""
        with pytest.raises(ValidationError):
            NoteCreateRequest(content='   ')

    def test_rejects_tabs_only(self):
        with pytest.raises(ValidationError):
            NoteCreateRequest(content='\t\t\t')

    def test_rejects_newlines_only(self):
        with pytest.raises(ValidationError):
            NoteCreateRequest(content='\n\n\n')


class TestNoteUpdateRequestSchema:
    """An edited note follows the same rules as a new one"""

    def test_trims_content(self):
        assert NoteUpdateRequest(content='  edited  ').content == 'edited'

    @pytest.mark.parametrize('kwargs', [
        {}, {'content': ''}, {'content': ' \n\t'}, {'content': 'x' * 257},
        {'content': 'ok', 'id': 2}, {'content': '🚀'},
    ])
    def test_rejects_what_create_rejects(self, kwargs):
        with pytest.raises(ValidationError):
            NoteUpdateRequest(**kwargs)
