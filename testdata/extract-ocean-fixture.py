#!/usr/bin/env python3
"""Extract the JSON emitted by ocean-upstream-fixture.rs from cargo test output."""
import json
import pathlib
import sys

text = pathlib.Path(sys.argv[1]).read_text()
start = text.index('{', text.index('running 1 test'))
fixture, _ = json.JSONDecoder().raw_decode(text[start:])
print(json.dumps(fixture, indent=2))
