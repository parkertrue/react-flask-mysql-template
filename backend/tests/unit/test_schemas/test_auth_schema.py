import pytest
from pydantic import ValidationError

from app.schemas.auth import RegisterRequest, LoginRequest


class TestRegisterRequest:
    """Test suite for RegisterRequest schema."""

    def test_valid_registration(self):
        """Schema should accept valid registration data."""
        data = {
            'email': 'test@example.com',
            'password': 'ValidPass123'
        }
        request = RegisterRequest(**data)

        assert request.email == 'test@example.com'
        assert request.password == 'ValidPass123'

    def test_missing_email(self):
        """Schema should reject missing email."""
        with pytest.raises(ValidationError) as exc_info:
            RegisterRequest(password='ValidPass123')

        errors = exc_info.value.errors()
        assert any(e['loc'] == ('email',) for e in errors)

    def test_missing_password(self):
        """Schema should reject missing password."""
        with pytest.raises(ValidationError) as exc_info:
            RegisterRequest(email='test@example.com')

        errors = exc_info.value.errors()
        assert any(e['loc'] == ('password',) for e in errors)

    def test_invalid_email_format(self):
        """Schema should reject invalid email formats."""
        invalid_emails = [
            'notanemail',
            '@example.com',
            'user@',
            'user @example.com',
            'user@.com',
            'user@domain',
        ]

        for invalid_email in invalid_emails:
            with pytest.raises(ValidationError):
                RegisterRequest(
                    email=invalid_email,
                    password='ValidPass123'
                )

    def test_valid_email_formats(self):
        """Schema should accept various valid email formats."""
        valid_emails = [
            'user@example.com',
            'user.name@example.com',
            'user+tag@example.com',
            'user123@sub.example.com',
            'a@b.co',
        ]

        for valid_email in valid_emails:
            request = RegisterRequest(
                email=valid_email,
                password='ValidPass123'
            )
            assert request.email == valid_email

    def test_password_min_length(self):
        """Schema should reject passwords under 8 characters."""
        short_passwords = ['Pass1', 'Ab1', 'Short7']

        for password in short_passwords:
            with pytest.raises(ValidationError) as exc_info:
                RegisterRequest(
                    email='test@example.com',
                    password=password
                )

            errors = exc_info.value.errors()
            assert any('min_length' in str(e) for e in errors)

    def test_password_max_length(self):
        """Schema should reject passwords over 128 characters."""
        # 129 characters
        long_password = 'A1' + 'a' * 127

        with pytest.raises(ValidationError) as exc_info:
            RegisterRequest(
                email='test@example.com',
                password=long_password
            )

        errors = exc_info.value.errors()
        assert any('max_length' in str(e) for e in errors)

    def test_password_exactly_8_chars(self):
        """Schema should accept password with exactly 8 characters."""
        request = RegisterRequest(
            email='test@example.com',
            password='Valid123'
        )
        assert len(request.password) == 8

    def test_password_exactly_128_chars(self):
        """Schema should accept password with exactly 128 characters."""
        # 128 characters with uppercase, lowercase, and digit
        password = 'A1' + 'a' * 126
        request = RegisterRequest(
            email='test@example.com',
            password=password
        )
        assert len(request.password) == 128

    def test_password_requires_uppercase(self):
        """Schema should reject passwords without uppercase letter."""
        with pytest.raises(ValidationError) as exc_info:
            RegisterRequest(
                email='test@example.com',
                password='lowercase123'
            )

        errors = exc_info.value.errors()
        error_messages = [str(e) for e in errors]
        assert any('uppercase' in msg.lower() for msg in error_messages)

    def test_password_requires_lowercase(self):
        """Schema should reject passwords without lowercase letter."""
        with pytest.raises(ValidationError) as exc_info:
            RegisterRequest(
                email='test@example.com',
                password='UPPERCASE123'
            )

        errors = exc_info.value.errors()
        error_messages = [str(e) for e in errors]
        assert any('lowercase' in msg.lower() for msg in error_messages)

    def test_password_requires_number(self):
        """Schema should reject passwords without number."""
        with pytest.raises(ValidationError) as exc_info:
            RegisterRequest(
                email='test@example.com',
                password='NoNumbersHere'
            )

        errors = exc_info.value.errors()
        error_messages = [str(e) for e in errors]
        assert any('number' in msg.lower() for msg in error_messages)

    def test_password_with_all_requirements(self):
        """Schema should accept password meeting all requirements."""
        valid_passwords = [
            'ValidPass123',
            'Abcdefg1',
            'P@ssw0rd',
            'MyPassword1',
            'Test1234',
        ]

        for password in valid_passwords:
            request = RegisterRequest(
                email='test@example.com',
                password=password
            )
            assert request.password == password

    def test_password_with_special_characters(self):
        """Schema should accept passwords with special characters."""
        password = 'P@ssw0rd!#$%'
        request = RegisterRequest(
            email='test@example.com',
            password=password
        )
        assert request.password == password

    def test_extra_fields_forbidden(self):
        """Schema should reject extra fields."""
        with pytest.raises(ValidationError) as exc_info:
            RegisterRequest(
                email='test@example.com',
                password='ValidPass123',
                extra_field='not allowed'
            )

        errors = exc_info.value.errors()
        assert any('extra_forbidden' in str(e) for e in errors)

    def test_none_values_rejected(self):
        """Schema should reject None values."""
        with pytest.raises(ValidationError):
            RegisterRequest(email=None, password='ValidPass123')

        with pytest.raises(ValidationError):
            RegisterRequest(email='test@example.com', password=None)

    def test_model_dump(self):
        """Schema should serialize to dict correctly."""
        request = RegisterRequest(
            email='test@example.com',
            password='ValidPass123'
        )
        data = request.model_dump()

        assert data['email'] == 'test@example.com'
        assert data['password'] == 'ValidPass123'

    def test_model_dump_excludes_password(self):
        """Consider excluding password from dumps for security."""
        request = RegisterRequest(
            email='test@example.com',
            password='ValidPass123'
        )

        # Standard dump includes password
        data = request.model_dump()
        assert 'password' in data

        # Can exclude password explicitly if needed
        data_safe = request.model_dump(exclude={'password'})
        assert 'password' not in data_safe
        assert 'email' in data_safe


class TestLoginRequest:
    """Test suite for LoginRequest schema."""

    def test_valid_login(self):
        """Schema should accept valid login data."""
        data = {
            'email': 'test@example.com',
            'password': 'ValidPass123'
        }
        request = LoginRequest(**data)

        assert request.email == 'test@example.com'
        assert request.password == 'ValidPass123'

    def test_missing_email(self):
        """Schema should reject missing email."""
        with pytest.raises(ValidationError):
            LoginRequest(password='ValidPass123')

    def test_missing_password(self):
        """Schema should reject missing password."""
        with pytest.raises(ValidationError):
            LoginRequest(email='test@example.com')

    def test_invalid_email_format(self):
        """Schema should reject invalid email format."""
        with pytest.raises(ValidationError):
            LoginRequest(
                email='notanemail',
                password='ValidPass123'
            )

    def test_password_min_length(self):
        """Schema should enforce minimum password length."""
        with pytest.raises(ValidationError):
            LoginRequest(
                email='test@example.com',
                password='short'
            )

    def test_password_max_length(self):
        """Schema should enforce maximum password length."""
        long_password = 'a' * 129

        with pytest.raises(ValidationError):
            LoginRequest(
                email='test@example.com',
                password=long_password
            )

    def test_login_no_password_validation(self):
        """Login should NOT validate password strength (only length)."""
        # Login accepts any password that meets length requirements
        # No uppercase/lowercase/number requirements

        passwords_accepted_for_login = [
            'alllowercase12345',  # No uppercase (but 8+ chars)
            'ALLUPPERCASE12345',  # No lowercase (but 8+ chars)
            'NoNumbersButLongEnough',  # No numbers (but 8+ chars)
        ]

        # These should fail registration but might pass login schema
        # if login doesn't have the same validators
        for password in passwords_accepted_for_login:
            if len(password) >= 8:
                # Login schema only checks length, not complexity
                request = LoginRequest(
                    email='test@example.com',
                    password=password
                )
                assert request.password == password

    def test_extra_fields_forbidden(self):
        """Schema should reject extra fields."""
        with pytest.raises(ValidationError):
            LoginRequest(
                email='test@example.com',
                password='ValidPass123',
                remember_me=True
            )

    def test_model_dump(self):
        """Schema should serialize to dict correctly."""
        request = LoginRequest(
            email='test@example.com',
            password='ValidPass123'
        )
        data = request.model_dump()

        assert data['email'] == 'test@example.com'
        assert data['password'] == 'ValidPass123'


class TestSchemaConsistency:
    """Test consistency between registration and login schemas."""

    def test_both_accept_valid_credentials(self):
        """Valid credentials should work for both register and login."""
        email = 'test@example.com'
        password = 'ValidPass123'

        register = RegisterRequest(email=email, password=password)
        login = LoginRequest(email=email, password=password)

        assert register.email == login.email
        assert register.password == login.password

    def test_password_length_consistency(self):
        """Both schemas should have same password length requirements."""
        # 8 chars should work for both
        password_8 = 'Valid123'

        RegisterRequest(email='test@example.com', password=password_8)
        LoginRequest(email='test@example.com', password=password_8)

        # 128 chars should work for both
        password_128 = 'A1' + 'a' * 126

        RegisterRequest(email='test@example.com', password=password_128)
        LoginRequest(email='test@example.com', password=password_128)

        # 129 chars should fail for both
        password_129 = 'A1' + 'a' * 127

        with pytest.raises(ValidationError):
            RegisterRequest(email='test@example.com', password=password_129)

        with pytest.raises(ValidationError):
            LoginRequest(email='test@example.com', password=password_129)
