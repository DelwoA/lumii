from __future__ import annotations

import argparse
import json
from pathlib import Path

from lumii_mastery.promotion import promote


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--candidate", type=Path, required=True)
    parser.add_argument("--champion", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(promote(args.candidate, args.champion), indent=2))


if __name__ == "__main__":
    main()
