---
name: Presentation
description: A project shown picture by picture, room by room (interiors, a venue, a portfolio), with variants to choose from and the products used, assembled by scripts.
---

# Presentation

This template is built by scripts, not written by hand: it carries dozens
of pictures, rows laid out from their proportions, and a full-screen
viewer. `presentation.css` and `lightbox.js` next to this file are the
layout; the scripts put them into the document. Add document-level CSS with
`--extra-css`, never by editing these files (SKILL.md, law 8).

## Use when

The pictures are the content: an interior design shown room by room, a
venue or a wedding shown space by space, a portfolio of finished work. The
reader looks, picks between variants, opens the products, and comments on a
picture. Text is short: a project description and a few lines per room.

## Do not use when

The document is mostly text with a few illustrations; that is a report or a
proposal with images placed in the prose. A single picture with a long
explanation is a change walkthrough. A price quote for the products is a
proposal: this template shows prices as found on the shops' pages, not an
offer.

## Input

1. **A folder of pictures**, one subfolder per room, numbered in reading
   order: `1. MAIN BEDROOM/`, `2. BATHROOM/`. Without the number, rooms
   come alphabetically. A folder with no subfolders is one room, unless
   the file names name the spaces (`SALA 1.jpg`, `SALA 2.jpg`, `WC 1.jpg`,
   `WC 2.jpg`): then each name is a room, alphabetically. Put the main space
   first by reordering `rooms` in the manifest; a second run keeps the order.
   JPG, PNG, WebP; HEIC when sips or ImageMagick can convert it
   (Pillow only with pillow-heif).
2. **Variants:** a file named like another one plus ` — <label>` (or
   ` - version …`) is a second version of the same view:
   `KITCHEN 7.jpg` and `KITCHEN 7 — WHITE FRONTS.jpg` show side by side in a
   "choose" panel as option A and option B.
3. **Product links, optional:** `links.txt`, a `# <room>` line (the room's
   name or slug) and then one link per line, with where the product sits
   before it:
   ```
   # Main bedroom
   Lamp on the left | https://shop.example/lamp-312
   Bench | https://shop.example/bench-oak
   ```
   Designer notes often carry numbering and working requests ("5.", "add
   pls"): clean those out when writing the file; the script takes the
   fields as they are.
4. **Texts, optional:** `texts.json` in the work folder,
   `{ "project": "…", "rooms": { "<room-slug>": "…" } }`. A blank line
   starts a new paragraph.

## Questions before the shape gate

Ask at most two:

- **The project title.** The folder name is not a title ("RENDERS_FINAL_2"
  is a working name). Never invent one.
- **Is there a description** of the project or the rooms from the
  designer? If not, you may draft one from what the pictures and folder
  names show, short and factual (materials, colors, layout you can see),
  and show it in the shape gate for the user to accept or rewrite. A room
  text nobody accepted does not go into `texts.json`.

## Procedure

`<work>` is a folder outside the pictures folder, for example next to it.

```sh
node <skill>/scripts/prepare-images.mjs "<pictures folder>" --out <work> --lang pl
node <skill>/scripts/product-cards.mjs links.txt --out <work> --lang pl     # optional
node <skill>/scripts/build-presentation.mjs <work> --title "<title>" \
  --profile .letterhead/brands/<slug> --out <file>.html
node <skill>/scripts/build-presentation.mjs <work> --title "<title>" \
  --profile .letterhead/brands/<slug> --only <room-slug> --out <room>.html   # one room
```

1. **Pictures.** `prepare-images.mjs` shrinks every picture (long edge
   1600 px, JPEG quality lowered until the set fits `--budget-mb`, 7 MB by
   default) and writes `<work>/manifest.json`. It prints each picture's
   size and the total.
2. **Check the names.** Folder names in capitals lose their proper nouns:
   "POKÓJ JULKA" comes back as "Pokój julka". Read every room `name`
   and `caption` in the manifest, fix the capitals and any name spelled two
   ways across files (ask the user which spelling is right), and set `nameSource`
   (and `captionSource` on a caption you changed) to `"checked"`. Keep
   `slug` and `id` as they are: comments hang on them. The build warns while
   names from capitalised folders are unchecked. A second run of
   `prepare-images.mjs` keeps your corrections.
3. **Products.** `product-cards.mjs` reads each shop page: name, maker,
   price and currency from the page's product data, the main photo (a
   share graphic or a watermarked image is skipped and another photo of the
   same product is searched for). Only what the page says goes into the
   card. Read `<work>/products.json` afterwards: shops' names are often
   SEO strings ("Harbour Fox Wallpaper - Harbour Fox Mural"), shorten
   them to the product's name as the shop shows it; a maker missing is left
   out, never guessed.
4. **Blocked shops.** A shop that refuses scripts (403, 429, a "checking
   your browser" page, a captcha) is written with `blocked: true` and the
   reason. Do not work around it. Ask the user for the photo and the
   details, or read the page in the user's own browser if the host has one
   connected. Then write `links.json` with the given fields and a local
   photo, and run the script again; it keeps what it already has:
   ```json
   { "main-bedroom": [
       { "where": "Side table", "url": "https://shop.example/table",
         "name": "…", "maker": "…", "shop": "…", "price": 549.99,
         "currency": "PLN", "image": "photos/table.jpg" } ] }
   ```
   The build leaves out a product without a name; say which ones.
   Ask whether the client should see prices. When not, build with
   `--no-prices`: prices and the note on when they were read leave the
   document, page source included; name, maker, shop and link stay.
5. **Brand.** `--profile` is the brand's folder; its tokens go over the
   style's (`--style`, default: the profile's own style, else `atelier`,
   which suits a studio writing to private clients). Without a profile,
   `--style` alone sets the look. The background always comes from the
   brand or the style.
6. **Build and check.** The build runs `check-document.mjs` and prints the
   size. Take both themes and the phone width before delivering. A file
   over 4 MB is published through the upload URL (reference/publish.md);
   about 9 MB for 40 renders is normal.

`--kind general` changes the words for work that is not an interior:
"sections" and "photos" instead of "rooms" and "renders".

## Structure

1. **Cover:** the brand's logo, the project title, labeled metadata (rooms,
   pictures, date), the project description, a one-line hint on how to
   open a picture, and the contents: numbered rooms with their picture
   counts.
2. **One section per room:** number, heading, facts (pictures, views in
   variants), the room text. A landscape first picture sits beside the
   heading; a square or portrait one opens a row under it. The rest follow
   in rows of equal height, then one "choose" panel per view with variants,
   then the products.
3. **Products:** a square tile per product (the photo whole, never cropped), where it sits, name, maker and
   shop, price, a link to the shop, and the date the prices were read.

**One room (`--only`):** the room is the document. Its name is the title,
the project title sits above it, no contents and no numbers, the first
picture runs full width, and products are a section of their own.

## Hierarchy contract

Pictures carry the document; type stays quiet around them. The cover title
is the one loud element. Room headings are the landmarks; facts and
captions are small and muted. The variant panel is the only boxed element,
because it asks the reader to decide.

## Mobile contract

First phone screen: logo, title, metadata, the project description. The
contents list follows as one column. Rows stack to one picture per line at
full width; the variant pair stacks with its labels kept under each
picture. Products become a list: small tile left, details right. The
viewer swipes between the room's pictures.

## Review contract

Stable ids per SKILL.md § Review-ready contract, plus: every room section,
every picture (`<room-slug>-<n>`, variants `-7a`/`-7b`) and every product
(`<room-slug>-produkt-<slug>` in Polish, `-product-` in English) has its
own id, derived from folder, file and product names, not from position.
The single-room document uses the same picture and product ids as the full
one. In Markloop the reader can comment in the full-screen viewer: each
enlarged picture carries `data-markloop-mirror="#<picture-id> img"`, so a
comment made there lands on the picture in the document, at the same spot,
and the picture's pins show in the viewer. Keep that attribute, the
`<dialog>` viewer and uncropped pictures (no `object-fit: cover` on the page
pictures); without them comments drift or land on the temporary viewer.
Where the comment layer lacks mirror support, comment mode closes the viewer.

**Privacy.** Folder names often carry the client's family: children's
names on their rooms. The document is for the client; do not put it in a
public gallery or an example without their consent.

## Failure modes

**A viewer that loses the reader.** The full-screen viewer opens on a
button, moves focus inside, closes on Esc, the close button or a tap
beside the picture, and returns focus to the picture that opened it; arrow
keys move between pictures, the counter and caption are announced, and the
page behind does not scroll. `lightbox.js` and `presentation.css` do this.
Document-level CSS or JS that hides the close button, steals Esc or swaps
the `<dialog>` for a `div` strands a keyboard or phone reader in a picture
they cannot leave.

**Folder names as the title.** "RENDERS_FINAL_2" on the cover. The title is
asked for.

**Unchecked capitals.** "Pokój julka" in the contents: a child's name in
lower case, in front of the parents who chose it.

**Invented product data.** A maker guessed from the product name, a price
from memory, a photo from another shop. The card carries what the shop's
page says, dated; the rest is asked for.

**Watermarked or share images.** A product shown as the shop's social
banner with its logo across it. The script skips those; when it finds
nothing better it leaves the photo out and says so.

**Working around a block.** Retrying a shop that refused, with a changed
identity. The user supplies what the shop will not give a script.

**Prose nobody wrote.** A room description drafted by the agent and never
shown to the user, in the designer's name.
