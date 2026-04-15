from dataclasses import dataclass, field
from typing import List, Dict

@dataclass
class Subcategory:
    id: str
    display_name: str
    search_hints: List[str]
    retailer_paths: Dict[str, str] = field(default_factory=dict)
    anti_keywords: List[str] = field(default_factory=list)

@dataclass
class Category:
    id: str
    subcategories: List[Subcategory]

CATEGORIES = {
    # ═══════════════════════════════ ELECTRONICS ═══════════════════════════════
    "electronics": Category(
        id="electronics",
        subcategories=[
            Subcategory(
                id="smartphones",
                display_name="Smartphones",
                search_hints=["phone", "smartphone"],
                retailer_paths={
                    "amazon_in": "/s?i=electronics&rh=n%3A1389401031",
                    "amazon_us": "/s?i=electronics&rh=n%3A2811409011",
                    "amazon_ae": "/s?i=electronics&rh=n%3A12050259031",
                    "amazon_uk": "/s?i=electronics&rh=n%3A5362060031",
                    "amazon_de": "/s?i=electronics&rh=n%3A3468301",
                    "amazon_ca": "/s?i=electronics&rh=n%3A6205124011",
                    "amazon_au": "/s?i=electronics&rh=n%3A4975185051",
                    "amazon_jp": "/s?i=electronics&rh=n%3A128187011",
                    "flipkart": "/mobiles/smartphones~type/pr?sid=tyy,4io",
                    "walmart": "/browse/electronics/cell-phones/3944_542371",
                    "noon": "/uae-en/electronics-and-mobiles/mobiles-and-accessories/mobiles-20905/",
                    "coupang": "/np/categories/413979",
                },
                anti_keywords=[
                    "case", "cover", "pouch", "sleeve", "holster", "shell", "housing",
                    "screen protector", "tempered glass", "screen guard", "film",
                    "charger", "adapter", "cable", "cord", "dock", "stand", "mount", "holder",
                    "sticker", "decal", "skin", "wrap", "ring", "grip", "popsocket",
                    "earbuds", "headphones", "airpods", "armband", "strap", "band",
                    "stylus", "pen", "replacement", "spare", "repair", "tool kit"
                ]
            ),
            Subcategory(
                id="laptops",
                display_name="Laptops",
                search_hints=["laptop", "notebook"],
                retailer_paths={},
                anti_keywords=[
                    "case", "sleeve", "bag", "backpack", "cover", "skin", "decal", "stand",
                    "charger", "adapter", "cable", "dock", "hub", "mouse", "keyboard",
                    "screen protector", "cooling pad", "ram", "ssd", "hard drive"
                ]
            ),
            Subcategory(
                id="headphones",
                display_name="Headphones & Earbuds",
                search_hints=["headphones", "earbuds"],
                retailer_paths={},
                anti_keywords=[
                    "case", "cover", "pouch", "sleeve", "silicone", "replacement pads", "eartips",
                    "cable", "adapter", "stand", "hanger", "hook"
                ]
            ),
            Subcategory(
                id="tablets",
                display_name="Tablets",
                search_hints=["tablet", "pad"],
                retailer_paths={},
                anti_keywords=[
                    "case", "cover", "pouch", "sleeve", "keyboard folio", "screen protector", "tempered glass",
                    "stylus", "pen", "stand", "mount", "charger", "adapter", "cable"
                ]
            ),
            Subcategory(
                id="smartwatches",
                display_name="Smartwatches",
                search_hints=["smartwatch", "watch"],
                retailer_paths={},
                anti_keywords=[
                    "band", "strap", "bracelet", "screen protector", "case", "cover", "charger", "cable",
                    "dock", "stand"
                ]
            ),
            Subcategory(
                id="cameras",
                display_name="Cameras",
                search_hints=["camera", "digital camera"],
                retailer_paths={},
                anti_keywords=[
                    "case", "bag", "strap", "lens cap", "screen protector", "tripod", "memory card",
                    "battery", "charger", "filter", "cleaning kit"
                ]
            ),
            Subcategory(
                id="speakers",
                display_name="Speakers",
                search_hints=["speaker", "bluetooth speaker"],
                retailer_paths={},
                anti_keywords=[
                    "case", "cover", "mount", "stand", "cable", "replacement", "grill"
                ]
            ),
            Subcategory(
                id="monitors",
                display_name="Monitors",
                search_hints=["monitor", "display"],
                retailer_paths={},
                anti_keywords=[
                    "cable", "mount", "arm", "stand", "screen protector", "cover",
                    "cleaning kit", "webcam", "light bar"
                ]
            ),
            Subcategory(
                id="storage",
                display_name="Storage (SSD/HDD)",
                search_hints=["ssd", "hard drive"],
                retailer_paths={},
                anti_keywords=[
                    "case", "enclosure", "cable", "adapter", "docking station", "screw"
                ]
            ),
            Subcategory(
                id="tvs",
                display_name="Televisions",
                search_hints=["tv", "television"],
                retailer_paths={},
                anti_keywords=[
                    "mount", "bracket", "stand", "remote", "cover", "cable", "hdmi",
                    "cleaning kit", "screen protector", "surge protector"
                ]
            ),
            Subcategory(
                id="printers",
                display_name="Printers",
                search_hints=["printer", "all-in-one printer"],
                retailer_paths={},
                anti_keywords=[
                    "ink", "toner", "cartridge", "paper", "cable", "cover", "stand"
                ]
            ),
            Subcategory(
                id="routers",
                display_name="Routers & Networking",
                search_hints=["router", "wifi router"],
                retailer_paths={},
                anti_keywords=[
                    "cable", "adapter", "mount", "antenna", "extender cable"
                ]
            ),
        ]
    ),

    # ═══════════════════════════════ GAMING ═══════════════════════════════
    "gaming": Category(
        id="gaming",
        subcategories=[
            Subcategory(
                id="consoles",
                display_name="Gaming Consoles",
                search_hints=["console", "gaming console"],
                retailer_paths={},
                anti_keywords=[
                    "controller", "headset", "case", "cover", "skin", "stand", "dock",
                    "cable", "charger", "game", "subscription"
                ]
            ),
            Subcategory(
                id="controllers",
                display_name="Controllers & Gamepads",
                search_hints=["controller", "gamepad"],
                retailer_paths={},
                anti_keywords=[
                    "skin", "cover", "grip", "thumbstick", "cable", "charging dock", "case", "stand"
                ]
            ),
            Subcategory(
                id="gaming_laptops",
                display_name="Gaming Laptops",
                search_hints=["gaming laptop"],
                retailer_paths={},
                anti_keywords=[
                    "case", "sleeve", "cooling pad", "skin", "decal", "keyboard", "mouse",
                    "headset", "stand", "charger"
                ]
            ),
            Subcategory(
                id="gaming_monitors",
                display_name="Gaming Monitors",
                search_hints=["gaming monitor"],
                retailer_paths={},
                anti_keywords=[
                    "cable", "mount", "arm", "stand", "screen protector", "light bar", "webcam"
                ]
            ),
            Subcategory(
                id="gaming_chairs",
                display_name="Gaming Chairs",
                search_hints=["gaming chair"],
                retailer_paths={},
                anti_keywords=[
                    "cushion", "pillow", "cover", "mat", "armrest pad", "caster", "wheel"
                ]
            ),
            Subcategory(
                id="vr_headsets",
                display_name="VR Headsets",
                search_hints=["vr headset", "virtual reality"],
                retailer_paths={},
                anti_keywords=[
                    "case", "cover", "strap", "face cover", "lens protector", "cable",
                    "controller grip", "stand", "charging dock"
                ]
            ),
            Subcategory(
                id="graphics_cards",
                display_name="Graphics Cards (GPU)",
                search_hints=["graphics card", "gpu"],
                retailer_paths={},
                anti_keywords=[
                    "bracket", "brace", "cable", "riser", "backplate", "thermal paste", "fan"
                ]
            ),
        ]
    ),

    # ═══════════════════════════════ FASHION ═══════════════════════════════
    "fashion": Category(
        id="fashion",
        subcategories=[
            Subcategory(
                id="sneakers",
                display_name="Sneakers & Shoes",
                search_hints=["sneakers", "shoes"],
                retailer_paths={},
                anti_keywords=[
                    "insole", "lace", "shoelace", "shoe tree", "shoe cleaner", "brush",
                    "deodorizer", "protector spray", "shoe bag"
                ]
            ),
            Subcategory(
                id="sunglasses",
                display_name="Sunglasses",
                search_hints=["sunglasses"],
                retailer_paths={},
                anti_keywords=[
                    "case", "pouch", "cleaning cloth", "lens", "strap", "chain", "cord",
                    "replacement nose pad"
                ]
            ),
            Subcategory(
                id="watches",
                display_name="Watches",
                search_hints=["watch", "wristwatch"],
                retailer_paths={},
                anti_keywords=[
                    "band", "strap", "bracelet", "link", "buckle", "case", "box",
                    "winder", "tool kit", "spring bar", "battery"
                ]
            ),
            Subcategory(
                id="handbags",
                display_name="Handbags & Wallets",
                search_hints=["handbag", "wallet"],
                retailer_paths={},
                anti_keywords=[
                    "organizer", "insert", "chain strap", "charm", "key ring",
                    "cleaning kit", "rain cover"
                ]
            ),
            Subcategory(
                id="jackets",
                display_name="Jackets & Coats",
                search_hints=["jacket", "coat"],
                retailer_paths={},
                anti_keywords=[
                    "hanger", "garment bag", "patch", "button", "zipper"
                ]
            ),
            Subcategory(
                id="perfumes",
                display_name="Perfumes & Fragrances",
                search_hints=["perfume", "cologne"],
                retailer_paths={},
                anti_keywords=[
                    "sample", "vial", "atomizer", "refill", "travel case", "cap"
                ]
            ),
            Subcategory(
                id="backpacks",
                display_name="Backpacks & Bags",
                search_hints=["backpack", "bag"],
                retailer_paths={},
                anti_keywords=[
                    "rain cover", "patch", "keychain", "buckle", "strap pad", "organizer"
                ]
            ),
        ]
    ),

    # ═══════════════════════════════ HOME & KITCHEN ═══════════════════════════════
    "home": Category(
        id="home",
        subcategories=[
            Subcategory(
                id="vacuum_cleaners",
                display_name="Vacuum Cleaners",
                search_hints=["vacuum cleaner", "robot vacuum"],
                retailer_paths={},
                anti_keywords=[
                    "filter", "brush roll", "bag", "replacement", "dust bin", "mop pad",
                    "side brush", "dock", "charging base"
                ]
            ),
            Subcategory(
                id="air_purifiers",
                display_name="Air Purifiers",
                search_hints=["air purifier"],
                retailer_paths={},
                anti_keywords=[
                    "filter", "replacement filter", "pre-filter", "carbon filter"
                ]
            ),
            Subcategory(
                id="coffee_machines",
                display_name="Coffee Machines",
                search_hints=["coffee maker", "espresso machine"],
                retailer_paths={},
                anti_keywords=[
                    "filter", "pods", "capsules", "descaler", "carafe", "grinder",
                    "milk frother", "cup", "mug", "tamper"
                ]
            ),
            Subcategory(
                id="blenders",
                display_name="Blenders & Mixers",
                search_hints=["blender", "mixer"],
                retailer_paths={},
                anti_keywords=[
                    "blade", "replacement", "lid", "gasket", "jar", "cup", "to-go cup"
                ]
            ),
            Subcategory(
                id="air_fryers",
                display_name="Air Fryers",
                search_hints=["air fryer"],
                retailer_paths={},
                anti_keywords=[
                    "liner", "parchment", "rack", "accessory kit", "skewer", "silicone mat",
                    "replacement basket", "cookbook"
                ]
            ),
            Subcategory(
                id="washing_machines",
                display_name="Washing Machines",
                search_hints=["washing machine"],
                retailer_paths={},
                anti_keywords=[
                    "hose", "cleaner", "stand", "pedestal", "lint filter", "drain pump",
                    "stacking kit", "cover"
                ]
            ),
            Subcategory(
                id="refrigerators",
                display_name="Refrigerators",
                search_hints=["refrigerator", "fridge"],
                retailer_paths={},
                anti_keywords=[
                    "water filter", "shelf", "drawer", "organizer", "deodorizer", "mat",
                    "ice maker", "bulb", "thermometer"
                ]
            ),
            Subcategory(
                id="microwaves",
                display_name="Microwaves & Ovens",
                search_hints=["microwave", "oven"],
                retailer_paths={},
                anti_keywords=[
                    "plate", "turntable", "cover", "splatter guard", "rack", "gloves",
                    "mat", "cleaner"
                ]
            ),
        ]
    ),

    # ═══════════════════════════════ SPORTS & FITNESS ═══════════════════════════════
    "sports": Category(
        id="sports",
        subcategories=[
            Subcategory(
                id="fitness_trackers",
                display_name="Fitness Trackers",
                search_hints=["fitness tracker", "activity tracker"],
                retailer_paths={},
                anti_keywords=[
                    "band", "strap", "screen protector", "case", "charger", "cable", "dock"
                ]
            ),
            Subcategory(
                id="treadmills",
                display_name="Treadmills",
                search_hints=["treadmill"],
                retailer_paths={},
                anti_keywords=[
                    "mat", "lubricant", "belt", "key", "cover", "heart rate strap"
                ]
            ),
            Subcategory(
                id="dumbbells",
                display_name="Dumbbells & Weights",
                search_hints=["dumbbell", "weights"],
                retailer_paths={},
                anti_keywords=[
                    "rack", "stand", "gloves", "mat", "wrist wrap", "strap"
                ]
            ),
            Subcategory(
                id="yoga_mats",
                display_name="Yoga Mats & Equipment",
                search_hints=["yoga mat"],
                retailer_paths={},
                anti_keywords=[
                    "bag", "strap", "towel", "cleaning spray", "block"
                ]
            ),
            Subcategory(
                id="cycles",
                display_name="Cycles & Bicycles",
                search_hints=["cycle", "bicycle"],
                retailer_paths={},
                anti_keywords=[
                    "helmet", "lock", "light", "bell", "pump", "tire", "tube", "pedal",
                    "seat", "saddle", "bottle holder", "gloves", "chain", "lube"
                ]
            ),
            Subcategory(
                id="sports_shoes",
                display_name="Sports Shoes",
                search_hints=["running shoes", "sports shoes"],
                retailer_paths={},
                anti_keywords=[
                    "insole", "lace", "cleaner", "deodorizer", "bag", "socks"
                ]
            ),
        ]
    ),

    # ═══════════════════════════════ BEAUTY & HEALTH ═══════════════════════════════
    "beauty": Category(
        id="beauty",
        subcategories=[
            Subcategory(
                id="trimmers",
                display_name="Trimmers & Shavers",
                search_hints=["trimmer", "shaver"],
                retailer_paths={},
                anti_keywords=[
                    "blade", "foil", "cleaning brush", "oil", "charger", "stand", "bag",
                    "replacement head"
                ]
            ),
            Subcategory(
                id="hair_dryers",
                display_name="Hair Dryers & Stylers",
                search_hints=["hair dryer", "hair styler"],
                retailer_paths={},
                anti_keywords=[
                    "diffuser", "nozzle", "filter", "stand", "holder", "brush attachment"
                ]
            ),
            Subcategory(
                id="skincare",
                display_name="Skincare Devices",
                search_hints=["skincare device", "face massager"],
                retailer_paths={},
                anti_keywords=[
                    "gel", "cream", "serum", "replacement head", "charger", "pouch"
                ]
            ),
            Subcategory(
                id="electric_toothbrush",
                display_name="Electric Toothbrushes",
                search_hints=["electric toothbrush"],
                retailer_paths={},
                anti_keywords=[
                    "brush head", "replacement", "charger", "case", "travel case", "stand"
                ]
            ),
            Subcategory(
                id="massagers",
                display_name="Massagers",
                search_hints=["massager", "massage gun"],
                retailer_paths={},
                anti_keywords=[
                    "head attachment", "replacement", "carrying case", "charger", "oil", "gel"
                ]
            ),
        ]
    ),

    # ═══════════════════════════════ BOOKS & MEDIA ═══════════════════════════════
    "books": Category(
        id="books",
        subcategories=[
            Subcategory(
                id="textbooks",
                display_name="Textbooks",
                search_hints=["textbook"],
                retailer_paths={},
                anti_keywords=[
                    "solution manual", "study guide", "workbook", "notebook", "highlighter", "bookmark"
                ]
            ),
            Subcategory(
                id="novels",
                display_name="Novels & Fiction",
                search_hints=["novel", "book"],
                retailer_paths={},
                anti_keywords=[
                    "bookmark", "book light", "book stand", "reading pillow"
                ]
            ),
            Subcategory(
                id="ereaders",
                display_name="E-Readers",
                search_hints=["e-reader", "kindle"],
                retailer_paths={},
                anti_keywords=[
                    "case", "cover", "sleeve", "screen protector", "charger", "cable",
                    "stand", "light"
                ]
            ),
        ]
    ),

    # ═══════════════════════════════ AUTOMOTIVE ═══════════════════════════════
    "automotive": Category(
        id="automotive",
        subcategories=[
            Subcategory(
                id="dash_cams",
                display_name="Dash Cameras",
                search_hints=["dash cam", "car camera"],
                retailer_paths={},
                anti_keywords=[
                    "mount", "suction cup", "cable", "hardwire kit", "memory card",
                    "protective case", "polarizing filter"
                ]
            ),
            Subcategory(
                id="car_accessories",
                display_name="Car Accessories",
                search_hints=["car accessory"],
                retailer_paths={},
                anti_keywords=[]
            ),
            Subcategory(
                id="car_chargers",
                display_name="Car Chargers & Electronics",
                search_hints=["car charger", "car electronics"],
                retailer_paths={},
                anti_keywords=[]
            ),
            Subcategory(
                id="tires",
                display_name="Tires",
                search_hints=["tire", "tyre"],
                retailer_paths={},
                anti_keywords=[
                    "pressure gauge", "inflator", "valve cap", "sealant", "cleaner",
                    "shine", "jack", "lug wrench"
                ]
            ),
        ]
    ),

    # ═══════════════════════════════ TOYS & KIDS ═══════════════════════════════
    "toys": Category(
        id="toys",
        subcategories=[
            Subcategory(
                id="action_figures",
                display_name="Action Figures & Collectibles",
                search_hints=["action figure", "collectible"],
                retailer_paths={},
                anti_keywords=[
                    "display case", "stand", "sticker", "poster"
                ]
            ),
            Subcategory(
                id="lego",
                display_name="LEGO & Building Sets",
                search_hints=["lego", "building set"],
                retailer_paths={},
                anti_keywords=[
                    "baseplate", "separator", "storage", "sorting tray", "sticker sheet"
                ]
            ),
            Subcategory(
                id="drones",
                display_name="Drones",
                search_hints=["drone", "quadcopter"],
                retailer_paths={},
                anti_keywords=[
                    "propeller", "blade", "battery", "charger", "case", "bag",
                    "landing pad", "controller", "guard"
                ]
            ),
            Subcategory(
                id="board_games",
                display_name="Board Games & Puzzles",
                search_hints=["board game", "puzzle"],
                retailer_paths={},
                anti_keywords=[
                    "mat", "organizer", "sleeve", "dice set", "expansion"
                ]
            ),
        ]
    ),

    # ═══════════════════════════════ OFFICE & STATIONERY ═══════════════════════════════
    "office": Category(
        id="office",
        subcategories=[
            Subcategory(
                id="office_chairs",
                display_name="Office Chairs",
                search_hints=["office chair", "ergonomic chair"],
                retailer_paths={},
                anti_keywords=[
                    "cushion", "armrest pad", "caster", "wheel", "mat", "cover",
                    "headrest pillow", "lumbar support"
                ]
            ),
            Subcategory(
                id="desks",
                display_name="Desks & Standing Desks",
                search_hints=["desk", "standing desk"],
                retailer_paths={},
                anti_keywords=[
                    "mat", "pad", "organizer", "cable tray", "monitor arm", "shelf",
                    "drawer", "keyboard tray"
                ]
            ),
            Subcategory(
                id="keyboards",
                display_name="Keyboards",
                search_hints=["keyboard", "mechanical keyboard"],
                retailer_paths={},
                anti_keywords=[
                    "keycap", "switch", "wrist rest", "cover", "skin", "cable", "stand",
                    "cleaning kit", "dust cover"
                ]
            ),
            Subcategory(
                id="mice",
                display_name="Mice & Trackpads",
                search_hints=["mouse", "gaming mouse"],
                retailer_paths={},
                anti_keywords=[
                    "pad", "mat", "feet", "skates", "grip tape", "cable", "bungee",
                    "receiver", "cover"
                ]
            ),
        ]
    ),

    # ═══════════════════════════════ GROCERIES & FOOD ═══════════════════════════════
    "grocery": Category(
        id="grocery",
        subcategories=[
            Subcategory(
                id="protein_supplements",
                display_name="Protein & Supplements",
                search_hints=["protein powder", "supplement"],
                retailer_paths={},
                anti_keywords=[
                    "shaker", "bottle", "scoop", "bag clip"
                ]
            ),
            Subcategory(
                id="snacks",
                display_name="Snacks & Chocolates",
                search_hints=["snack", "chocolate"],
                retailer_paths={},
                anti_keywords=[]
            ),
            Subcategory(
                id="beverages",
                display_name="Beverages & Drinks",
                search_hints=["beverage", "drink"],
                retailer_paths={},
                anti_keywords=[
                    "glass", "cup", "bottle", "straw", "lid"
                ]
            ),
        ]
    ),
}

def build_search_query(product_name: str, subcat: Subcategory) -> str:
    # As per prompt: ONLY the top 2 are appended to the query, so order matters
    hints = " ".join(subcat.search_hints[:2])
    return f"{product_name} {hints}".strip()
