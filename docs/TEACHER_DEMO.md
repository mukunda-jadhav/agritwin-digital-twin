# AgriTwin presentation walkthrough

## Prepare a real-weather run

1. Start the project with npm run dev in C:\Users\isvol\Downloads\digital_twin and open http://localhost:5173.
2. Sign in or create an account, then create a farm for a real Maharashtra location. Add a plot with the crop, sowing date, area, soil type and irrigation method.
3. For a short maturity walkthrough, choose a short-duration crop such as bajra or jowar and use a realistic sowing date about 80–110 days before the presentation. Start the simulation at that date and advance in seven-day steps or use the speed control. The real historical provider data is used where available; after the forecast horizon, the latest provider weather carries forward with rainfall set to zero.
4. Before presenting, open Twin data & assumptions and verify the source and date range. Keep the laptop online so Open-Meteo can supply weather. Save the farm and leave the simulation paused at a useful stage if you do not want to replay it live.

## Five-minute explanation

1. **Problem:** farmers make irrigation and crop-stage decisions using field details and weather that are often scattered.
2. **Digital twin setup:** AgriTwin stores the farm location, plot area, crop, sowing date, soil class and irrigation method.
3. **Data flow:** the location requests Open-Meteo forecast and historical reanalysis. Provider days are saved; missing future days reuse the latest actual provider values and are labeled carried forward. Rain is not repeated.
4. **Simulation:** each day updates root-zone water through rain, irrigation, losses, evapotranspiration and drainage. Crop development responds to temperature and modeled water stress.
5. **Visualization and action:** inspect the 3D field, check the selected plot and water estimate, record virtual irrigation, review a scenario, then show the maturity pause and harvest action.

## Questions teachers may ask

- **Is soil water measured?** No. It is an estimate from gridded weather-model soil moisture or a weather-balance spin-up. There are no field sensors connected.
- **Is crop growth from live weather?** Weather inputs come from a live provider forecast or its historical reanalysis. Crop development is calculated by the digital-twin model using reference crop parameters.
- **What if the forecast ends?** The simulation continues with the latest provider weather already obtained or saved. The display says when a day's weather is carried forward, and repeated rainfall is not counted.
- **Can you claim exact yield or water savings?** No. Outputs are modeled estimates and need on-farm validation.
- **Does the 3D model map the actual field?** It shows the saved farm outline and schematic plot rows; crop plots are not surveyed 3D reconstructions.
- **Does it operate irrigation equipment?** No. Irrigation entries change only the virtual model.

Do not describe an estimated value as measured. Do not project passwords, API keys or database connection strings. The project has not been hosted or independently field-validated.

