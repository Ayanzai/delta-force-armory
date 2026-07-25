#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从 kkrb.net API 获取枪械和配件的实时价格
"""
import requests
import json
import time
import os
from urllib.parse import quote

API_BASE = "http://www.kkrb.net"
import os
COOKIE_FILE = os.path.join(os.environ.get("TEMP", "C:/Users/anya/AppData/Local/Temp"), "kkrb_cookies.txt")
RAW_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "raw")
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "X-Requested-With": "XMLHttpRequest",
    "Referer": "http://www.kkrb.net/",
    "Content-Type": "application/x-www-form-urlencoded",
})


def init_session():
    """Initialize session with cookies from saved file"""
    import http.cookiejar
    cj = http.cookiejar.MozillaCookieJar(COOKIE_FILE)
    try:
        cj.load()
        for c in cj:
            session.cookies.set(c.name, c.value)
    except:
        session.get("http://www.kkrb.net/", timeout=10)


def get_weapon_prices():
    """Get all weapon info data including prices"""
    resp = session.post(f"{API_BASE}/getWeaponInfoData", data={"globalData": "false"}, timeout=15)
    data = resp.json()
    if data.get("code") != 1:
        print(f"ERROR: getWeaponInfoData failed: {data.get('msg')}")
        return {}
    
    result = {}
    for item in data["data"]:
        gun_id = item.get("gunID")
        gun_name = item.get("gunName")
        gun_price = item.get("gunPrice")
        price_curve = item.get("priceCurve", {})
        result[gun_name] = {
            "gunID": gun_id,
            "gunPrice": gun_price,
            "priceCurve": price_curve,
        }
    
    print(f"  -> Got prices for {len(result)} weapons")
    return result


def get_item_price(item_name):
    """Get price for a specific item from the market API"""
    try:
        resp = session.post(f"{API_BASE}/getQueryItemPriceCurveData", data={
            "type": "query_all_item_curve",
            "itemName": item_name,
            "itemInfo": "true",
            "globalData": "false",
        }, timeout=10)
        data = resp.json()
        if data.get("code") == 1 and data.get("data"):
            item = data["data"][0]
            return {
                "price": item.get("prices", {}),
                "grade": item.get("itemGrade"),
            }
    except Exception as e:
        print(f"    Warning: failed to get price for {item_name}: {e}")
    return None


def load_json(filename):
    """Load a JSON file from raw data directory"""
    filepath = os.path.join(RAW_DIR, filename)
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def load_all_items_from_raw():
    """Load all guns and attachments from raw data"""
    items = {}
    
    # Load guns
    gun_data = load_json("gunRifle.json")
    guns = gun_data["jData"]["data"]["data"]["list"]
    items["guns"] = guns
    print(f"Loaded {len(guns)} guns")
    
    # Load attachments
    attachment_types = {
        "accMuzzle": "枪口",
        "accForeGrip": "前握把",
        "accBackGrip": "后握把",
        "accBarrel": "枪管",
        "accHandGuard": "护木",
        "accMagazine": "弹匣",
        "accScope": "瞄具",
        "accStock": "枪托",
        "accFunctional": "功能性配件",
    }
    
    attachments = {}
    for file_key, cn_name in attachment_types.items():
        filename = f"acc_{file_key}.json"
        try:
            data = load_json(filename)
            items_list = data["jData"]["data"]["data"]["list"]
            attachments[file_key] = {
                "cn_name": cn_name,
                "items": items_list,
            }
            print(f"Loaded {len(items_list)} {cn_name}")
        except Exception as e:
            print(f"  Warning: failed to load {filename}: {e}")
    
    items["attachments"] = attachments
    return items


def fetch_all_prices(items):
    """Fetch real-time prices for all guns and attachments"""
    print("\n=== Fetching weapon prices from kkrb.net ===")
    weapon_prices = get_weapon_prices()
    
    # Attach prices to gun data
    for gun in items["guns"]:
        name = gun["objectName"]
        if name in weapon_prices:
            gun["_price"] = weapon_prices[name]["gunPrice"]
            gun["_priceCurve"] = weapon_prices[name]["priceCurve"]
        else:
            gun["_price"] = None
            gun["_priceCurve"] = {}
    
    return weapon_prices


def consolidate_data(items):
    """Consolidate all data into a unified structure"""
    output = {
        "guns": [],
        "attachments": {},
    }
    
    # Process guns
    for gun in items["guns"]:
        out_gun = {
            "id": gun["objectID"],
            "name": gun["objectName"],
            "type": gun["secondClassCN"],
            "typeKey": gun["secondClass"],
            "grade": gun["grade"],
            "weight": gun["weight"],
            "desc": gun.get("desc", ""),
            "pic": gun["pic"],
            "stats": {
                "meatHarm": gun["gunDetail"]["meatHarm"],
                "shootDistance": gun["gunDetail"]["shootDistance"],
                "recoil": gun["gunDetail"]["recoil"],
                "control": gun["gunDetail"]["control"],
                "stable": gun["gunDetail"]["stable"],
                "hipShot": gun["gunDetail"]["hipShot"],
                "armorHarm": gun["gunDetail"]["armorHarm"],
                "fireSpeed": gun["gunDetail"]["fireSpeed"],
                "capacity": gun["gunDetail"]["capacity"],
                "fireMode": gun["gunDetail"]["fireMode"],
                "muzzleVelocity": gun["gunDetail"]["muzzleVelocity"],
                "soundDistance": gun["gunDetail"]["soundDistance"],
                "caliber": gun["gunDetail"]["caliber"],
            },
            "ammo": [a["objectID"] for a in gun["gunDetail"].get("ammo", [])],
            "accessorySlots": [a["slotID"] for a in gun["gunDetail"].get("accessory", [])],
            "price": gun.get("_price"),
            "priceCurve": gun.get("_priceCurve", {}),
        }
        output["guns"].append(out_gun)
    
    # Process attachments
    for type_key, type_info in items["attachments"].items():
        out_items = []
        for acc in type_info["items"]:
            detail = acc.get("accDetail", {})
            out_item = {
                "id": acc["objectID"],
                "name": acc["objectName"],
                "type": type_info["cn_name"],
                "typeKey": type_key,
                "grade": acc["grade"],
                "weight": acc["weight"],
                "pic": acc["pic"],
                "stats": {},
                "effectText": {
                    "advantage": [e["value"] for e in detail.get("advantage", {}).get("effectList", [])],
                    "disadvantage": [e["value"] for e in detail.get("disadvantage", {}).get("effectList", [])],
                },
            }
            # Numeric stats
            for stat_key in ["recoil", "controlSpeed", "controlStable", "hipShot", 
                           "shotDistancePercent", "quickSeparate", "extraBullet"]:
                if stat_key in detail:
                    out_item["stats"][stat_key] = detail[stat_key]
            
            out_items.append(out_item)
        
        output["attachments"][type_key] = {
            "name": type_info["cn_name"],
            "items": out_items,
        }
    
    return output


def main():
    print("Delta Force Data Consolidation")
    print("=" * 50)
    
    # Initialize session
    print("\nInitializing session...")
    init_session()
    
    # Load data from raw files
    print("\n=== Loading raw data ===")
    items = load_all_items_from_raw()
    
    # Fetch prices
    fetch_all_prices(items)
    
    # Consolidate
    print("\n=== Consolidating data ===")
    output = consolidate_data(items)
    
    # Save
    os.makedirs(OUT_DIR, exist_ok=True)
    out_path = os.path.join(OUT_DIR, "delta_force_data.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f"\n[DONE] Data saved to {out_path}")
    print(f"   Guns: {len(output['guns'])}")
    for k, v in output["attachments"].items():
        print(f"   {v['name']}: {len(v['items'])}")
    
    return output


if __name__ == "__main__":
    main()
