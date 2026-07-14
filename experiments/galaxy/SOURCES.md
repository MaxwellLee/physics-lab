# Galaxy experiment sources

This experiment separates measured values, observation-derived maps, and teaching visualizations. It does not present the external view of the Milky Way, a black-hole close-up, or exoplanet surfaces as photographs.

## Scientific model and facts

- Milky Way structure, scale, stellar population, and the Sun's galactic orbit: [NASA Galaxies](https://science.nasa.gov/universe/galaxies/), [NASA Solar System Facts](https://science.nasa.gov/solar-system/solar-system-facts/)
- Sagittarius A* classification and approximate mass: [NASA Black Hole Types](https://science.nasa.gov/universe/black-holes/types/), [NASA Galactic Center explainer](https://science.nasa.gov/mission/webb/science-overview/science-explainers/what-is-the-center-of-our-galaxy-like/)
- Solar and planetary facts: [NASA Solar System](https://science.nasa.gov/solar-system/), individual NASA planet fact pages, and [NASA Basics of Space Flight](https://science.nasa.gov/learn/basics-of-space-flight/chapter1-2/)
- Orbital relationships: [NASA Orbits and Kepler's Laws](https://science.nasa.gov/solar-system/orbits-and-keplers-laws/)
- Exoplanet system facts: NASA Exoplanet Exploration pages. Exoplanet surfaces are schematic because reliable surface images do not exist.

Planet positions are advanced from approximate J2000 orbital elements with a Kepler solver. The model is for education, not spacecraft navigation.

## Planet textures

- `mercury.jpg`: USGS Astrogeology, MESSENGER MDIS Global Color Mosaic, 1024-pixel equirectangular sample. Source data: NASA MESSENGER / JHU-APL / Carnegie / ASU. [USGS catalog record](https://astrogeology.usgs.gov/search/map/mercury_messenger_mdis_global_color_mosaic_665m)
- `venus.jpg`: NASA/JPL-Caltech generated planetary map based on Magellan radar imagery, with documented gap filling. [NASA 3D Resource](https://science.nasa.gov/3d-resources/venus/)
- Earth and Moon: reuse the verified NASA Earth Observatory Blue Marble and NASA SVS LRO/LROC products documented in [`../../assets/textures/SOURCES.md`](../../assets/textures/SOURCES.md).
- `mars.jpg`: NASA/JPL-Caltech generated planetary map based on Viking imagery processed by USGS. [NASA 3D Resource](https://science.nasa.gov/3d-resources/mars/)
- `jupiter.jpg`: NASA/JPL-Caltech global map made from Voyager imagery. [NASA 3D Resource](https://science.nasa.gov/3d-resources/jupiter/)
- `saturn.jpg`: NASA/JPL-Caltech legacy global visualization. NASA labels this product fictional rather than a single observation-derived global map. It is therefore identified in the interface as a visualization. [NASA 3D Resource](https://science.nasa.gov/3d-resources/saturn/)
- Uranus: generated in-browser as a deliberately low-detail blue-green atmosphere based on NASA's visible-light description. No invented storms or surface details are added. [NASA Uranus](https://science.nasa.gov/uranus/)
- `neptune.jpg`: Don Davis and JPL/Caltech legacy global visualization with cloud features. NASA labels the product fictional; the interface explicitly describes it as an observation-based global visualization, not a photograph. [NASA 3D Resource](https://science.nasa.gov/3d-resources/neptune/)

## Rendered visualizations

- The Milky Way is a procedural particle reconstruction of a barred spiral galaxy with a central bulge, thin stellar disk, spiral-arm concentration, and sparse halo. It is not an external photograph of the Milky Way.
- The Sagittarius A* close-up uses a procedural event-horizon silhouette, photon-ring cue, and animated accretion-flow visualization. Sagittarius A* is comparatively quiet, so this is a scale-learning view rather than a claim that it currently has a bright disk of this appearance.
- Saturn's rings are a procedural teaching texture. Their relative extent is approximate; individual ring particles are not resolved.
- Uranus's rings and all generic exoplanet appearances are schematic.

## Usage

NASA and USGS materials are credited to their originating teams. No NASA or USGS logo is used, and no endorsement is implied. See [NASA media usage guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/).
