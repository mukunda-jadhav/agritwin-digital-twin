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

This is a software research prototype. Daily steps omit layered infiltration, nutrients, pests, disease, cultivar detail, and field-scale spatial variation. No agronomic validation or prediction-accuracy claim is made.

