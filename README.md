# Valenversary

Shopify theme files for the landing page at `/pages/valenversary` (ourvalenversary.com).
Copy each file into the matching folder of the `Copy of Horizon` theme.

- `layout/valenversary.liquid` – bare layout (no nav/footer)
- `sections/valenversary-page.liquid` – the whole landing page
- `templates/page.valenversary.json` – page template using that layout

Homepage redirect (add as a Custom Liquid block in `sections/header-group.json`):

```html
<script>if(window.location.pathname==='/'){window.location.replace('/pages/valenversary');}</script>
```
