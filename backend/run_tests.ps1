param(
    [string]$TestType,
    [switch]$NoCoverage
)

function Show-Help {
    Write-Host "Usage: .\run_tests.ps1 [-TestType <type>] [-NoCoverage]"
    Write-Host ""
    Write-Host "Types:"
    Write-Host "  all           - Run all tests"
    Write-Host "  unit          - Run unit tests only"
    Write-Host "  integration   - Run integration tests only"
    Write-Host "  models        - Run model tests only"
    Write-Host "  schemas       - Run schema tests only"
    Write-Host "  routes        - Run route tests only"
    Write-Host "  auth          - Run authentication tests only"
    Write-Host "  notes         - Run notes tests only"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\run_tests.ps1 -TestType all                 # All tests with coverage"
    Write-Host "  .\run_tests.ps1 -TestType unit                # Unit tests with coverage"
    Write-Host "  .\run_tests.ps1 -TestType all -NoCoverage     # All tests, no coverage"
}


Write-Host "================================" -ForegroundColor Green
Write-Host "Backend Test Suite Runner" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""

# Check if no args
if ($PSBoundParameters.Count -eq 0) {
    Show-Help
    exit 0
}

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

# Determine coverage flag
$CoverageArgs = if ($NoCoverage) { @() } else { @("--cov=app", "--cov-report=term-missing") }

switch ($TestType.ToLower()) {
    "help" {
        Show-Help
        exit 0
    }
    
    "all" {
        Write-Host "Running all tests..." -ForegroundColor Green
        pytest @CoverageArgs -v
    }

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

    default {
        Write-Host "Unknown test type: $TestType" -ForegroundColor Red
        Write-Host ""
        Show-Help
        exit 1
    }
}