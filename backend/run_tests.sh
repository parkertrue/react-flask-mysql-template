#!/bin/bash
set -e

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

show_help() {
    echo "Usage: ./run_tests.sh <type> [coverage]"
    echo ""
    echo "Types:"
    echo "  all           - Run all tests"
    echo "  unit          - Run unit tests only"
    echo "  integration   - Run integration tests only"
    echo "  models        - Run model tests only"
    echo "  schemas       - Run schema tests only"
    echo "  routes        - Run route tests only"
    echo "  auth          - Run authentication tests only"
    echo "  notes         - Run notes tests only"
    echo ""
    echo "Examples:"
    echo "  ./run_tests.sh all              # All tests with coverage"
    echo "  ./run_tests.sh unit             # Unit tests with coverage"
    echo "  ./run_tests.sh all coverage     # Explicit coverage flag"
}

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Backend Test Suite Runner${NC}"
echo -e "${GREEN}================================${NC}"
echo ""

if [ "$#" -eq 0 ]; then
    show_help
    exit 0
fi

# Activate virtual environment (cross-platform)
if [ -z "${VIRTUAL_ENV}" ]; then
    echo -e "${YELLOW}Activating virtual environment...${NC}"
    if [ -f ".venv/Scripts/activate" ]; then
        source .venv/Scripts/activate  # Windows (Git Bash)
    elif [ -f ".venv/bin/activate" ]; then
        source .venv/bin/activate      # Linux/macOS
    else
        echo -e "${RED}Error: .venv not found.${NC}"
        echo -e "${RED}Run setup first:${NC}"
        echo "  python -m venv .venv"
        echo "  source .venv/Scripts/activate  # or .venv/bin/activate on Linux"
        echo "  pip install -r requirements.txt"
        exit 1
    fi
fi

TEST_TYPE="$1"
COVERAGE="${2:-coverage}"  # Default to coverage unless 'nocoverage' specified

case "$TEST_TYPE" in
    help)
        show_help
        exit 0
        ;;
    
    all)
        echo -e "${GREEN}Running all tests...${NC}"
        if [ "$COVERAGE" != "nocoverage" ]; then
            pytest --cov=app --cov-report=term-missing -v
        else
            pytest -v
        fi
        ;;

    unit)
        echo -e "${GREEN}Running unit tests only...${NC}"
        if [ "$COVERAGE" != "nocoverage" ]; then
            pytest tests/unit/ --cov=app --cov-report=term-missing -v
        else
            pytest tests/unit/ -v
        fi
        ;;
    
    integration)
        echo -e "${GREEN}Running integration tests only...${NC}"
        if [ "$COVERAGE" != "nocoverage" ]; then
            pytest tests/integration/ --cov=app --cov-report=term-missing -v
        else
            pytest tests/integration/ -v
        fi
        ;;
    
    models)
        echo -e "${GREEN}Running model tests only...${NC}"
        pytest tests/unit/test_models/ -v
        ;;
    
    schemas)
        echo -e "${GREEN}Running schema tests only...${NC}"
        pytest tests/unit/test_schemas/ -v
        ;;
    
    routes)
        echo -e "${GREEN}Running route tests only...${NC}"
        pytest tests/integration/test_routes/ -v
        ;;
    
    auth)
        echo -e "${GREEN}Running authentication tests only...${NC}"
        pytest tests/integration/test_routes/test_auth_routes.py \
               tests/unit/test_models/test_user_model.py \
               tests/unit/test_schemas/test_auth_schema.py -v
        ;;
    
    notes)
        echo -e "${GREEN}Running notes tests only...${NC}"
        pytest tests/integration/test_routes/test_notes_routes.py \
               tests/unit/test_models/test_notes_model.py \
               tests/unit/test_schemas/test_notes_schema.py -v
        ;;
    
    *)
        echo -e "${RED}Unknown test type: $TEST_TYPE${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac