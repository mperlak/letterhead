# presentation--bunnyfeelshome: pictures, prompts, products

Output: [`documents/presentation--bunnyfeelshome.html`](../documents/presentation--bunnyfeelshome.html)
(8.6 MB, 23 pictures, 6 products, no prices). Generated 2026-10-06 by
`claude -p --model opus` (claude-opus-5-5) with the letterhead plugin loaded
from this repo; the HTML is unedited. The brand profile is in
[`brands/bunnyfeelshome/`](../brands/bunnyfeelshome/) (taught from the live
site in the first version of this example; without the site's HTML: it is a
real, live site).

This is the second version. Version 1 had four rooms (19 renders) and no
products; version 2 adds a fifth room, "Home office" (4 renders), and a product
list with links to English shop pages, built with `--no-prices`.

**Pictures.** The owner's own interior visualisations of one project, "House
on Hill" (23 renders in five room folders), published here with the owner's
permission. They were copied into the run directory; the originals were not
touched.

**Room order.** Living room, Home office, Bedroom, Child's room, WC: the two
day spaces first, then the sleeping rooms, then the WC. (The folder name
`restroom` stays the room's id, so a comment's anchor does not depend on the
display name.)

## links.txt (verbatim, as given to the run)

```
# Living room
Pendant lamps over the dining table | https://www.nordlux.com/en-GB/product/211237/2112373001
Arc floor lamp by the windows | https://www.nordlux.com/product/211241/2112414001

# Home office
Desk | https://www.ikea.com/gb/en/p/mittzon-desk-birch-veneer-white-s69529112/
Office chair | https://www.hermanmiller.com/en_gb/products/seating/office-chairs/aeron-chair/
Sofa | https://www.ikea.com/de/en/p/landskrona-2-seat-sofa-grann-bomstad-golden-brown-wood-s69270264/
Floor lamp | https://www.ikea.com/de/en/p/lauters-floor-lamp-ash-white-30405042/
```

## Where each product comes from, and how it was matched

The owner gave Polish IKEA pages for the desk, the sofa and the lamp, and
named the Aeron chair. The links in the file are the English pages for the same
article, found by article number and checked: the page resolves and its title
and size match the Polish page (MITTZON 160x80 cm, birch veneer/white;
LANDSKRONA 2-seat sofa, Grann/Bomstad golden-brown/wood; LAUTERS floor lamp,
ash/white).

- **MITTZON desk** (IKEA, article s69529112): the white sit/stand frame with a
  pale birch top in all four Home office pictures. English page on ikea.com/gb.
- **Aeron chair** (Herman Miller): the black mesh chair in all four Home office
  pictures. The official product page, hermanmiller.com/en_gb.
- **LANDSKRONA 2-seat sofa** (IKEA, s69270264): the owner listed it under the
  products without a room; the pictures place it in the Home office, not the
  living room: the tufted cognac leather two-seater with wooden feet, left of
  the desk (views 1, 2 and 4). The living room's sofas are fabric corner
  sofas. IKEA UK, Ireland, US and Canada have no page for this variant and
  ikea.com/pl has none in English; the English page on ikea.com/de has the same
  title as the Polish one, so that is the link.
- **LAUTERS floor lamp** (IKEA, 30405042): likewise the Home office, not the
  living room: the wooden tripod with a ring and a white drum shade (views 2, 3
  and 4). Same story for the English page (ikea.com/de).

Two more were identified from the living-room renders. Each had to be an
unmistakable match, with an English product page on the maker's own site:

- **Nordlux Dicte 53 pendant, white:** the three white pleated pendant shades
  over the dining table (living room views 1, 2, 5, 7). The shade is the
  Dicte's: pleated cotton drum with a chamfered, trapezoid lower edge; compared
  against the maker's product photo.
- **Nordlux Dicte floor lamp, white:** the black arc lamp with the same pleated
  shade, beside the kitchen (living room view 1, and at the window in views 5
  and 7); the maker's photo shows the same arc stem and shade.

Looked at and left out, because no match was certain or no live English page
exists:

- The dining table (trestle legs with pegs, oak): looks like IKEA MÖCKELBY,
  which IKEA no longer sells; the product pages on ikea.com/gb, /de and /dk are
  gone.
- The spindle-back dining armchairs (pale green): a J-chair family (FDB / HAY
  J77), but the version with arms and the colour could not be matched.
- The black kitchen bar stools (similar to Muuto Loft) and the round black tray
  coffee tables: the pictures do not show enough to tell the exact product.
- The tilted-shade chrome floor lamp, the pendants with long black tubes, the
  corner sofa, the acoustic hexagon panels, the C-shaped black side table in the
  Home office.

## How the products were read

`product-cards.mjs` read the four IKEA and Herman Miller pages by itself (name,
maker, price, photo; the prices were read and then dropped by `--no-prices`;
the output holds no price or currency). The two Nordlux pages fill in the
product photo with JavaScript, so the script found no photo and left them out
("needs the user"). The Blocked shops procedure was followed: the owner's
side supplied the fields read from the pages (name, maker, shop, link) and the
maker's own product photos, written to `links.json` and read with
`product-cards.mjs --refresh` (a plain re-run keeps the earlier entries and did
not pick the fields up; see the note in `examples/README.md`). The maker was
not guessed: Herman Miller's page has no maker field, so the chair has none.

## Prompt (verbatim), the second version

Turn 1 of a fresh session (not a resume: the first version's transcript no
longer existed) in a directory holding the pictures folder, `links.txt`, the
brand profile copied to `.letterhead/brands/bunnyfeelshome/`, and
`provided/` with the two Nordlux photos. The brand is not taught again.

> Make a presentation of the House on Hill project from the pictures in house-on-hill/ (subfolders living_room, home office, bedroom, child_room, restroom), in the BunnyFeelsHome brand (the profile is already in .letterhead/brands/bunnyfeelshome/), in English. Project title: House on Hill. Room names, in this order: Living room, Home office, Bedroom, Child's room, WC. The "home office" folder is a new room; use the folder as it is.
>
> Products, from links.txt in this directory (the format is the skill's: "# <room>" lines, "where | url" lines). No prices: build with --no-prices. The shop pages are English, on purpose. Read the pages with the skill's product-cards.mjs. The Nordlux pages (nordlux.com) fill their product photo in with JavaScript, so the script will report "no photo on the page" for the two Dicte lamps and leave them out. For those two, follow the template's procedure for a shop that blocks the script: I give you the fields, you write links.json and run the script again. I read both pages myself and downloaded the shop's own product photos (provided/nordlux-dicte-53-pendant.jpg and provided/nordlux-dicte-floor-lamp.jpg; copy them where the script expects local photos). Fields: living-room / "Pendant lamps over the dining table", url https://www.nordlux.com/en-GB/product/211237/2112373001, name "Dicte 53 pendant, white", maker "Nordlux", shop "Nordlux", image provided/nordlux-dicte-53-pendant.jpg; living-room / "Arc floor lamp by the windows", url https://www.nordlux.com/product/211241/2112414001, name "Dicte floor lamp, white", maker "Nordlux", shop "Nordlux", image provided/nordlux-dicte-floor-lamp.jpg. No prices for these (leave price and currency out). For the other four products take what the script reads from the page (shorten the shops' SEO names to the product's name, leave a missing maker out, do not guess). The Herman Miller page has no maker field: leave it out as the script gives it, unless the page itself says it.
>
> No project description from the designer: if you draft one from the pictures, keep it short and factual and I accept it, as I accept any short room texts you draft the same way (for the Home office too). Picture captions: name them by room and view, like "Home office, view 1". I approve in advance the shape you propose, so do not wait for my confirmation. The file may be up to about 9 MB: use --budget-mb 6.5 for the pictures so the document fits. Never edit the built HTML by hand; if something is wrong, fix the input and rebuild. Save it as presentation--bunnyfeelshome.html. At the end tell me which products ended up in the document, and which (if any) were left out and why.

The project text and the five room texts in the document are the agent's
drafts from the pictures, accepted in the prompt; the picture captions are
the agent's too. The agent shortened the product names in `products.json`
(the template's step 3) and rebuilt; it did not touch the HTML.

## Version 1 (superseded)

Version 1 (4 rooms, 19 pictures, no products, 8.5 MB, $1.61 in two turns)
was made in two turns of one session: teach the brand from
https://bunnyfeelshome.com, then build the presentation. The teach prompt
(verbatim):

> Learn the BunnyFeelsHome brand from its live site https://bunnyfeelshome.com (it is my own brand; I approve scanning the live site, saving the logo and writing the profile to .letterhead/brands/bunnyfeelshome/ here). I am not available to answer questions during this run: I approve in advance the profile you propose, and if you ask about the logo or the base style, go with your own recommendation. Do not wait for my confirmation. Just go, then run the brand sheet.

The brand profile in `brands/bunnyfeelshome/` comes from that turn.
