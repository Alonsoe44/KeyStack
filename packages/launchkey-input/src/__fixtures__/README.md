# Captures

Raw `amidi -p hw:1,0,1 -d` output from a Launchkey Mini MK4 37 on the client
Pi, 2026-10-19, run by hand by the owner. Copied verbatim; do not edit.

| File | Setup sent | What was pressed |
|---|---|---|
| `amidi-list.txt` | — | output of `amidi -l` |
| `test3-pads-absolute-knobs.txt` | `9F 0C 7F` | pads 1, 2, 4, 5, then knobs 8 and 7 (absolute mode) |
| `test4-buttons-relative.txt` | `9F 0C 7F B6 45 7F` | Shift, Play, Record, Func, >, v, pads 16 + 8, Track v/^, pad 16, Func, >, ^, v |
| `test5-knob-and-track.txt` | `9F 0C 7F B6 45 7F` | knob 1: 3 clicks clockwise, 3 back; Track ^, Track v |
