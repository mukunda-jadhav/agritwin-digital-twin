# Current limitations

- Crop development, root-zone water, stress and harvest are model estimates. Crop profiles and soil hydraulic values need field and cultivar validation.
- Open-Meteo supplies regional forecast or reanalysis values, not a sensor placed in the farmer's field. Future missing days reuse the latest provider values and set daily rainfall to zero. Provenance identifies carried-forward weather.
- Initial soil water is estimated from gridded weather-model soil moisture where available or from a recent-weather spin-up. Previous irrigation is unknown.
- 3D plots and crop rows are schematic. Only the saved outer farm boundary is georeferenced; individual crop plots are not reconstructed from surveyed polygons.
- The three soil classes and three irrigation methods use reference efficiencies and simplified infiltration/drainage assumptions.
- Harvest quantities are simulated model outputs. No sensor, pump controller, market-price feed or guaranteed advisory is connected to the simulation.
- Some technical/help text still falls back to English. Browser speech depends on installed voices.
- The backend currently supports one API instance. Runs pause on restart; multi-instance workers require coordination.
- Hosted deployment, database migration and end-to-end live sign-in have not been activated from this workspace.

New runs do not use generated weather. Legacy saved runs and archives are retained with their original weather provenance; reset a legacy run to start a current model run.

