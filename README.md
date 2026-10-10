# Virtual Energy Sandbox

A browser-based educational demonstration of residential solar, batteries, smart-meter readings and automated electricity management. Built with React, TypeScript, Vite, Tailwind CSS and animated SVG. No installation or login is required for the deployed site.

## Local development

Use Node.js 22 or later.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite (including `/virtual-energy-sandbox/`).

```sh
npm test
npm run build
npm run preview
```

## Demonstration

Choose positive feed-in tariff, negative feed-in tariff, or no solar / evening peak. Play advances one simulated minute every 0.2 seconds, for up to five simulated hours. Pause freezes time and energy-flow animation. Reset and scenario selection restore the scenario's 80% starting SoC and pause playback. Inactive flows have no arrows. Solid arrowheads show direction; violet dashed lines indicate communication.

Solar supplies the house first, then charges the battery. Surplus is exported at positive FiT and curtailed at negative FiT. With no solar, the battery supplies the house until reserve or power constraints require grid imports. Positive FiT starts with 4.5 kW battery charging; export begins as the battery fills after 36 simulated minutes. Negative FiT similarly begins curtailing after the battery fills. Evening reserve is reached after 243 simulated minutes.

## Interactive Lab placeholder

The fourth navigation option opens an isolated `src/InteractiveLab.tsx` placeholder. Entering the lab pauses the simulator; returning to one of the original scenarios restores its starting conditions using the existing reducer. No fault simulations or additional energy calculations are implemented.

Future lab scenarios must use publicly documented device behaviour and public Amber Electric support resources, with sources verified during that development phase. Internal company information must not be used. The separate lab component can later host its own scenario panel and connection controls without modifying the normal simulation engine.

Playback controls are contained in `src/PlaybackControls.tsx` and placed inside the simulation figure with a compact timeline. On narrow screens they sit above the SVG within the figure to avoid obscuring energy flows.

## Model and limitations

- Constant illustrative prices and loads; no live market or weather data.
- Default capacity 13.5 kWh, charge/discharge limits 5 kW, reserve 20%.
- Idealised AC-coupled topology: separate 6 kW solar inverter and 5 kW battery inverter. The diagram groups these as “Inverters”. This is not a shared 5 kW hybrid-inverter model.
- Lossless conversion and storage, instantaneous response, no degradation, ramping, network export constraint, tariffs or billing calculations.
- Battery energy is bounded over each one-minute interval so the last charging/discharging step cannot exceed capacity or reserve. Live powers describe the upcoming interval at the displayed SoC.
- Balance: solar + battery discharge + grid import = household consumption + battery charge + grid export. Available solar = generated solar + curtailed solar.
- No simultaneous battery charging/discharging or grid importing/exporting.
- Playback time advances only while the browser processes timer callbacks; it is a demonstration, not a wall-clock model.

`src/engine.ts` contains pure calculations and the playback reducer. Visual components consume those values. Automated tests cover energy conservation across SoC values, storage bounds, inverter and battery power limits, curtailment, invalid inputs and control transitions.

## GitHub Pages

After approving and merging the initial pull request:

1. Open repository **Settings → Pages**.
2. Under **Build and deployment**, choose **GitHub Actions** as the source.
3. Open **Actions → Validate and deploy Pages** and run the workflow on `main` if the merge-triggered deployment ran before Pages was enabled.
4. Wait for the deployment job to complete. The intended URL is https://stellariceberg.github.io/virtual-energy-sandbox/.

The workflow tests and builds pull requests, but only deploys `main`. Vite's base path is configured for this repository name. GitHub Pages is not published from the feature branch.

## Design and independence

The provided Canva image is preserved in `docs/design-reference.png`. The interface recreates its arrangement with SVG rather than embedding the image as the dashboard.

This is an independent educational project. It does not reproduce Amber Electric's proprietary SmartShift algorithms, internal software, or actual integrations. It connects to no physical devices.

## Licence

MIT — see [LICENSE](LICENSE).
