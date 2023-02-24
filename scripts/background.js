let dataPromise = null;

async function getFromStorage(key, defaultValue) {
    let response = await chrome.storage.local.get({ [key]: defaultValue });
    return response[key];
}

async function getSettings() {
    const defaults = {
        "attributes":                    ["href", "src", "style"],
        "blackList":                     "",
        "boxColor":                      "#000000",
        "boxDynamicColor":               false,
        "boxed":                         true,
        "boxOpacity":                    0.7,
        "bundleColor":                   "#ffff00",
        "bundleIcon":                    "&#127873;&#xFE0E;",
        "bundlesRefreshInterval":        2880,
        "cardColor":                     "#0000ff",
        "cardIcon":                      "&#x1F0A1",
        "cardsRefreshInterval":          2880,
        "dateOverride":                  false,
        "decommissionedColor":           "#ffffff",
        "decommissionedIcon":            "&#9760;",
        "decommissionedRefreshInterval": 1440,
        "dlcColor":                      "#a655b2",
        "dlcIcon":                       "&#8681;",
        "dlcRefreshInterval":            1440,
        "dynamicContent":                "disabled",
        "followedColor":                 "#f7dc6f",
        "followedIcon":                  "&#9733;",
        "iconsBold":                     false,
        "iconsScale":                    1,
        "ignoredColor":                  "#808080",
        "ignoredIcon":                   "&#128683;&#xFE0E;",
        "limitedColor":                  "#00ffff",
        "limitedIcon":                   "&#9881;",
        "limitedRefreshInterval":        2880,
        "ownedColor":                    "#008000",
        "ownedIcon":                     "&#10004;",
        "pingInterval":                  1500,
        "prefix":                        false,
        "unownedColor":                  "#ff0000",
        "unownedIcon":                   "&#10008;",
        "userRefreshInterval":           1,
        "wantBundles":                   true,
        "wantCards":                     true,
        "wantDecommissioned":            true,
        "wantDLC":                       true,
        "wantFollowed":                  true,
        "wantIgnores":                   true,
        "wantLimited":                   true,
        "whiteListMode":                 false,
        "wishlistColor":                 "#ff69b4",
        "wishlistIcon":                  "&#10084;",
    };

    let settingsFromStorage = await getFromStorage("swi_settings", {});

    let settings = {
        ...defaults,
        ...settingsFromStorage,
    };

    await chrome.storage.local.set({ "swi_settings": settings });
    return settings;
}

function arrayToObject(array, key) {
    if (!key) {
        return array.reduce((obj, item) => Object.assign(obj, { [item]: 1 }), {});
    }

    return array.reduce((obj, item) => Object.assign(obj, { [item[key]]: item }), {});
}

function processUserData(userdata) {
    const ignoredApps = arrayToObject(Object.keys(userdata.rgIgnoredApps)); // change 0 values to 1
    const ownedApps = arrayToObject(userdata.rgOwnedApps);
    const ownedPackages = arrayToObject(userdata.rgOwnedPackages);
    const followedApps = arrayToObject(userdata.rgFollowedApps);
    const wishlist = arrayToObject(userdata.rgWishlist);
    return { ignoredApps, ownedApps, ownedPackages, followedApps, wishlist };
}

async function getUserData() {
    let json = await fetch(`https://store.steampowered.com/dynamicstore/userdata/?t=${Date.now()}`, { "credentials": "include" }).then((response) => response.json());

    if (json.rgOwnedApps.length === 0 && json.rgOwnedPackages.length === 0) { // not logged in
        throw new Error("Not logged in");
    }

    return processUserData(json);
}

async function getDecommissioned() {
    let json = await fetch("https://steam-tracker.com/api?action=GetAppListV3", {
        "credentials": "omit",
        "timeout":     30000,
    }).then((response) => response.json());
    if (!json.success) {
        throw new Error("Unable to fetch decommissioned apps");
    }
    return arrayToObject(json.removed_apps, "appid");
}

async function getDLC() {
    let json = await fetch("https://bartervg.com/browse/dlc/json/", {
        "credentials": "omit",
        "timeout":     30000,
    }).then((response) => response.json());

    if (Object.keys(json).length < 7000) { // sanity check
        throw new Error("Unable to fetch Barter.vg DLC data");
    }

    return json;
}

async function getCards() {
    let json = await fetch("https://bartervg.com/browse/cards/json/", {
        "credentials": "omit",
        "timeout":     30000,
    }).then((response) => response.json());

    if (Object.keys(json).length < 7000 || !Object.values(json)[0].marketable) { // sanity check
        throw new Error("Unable to fetch Barter.vg trading cards data");
    }

    return json;
}

async function getBundles() {
    let json = await fetch("https://bartervg.com/browse/bundles/json/", {
        "credentials": "omit",
        "timeout":     30000,
    }).then((response) => response.json());

    if (Object.keys(json).length < 7000) { // sanity check
        throw new Error("Unable to fetch Barter.vg bundles data");
    }

    return json;
}

async function getLimited() {
    let json = await fetch("https://bartervg.com/browse/tag/481/json/", {
        "credentials": "omit",
        "timeout":     30000,
    }).then((response) => response.json());

    if (Object.keys(json).length < 7000) { // sanity check
        throw new Error("Unable to fetch Barter.vg low confidence metric data");
    }

    return json;
}

async function getData() {
    const settings = await getSettings();
    const userdata = await getFromStorage("swi_userdata", null);
    const decommissioned = await getFromStorage("swi_decommissioned", null);
    const dlcs = await getFromStorage("swi_dlc", null);
    const cards = await getFromStorage("swi_cards", null);
    const bundles = await getFromStorage("swi_bundles", null);
    const limited = await getFromStorage("swi_limited", null);
    // const lastCached = {
    //     "userdata":       await getFromStorage("swi_userdata_last", 0),
    //     "decommissioned": await getFromStorage("swi_decommissioned_last", 0),
    //     "dlcs":           await getFromStorage("swi_dlc_last", 0),
    //     "cards":          await getFromStorage("swi_cards_last", 0),
    //     "bundles":        await getFromStorage("swi_bundles_last", 0),
    //     "limited":        await getFromStorage("swi_limited_last", 0),
    // };
    const lastCached = {};
    lastCached.userdata = await getFromStorage("swi_userdata_last", 0);
    lastCached.decommissioned = await getFromStorage("swi_decommissioned_last", 0);
    lastCached.dlcs = await getFromStorage("swi_dlc_last", 0);
    lastCached.cards = await getFromStorage("swi_cards_last", 0);
    lastCached.bundles = await getFromStorage("swi_bundles_last", 0);
    lastCached.limited = await getFromStorage("swi_limited_last", 0);

    const data = { userdata, decommissioned, dlcs, cards, bundles, limited, lastCached };

    let tasks = [
        {
            "key":     "userdata",
            "promise": getUserData,
            "refresh": settings.userRefreshInterval,
            "storage": "swi_userdata",
        },
        {
            "key":     "decommissioned",
            "promise": getDecommissioned,
            "refresh": settings.decommissionedRefreshInterval,
            "storage": "swi_decommissioned",
        },
        {
            "key":     "dlcs",
            "promise": getDLC,
            "refresh": settings.dlcRefreshInterval,
            "storage": "swi_dlc",
        },
        {
            "key":     "cards",
            "promise": getCards,
            "refresh": settings.cardsRefreshInterval,
            "storage": "swi_cards",
        },
        {
            "key":     "bundles",
            "promise": getBundles,
            "refresh": settings.bundlesRefreshInterval,
            "storage": "swi_bundles",
        },
        {
            "key":     "limited",
            "promise": getLimited,
            "refresh": settings.limitedRefreshInterval,
            "storage": "swi_limited",
        },
    ];

    await Promise.all(tasks.map(async(task) => {
        let timeExpired = Date.now() - lastCached[task.key]; // time since last cache
        if (data[task.key] && timeExpired < task.refresh * 60000) {
            return;
        }

        console.log(`[Steam Web Integration] Refreshing '${task.key}' data`);
        data[task.key] = await task.promise().catch((error) => {
            console.error(error);
            return data[task.key];
        });
        data.lastCached[task.key] = Date.now();
        await chrome.storage.local.set({
            [task.storage]:           data[task.key],
            [`${task.storage}_last`]: data.lastCached[task.key],
        });
    }));

    dataPromise = null;
    return data;
}

async function onMessage(message) {
    console.log("[Steam Web Integration] Received message: ", message);
    switch (message.action) {
        case "getData":
            dataPromise = dataPromise || getData();
            return dataPromise;
        case "getSettings":
            return getSettings();
        case "runSWI":
        case "reloadSWI":
        case "clearSWI":
            return chrome.tabs.query({
                "active":        true,
                "currentWindow": true,
            }, (tabs) => {
                let myTabId = tabs[0].id;
                chrome.tabs.sendMessage(myTabId, message);
            });
        default:
            throw new Error("Unknown message action");
    }
}

chrome.runtime.onMessage.addListener(onMessage);
