from __future__ import annotations

import hashlib


def student_split(user_id: str, train: float = 0.70, validation: float = 0.15) -> str:
    """Assign a student deterministically without leaking rows across splits."""
    digest = hashlib.sha256(str(user_id).encode("utf-8")).digest()
    bucket = int.from_bytes(digest[:8], "big") / (2**64 - 1)
    if bucket < train:
        return "train"
    if bucket < train + validation:
        return "validation"
    return "test"
