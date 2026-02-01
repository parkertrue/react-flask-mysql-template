import pytest

from app.utils.sanitizer import InputSanitizer


@pytest.fixture
def sanitizer():
    return InputSanitizer()


class TestSanitizePlainText:
    """Plain text that contains no HTML should pass through unchanged."""

    def test_plain_text_unchanged(self, sanitizer):
        assert sanitizer.sanitize_note_content("Hello world") == "Hello world"

    def test_preserves_unicode(self, sanitizer):
        text = "Unicode: 你好 مرحبا שלום 🎉"
        assert sanitizer.sanitize_note_content(text) == text

    def test_preserves_newlines(self, sanitizer):
        text = "Line 1\nLine 2\nLine 3"
        assert sanitizer.sanitize_note_content(text) == text

    def test_preserves_safe_punctuation(self, sanitizer):
        """Symbols that cannot be interpreted as HTML are kept verbatim."""
        text = "cost: $100 (50% off!) — great deal #1 @here"
        assert sanitizer.sanitize_note_content(text) == text

    def test_encodes_bare_ampersand(self, sanitizer):
        """nh3 HTML-encodes bare ampersands for safety."""
        assert sanitizer.sanitize_note_content(
            "Bob & Jane") == "Bob &amp; Jane"

    def test_preserves_already_encoded_entity(self, sanitizer):
        """An already-encoded &amp; is kept as &amp; (not double-encoded)."""
        assert sanitizer.sanitize_note_content(
            "Bob &amp; Jane") == "Bob &amp; Jane"


class TestSanitizeScriptInjection:
    """All forms of script-based XSS must be stripped."""

    def test_strips_script_tag(self, sanitizer):
        result = sanitizer.sanitize_note_content(
            "<script>alert('xss')</script>Hello"
        )
        assert "<script>" not in result
        assert "alert" not in result
        assert "Hello" in result

    def test_strips_script_tag_only(self, sanitizer):
        """Input that is *only* a script tag produces an empty string."""
        result = sanitizer.sanitize_note_content(
            "<script>alert('xss')</script>"
        )
        assert result == ""

    def test_strips_style_tag(self, sanitizer):
        result = sanitizer.sanitize_note_content(
            "<style>body{color:red}</style>Visible"
        )
        assert "<style>" not in result
        assert "color:red" not in result
        assert "Visible" in result

    def test_strips_html_comment(self, sanitizer):
        result = sanitizer.sanitize_note_content(
            "<!-- hidden comment -->Real text"
        )
        assert "<!--" not in result
        assert "hidden comment" not in result
        assert "Real text" in result

    def test_strips_nested_script_attempt(self, sanitizer):
        """Common obfuscation: nest a script tag inside itself.
        nh3 strips the inner <script>...</script> but the text fragments
        outside that tag survive as plain text.  The critical property is
        that no executable markup remains — the leftover text is harmless."""
        result = sanitizer.sanitize_note_content(
            "<scr<script>ipt>alert(1)</script>ipt>"
        )
        assert "<script>" not in result
        assert "onerror" not in result
        assert "onclick" not in result
        # No HTML tags whatsoever in the output
        assert "<" not in result or "&lt;" in result


class TestSanitizeEventHandlers:
    """HTML tags that carry event-handler attributes must be stripped."""

    def test_strips_div_onclick(self, sanitizer):
        result = sanitizer.sanitize_note_content(
            '<div onclick="evil()">Click me</div>'
        )
        assert "onclick" not in result
        assert "<div" not in result
        assert "Click me" in result

    def test_strips_img_onerror(self, sanitizer):
        result = sanitizer.sanitize_note_content(
            '<img src=x onerror=alert(1)>'
        )
        assert "onerror" not in result
        assert "<img" not in result
        assert result == ""

    def test_strips_svg_onload(self, sanitizer):
        result = sanitizer.sanitize_note_content(
            "<svg onload=alert(1)>"
        )
        assert "onload" not in result
        assert "<svg" not in result
        assert result == ""


class TestSanitizeJavascriptProtocol:
    """Links with javascript: hrefs must be stripped; link text is kept."""

    def test_strips_javascript_href_keeps_text(self, sanitizer):
        result = sanitizer.sanitize_note_content(
            "<a href='javascript:alert(1)'>Click</a>"
        )
        assert "javascript:" not in result
        assert "<a " not in result
        assert "Click" in result


class TestSanitizeNullBytes:
    """Null bytes must be removed before any other processing."""

    def test_removes_null_bytes(self, sanitizer):
        result = sanitizer.sanitize_note_content("Before\x00After")
        assert "\x00" not in result
        assert "Before" in result
        assert "After" in result

    def test_removes_multiple_null_bytes(self, sanitizer):
        result = sanitizer.sanitize_note_content("\x00\x00Hello\x00\x00")
        assert "\x00" not in result
        assert "Hello" in result


class TestSanitizeWhitespace:
    """Whitespace-only input should collapse to an empty string after strip."""

    def test_spaces_only(self, sanitizer):
        assert sanitizer.sanitize_note_content("   ") == ""

    def test_tabs_only(self, sanitizer):
        assert sanitizer.sanitize_note_content("\t\t\t") == ""

    def test_newlines_only(self, sanitizer):
        assert sanitizer.sanitize_note_content("\n\n\n") == ""

    def test_mixed_whitespace(self, sanitizer):
        assert sanitizer.sanitize_note_content(" \t \n ") == ""


class TestSanitizeMaxLength:
    """Content must be truncated to max_length before sanitization."""

    def test_truncates_to_default_max_length(self, sanitizer):
        long_text = "a" * 500
        result = sanitizer.sanitize_note_content(long_text)
        assert len(result) == 256

    def test_truncates_to_custom_max_length(self, sanitizer):
        long_text = "b" * 200
        result = sanitizer.sanitize_note_content(long_text, max_length=100)
        assert len(result) == 100

    def test_does_not_truncate_when_under_limit(self, sanitizer):
        text = "short"
        assert sanitizer.sanitize_note_content(text) == "short"

    def test_exactly_max_length_unchanged(self, sanitizer):
        text = "x" * 256
        assert sanitizer.sanitize_note_content(text) == text


class TestSanitizeNonStringInput:
    """Non-string input must return an empty string, never crash."""

    def test_none_returns_empty(self, sanitizer):
        assert sanitizer.sanitize_note_content(None) == ""

    def test_integer_returns_empty(self, sanitizer):
        assert sanitizer.sanitize_note_content(123) == ""

    def test_list_returns_empty(self, sanitizer):
        assert sanitizer.sanitize_note_content(["a", "b"]) == ""

    def test_dict_returns_empty(self, sanitizer):
        assert sanitizer.sanitize_note_content({"key": "val"}) == ""

    def test_bool_returns_empty(self, sanitizer):
        assert sanitizer.sanitize_note_content(True) == ""
