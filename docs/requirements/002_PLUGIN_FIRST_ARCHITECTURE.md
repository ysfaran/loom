# 002 - First Renderer: React + Vite + MDX/MD

## User Story
As a user, I want Loom to stay framework-agnostic while shipping a first production renderer, so I can use Loom immediately and still keep the architecture open for future renderer plugins.

## Acceptance Criteria
- Loom remains renderer-agnostic at product level.
- First renderer plugin supports:
  - Markdown (`.md`)
  - MDX (`.mdx`)
- First renderer builds a web docs output using:
  - React
  - Vite
  - Tailwind CSS
  - Tailwind Typography
- First renderer provides the command functions needed by CLI contract:
  - `list`
  - `validate`
  - `build`
  - `dev`
- Renderer behavior is exposed through plugin context, not through dedicated CLI renderer options.

## Technical Details
- First renderer plugin acts as the baseline capability provider for app execution.
- Build output should include:
  - route generation from MD/MDX files
  - rendered HTML application assets
  - documentation navigation shell
- Dev mode should provide local preview workflow with live editing support where possible.
- This requirement is intentionally scoped to the first renderer only.
- Additional renderer plugins (for other frameworks) are future work and must follow the same plugin contract model.

A plugin should be structureed as follow (just an example):

```ts
interface ChatContext {
  chat: {
    chatReady: boolean;
    ask(input: string): Promise<string>;
  };
}

// generic ChatContext: defines wich new context properties/function this plugin will provide
// generic SearchContext: defiens which context properties/function this plugin expects to be there

export const chatPlugin = definePlugin<ChatContext, SearchContext>({
  name: "@loom/plugin-chat",
  setup({ search }) {// search comes from SearchContext
    // to something with existing search context

    // provide new properties/function to extension context for subsequent plugins to use
    return {
      chat: {
        chatReady: true,
        ask: async (input: string) => `[chat] ${input} (${hits.length} hits)`
      }
    };
  }
});
```