# Travel the Back Roads

Travel website for Robert and Brenda Guida.

## Source of truth

Use https://github.com/robguida/ttbr.git for ongoing website development.

```sh
git clone https://github.com/robguida/ttbr.git
cd ttbr
git pull --ff-only origin main
# Edit and verify the site.
git add dist README.md
git commit -m "Describe the website change"
git push origin main
```

Pull before editing. If changes conflict, preserve local work and reconcile the changes before pushing; do not force-push.

## Site files

- `dist/index.html`: page shell, navigation, search, and footer.
- `dist/style.css`: responsive styling and brand colors.
- `dist/app.js`: page content, routes, search, mobile menu, and photo lightbox.
- `dist/assets/`: original website logo and credited Sarandë photograph.
- `.openai/hosting.json`: existing private Sites deployment identity.

The site uses plain HTML, CSS, and JavaScript, with no dependency installation or build required. Serve `dist/` using a static web server to preview. Run `node --check dist/app.js` to check JavaScript syntax.

## Publishing

GitHub stores the source. A push to this repository does not automatically publish the site. Publish through the Sites workflow, retaining the existing project identity and private access. Synchronize the exact source to the Sites-managed repository, package `dist/`, then deploy that saved version. Do not replace the existing public domain or change access without the owner's instruction.

Private review site: https://travel-the-back-roads-brenda.snappyshrew16.chatgpt.site

Photo attribution and licensing are available on the site's Photo credits page.
