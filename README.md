# Techno Dive

A mobile-first technical cave and shipwreck diving web game with realistic trimix/nitrox gas physics, decompression physiology, a dive computer HUD, and real-time co-op multiplayer across 25 real-world expeditions.

## Quick Start (Play on PC & Mobile over Wi-Fi)

```powershell
cd "c:\Users\Chris Barnes\Projects\cave-diver"
npm start
```

The server binds to `0.0.0.0:3000` and prints your local LAN URLs (for example `http://192.168.x.x:3000`). Open that URL in Safari or Chrome on your phone (connected to the same Wi-Fi network) to play.

> **Windows Firewall note:** On first launch, Windows may ask to allow Node.js on Private networks — allow it so your phone can reach port `3000`.

## Level 1: Cenote El Abismo (0–50m)
1. **EAN32 (0–33m Travel):** Descend through Cenote Alpha past `Cavern Gate (12m)` to `Halocline Drop (26m)`.
2. **TMX 14/55 (3–65m Bottom):** Switch before passing 30m to avoid Oxygen Toxicity & Nitrogen Narcosis. Navigate `The Restriction (38m)` cleanly to avoid kicking up blinding silt clouds, then reach `Deep Sump (50m)`.
3. **O2 100% (0–6m Deco):** Ascend smoothly (<10 m/min) up the chimney, switch back to `EAN32` above 20m (to prevent hypoxia near the surface on Trimix), then switch to `O2 100%` at `Deco Shelf (6m)` to clear your decompression ceiling before surfacing at Cenote Beta.

## Controls
- **Mobile:** Left thumbstick to swim · **FIN KICK** button for burst thrust · Tap cylinder buttons directly on the **Dive Computer** bezel to switch gas.
- **Desktop:** `WASD` / Arrow Keys to swim · `1` / `2` / `3` to switch gas · `Space` for fin kick · `L` to toggle torch.

## Running Tests
```powershell
npm test
```
