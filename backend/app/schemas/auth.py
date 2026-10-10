import re
import unicodedata

from email_validator import EmailNotValidError, validate_email
from pydantic import BaseModel, Field, field_validator, ConfigDict

# Checked after normalizing, so the stored form always fits the users.email
# column.
from app.models.user import EMAIL_MAX_LENGTH

# Only the hash is stored, so these are policy rather than a column size.
# frontend/src/utils/validation.js mirrors them.
PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 128

# Unicode general categories a new password may use: letters, combining
# marks, numbers, punctuation, and math, currency and modifier symbols. Left
# out: separators (every kind of space), control and format characters (the
# zero-width joiner that builds emoji sequences), enclosing marks (keycaps)
# and "other symbols", which hold every emoji along with signs like © and °.
_PASSWORD_CATEGORIES = {'Lu', 'Ll', 'Lt', 'Lm', 'Lo', 'Mn', 'Mc', 'Nd', 'Nl', 'No',
                        'Pc', 'Pd', 'Ps', 'Pe', 'Pi', 'Pf', 'Po', 'Sm', 'Sc', 'Sk'}
# Emoji parts that fall in allowed categories: variation selectors (Mn) and
# skin-tone modifiers (Sk)
_EMOJI_COMPONENTS = re.compile('[\ufe00-\ufe0f\U0001f3fb-\U0001f3ff]')


def normalize_email(value: str) -> str:
    """The canonical, ASCII-only form of an email address, or ValueError.

    Only a plain local@domain.tld address passes: no display name, quoting
    or IP literal. The part before the @ must be ASCII, so any mail server
    can deliver to it (non-ASCII there needs SMTPUTF8, which many lack).
    An international domain is allowed and stored as its ASCII form
    (bücher.de -> xn--bcher-kva.de), which every server accepts and which
    keeps one mailbox to one account. IDNA refuses emoji in a domain.
    """
    try:
        result = validate_email(value, allow_smtputf8=False, check_deliverability=False)
    except EmailNotValidError as e:
        raise ValueError(str(e)) from None
    if len(result.ascii_email) > EMAIL_MAX_LENGTH:
        raise ValueError(f'Email must be at most {EMAIL_MAX_LENGTH} characters')
    return result.ascii_email


def _normalize_password(value):
    # NFKC, so the same password typed on any device hashes the same: an
    # accented letter can arrive as one character or as a letter plus a
    # combining accent, and full-width letters become plain ones. NIST SP
    # 800-63B recommends it. Done before the length checks, which then count
    # the form that is hashed.
    return unicodedata.normalize('NFKC', value) if isinstance(value, str) else value


def _check_password_characters(value: str) -> str:
    # Checked at login too, so no password that registration refuses can be
    # tried at all
    if any(c.isspace() for c in value):
        raise ValueError('Password must not contain spaces')
    if (any(unicodedata.category(c) not in _PASSWORD_CATEGORIES for c in value)
            or _EMOJI_COMPONENTS.search(value)):
        raise ValueError('Password must not contain emoji or other symbols like © or °')
    return value


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)

    model_config = ConfigDict(extra='forbid')

    check_email = field_validator('email')(normalize_email)
    normalize_password = field_validator('password', mode='before')(_normalize_password)
    check_password_characters = field_validator('password')(_check_password_characters)

    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain lowercase letter')
        if not re.search(r'[0-9]', v):
            raise ValueError('Password must contain number')
        return v


class LoginRequest(BaseModel):
    email: str
    # Normalized and limited to the same characters as RegisterRequest's,
    # but no strength rules: tightening RegisterRequest's must not lock out
    # users whose existing passwords predate the change.
    password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)

    model_config = ConfigDict(extra='forbid')

    check_email = field_validator('email')(normalize_email)
    normalize_password = field_validator('password', mode='before')(_normalize_password)
    check_password_characters = field_validator('password')(_check_password_characters)
