# Roadmap: features that set AgriTwin apart

Ordered by how much each one strengthens the idea of a *digital twin* (a model that stays tied to the real field) rather than a one-off simulator.

## 1. Disease and pest risk watch — implemented

Weather- and stage-driven risk index for 40 Maharashtra diseases and pests across all 12 crops, with symptoms, scouting steps and integrated pest management guidance. See docs/MODELING.md.

## 2. Satellite calibration (NDVI data assimilation)

Pull free Sentinel-2 imagery for the farm boundary already saved in the app, compute NDVI per plot every 5 to 10 days, and compare it with the simulated leaf area. When they disagree, nudge the model state toward the observation. This turns the current "unvalidated prototype" limitation into a measured error, and it works without any sensors on the farm. It also gives the schematic 3D view a real-data overlay.

## 3. Photo scouting log with a village outbreak map

Let a farmer photograph a leaf and record what they found (confirmed by a KVK officer or by the farmer). Store it with date, plot and threat. Use confirmed reports to (a) show a "seen nearby this week" badge on the risk cards and (b) calibrate the thresholds in threats.ts against real outbreaks, replacing today's generalised ranges. An image classifier can suggest a candidate, but the farmer's or officer's confirmation should be the stored label. Scouting counts would also let insect risk rise above its weather-only cap.

## 4. Marathi voice and WhatsApp advisory

Send a short daily message in Marathi: irrigate or not, any High risk threat and what to scout. The app already has Marathi and Hindi text and browser speech; this moves the advice to where farmers already are. Voice notes help farmers who prefer not to read.

## 5. Season and sowing-date planner

Reuse the existing engine to run every supported crop across a range of sowing dates using historical weather, then rank by modelled yield, irrigation water, disease risk exposure and profit using the mandi prices and cost inputs already in the app. Presents "what should I plant, and when" before the season starts, using only parts of the system that already exist.

## Also worth considering

- Soil Health Card nutrient planner (nitrogen, phosphorus, potassium) to add the nutrient dimension the model currently omits.
- Crop-insurance evidence report: a dated record of weather, stress and scouting that supports a claim.
