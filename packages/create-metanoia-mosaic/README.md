# create-metanoia-mosaic

Creates a starter project for [Metanoia Mosaic](https://github.com/Xephyr-Labs/metanoia-mosaic): an Express server running [`@metanoialabs/chatbot`](https://www.npmjs.com/package/@metanoialabs/chatbot), with the chat widget already on its page.

```sh
npm create metanoia-mosaic
```

Then:

```sh
cd my-assistant
cp .env.example .env   # add your OpenAI-compatible provider URL, key, and model
npm install
npm run dev
```

## Options

```sh
npm create metanoia-mosaic -- --name my-assistant --template express --yes
```

| Flag | Default | Purpose |
| --- | --- | --- |
| `--name` | `my-assistant` | Directory to create. It must not already exist |
| `--template` | `express` | Starter template. Only `express` is available for now |
| `--yes`, `-y` | | Skip the prompts and use the defaults |

Before you deploy, replace the placeholder resolver in `src/auth.js` with one that reads your app's real login session.

Requires Node.js 20 or newer.

## License

MIT
