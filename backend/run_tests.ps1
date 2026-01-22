param(
    [string]$TestType = "all",
    [switch]$NoCoverage
)

Write-Host "================================" -ForegroundColor Green
Write-Host "Backend Test Suite Runner" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""

# Check if virtual environment is activated
if (-not $env:VIRTUAL_ENV) {
    Write-Host "Warning: Virtual environment not detected" -ForegroundColor Yellow
    Write-Host "Attempting to activate .venv..." -ForegroundColor Yellow
    
    if (Test-Path ".venv\Scripts\Activate.ps1") {
        & .venv\Scripts\Activate.ps1
        Write-Host "Virtual environment activated" -ForegroundColor Green
    } else {
        Write-Host "Error: .venv not found. Run setup first:" -ForegroundColor Red
        Write-Host "  python -m venv .venv"
        Write-Host "  .venv\Scripts\activate"
        Write-Host "  pip install -r requirements.txt"
        exit 1
    }
}

# Set test environment variables
$env:FLASK_ENV = "testing"
$env:MYSQL_USER = "test"
$env:MYSQL_PASSWORD = "test"
$env:MYSQL_HOST = "localhost"
$env:MYSQL_DATABASE = "test"
$env:SECRET_KEY = "test-secret-key-for-testing-only"

# Determine coverage flag
$CoverageArgs = if ($NoCoverage) { @() } else { @("--cov=app", "--cov-report=term-missing") }

switch ($TestType.ToLower()) {
    "unit" {
        Write-Host "Running unit tests only..." -ForegroundColor Green
        pytest tests/unit/ @CoverageArgs -v
    }
    
    "integration" {
        Write-Host "Running integration tests only..." -ForegroundColor Green
        pytest tests/integration/ @CoverageArgs -v
    }
    
    "models" {
        Write-Host "Running model tests only..." -ForegroundColor Green
        pytest tests/unit/test_models/ -v
    }
    
    "schemas" {
        Write-Host "Running schema tests only..." -ForegroundColor Green
        pytest tests/unit/test_schemas/ -v
    }
    
    "routes" {
        Write-Host "Running route tests only..." -ForegroundColor Green
        pytest tests/integration/test_routes/ -v
    }
    
    "auth" {
        Write-Host "Running authentication tests only..." -ForegroundColor Green
        pytest tests/integration/test_routes/test_auth_routes.py `
               tests/unit/test_models/test_user_model.py `
               tests/unit/test_schemas/test_auth_schema.py -v
    }
    
    "notes" {
        Write-Host "Running notes tests only..." -ForegroundColor Green
        pytest tests/integration/test_routes/test_notes_routes.py `
               tests/unit/test_models/test_notes_model.py `
               tests/unit/test_schemas/test_notes_schema.py -v
    }
    
    "fast" {
        Write-Host "Running fast tests (unit tests, no coverage)..." -ForegroundColor Green
        pytest tests/unit/ -v
    }
    
    "coverage" {
        Write-Host "Running all tests with coverage report..." -ForegroundColor Green
        pytest --cov=app --cov-report=html --cov-report=term-missing -v
        Write-Host ""
        Write-Host "HTML coverage report generated at: htmlcov\index.html" -ForegroundColor Green
    }
    
    "all" {
        Write-Host "Running all tests..." -ForegroundColor Green
        pytest @CoverageArgs -v
    }
    
    default {
        Write-Host "Unknown test type: $TestType" -ForegroundColor Red
        Write-Host ""
        Write-Host "Usage: .\run_tests.ps1 [-TestType <type>] [-NoCoverage]"
        Write-Host ""
        Write-Host "Types:"
        Write-Host "  all           - Run all tests (default)"
        Write-Host "  unit          - Run unit tests only"
        Write-Host "  integration   - Run integration tests only"
        Write-Host "  models        - Run model tests only"
        Write-Host "  schemas       - Run schema tests only"
        Write-Host "  routes        - Run route tests only"
        Write-Host "  auth          - Run authentication tests only"
        Write-Host "  notes         - Run notes tests only"
        Write-Host "  fast          - Run unit tests without coverage"
        Write-Host "  coverage      - Run all tests with HTML coverage report"
        Write-Host ""
        Write-Host "Examples:"
        Write-Host "  .\run_tests.ps1                      # All tests with coverage"
        Write-Host "  .\run_tests.ps1 -TestType unit       # Unit tests with coverage"
        Write-Host "  .\run_tests.ps1 -TestType all -NoCoverage  # All tests, no coverage"
        Write-Host "  .\run_tests.ps1 -TestType fast       # Quick unit tests"
        exit 1
    }
}