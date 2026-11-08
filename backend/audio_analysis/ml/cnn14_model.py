
import torch
import torch.nn as nn
import torch.nn.functional as F


class ConvBlock(nn.Module):
    def __init__(self, in_channels, out_channels):
        super().__init__()

        self.conv1 = nn.Conv2d(
            in_channels,
            out_channels,
            kernel_size=3,
            padding=1,
            bias=False,
        )
        self.conv2 = nn.Conv2d(
            out_channels,
            out_channels,
            kernel_size=3,
            padding=1,
            bias=False,
        )

        self.bn1 = nn.BatchNorm2d(out_channels)
        self.bn2 = nn.BatchNorm2d(out_channels)

    def forward(self, x):
        x = F.relu_(self.bn1(self.conv1(x)))
        x = F.relu_(self.bn2(self.conv2(x)))
        x = F.avg_pool2d(x, kernel_size=2)
        return x


class CNN14BirdCLEF(nn.Module):
    def __init__(self, num_classes=234):
        super().__init__()

        # Checkpoint-compatible parameter names.
        # Forward implementations must match training code.
        self.spectrogram_extractor = nn.Module()
        self.spectrogram_extractor.stft = nn.Module()
        self.spectrogram_extractor.stft.conv_real = nn.Conv1d(
            1, 513, kernel_size=1024, stride=320, bias=False
        )
        self.spectrogram_extractor.stft.conv_imag = nn.Conv1d(
            1, 513, kernel_size=1024, stride=320, bias=False
        )

        self.logmel_extractor = nn.Module()
        self.logmel_extractor.register_parameter(
            "melW",
            nn.Parameter(torch.empty(513, 64), requires_grad=False),
        )

        self.bn0 = nn.BatchNorm2d(64)

        channels = [1, 64, 128, 256, 512, 1024, 2048]

        self.conv_block1 = ConvBlock(channels[0], channels[1])
        self.conv_block2 = ConvBlock(channels[1], channels[2])
        self.conv_block3 = ConvBlock(channels[2], channels[3])
        self.conv_block4 = ConvBlock(channels[3], channels[4])
        self.conv_block5 = ConvBlock(channels[4], channels[5])
        self.conv_block6 = ConvBlock(channels[5], channels[6])

        self.fc1 = nn.Linear(2048, 2048)
        self.fc_audioset = nn.Linear(2048, num_classes)

    def forward_features(self, x):
        x = self.bn0(x)

        x = self.conv_block1(x)
        x = self.conv_block2(x)
        x = self.conv_block3(x)
        x = self.conv_block4(x)
        x = self.conv_block5(x)
        x = self.conv_block6(x)

        # Global pooling across frequency and time.
        x = torch.mean(x, dim=(2, 3))

        x = F.dropout(x, p=0.5, training=self.training)
        x = F.relu_(self.fc1(x))
        x = F.dropout(x, p=0.5, training=self.training)

        return x

    def forward(self, x):
        embedding = self.forward_features(x)
        logits = self.fc_audioset(embedding)

        return {
            "logits": logits,
            "clipwise_output": torch.sigmoid(logits),
            "embedding": embedding,
        }

