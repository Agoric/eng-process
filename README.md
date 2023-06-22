# eng-process

This repository contains tools that we wrote to support our engineering proces at Agoric.

## Labels syncing

We have workflows you can run manually to sync labels.

1. Run [.github/actions/export-labels.yml] to export the current state to a manifest.
2. Edit the manifest as desired.
3. Run [.github/actions/sync-labels.yml] to update to match the manifest.
