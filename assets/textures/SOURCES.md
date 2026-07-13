# Texture sources and processing

These textures are derived from public NASA imagery for educational, real-time rendering. They contain no artificial eclipse coloring or pre-rendered eclipse shadow.

## Earth

- Files: `earth_4096.jpg` (4096×2048), `earth_2048.jpg` (2048×1024)
- Source: NASA Earth Observatory, **Blue Marble: Next Generation — July base map**, global 5400×2700 JPEG.
- Source file: <https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/july/world.200407.3x5400x2700.jpg>
- Collection and alternate resolutions: <https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/>
- Processing: high-quality bicubic downsampling; JPEG quality 91 (4K) and 90 (2K). No clouds, lighting, atmosphere, night lights, or eclipse shadow were added.
- Credit: **NASA Earth Observatory; Blue Marble: Next Generation, produced by Reto Stöckli, NASA Goddard Space Flight Center.**

## Moon

- Files: `moon_4096.jpg` (4096×2048), `moon_2048.jpg` (2048×1024), `moon_nearside_1024.png` (1024×1024 RGBA), `moon_height_1024.jpg` (1024×512 grayscale)
- Source: NASA Scientific Visualization Studio, **CGI Moon Kit**, `lroc_color_2k.jpg` (2048×1024).
- Source file: <https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg>
- Source page and higher-resolution color/elevation products: <https://svs.gsfc.nasa.gov/4720/>
- Data basis: Lunar Reconnaissance Orbiter Camera (LROC) Wide Angle Camera global color data, with polar gaps filled from the LRO laser-altimeter albedo map as documented by NASA SVS.
- Processing: JPEG quality 93; the 4K delivery is a high-quality bicubic upscale of the official 2K web image, while the 2K delivery retains the source dimensions. `moon_nearside_1024.png` is an unlit orthographic projection centered at 0° lunar longitude, with a transparent antialiased edge. No red lunar-eclipse tint or directional shadow was baked into any file.
- Height source: NASA CGI Moon Kit `ldem_3_8bit.jpg`, a browser-ready 8-bit preview derived from Lunar Orbiter Laser Altimeter (LOLA) global elevation data: <https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_3_8bit.jpg>. It is retained byte-for-byte at 1024×512 as `moon_height_1024.jpg` and is intended for subtle visual bump mapping; use the higher-bit products linked on the source page for numerical elevation work.
- Credit: **NASA's Scientific Visualization Studio; Ernie Wright (USRA); Noah Petro (NASA/GSFC); LRO/LROC and LOLA instrument teams.**

## Clouds

- File: `clouds_2048.png` (2048×1024 RGBA)
- Source: NASA Visible Earth, **Blue Marble: Clouds**, `cloud_combined_2048.jpg` (2048×1024).
- Source file: <https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_2048.jpg>
- Source record: <https://visibleearth.nasa.gov/images/57747/blue-marble-clouds/77558l>
- Processing: retained the source resolution; converted grayscale brightness into alpha over a near-white cloud color so the layer can be placed on a slightly larger transparent sphere. Dark source pixels become transparent. No surface color or shadow was added.
- Credit: **NASA Goddard Space Flight Center; Reto Stöckli (land surface, shallow water, clouds); enhancements by Robert Simmon.**

## Usage

NASA states that its imagery and media files used for 3D models are generally not subject to copyright in the United States and may be used for educational and informational web pages. NASA should be acknowledged as the source, NASA logos must not be used as endorsement, and separately identified third-party material requires its own permission. See <https://www.nasa.gov/nasa-brand-center/images-and-media/>.
