# usage

A mod for [Claude Code](https://claude.com/claude-code): a side pane with what the session has spent so far.

```
12 min 5 s
this session · $3.51

5-hour limit
resets in                4 h 0 min

7-day limit                    79%
━━━━━━━━━━━━━━━━━━━━━━━━━──────
resets in                  3 d 2 h

Context                 180k of 1M
messages                      142k
tools                          21k
system                         12k

Last turn
output                        1.2k

Tokens                         45k
output                         12k
input                          33k
served from cache              92%

Tools                           18
Read                             7
Edit                             5
Bash                             4
```

## What it shows

- **Session**: elapsed time and accumulated cost.
- **Notices**: from 80% of context it recommends `/compact`, and it warns about each limit that passes 80% (the 5-hour one is followed on the band).
- **Limits**: each usage window with its bar and when it resets.
- **Context**: tokens used out of the window and the three categories that take up the most.
- **Last turn**: output tokens.
- **Tokens**: output, input and how much of the input the cache served.
- **Tools**: total calls and the five most used.

The pane opens by itself when the session starts; `/usage-pane` opens it again.

## Meant to be used with `band`

This pane does not repeat what the [band](https://github.com/zrdqns/claude-code-band) mod already shows above the prompt: the context percentage, the 5-hour limit percentage and the last turn's length and cost are there. Here is the detail the band does not have.

## Installation

At the prompt of a terminal session:

```
/plugin install usage --marketplace zrdqns/claude-code-usage
```

Answer `y` to add the marketplace and choose the scope (the user scope loads it in every session, including the desktop app's).

To try it from a local copy, without installing it:

```bash
claude --plugin-dir ./claude-code-usage
```

## Development

```bash
claude plugin validate .
claude plugin test .
```

The module is in [`hooks/register.tsx`](hooks/register.tsx), its state contract in [`types/index.d.ts`](types/index.d.ts) and the tests in [`tests/`](tests).

## License

[MIT](LICENSE)
