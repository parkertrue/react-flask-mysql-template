import html

import nh3


class InputSanitizer:

    @staticmethod
    def sanitize_text(value: str, max_length: int = 256) -> str:
        """Strip null bytes and all HTML, truncate, and trim whitespace.

        Output is plain text, not HTML. Entities are decoded before stripping,
        so entity-encoded markup like ``&lt;script&gt;`` is removed too, and
        decoded again afterwards so that ordinary characters such as ``&`` in
        "Bob & Jane" survive verbatim instead of nh3's escaped ``&amp;``.

        Because the result is plain text it is *not* safe to interpolate into
        an HTML document unescaped. Render it through a framework that escapes
        on output (React does this by default).
        """
        if not isinstance(value, str):
            return ""
        value = value.replace('\x00', '')[:max_length]
        value = html.unescape(value)
        value = nh3.clean(value, tags=set())
        value = html.unescape(value)
        return value.strip()
