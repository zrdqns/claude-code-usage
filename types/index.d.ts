export type Tokens = {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

export type Tools = Record<string, number>

export type Part = { name: string; tokens: number }

export type LastTurn = { output: number }

declare module 'claude-code' {
  interface PluginState {
    usage: {
      tokens: Tokens
      tools: Tools
      parts: Part[]
      last: LastTurn | null
    }
  }
}
