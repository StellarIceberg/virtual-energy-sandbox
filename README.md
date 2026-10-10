# Virtual Energy Sandbox

An independent, browser-based educational demonstration of residential solar, batteries, smart-meter readings, price-aware energy management and publicly documented troubleshooting concepts. Built with React, TypeScript, Vite, Tailwind CSS and animated SVG. No login, backend, database or external data API.

Public deployment: https://stellariceberg.github.io/virtual-energy-sandbox/

## Local development

Use Node.js 22 or later.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite, including `/virtual-energy-sandbox/`.

```sh
npm test
npm run build
npm run preview
```

## Illustrative system

`src/config.ts` holds the central configuration: 10 kW solar array, 40 kWh battery, 10 kW charging/discharging limits, 80% starting SoC, 20% manufacturer reserve, 25% automated export floor, one 10 kW hybrid inverter with shared AC conversion, and a 10 kW site export cap. This is a large illustrative residential system, not a claim about the average Amber customer.

The model is idealised and lossless. Battery energy (kWh) and power (kW) are labelled separately. Physical dispatch obeys:

- solar + battery discharge + grid import = home load + battery charge + grid export;
- available solar = generated solar + curtailed solar;
- battery energy change = (charging power − discharging power) × simulated hours.

The base system has DC-coupled solar and storage. The shared AC bridge obeys `solar + discharge − charge ≤ 10 kW`, so solar and battery discharge cannot each produce 10 kW independently. Solar charging can run alongside AC home supply/export: it is a DC flow and is not added to AC output. PV input and battery-port limits are separate interface ratings, not separate inverters. Grid supply can bypass the inverter to cover household demand above its rating. The model does not implement grid charging.

Only the existing secondary-solar troubleshooting case uses an explicitly labelled alternate topology: a 5 kW solar-only inverter alongside the hybrid inverter, with no separate battery inverter. That branch's AC generation is excluded from the hybrid output calculation; any AC-to-battery flow respects the hybrid conversion limit.

This idealised interpretation is consistent with public [Fronius hybrid-inverter documentation](https://www.fronius.com/en-au/australia/solar-energy/installers-partners/technical-data/all-products/inverters/fronius-symo-gen24-plus/fronius-symo-gen24-10-0-aus-plus-sc), which distinguishes AC ratings, PV input and battery ports and describes parallel DC/AC flows. It is not a manufacturer-specific device model.

No simultaneous charging/discharging or importing/exporting is allowed. Home consumption can use storage down to manufacturer reserve; automated battery exports also respect the separate export floor and forecast budget. The local hard export cap remains effective when cloud curtailment commands fail.

## Main scenarios

Positive FiT uses solar for the home, charges storage and exports surplus. Negative FiT supplies the home and storage while curtailing excess generation. Both demonstrate constant conditions for five simulated hours.

Evening optimisation uses a deterministic 17:00–24:00 schedule and zero solar. The 10 kWh remaining household forecast is spread uniformly across that seven-hour demonstration (about 1.43 kW), not modelled as a 10 kW load. Separate import and feed-in tariffs appear in the interface. There is no randomness or live market data.

The educational planner protects forecast household demand **in addition to** the effective export reserve, then allocates surplus energy to eligible future price blocks in descending FiT order. The 15 c/kWh opportunity threshold is an example, not a documented universal SmartShift trigger. With default settings it allocates 12 kWh of battery exports to the 35 and 22 c/kWh periods, supplies 10 kWh to the home, and finishes at 25% SoC. This conservative strategy is an approximation, not SmartShift's proprietary optimisation.

Power readings describe the next one-minute dispatch at the displayed model state. The paused/complete diagram is a frozen planning snapshot; totals include only elapsed intervals. Household and grid cards show accumulated kWh, with power/individual import-export totals as secondary readings. Export value is integrated separately from import cost; lab negative-price exports show an illustrative charge, not a bill.

## Playback

One Play/Pause toggle, Reset and `» 2×`, `» 10×`, `» 100×` speed controls sit within the figure. Base 1× advances one simulated minute per 0.2 seconds; it is already accelerated from wall time. Selecting an active multiplier returns to 1×. Each tick integrates every individual simulated minute, even at 100×, preserving tariff, reserve and energy transitions. Browser background timer throttling may slow apparent playback.

Reset and main scenario selection reset time, energy counters, SoC and speed. Entering the lab pauses the main simulation. Lab comparison switches restart lab time and counters; connection toggles affect subsequent intervals without rewriting prior energy accounting. Reset Fault restores normal operation and clears connection/telemetry overrides.

## Interactive Lab

Eight examples use the same physical dispatch ledger and SVG diagram:

1. Inverter communication loss, with explicitly assumed local fallback operation.
2. Requested solar curtailment not executed, with negative-FiT export charges.
3. Battery discharge restriction: choose reserve, remote control rejection or device lock.
4. Site export cap: compare an intentional approved limit with an illustrative incorrect setting.
5. Partial curtailment with a separate, uncontrolled secondary solar inverter.
6. A manufacturer reserve higher than the export floor (expected behaviour).
7. EV charging as an illustrative household load, without universally disabling curtailment.
8. A simulated firmware compatibility warning and rejected remote commands.

The violet communication link and physical battery connection can be toggled with mouse, keyboard, or external buttons. Colours distinguish unavailable communication, unexecuted commands, physical restrictions and expected behaviour. Optional missing/delayed telemetry does not erase model power or smart-meter accounting. Diagram readings are explicitly model ground truth, not supposedly known live device telemetry.

Each example contains public context, an explicit simulation assumption, suggested checks and working external documentation links. No controls interact with real devices. Follow manufacturer/installer instructions for real systems; the lab does not authorise changing an approved network export limit.

## Public sources and qualifications

All links were opened and checked on 10 October 2026, without authenticated or internal resources. The Interactive Lab includes a Sources & References panel and links for every scenario.

- [Communication troubleshooting](https://help.amber.com.au/hc/en-us/articles/26313725905037-Troubleshooting-SmartShift-Communication-Issues)
- [Solar curtailment troubleshooting](https://help.amber.com.au/hc/en-us/articles/35294215672845-What-to-do-when-solar-curtailment-isn-t-working)
- [Battery energy, manufacturer reserve and automated discharge floor](https://help.amber.com.au/hc/en-us/articles/26733365644045-How-much-of-my-battery-energy-can-Amber-access)
- [General device troubleshooting](https://help.amber.com.au/hc/en-us/articles/38919749770125-Device-troubleshooting-Where-to-Begin-and-is-SmartShift-Causing-the-Issue)
- [AC/DC coupling](https://help.amber.com.au/hc/en-us/articles/40457118061453-AC-coupling-vs-DC-coupling-What-it-means-for-SmartShift)
- [Load-following curtailment](https://help.amber.com.au/hc/en-us/articles/20248505808781-Load-following-curtailment-who-it-applies-to-and-how-it-works)
- [Fox ESS enrolment and firmware](https://help.amber.com.au/hc/en-us/articles/38980157821197-Enrolling-your-Fox-ESS-system-with-Amber)
- [Public SmartShift status and historical reports](https://help.amber.com.au/hc/en-us/articles/35922375367181-SmartShift-Status)

Public documentation supports the general categories, not the exact simulated local fallback modes, numerical fault settings, response times, uniform forecast, EV load, or price-allocation algorithm. Firmware requirements and historical status examples do not imply a current outage or diagnose an actual device. The lab makes no universal claim that EV charging disables curtailment. No internal Amber knowledge base, ticket, proprietary algorithm, or private integration information is used.

## Architecture and validation

- `config.ts`: system settings, tariff schedule, playback speeds.
- `engine.ts`: pure dispatch, forecast/export allocation, time integration and totals.
- `navigation.ts`: safe main-scenario/lab transitions.
- `labEngine.ts`: isolated lab conditions and fault/restoration reducer.
- `labScenarios.ts`: public sources, symptoms, qualification text and checks.
- `Diagram.tsx`: existing Canva-inspired SVG, with optional interaction and secondary inverter.

`npm test` runs the original tests updated for Phase 2 specifications plus new tests for energy conservation, SoC boundaries, forecast protection, tariff scheduling, speed equivalence, kWh integration, navigation, lab restrictions/restoration, diagram units and documentation links. Browser smoke checks cover playback, all lab scenario comparisons, restored connections and narrow-screen overflow.

Limitations: perfect forecasts, uniform household demand, piecewise constant prices, no conversion losses or battery degradation, instantaneous commands, simplified site topology and device behaviour. No weather, billing, real integration, authentication, safety diagnostics or customer account functionality.

## GitHub Pages

The existing workflow is unchanged. Pull requests run tests and build; only `main` deploys after approval and merge. Settings → Pages → Source must be **GitHub Actions**. If needed, run **Validate and deploy Pages** on `main`. Vite's base remains `/virtual-energy-sandbox/`.

The original Canva reference is preserved in `docs/design-reference.png`.

## Independence and licence

Independent educational portfolio project. No affiliation, endorsement or official certification from Amber Electric. It does not reproduce proprietary SmartShift algorithms, internal software or actual integrations.

MIT — see [LICENSE](LICENSE).

### Controller operating status

The permanent violet-link label describes control signals, not electricity. A separate status is derived from actual battery flows: local home supply or solar charging is **Self-consumption**, battery grid exports are **Dispatching**, reserve protection without battery activity is **Preserving**, and other inactivity is **Idle**. **Control unavailable** requires a simulated command fault; local operation can still continue. Export planning and fault diagnostics are displayed separately. Operating-status classification does not change physical dispatch.

These educational labels reference Amber’s public [automation explainers](https://help.amber.com.au/hc/en-us/articles/37122595895309-Understanding-your-SmartShift-Automation-Explainers) and [SmartShift overview](https://help.amber.com.au/hc/en-us/articles/10014159451405-How-does-SmartShift-work). They do not reproduce SmartShift algorithms or imply that every battery discharge is a remote command.
