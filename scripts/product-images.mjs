/**
 * Curated product photography for the sample catalog.
 *
 * Sources:
 * - Shopify Burst (https://www.shopify.com/stock-photos) — free stock photos
 *   under the Shopify Burst license, no attribution required.
 * - Pexels (https://www.pexels.com) — free stock photos under the Pexels
 *   license, no attribution required.
 * - Wikimedia Commons (https://commons.wikimedia.org) — CC0, public domain,
 *   CC BY, or CC BY-SA images. Per-file credit is recorded in
 *   docs/product-image-credits.md.
 *
 * Only the `images` field of seed-owned products is updated from this map.
 */

const burst = (slug) =>
  `https://burst.shopifycdn.com/photos/${slug}.jpg?width=1200&format=pjpg&exif=0&iptc=0`;

const pexels = (id) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1200&fm=jpg`;

const commons = (url) => url;

export const productImages = {
  // Audio
  "halo-wireless-headphones": [burst("noise-cancelling-headphones")],
  "pebble-portable-speaker": [burst("portable-bluetooth-speaker")],
  "drift-noise-cancelling-earbuds": [
    burst("black-wireless-bluetooth-earbuds-on-white-background"),
  ],
  "orchard-bookshelf-speakers": [
    commons(
      "https://upload.wikimedia.org/wikipedia/commons/4/48/Altec_Lansing_Bookshelf_Speakers.jpg",
    ),
  ],
  "echo-mini-bluetooth-speaker": [burst("mini-bluetooth-speaker")],
  "signal-studio-microphone": [
    burst("photo-of-a-black-recording-microphone"),
  ],
  "cadence-belt-drive-turntable": [
    burst("vinyl-record-on-a-record-player"),
  ],
  "lumen-compact-soundbar": [
    commons(
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b9/SAMSUNG_SOUNDBAR_HW-J250.jpg/1280px-SAMSUNG_SOUNDBAR_HW-J250.jpg",
    ),
  ],

  // Workspace
  "arc-desk-lamp": [pexels(19240055)],
  "tactile-mechanical-keyboard": [pexels(36203655)],
  "slate-monitor-stand": [
    commons(
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/24/Monitor_arm_stand_%281%29.jpg/1280px-Monitor_arm_stand_%281%29.jpg",
    ),
  ],
  "compass-desk-organizer": [
    commons(
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e2/Gather%2C_The_minimal%2C_modular_organizer._%28Unsplash%29.jpg/1280px-Gather%2C_The_minimal%2C_modular_organizer._%28Unsplash%29.jpg",
    ),
  ],
  "ridge-laptop-stand": [pexels(4792717)],
  "quiet-felt-desk-pad": [pexels(18155963)],
  "line-ergonomic-mouse": [
    burst("close-up-of-computer-mouse-in-action"),
  ],
  "lattice-cable-tray": [pexels(10567170)],

  // Home
  "daily-ceramic-mug": [burst("coffee-mug-in-bean-pile")],
  "woven-cotton-throw": [pexels(4886902)],
  "linen-cushion-cover": [burst("modern-grey-couch-and-pillows")],
  "oak-serving-board": [burst("green-veggies-on-cutting-board")],
  "hearth-scented-candle": [burst("mauve-candle-on-white-table")],
  "ripple-glass-vase": [burst("glass-vase-with-purple-flower")],
  "waffle-bath-towel": [burst("white-towels-and-rob-in-salon")],
  "drift-storage-basket": [
    burst("wicker-picnic-basket-with-stemless-wine-glasses"),
  ],

  // Accessories
  "field-day-backpack": [burst("gold-zipper-on-black-fashion-backpack")],
  "minimal-steel-watch": [burst("classic-quartz-wrist-watch")],
  "leather-card-holder": [burst("money-wallet-change-purse")],
  "canvas-weekender-bag": [burst("leather-duffle-bag-handle")],
  "trail-crossbody-pouch": [
    commons(
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/86/DKNY_SM_Flap_Crossbody_W_-_ADJ_Chain_Crossbody_R1513005_Kalbsleder_beige_%281%29_%2816701889051%29.jpg/1280px-DKNY_SM_Flap_Crossbody_W_-_ADJ_Chain_Crossbody_R1513005_Kalbsleder_beige_%281%29_%2816701889051%29.jpg",
    ),
  ],
  "meridian-sunglasses": [
    burst("flatlay-of-tortoise-shell-sunglasses-on-white"),
  ],
  "braided-leather-belt": [pexels(19071478)],
  "fold-travel-wallet": [burst("wallet-and-money")],

  // Outdoor
  "summit-water-bottle": [burst("filling-water-bottle")],
  "cloudstep-sneakers": [burst("pair-of-all-black-sneakers")],
  "ridgeline-daypack": [
    burst("camping-product-waterproof-backpack-green"),
  ],
  "ember-camp-lantern": [
    commons(
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0e/Enbrighten_LED_Camping_Lantern.jpg/1280px-Enbrighten_LED_Camping_Lantern.jpg",
    ),
  ],
  "trailhead-trekking-poles": [
    commons(
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/66/Retracted_trekking_poles.jpg/1280px-Retracted_trekking_poles.jpg",
    ),
  ],
  "cozy-packable-blanket": [burst("woman-reading-on-picnic-blanket")],
  "storm-shell-rain-jacket": [burst("mens-wind-rain-jacket")],

  // Wellness
  "still-room-diffuser": [
    burst("black-geometric-diffuser-created-white-smoke"),
  ],
  "grip-yoga-mat": [burst("yoga-mat-product-photo")],
  "cedar-bath-soak": [burst("bath-salts-on-bathtub")],
  "rest-eye-pillow": [pexels(16344910)],
  "calm-ceramic-diffuser": [pexels(8533213)],
  "loop-resistance-bands": [burst("two-women-with-resistance-bands")],
  "morning-ritual-tea-set": [burst("tea-set-on-wooden-table")],

  // Electronics
  "aperture-instant-camera": [
    burst("instant-camera-paints-and-record-with-cocktail"),
  ],
  "pulse-fitness-tracker": [burst("black-mi-band-smartwatch")],
  "nova-portable-projector": [
    commons(
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/14/InFocus_IN34.jpg/1280px-InFocus_IN34.jpg",
    ),
  ],
  "relay-smart-plug-set": [
    commons(
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/da/Smart-plug.jpg/1280px-Smart-plug.jpg",
    ),
  ],
  "frame-digital-photo-display": [
    commons(
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9c/Digital_photo_frame_with_picture.jpg/1280px-Digital_photo_frame_with_picture.jpg",
    ),
  ],
  "orbit-wireless-charging-pad": [
    burst("cell-phone-and-wireless-charger-on-white-desk"),
  ],

  // Fashion
  "everyday-oxford-shirt": [
    burst("mens-button-up-shirt-urban-fashion"),
  ],
  "highland-wool-scarf": [burst("grey-and-peach-scarf-product")],
  "classic-chino-trousers": [
    burst("a-model-in-khaki-trousers-and-a-striped-t-shirt"),
  ],
  "marina-linen-dress": [burst("button-detail-on-sun-dress")],
  "studio-cotton-tee": [burst("red-tee-with-pocket")],
  "alpine-quilted-jacket": [burst("navy-blue-zip-up-jacket")],

  // Footwear
  "harbor-leather-loafers": [burst("loafers-leaning-along-white-wall")],
  "trail-runner-sneakers": [burst("pair-of-black-sneakers-back")],
  "meadow-canvas-slip-ons": [
    commons(
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/88/Leguano_Barefoot_Slip-On_Shoes_-_Top_View.jpg/1280px-Leguano_Barefoot_Slip-On_Shoes_-_Top_View.jpg",
    ),
  ],
  "summit-hiking-boots": [
    burst("rugged-hiking-boots-stood-on-rocks"),
  ],
  "willow-ankle-boots": [burst("brown-boots-on-the-curb")],
  "coast-leather-sandals": [burst("sandals-in-sand")],

  // Kitchen & Dining
  "copper-pour-over-kettle": [
    burst("copper-kettle-pour-over-coffee"),
  ],
  "stoneware-dinner-set": [
    burst("stack-of-white-plates-with-the-text-inlaid"),
  ],
  "beechwood-utensil-set": [burst("kitchen-utensils-on-counter")],
  "airtight-pantry-jars": [burst("assorted-nut-mixes-in-jars")],
  "cast-iron-skillet": [
    burst("flatlay-iron-skillet-with-meat-and-other-food"),
  ],
  "linen-apron": [burst("apron-on-kitchen-ready")],

  // Beauty & Personal Care
  "botanical-face-cleanser": [
    burst("woman-practicing-her-skincare-routine"),
  ],
  "rosehip-facial-oil": [
    burst("glass-jar-of-face-oil-and-a-dropper-above-it"),
  ],
  "hinoki-body-wash": [burst("hand-using-body-wash-sponge")],
  "silk-sleep-mask": [burst("a-person-sleeps-with-a-black-eye-mask-on")],
  "clay-mask-duo": [burst("face-mask-at-spa")],
  "bristle-body-brush": [
    commons(
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3d/Merryware_body_brush_1978%E2%80%9379.jpg/1280px-Merryware_body_brush_1978%E2%80%9379.jpg",
    ),
  ],

  // Sports & Fitness
  "adjustable-dumbbell-pair": [burst("dumbbells-and-gym-shoes")],
  "speed-jump-rope": [
    burst("a-hand-grips-a-black-gathered-jump-rope"),
  ],
  "foam-roller": [
    burst("two-dumbells-and-a-foam-roller-on-a-wooden-table"),
  ],
  "insulated-gym-bottle": [
    burst("woman-smiles-looking-over-shoulder-holding-a-water-bottle"),
  ],
  "training-resistance-bands": [
    commons(
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/40/Grid_Layout_of_Blue_Barry%27s_Exercise_Mats_and_Resistance_Bands.jpg/1280px-Grid_Layout_of_Blue_Barry%27s_Exercise_Mats_and_Resistance_Bands.jpg",
    ),
  ],
  "court-tennis-balls": [
    burst("tennis-balls-sit-on-the-green-court-bleached-by-the-sun"),
  ],

  // Books & Stationery
  "linen-hardcover-journal": [
    burst("woman-sits-alone-journalling-in-a-black-notebook"),
  ],
  "everyday-fountain-pen": [
    commons(
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a0/TWSBI_Eco_F%C3%BCllhalter_Orange_M_mit_Kappe.jpg/1280px-TWSBI_Eco_F%C3%BCllhalter_Orange_M_mit_Kappe.jpg",
    ),
  ],
  "set-of-three-notebooks": [
    burst("three-notebooks-against-a-pink-background"),
  ],
  "desk-weekly-planner": [
    burst("a-flatlay-of-plants-coffee-and-open-notebook"),
  ],
  "brass-page-markers": [
    commons(
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f8/Ribbon_bookmark_and_a_paper_bookmark.jpg/1280px-Ribbon_bookmark_and_a_paper_bookmark.jpg",
    ),
  ],
  "the-slow-home-handbook": [burst("book-lit-up-with-reading")],

  // Toys & Games
  "wooden-block-set": [
    burst("wooden-blocks-lay-in-colorful-dots-and-spell-smile"),
  ],
  "illustrated-puzzle-wild-coast": [
    burst("piled-puzzle-pieces-on-table"),
  ],
  "classic-playing-cards": [burst("black-and-white-playing-cards")],
  "plush-forest-fox": [pexels(691129)],
  "build-your-own-robot-kit": [
    burst("pieces-needed-for-building-a-robot"),
  ],
  "wooden-chess-set": [
    burst("wooden-chess-set-in-partial-window-light"),
  ],

  // Grocery & Essentials
  "single-origin-coffee-beans": [
    burst("roasted-coffee-beans-on-white-fabric"),
  ],
  "wildflower-honey": [pexels(35282122)],
  "extra-virgin-olive-oil": [pexels(38490939)],
  "loose-leaf-earl-grey": [burst("black-looseleaf-tea-jar")],
  "sea-salt-flakes": [burst("flavored-salt-spills-from-jar")],
  "dark-chocolate-bar-set": [
    burst("a-bar-of-dark-chocolate-on-white"),
  ],
};
