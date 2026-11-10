# Crop and water model

The API advances a daily virtual clock. Each step consumes one saved weather row and scheduled irrigation events. The browser renders persisted model states.

## Water balance

Final root-zone water = initial water + rainfall + gross irrigation - application loss - runoff - actual evapotranspiration - drainage.

Water is represented as millimetres over the plot. One millimetre over one square metre equals one litre. Reference soil-class values are defined for a 0.30 m layer; new runs scale storage using the selected crop profile's reference root depth. Soil type and root depth are simplified assumptions, not measurements of the field. Drip, sprinkler and flood efficiencies are modeled as 0.90, 0.75 and 0.60.

Actual ET uses provider reference ET0 × crop coefficient × a modeled water-stress coefficient. Rain above the infiltration limit and water above storage capacity become runoff. Water above field capacity drains at a soil-specific rate. Unplanted soil uses a simplified crop coefficient.

## Crop development

Daily growing degree days use the crop reference base temperature and cap. Crop profiles supply reference maturity, water-use coefficients, development stages, root depth, canopy and yield assumptions. Profiles include wheat, maize, tomato, soybean, cotton, tur/pigeonpea, jowar/sorghum, bajra/pearl millet, gram/chickpea, rice, groundnut and sugarcane.

The accumulated development and the resulting stress, biomass and yield are model outputs. They are not field measurements or guaranteed yield forecasts. Generic crop profiles cannot represent every cultivar, planting density or management practice. Local field validation is required before using outputs for operational decisions. At maturity the simulation pauses and asks the user to record the modeled harvest.

## Weather and starting water

Weather inputs are Open-Meteo daily mean temperature, precipitation, FAO reference evapotranspiration, relative humidity and solar radiation. Historical data is reanalysis and forecast data is a forecast model; neither is an on-field sensor reading. Dates use the farm's provider timezone when available.

New provider rows are saved with each run. If a later day has no provider observation, the most recent provider values are carried forward and labeled with the source date. Rainfall is zero on those carried days because it is a per-day total and must not be duplicated. An outage can use weather already saved to the current or archived runs. The system does not generate replacement weather. Without any actual provider weather to seed the run, it cannot advance.

Starting water is estimated from a gridded weather-model soil-moisture product where available. Otherwise the app runs a 30-day bare-soil balance using actual or carried provider weather and exposes sensitivity to the unknown initial state. Prior irrigation is unknown. Neither method is a direct soil measurement.

## Scenarios and intended use

A scenario compares two branches from a saved farm state using the same weather rows and different user-selected temperature, rainfall or irrigation assumptions. The active run is not changed.

This is a software research prototype. Daily steps omit layered infiltration, nutrients, cultivar detail, and field-scale spatial variation. Disease and pest risk is reported separately as a weather-driven index (see below); it does not feed back into simulated growth or yield. No agronomic validation or prediction-accuracy claim is made.


## Crop health (disease and pest risk index)

`packages/shared/src/threats.ts` holds a reference library of 40 Maharashtra diseases and pests covering all 12 crop profiles (each crop has at least one disease and one pest). Each entry records the susceptible crop stage, the temperature and humidity range that favours it, whether wet or dry weather favours it, symptoms, a scouting method and integrated pest management steps.

For each plot the API reads up to 14 days of saved provider weather and the plot's modelled crop stage, water stress and soil saturation. Each day's favourability is a temperature trapezoid combined with humidity and recent rain (wet-weather threats) or dryness (dry-weather pests and vectors). The last 7 days are averaged with recent days weighted more, multiplied by a stage factor that is zero outside the susceptible window, then scaled by water stress (for example charcoal rot, dry root rot, aflatoxin) and waterlogging (Phytophthora blight, red rot) where those matter. The result is a 0–100 index: Low below 25, Moderate to 49, High to 69, Very high from 70.

What the index is and is not:

- It is a **risk index**, not a diagnosis. It does not count pests or confirm infection.
- Daily regional weather replaces in-field leaf wetness, so humidity and rain are proxies.
- Weather cannot show insect numbers, so population-driven threats are capped: temperature-only insects at Moderate and weather-linked insects and vector-borne viruses at High. Reaching Very high for these requires scouting or trap counts, which the prototype does not yet record.
- Generated (synthetic) weather is never used. Carried-forward days are counted and disclosed, and fewer than 3 weather days is labelled indicative.
- Temperature, humidity and stage ranges are generalised reference values from standard crop-protection literature. They have not been calibrated against Maharashtra outbreak records, and local names and management steps should be reviewed by a KVK or state agricultural university officer before use. The library gives integrated pest management steps and does not recommend pesticide products or doses.
