import nh3


class InputSanitizer:

    @staticmethod
    def sanitize_note_content(content: str, max_length: int = 256) -> str:
        if not isinstance(content, str):
            return ""
        content = content.replace('\x00', '')[:max_length]
        content = nh3.clean(content, tags=set())
        return content.strip()
