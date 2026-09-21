#!/usr/bin/env python3
"""Emit a Tauri --config JSON overlay for CI signing.

Unsigned builds (no TAURI_SIGNING_PRIVATE_KEY) disable updater artifacts.
If WINDOWS_CERTIFICATE_THUMBPRINT is set, pass it through for Authenticode.
Prints nothing when no overlay is needed.
"""

from __future__ import annotations

import json
import os


def main() -> None:
    bundle: dict[str, object] = {}
    if not os.environ.get("TAURI_SIGNING_PRIVATE_KEY"):
        bundle["createUpdaterArtifacts"] = False
    thumb = os.environ.get("WINDOWS_CERTIFICATE_THUMBPRINT")
    if thumb:
        bundle.setdefault("windows", {})["certificateThumbprint"] = thumb
    if bundle:
        print(json.dumps({"bundle": bundle}, separators=(",", ":")))


if __name__ == "__main__":
    main()
