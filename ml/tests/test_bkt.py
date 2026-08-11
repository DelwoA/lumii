from lumii_mastery.bkt import BktParameters, probability_correct, update


def test_repeated_success_increases_mastery_and_prediction() -> None:
    parameters = BktParameters()
    mastery = parameters.prior
    before = probability_correct(mastery, parameters)
    for _ in range(4):
        mastery = update(mastery, 1, parameters)
    assert mastery > parameters.prior
    assert probability_correct(mastery, parameters) > before


def test_failure_reduces_the_posterior_signal() -> None:
    parameters = BktParameters()
    mastery = 0.8
    assert update(mastery, 0, parameters) < update(mastery, 1, parameters)
