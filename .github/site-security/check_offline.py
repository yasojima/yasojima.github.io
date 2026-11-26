"""Entry point shared by build, local server and the mandatory Pages gate."""
import json
import sys
from distribution_security import check_distribution

if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('Usage: check_offline.py PUBLIC_OUTPUT_DIRECTORY')
    print(json.dumps(check_distribution(sys.argv[1])))
