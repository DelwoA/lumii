from __future__ import annotations

import torch
from torch import nn


class TemporalMasteryNet(nn.Module):
    """A compact GRU that generalizes to concepts not present in public data."""

    def __init__(self, input_size: int, hidden_size: int, layers: int, dropout: float) -> None:
        super().__init__()
        self.gru = nn.GRU(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=layers,
            dropout=dropout if layers > 1 else 0.0,
            batch_first=True,
        )
        self.head = nn.Sequential(
            nn.LayerNorm(hidden_size),
            nn.Linear(hidden_size, hidden_size // 2),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_size // 2, 1),
        )

    def forward(self, features: torch.Tensor, lengths: torch.Tensor) -> torch.Tensor:
        outputs, _ = self.gru(features)
        batch = torch.arange(outputs.shape[0], device=outputs.device)
        final = outputs[batch, torch.clamp(lengths - 1, min=0)]
        return self.head(final).squeeze(-1)


class CalibratedInferenceModel(nn.Module):
    def __init__(self, model: nn.Module, temperature: float) -> None:
        super().__init__()
        self.model = model
        self.register_buffer("temperature", torch.tensor(float(temperature)))

    def forward(self, features: torch.Tensor, lengths: torch.Tensor) -> torch.Tensor:
        return torch.sigmoid(self.model(features, lengths) / self.temperature)


class TransferMasteryNet(nn.Module):
    """Portable attention model that corrects a leakage-safe statistical prior."""

    def __init__(
        self,
        input_size: int,
        hidden_size: int = 64,
        layers: int = 2,
        heads: int = 4,
        dropout: float = 0.1,
        maximum_sequence_length: int = 200,
        baseline_feature_index: int = 12,
    ) -> None:
        super().__init__()
        if hidden_size % heads:
            raise ValueError("hidden_size must be divisible by heads")
        self.input_projection = nn.Linear(input_size, hidden_size)
        self.baseline_feature_index = baseline_feature_index
        self.position = nn.Embedding(maximum_sequence_length, hidden_size)
        layer = nn.TransformerEncoderLayer(
            d_model=hidden_size,
            nhead=heads,
            dim_feedforward=hidden_size * 4,
            dropout=dropout,
            activation="gelu",
            batch_first=True,
            norm_first=True,
        )
        self.encoder = nn.TransformerEncoder(
            layer,
            num_layers=layers,
            norm=nn.LayerNorm(hidden_size),
            enable_nested_tensor=False,
        )
        self.head = nn.Sequential(
            nn.Linear(hidden_size, hidden_size // 2),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_size // 2, 1),
        )
        final_layer = self.head[-1]
        if isinstance(final_layer, nn.Linear):
            nn.init.zeros_(final_layer.weight)
            nn.init.zeros_(final_layer.bias)

    def forward(self, features: torch.Tensor, lengths: torch.Tensor) -> torch.Tensor:
        sequence_length = features.shape[1]
        positions = torch.arange(sequence_length, device=features.device)
        hidden = self.input_projection(features) + self.position(positions)[None, :, :]
        padding_mask = positions[None, :] >= lengths[:, None]
        encoded = self.encoder(hidden, src_key_padding_mask=padding_mask)
        batch = torch.arange(features.shape[0], device=features.device)
        final_index = torch.clamp(lengths - 1, min=0)
        final = encoded[batch, final_index]
        baseline_probability = torch.clamp(
            features[batch, final_index, self.baseline_feature_index],
            min=1e-4,
            max=1 - 1e-4,
        )
        baseline_logit = torch.logit(baseline_probability)
        return baseline_logit + self.head(final).squeeze(-1)
