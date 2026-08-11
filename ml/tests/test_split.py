from lumii_mastery.data.split import student_split


def test_student_split_is_deterministic_and_complete() -> None:
    results = [student_split(f"student-{index}") for index in range(10_000)]
    assert results == [student_split(f"student-{index}") for index in range(10_000)]
    assert set(results) == {"train", "validation", "test"}
    assert 0.67 < results.count("train") / len(results) < 0.73
