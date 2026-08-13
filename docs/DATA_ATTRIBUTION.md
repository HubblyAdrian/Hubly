# Data Attribution & Third-Party Licenses

This document records third-party datasets bundled into or imported by Hubly
and the attribution their licenses require. It is Hubly's canonical
credits/legal location for data sources.

## GeoNames — US ZIP-code centroids

The `zip_centroids` table (US ZIP → approximate latitude/longitude centroid,
city, state) that powers Marketplace Local Discovery's geographic provider
search is derived from the **GeoNames** postal-code dataset.

- **Source:** <https://download.geonames.org/export/zip/> (US postal codes)
- **License:** Creative Commons Attribution 4.0 (CC BY 4.0) —
  <https://creativecommons.org/licenses/by/4.0/>
- **Attribution:** This product uses data from **GeoNames** (<https://www.geonames.org>).

GeoNames data is used only as a backend reference table to convert a customer
or provider ZIP code into approximate coordinates for distance/service-area
matching. It is not resold or exposed as a standalone dataset.
