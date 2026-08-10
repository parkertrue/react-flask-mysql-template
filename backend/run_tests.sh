#!/bin/bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

show_help() {
    echo "Usage: ./run_tests.sh <type> [options]"
    echo ""
    echo "Types:"
    echo "  all           - Run all tests (unit + integration separately)"
    echo "  unit          - Run unit tests only (fast, no Docker)"
    echo "  integration   - Run integration tests only (requires Docker)"
    echo "  combined      - Run all tests with combined coverage report"
    echo ""
    echo "Options:"
    echo "  --no-coverage - Skip coverage reporting"
    echo "  --verbose     - Show verbose output (-v)"
    echo ""
    echo "Examples:"
    echo "  ./run_tests.sh unit                  # Fast unit tests"
    echo "  ./run_tests.sh integration           # Integration tests with Docker"
    echo "  ./run_tests.sh combined              # All tests, combined coverage"
    echo "  ./run_tests.sh unit --no-coverage    # Unit tests without coverage"
}

start_test_services() {
    echo -e "${YELLOW}Starting test services (MySQL + Redis)...${NC}"
    
    # Run docker compose from parent directory (where docker-compose.test.yml is)
    (cd .. && docker compose -f docker-compose.test.yml up -d)
    
    echo -e "${YELLOW}Waiting for services to be healthy...${NC}"
    sleep 10
    
    # Verify services are up
    if ! (cd .. && docker compose -f docker-compose.test.yml ps | grep -q "Up"); then
        echo -e "${RED}❌ Test services failed to start${NC}"
        (cd .. && docker compose -f docker-compose.test.yml logs)
        exit 1
    fi
    
    echo -e "${GREEN}✅ Test services ready${NC}"
}

stop_test_services() {
    echo -e "${YELLOW}Stopping test services...${NC}"
    
    # Run docker compose from parent directory
    (cd .. && docker compose -f docker-compose.test.yml down -v)
}

load_test_env() {
    # Load .env.test from parent directory (project root)
    if [ -f "../.env.test" ]; then
        export $(grep -v '^#' ../.env.test | xargs)
        echo -e "${GREEN}✅ Loaded .env.test${NC}"
    else
        echo -e "${RED}❌ .env.test not found in project root${NC}"
        echo "Create .env.test in project root with test configuration"
        exit 1
    fi
}

activate_venv() {
    if [ -z "${VIRTUAL_ENV}" ]; then
        echo -e "${YELLOW}Activating virtual environment...${NC}"
        if [ -f ".venv/Scripts/activate" ]; then
            source .venv/Scripts/activate
        elif [ -f ".venv/bin/activate" ]; then
            source .venv/bin/activate
        else
            echo -e "${RED}❌ Virtual environment not found${NC}"
            echo "Run: python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
            exit 1
        fi
    fi
}

if [ "$#" -eq 0 ]; then
    show_help
    exit 0
fi

TEST_TYPE="$1"
NO_COVERAGE=false
VERBOSE=""

# Parse options
shift
while [ "$#" -gt 0 ]; do
    case "$1" in
        --no-coverage)
            NO_COVERAGE=true
            shift
            ;;
        --verbose)
            VERBOSE="-v"
            shift
            ;;
        *)
            echo -e "${RED}❌ Unknown option: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

activate_venv

# Load test environment variables for ALL test types
# (Unit tests need these for config class instantiation tests)
load_test_env

case "$TEST_TYPE" in
    help)
        show_help
        exit 0
        ;;
    
    unit)
        echo -e "${GREEN}================================${NC}"
        echo -e "${GREEN}Running UNIT tests (fast)${NC}"
        echo -e "${GREEN}================================${NC}"
        
        if [ "$NO_COVERAGE" = true ]; then
            pytest tests/unit/ $VERBOSE
        else
            pytest tests/unit/ --cov=app --cov-report=term-missing $VERBOSE
        fi
        ;;
    
    integration)
        echo -e "${GREEN}================================${NC}"
        echo -e "${GREEN}Running INTEGRATION tests${NC}"
        echo -e "${GREEN}================================${NC}"
        
        # Start Docker services (env already loaded)
        start_test_services
        
        # Run integration tests
        if [ "$NO_COVERAGE" = true ]; then
            pytest tests/integration/ $VERBOSE
        else
            pytest tests/integration/ --cov=app --cov-report=term-missing $VERBOSE
        fi
        
        # Stop services
        stop_test_services
        ;;
    
    combined)
        echo -e "${GREEN}================================${NC}"
        echo -e "${GREEN}COMBINED TEST SUITE${NC}"
        echo -e "${GREEN}Unit + Integration with Total Coverage${NC}"
        echo -e "${GREEN}================================${NC}"
        
        # Start services for integration tests (env already loaded)
        start_test_services
        
        # Run unit tests first (generates .coverage)
        echo -e "${YELLOW}[1/2] Running unit tests...${NC}"
        pytest tests/unit/ --cov=app --cov-report= $VERBOSE
        
        # Run integration tests (appends to .coverage)
        echo -e "${YELLOW}[2/2] Running integration tests...${NC}"
        pytest tests/integration/ --cov=app --cov-append --cov-report= $VERBOSE
        
        # Generate combined coverage report
        echo -e "${GREEN}================================${NC}"
        echo -e "${GREEN}COMBINED COVERAGE REPORT${NC}"
        echo -e "${GREEN}================================${NC}"
        coverage report -m
        
        # Generate HTML report
        coverage html
        echo -e "${GREEN}✅ HTML coverage report: htmlcov/index.html${NC}"
        
        # Stop services
        stop_test_services
        ;;
    
    all)
        echo -e "${GREEN}================================${NC}"
        echo -e "${GREEN}ALL TESTS (separate reports)${NC}"
        echo -e "${GREEN}================================${NC}"
        
        # Run unit tests
        echo -e "${YELLOW}[1/2] Unit tests...${NC}"
        if [ "$NO_COVERAGE" = true ]; then
            pytest tests/unit/ $VERBOSE
        else
            pytest tests/unit/ --cov=app --cov-report=term-missing $VERBOSE
        fi
        
        echo ""
        
        # Start services for integration tests (env already loaded)
        start_test_services
        
        # Run integration tests
        echo -e "${YELLOW}[2/2] Integration tests...${NC}"
        if [ "$NO_COVERAGE" = true ]; then
            pytest tests/integration/ $VERBOSE
        else
            pytest tests/integration/ --cov=app --cov-report=term-missing $VERBOSE
        fi
        
        # Stop services
        stop_test_services
        ;;
    
    *)
        echo -e "${RED}❌ Unknown test type: $TEST_TYPE${NC}"
        show_help
        exit 1
        ;;
esac

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}✅ Tests complete!${NC}"
echo -e "${GREEN}================================${NC}"