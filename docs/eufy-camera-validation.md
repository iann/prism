# Eufy camera integration validation log

This file is filled during implementation of [`eufy-camera-event-proposal.md`](./eufy-camera-event-proposal.md). It must contain observed values from the installed Home Assistant/Eufy/go2rtc deployment before live video is called supported. Never put passwords, bearer tokens, private snapshots, or public network addresses in this file.

## Environment

| Item | Observed value | Date | Evidence / notes |
| --- | --- | --- | --- |
| Prism commit / branch | _pending_ |  |  |
| Prism origin | _pending_ |  |  |
| Home Assistant installation (OS/container) | _pending_ |  |  |
| Home Assistant version | _pending_ |  |  |
| Eufy integration version | _pending_ |  |  |
| eufy-security-ws version | _pending_ |  |  |
| go2rtc version and host | _pending_ |  |  |
| Kitchen browser / display | _pending_ |  |  |

## Camera capability matrix

Use opaque Prism IDs in code and record the actual HA entity IDs only in this private local file.

| Prism ID | Model / suffix | Firmware | HA camera entity | Ring source | Motion source | Picture source | go2rtc alias | Event | Picture | Live | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `doorbell-1` | T8200 | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ |  |
| `doorbell-2` | T8200 | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ |  |
| `floodlight-1` | T8420 | _pending_ | _pending_ | n/a | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | Confirm exact suffix / HomeBase association. |

## Measurements

Record source time, HA observation, Prism receipt, first known picture capture time, first decoded frame, and cleanup completion. “Live” means decoded frames, not an open HTTP request or an HA streaming state.

| Camera | Trial | Physical action (UTC) | HA observed (UTC) | Prism card (UTC) | Picture capture time | First decoded frame | Release / stop | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |  |  |

## Known gaps

- Hardware and current Eufy bridge compatibility are not established by the model names alone.
- Repeated doorbell presses must be tested while the ringing state is already active.
- T8420 person-only detection is not assumed.
- WebRTC media reachability depends on the actual LAN/container topology.
