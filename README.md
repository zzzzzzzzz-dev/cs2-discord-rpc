
# CS2 Discord RPC

A small local bridge for showing your Counter-Strike 2 match on Discord. CS2 sends game-state updates to the bridge, which forwards the useful parts to Discord Rich Presence.

![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

## What it shows

- Premier, Competitive, Wingman, Casual, Deathmatch, and custom matches
- Current map and match phase
- CT/T score
- Your match K/D and score
- Current round phase

Example:

```text
Premier • de_mirage
CT 8 - T 5 • K/D 12/7 • Score 96
```

## Requirements

 Windows, macOS, or Linux
 Node.js 18 or newer
 Discord Desktop
Counter-Strike 2

## Setup

### 1. Create a Discord application

Go to the [Discord Developer Portal](https://discord.com/developers/applications), create an application, and copy its **Application ID**.

You can also upload a Rich Presence image under **Rich Presence → Art Assets**. The image key used by this project is `cs2`.

### 2. Configure the bridge

From the project directory:

```bash
cp .env.example .env
```

Open `.env` and replace `your_discord_application_id` with your Application ID. The token can be changed, but it must match the token in the GSI config file.

Install dependencies and run the tests:

```bash
npm install
npm test
```

Start the bridge:

```bash
npm start
```

On Windows, `start.bat` can be used instead.

### 3. Install the CS2 config

Copy `gamestate_integration_cs2_discord_rpc.cfg` to:

```text
<Steam folder>/steamapps/common/Counter-Strike Global Offensive/game/csgo/cfg/
```

For a default Windows Steam install, that is usually:

```text
C:\Program Files (x86)\Steam\steamapps\common\Counter-Strike Global Offensive\game\csgo\cfg\
```

Restart CS2 after copying the file. The bridge listens only on `127.0.0.1`, so game data stays on your computer.

In Discord, make sure **User Settings → Activity Privacy → Display current activity as a status message** is enabled.

## Troubleshooting

### `npm` is not recognized

Install the [Node.js LTS release](https://nodejs.org/en/download) and enable **Add to PATH** during setup. Close and reopen your terminal afterward.

### Discord does not show the activity

- Keep Discord Desktop open.
- Check Activity Privacy settings.
- Confirm `DISCORD_CLIENT_ID` is set in `.env`.
- Check the bridge output for `Connected to Discord.`

### CS2 is not sending updates

- Restart CS2 after installing the cfg file.
- Make sure the file is inside `game\csgo\cfg`, not the older `csgo\cfg` folder.
- Check that the URI in the cfg is `http://127.0.0.1:3000`.
- If you changed `GSI_TOKEN`, update the cfg file to match.

### The image is missing

Upload an asset whose key is exactly `cs2`. The text presence still works without an image.

## Development

Run the test suite with:

```bash
npm test
```

The bridge accepts POST requests at `http://127.0.0.1:3000/`. A basic health check is available at `http://127.0.0.1:3000/health`.

## License

MIT. See [LICENSE](LICENSE).
## ai made this slop read me i was too lazy to type all that
