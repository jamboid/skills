# 365 Retail Markets — Site Audit

The structural and tonal exemplar for `perf-audit`. Match this register when drafting; do not mimic content.

## Site Architecture

- CMS: Wordpress
- UI Framework: Fusion Page Builder

The 365 website is built using Wordpress as the CMS. On top of this is a page-builder plugin called Fusion Page Builder that creates the UI layouts and styles. This combination produces a bloated code style, with a large CSS file and, additionally, a lot of inline CSS on each page along with a lot of utility classes, rather than a more streamlined, semantic structure.

The contact forms found on most of the product/service pages are created using HubSpot forms and embedded via an iFrame, and use the React framework in some capacity.

## Site Performance

### Performance tests
- PageSpeed Insights Audit: [link]
- WebPageTest Performance Test: [link]
- Lighthouse Quality Report: [link]

### Analysis
- The site homepage loads with 150 server requests, the majority of which are JavaScript files. Some kind of concatenation optimisation of these files would reduce this greatly.
- The total size of the homepage is 10.3MB. The majority of this comprises large, unoptimised images, although other assets are relatively substantial for their type.
- Based on the tests listed above, page load performance on mobile is poor, desktop slightly better. The large sizes of the blocking CSS and JS, and the banner images are the main culprits here, creating a long wait before the browser has loaded and parsed all the content and the page is viewable and interactive.
- The site uses a CSS framework heavily based on utility classes, a very inefficient way to style a page. This results in both a very large CSS file (100Kb compressed / 685Kb uncompressed) and a large number of classes applied to each styled element in the HTML. Beyond loading times, the effort required by the browser to parse all of these CSS rules will cause a performance hit, especially on mobile.
- Many page elements also have substantial amounts of inline CSS and data attributes related to animation transitions.

### Images and assets
- There's a general lack of image optimisation across the whole site.
- Image sizes range up to 9.2MB and most pages have at least one image over 1MB and several over 200Kb.

## Accessibility

### Tests
- Colour Palette Analysis: [link]

### Analysis
- The colour palette provides a good range of colour combinations that pass WCAG contrast standards.
- The main contrast issue with the current design is the yellow buttons with white text, which are a clear fail.
- Accessibility is otherwise generally pretty good. Some improvements could be made to link text.

## Design and User Experience
- Banners on most pages fit perfectly in the viewport, making the existence of content below the fold unclear.
- Cards with icons that change colour on hover give the impression of a user action (e.g. linking to a different location) but don't do anything.
- There is little to no cross-linking between pages. The only action available to a user on most pages is completing the contact form.
- The pre-checked newsletter signup checkbox is a bit of a dark pattern.

## Conclusions

The 365 website is bloated as a result of the choices around the platform and framework used to build it. This is the compromise you make when using a tool geared more to creating design flexibility and a code-less, WYSIWYG build process.

While moving to a more bespoke, performance-oriented architecture would be a large undertaking (although the functional complexity of the current site is relatively small), more immediate improvements could be made by addressing the lack of image optimisation and fixing the critical accessibility issue around the button colour.
