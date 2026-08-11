import torch

from lumii_mastery.model import TemporalMasteryNet, TransferMasteryNet


def test_model_returns_one_logit_per_sequence() -> None:
    model = TemporalMasteryNet(input_size=5, hidden_size=16, layers=1, dropout=0.1)
    logits = model(torch.zeros((3, 12, 5)), torch.tensor([1, 7, 12]))
    assert logits.shape == (3,)
    assert torch.isfinite(logits).all()


def test_transfer_model_masks_padding_and_returns_one_logit() -> None:
    model = TransferMasteryNet(
        input_size=13,
        hidden_size=32,
        layers=1,
        heads=4,
        maximum_sequence_length=20,
    )
    features = torch.zeros((3, 20, 13))
    features[:, :, 12] = 0.6
    logits = model(features, torch.tensor([3, 11, 20]))
    assert logits.shape == (3,)
    assert torch.isfinite(logits).all()
