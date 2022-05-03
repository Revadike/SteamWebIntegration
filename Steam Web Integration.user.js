// ==UserScript==
// @author       Revadike
// @connect      bartervg.com
// @connect      steam-tracker.com
// @connect      store.steampowered.com
// @contributor  Barter.vg
// @contributor  Black3ird
// @contributor  Lex
// @contributor  Luckz
// @contributor  観月唯
// @description  Check every web page for game, dlc and package links to the steam store and mark using icons whether it's owned, unowned, wishlisted, ignored (not interested), DLC, removed/delisted (decommissioned), has low confidence metric, has cards, or is bundled.
// @downloadURL  https://github.com/Revadike/SteamWebIntegration/raw/master/Steam%20Web%20Integration.user.js
// @exclude      /^https?\:\/\/(.+\.steampowered|steamcommunity)\.com\/(?!groups\/groupbuys).*/
// @grant        GM_addStyle
// @grant        GM_deleteValue
// @grant        GM_getValue
// @grant        GM_info
// @grant        GM_listValues
// @grant        GM_openInTab
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @homepageURL  https://www.steamgifts.com/discussion/y9vVm/
// @icon         https://store.steampowered.com/favicon.ico
// @include      /^https?\:\/\/.+/
// @name         Steam Web Integration
// @namespace    Royalgamer06
// @require      https://cdn.jsdelivr.net/npm/jquery@3.3.1/dist/jquery.slim.min.js
// @require      https://cdn.jsdelivr.net/gh/kapetan/jquery-observe@2.0.3/jquery-observe.js
// @run-at       document-start
// @supportURL   https://github.com/Revadike/SteamWebIntegration/issues/
// @updateURL    https://github.com/Revadike/SteamWebIntegration/raw/master/Steam%20Web%20Integration.user.js
// @version      1.12.1
// ==/UserScript==

// ==Code==
// eslint-disable-next-line
this.$ = this.jQuery = jQuery.noConflict(true);
let settings;
let boxNode;

function factoryReset() {
    if (unsafeWindow.confirm("Are you sure you want to reset all settings and cached data?")) {
        const keys = GM_listValues();
        keys.forEach((key) => GM_deleteValue(key));
        console.log("[Steam Web Integration] Factory reset completed!");
        unsafeWindow.alert("Factory reset completed!");
    }
}

function displaySettings() {
    // eslint-disable-next-line camelcase
    const { name, version, author } = GM_info.script;
    $("#title").text(`${name} (${version}) by ${author}`);
    $("#settings").show();
    $("#notinstalled").hide();

    Object.keys(settings).forEach((setting) => {
        const value = settings[setting];
        if (typeof value === "boolean") {
            $(`#${setting}`).prop("checked", value);
        } else {
            $(`#${setting}`).val(value);
        }
    });
}

function showToast() {
    $("#snackbar").addClass("show");
    setTimeout(() => $("#snackbar").removeClass("show"), 3000);
}

function onChange(elem) {
    const name = $(elem).attr("name");
    const val = $(elem).val();

    if (elem.type === "checkbox") {
        settings[name] = $(elem).prop("checked");
    } else {
        settings[elem.name] = Number.isFinite(val) ? Number(val) : val;
    }

    GM_setValue("swi_settings", JSON.stringify(settings));
    showToast();
}

function arrayToObject(array, key) {
    if (!key) {
        return array.reduce((obj, item) => Object.assign(obj, { [item]: 1 }), {});
    }

    return array.reduce((obj, item) => Object.assign(obj, { [item[key]]: item }), {});
}

function createBoxNode() {
    return $("<div/>", { "class": `swi-block${settings.boxed ? " swi-boxed" : ""}` });
}

function getIconHTML(color, str, lcs, icon, link) {
    // eslint-disable-next-line camelcase
    const { name, version, author } = GM_info.script;
    const titlePlus = `\nLast updated at ${lcs}\n${name} (${version}) by ${author}`;
    if (link) {
        return `<span title="${str}\n${titlePlus}"><a style="color: ${color} !important;" href="${link}" target="_blank">${icon}</a></span>`;
    }

    return `<span style="color: ${color} !important;" title="${str} on Steam\n${titlePlus}">${icon}</span>`;
}

function convertToRGB(color) {
    const aRgbHex = color.replace("#", "").match(/.{1,2}/g);
    const aRgb = [
        parseInt(aRgbHex[0], 16),
        parseInt(aRgbHex[1], 16),
        parseInt(aRgbHex[2], 16),
    ];
    return aRgb;
}

function calculateColor(iconsEncoding) {
    const color = (iconsEncoding * 305040).toString(16);
    const rgb = convertToRGB(color);
    return `rgba(${rgb.join(", ")}, ${settings.boxOpacity})`;
}

function getBoxNode(html, iconsEncoding, appID, subID) {
    const node = boxNode.clone(false, false);
    if (subID) {
        node.attr("data-subid", subID);
    } else {
        node.attr("data-appid", appID);
    }
    if (settings.boxDynamicColor) {
        node.attr("style", `background: ${calculateColor(iconsEncoding)} !important;`);
    }
    node.html(html);
    return node;
}

function refreshDecommissioned(callback) {
    if (!settings.wantDecommissioned) {
        callback();
        return;
    }

    let cachedDecommissioned = JSON.parse(GM_getValue("swi_decommissioned", null));
    if (Array.isArray(cachedDecommissioned)) { // fix old data format
        cachedDecommissioned = arrayToObject(cachedDecommissioned, "appid");
    }

    const lastCachedDecommissioned = GM_getValue("swi_decommissioned_last", 0);
    if (cachedDecommissioned && Date.now() - lastCachedDecommissioned < settings.decommissionedRefreshInterval * 60000) {
        callback(cachedDecommissioned);
        return;
    }

    GM_xmlhttpRequest({
        "method":  "GET",
        "url":     "https://steam-tracker.com/api?action=GetAppListV3",
        "timeout": 30000,
        "onload":  (response) => {
            let json = null;
            try {
                json = JSON.parse(response.responseText);
                if (json.success) {
                    const responseAsObject = arrayToObject(json.removed_apps, "appid");
                    GM_setValue("swi_decommissioned", JSON.stringify(responseAsObject));
                    GM_setValue("swi_decommissioned_last", Date.now());
                    callback(responseAsObject);
                    return;
                }
            } catch (error) {
                console.log("[Steam Web Integration] Unable to parse removed steam games data. Using cached data...", error);
            }
            callback(cachedDecommissioned);
        },
        "onerror": () => {
            console.log("[Steam Web Integration] An error occurred while refreshing removed steam games data. Using cached data...");
            callback(cachedDecommissioned);
        },
        "ontimeout": () => {
            console.log("[Steam Web Integration] It took too long to refresh removed steam games data. Using cached data...");
            callback(cachedDecommissioned);
        },
    });
}

function refreshDLC(callback) {
    if (!settings.wantDLC) {
        callback();
        return;
    }

    const cachedDLC = JSON.parse(GM_getValue("swi_dlc", null));
    const lastCachedDLC = Number(GM_getValue("swi_dlc_last", 0)) || 1;
    if (cachedDLC && Object.keys(cachedDLC).length > 7000 && Date.now() - lastCachedDLC < settings.dlcRefreshInterval * 60000) {
        callback(cachedDLC);
        return;
    }

    GM_xmlhttpRequest({
        "method":  "GET",
        "url":     "https://bartervg.com/browse/dlc/json/",
        "timeout": 30000,
        "onload":  (response) => {
            let json = null;
            try {
                json = JSON.parse(response.responseText);
                if (Object.keys(json).length > 7000) { // sanity check
                    GM_setValue("swi_dlc", JSON.stringify(json));
                    GM_setValue("swi_dlc_last", Date.now());
                    callback(json);
                    return;
                }
            } catch (error) {
                console.log("[Steam Web Integration] Unable to parse Barter.vg downloadable content data. Using cached data...", error);
            }
            callback(cachedDLC);
        },
        "onerror": (response) => {
            console.log("[Steam Web Integration] An error occurred while refreshing Barter.vg downloadable content data. Using cached data...", response);
            callback(cachedDLC);
        },
        "ontimeout": () => {
            console.log("[Steam Web Integration] It took too long to refresh Barter.vg downloadable content data. Using cached data...");
            callback(cachedDLC);
        },
    });
}

function refreshLimited(callback) {
    if (!settings.wantLimited) {
        callback();
        return;
    }

    const cachedLimited = JSON.parse(GM_getValue("swi_limited", null));
    const lastCachedLimited = Number(GM_getValue("swi_limited_last", 0)) || 1;
    if (cachedLimited && Object.keys(cachedLimited).length > 7000 && Date.now() - lastCachedLimited < settings.limitedRefreshInterval * 60000) {
        callback(cachedLimited);
        return;
    }

    GM_xmlhttpRequest({
        "method":  "GET",
        "url":     "https://bartervg.com/browse/tag/481/json/",
        "timeout": 30000,
        "onload":  (response) => {
            let json = null;
            try {
                json = JSON.parse(response.responseText);
                if (Object.keys(json).length > 7000) { // sanity check
                    GM_setValue("swi_limited", JSON.stringify(json));
                    GM_setValue("swi_limited_last", Date.now());
                    callback(json);
                    return;
                }
            } catch (error) {
                console.log("[Steam Web Integration] Unable to parse Barter.vg low confidence metric data. Using cached data...", error);
            }
            callback(cachedLimited);
        },
        "onerror": (response) => {
            console.log("[Steam Web Integration] An error occurred while refreshing Barter.vg low confidence metric data. Using cached data...", response);
            callback(cachedLimited);
        },
        "ontimeout": () => {
            console.log("[Steam Web Integration] It took too long to refresh Barter.vg low confidence metric data. Using cached data...");
            callback(cachedLimited);
        },
    });
}

function refreshCards(callback) {
    if (!settings.wantCards) {
        callback();
        return;
    }

    const cachedCards = JSON.parse(GM_getValue("swi_tradingcards", null));
    const lastCachedCards = Number(GM_getValue("swi_tradingcards_last", 0)) || 1;
    if (cachedCards && Object.keys(cachedCards).length > 7000 && Object.values(cachedCards)[0].marketable && Date.now() - lastCachedCards < settings.cardsRefreshInterval * 60000) {
        callback(cachedCards);
        return;
    }

    GM_xmlhttpRequest({
        "method":  "GET",
        "url":     "https://bartervg.com/browse/cards/json/",
        "timeout": 30000,
        "onload":  (response) => {
            let json = null;
            try {
                json = JSON.parse(response.responseText);
                if (Object.keys(json).length > 7000) { // sanity check
                    GM_setValue("swi_tradingcards", JSON.stringify(json));
                    GM_setValue("swi_tradingcards_last", Date.now());
                    callback(json);
                    return;
                }
            } catch (error) {
                console.log("[Steam Web Integration] Unable to parse Barter.vg trading cards data. Using cached data...", error);
            }
            callback(cachedCards);
        },
        "onerror": (response) => {
            console.log("[Steam Web Integration] An error occurred while refreshing Barter.vg trading cards data. Using cached data...", response);
            callback(cachedCards);
        },
        "ontimeout": () => {
            console.log("[Steam Web Integration] It took too long to refresh Barter.vg trading cards data. Using cached data...");
            callback(cachedCards);
        },
    });
}

function refreshBundles(callback) {
    if (!settings.wantBundles) {
        callback();
        return;
    }

    const cachedBundles = JSON.parse(GM_getValue("swi_bundles", null));
    const lastCachedBundles = Number(GM_getValue("swi_bundles_last", 0)) || 1;
    if (cachedBundles && Object.keys(cachedBundles).length > 7000 && Object.values(cachedBundles)[0].bundles && Date.now() - lastCachedBundles < settings.bundlesRefreshInterval * 60000) {
        callback(cachedBundles);
        return;
    }

    GM_xmlhttpRequest({
        "method":  "GET",
        "url":     "https://bartervg.com/browse/bundles/json/",
        "timeout": 30000,
        "onload":  (response) => {
            let json = null;
            try {
                json = JSON.parse(response.responseText);
                if (Object.keys(json).length > 7000) { // sanity check
                    GM_setValue("swi_bundles", JSON.stringify(json));
                    GM_setValue("swi_bundles_last", Date.now());
                    callback(json);
                    return;
                }
            } catch (error) {
                console.log("[Steam Web Integration] Unable to parse Barter.vg bundles data. Using cached data...", error);
            }
            callback(cachedBundles);
        },
        "onerror": (response) => {
            console.log("[Steam Web Integration] An error occurred while refreshing Barter.vg bundles data. Using cached data...", response);
            callback(cachedBundles);
        },
        "ontimeout": () => {
            console.log("[Steam Web Integration] It took too long to refresh Barter.vg bundles data. Using cached data...");
            callback(cachedBundles);
        },
    });
}

function doApp(elem, wishlist, ownedApps, ignoredApps, followedApps, decommissioned, limited, cards, bundles, dlc, lcs, dlcs, dlclcs, llcs, clcs, blcs) {
    $(elem).addClass("swi");

    /* Example detectable links:
     * https://barter.vg/steam/app/440/
     * https://s.team/a/440/
     * https://steamcdn-a.akamaihd.net/steam/apps/440/header.jpg
     * https://steamdb.info/app/440/
     * https://store.steampowered.com/app/440/
     */

    const attr = settings.attributes.find((a) => /\/a(pps?)?\/[0-9]+/g.test($(elem).attr(a)));
    if (!attr) {
        return;
    }

    const attrVal = $(elem).attr(attr);
    const appID = Number(attrVal.match(/\/a(?:pps?)?\/[0-9]+/g)[0].split(/\/a(?:pps?)?\//)[1]);
    if (Number.isNaN(appID)) {
        return;
    }

    setTimeout(() => { // avoids having the page hang when loading, because it is waiting on our script execution
        let html;
        let subject;
        let iconsEncoding = 0;
        if (dlc && dlc[appID]) {
            subject = "DLC";
        } else if (dlc && !dlc[appID]) {
            subject = "Game";
        } else {
            subject = "Game or DLC";
        }

        if (ownedApps && ownedApps[appID]) { // if owned
            html = getIconHTML(settings.ownedColor, `${subject} (${appID}) owned`, lcs, settings.ownedIcon); // ✔
            iconsEncoding += 1;
        } else if (wishlist[appID]) { // if not owned and wishlisted
            html = getIconHTML(settings.wishlistColor, `${subject} (${appID}) wishlisted`, lcs, settings.wishlistIcon); // ❤
            iconsEncoding += 3;
        } else { // else not owned and not wishlisted
            html = getIconHTML(settings.unownedColor, `${subject} (${appID}) not owned`, lcs, settings.unownedIcon); // ✘
            iconsEncoding += 2;
        }

        if (settings.wantFollowed && followedApps && followedApps[appID]) {
            html += getIconHTML(settings.followedColor, `${subject} (${appID}) followed`, lcs, settings.followedIcon); // ★
            iconsEncoding += 4;
        }

        if (settings.wantIgnores && ignoredApps && ignoredApps[appID]) { // if ignored and enabled
            html += getIconHTML(settings.ignoredColor, `${subject} (${appID}) ignored`, llcs, settings.ignoredIcon); // 🛇
            iconsEncoding += 5;
        }

        if (settings.wantDLC && dlc && dlc[appID]) { // if DLC and enabled
            const base = dlc[appID].base_appID;
            const ownsBase = Boolean(ownedApps[base]);
            const extraIcon = `<span style="color: ${ownsBase ? settings.ownedColor : settings.unownedColor};">${ownsBase ? "⁺" : "⁻"}</span>`;
            html += getIconHTML(settings.dlcColor, `${subject} (${appID}) is downloadable content for an ${ownsBase ? "" : "un"}owned base game (${base})`, dlclcs, settings.dlcIcon + extraIcon); // ⇩
            iconsEncoding += 6;
        }

        if (settings.wantDecommissioned && decommissioned && decommissioned[appID]) { // if decommissioned and enabled
            const app = decommissioned[appID];
            html += getIconHTML(settings.decommissionedColor, `The ${app.type} '${app.name.replace(/"|'/g, "")}' (${appID}) is ${app.category.toLowerCase()} and has only ${app.count} confirmed owner${app.count === 1 ? "" : "s"} on Steam`, dlcs, settings.decommissionedIcon, `https://steam-tracker.com/app/${appID}/`); // 🗑
            iconsEncoding += 7;
        }

        if (settings.wantLimited && limited && limited[appID]) { // if limited and enabled
            html += getIconHTML(settings.limitedColor, `Game (${appID}) has profile features limited`, llcs, settings.limitedIcon); // ⚙
            iconsEncoding += 8;
        }

        if (settings.wantCards && cards && cards[appID] && cards[appID].cards && cards[appID].cards > 0) { // if has cards and enabled
            html += getIconHTML(settings.cardColor, `Game (${appID}) has ${cards[appID].cards} ${cards[appID].marketable ? "" : "un"}marketable card${cards[appID].cards === 1 ? "" : "s"}`, clcs, settings.cardIcon, `https://www.steamcardexchange.net/index.php?gamepage-appid-${appID}`); // 🂡
            iconsEncoding += 9;
        }

        if (settings.wantBundles && bundles && bundles[appID] && bundles[appID].bundles && bundles[appID].bundles > 0) { // if bundled and enabled
            html += getIconHTML(settings.bundleColor, `Game (${appID}) has been in ${bundles[appID].bundles} bundle${bundles[appID].bundles === 1 ? "" : "s"}`, blcs, settings.bundleIcon, `https://barter.vg/steam/app/${appID}/#bundles`); // 🎁︎
            iconsEncoding += 10;
        }

        const today = new Date().toLocaleString("sv-SE");
        if (today.includes("-04-01 ")) {
            html += getIconHTML("green", "April Fools!\nClick for the joke :)", today, "&#129313;&#xFE0E;", "https://steamcommunity.com/groups/RemGC");
        }

        if (settings.prefix) {
            $(elem).before(getBoxNode(html, iconsEncoding, appID));
        } else {
            $(elem).after(getBoxNode(html, iconsEncoding, appID));
        }

        $(elem).parent()
            .css("overflow", "visible");
    }, 0);
}

function doSub(elem, ownedPackages, lcs) {
    $(elem).addClass("swi");

    /* Example detectable links:
     * https://barter.vg/steam/sub/469/
     * https://steamdb.info/sub/469/
     * https://store.steampowered.com/sub/469/
     */

    const attr = settings.attributes.find((a) => /sub\/[0-9]+/g.test($(elem).attr(a)));
    if (!attr) {
        return;
    }

    const attrVal = $(elem).attr(attr);
    const subID = Number(attrVal.match(/sub\/[0-9]+/g)[0].split("sub/")[1]);
    if (Number.isNaN(subID)) {
        return;
    }

    setTimeout(() => {
        let html;
        let iconsEncoding = 0;

        if (ownedPackages[subID]) { // if owned
            html = getIconHTML(settings.ownedColor, `Package (${subID}) owned`, lcs, settings.ownedIcon); // ✔
            iconsEncoding += 1;
        } else { // else not owned
            html = getIconHTML(settings.unownedColor, `Package (${subID}) not owned`, lcs, settings.unownedIcon); // ✖
            iconsEncoding += 2;
        }

        if (settings.prefix) {
            $(elem).before(getBoxNode(html, iconsEncoding, undefined, subID));
        } else {
            $(elem).after(getBoxNode(html, iconsEncoding, undefined, subID));
        }

        $(elem).parent()
            .css("overflow", "visible");
    }, 0);
}

function integrate(userdata, decommissioned, cards, bundles, limited, dlc, lastCached) {
    const { ignoredApps, ownedApps, ownedPackages, followedApps, wishlist } = userdata;
    const lcs = settings.dateOverride ? new Date(lastCached).toLocaleString("sv-SE") : new Date(lastCached).toLocaleString();
    const dlcs = new Date(GM_getValue("swi_decommissioned_last", 0)).toLocaleString(settings.dateOverride ? "sv-SE" : undefined);
    const dlclcs = new Date(GM_getValue("swi_dlc_last", 0)).toLocaleString(settings.dateOverride ? "sv-SE" : undefined);
    const llcs = new Date(GM_getValue("swi_limited_last", 0)).toLocaleString(settings.dateOverride ? "sv-SE" : undefined);
    const clcs = new Date(GM_getValue("swi_tradingcards_last", 0)).toLocaleString(settings.dateOverride ? "sv-SE" : undefined);
    const blcs = new Date(GM_getValue("swi_bundles_last", 0)).toLocaleString(settings.dateOverride ? "sv-SE" : undefined);

    const appSelector = [
        "[href*=\"steamcommunity.com/app/\"]",
        "[href*=\"steamdb.info/app/\"]",
        "[href*=\"store.steampowered.com/agecheck/app/\"]",
        "[href*=\"store.steampowered.com/app/\"]",
        "[href*=\"s.team/a/\"]",
        "[style*=\"cdn.akamai.steamstatic.com/steam/apps/\"]",
        "[style*=\"cdn.edgecast.steamstatic.com/steam/apps/\"]",
        "[style*=\"steamcdn-a.akamaihd.net/steam/apps/\"]",
        "[style*=\"steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/\"]",
        "[style*=\"cdn.cloudflare.steamstatic.com/steam/apps/\"]",
        "[style*=\"cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/\"]",
        "[style*=\"steamcdn-a.opskins.media/steam/apps/\"]",
        "[style*=\"steamcdn-a.opskins.media/steamcommunity/public/images/apps/\"]",
        "[style*=\"steamdb.info/static/camo/apps/\"]",
        "img[src*=\"cdn.akamai.steamstatic.com/steam/apps/\"]",
        "img[src*=\"cdn.edgecast.steamstatic.com/steam/apps/\"]",
        "img[src*=\"steamcdn-a.akamaihd.net/steam/apps/\"]",
        "img[src*=\"steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/\"]",
        "img[src*=\"cdn.cloudflare.steamstatic.com/steam/apps/\"]",
        "img[src*=\"cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/\"]",
        "img[src*=\"steamcdn-a.opskins.media/steam/apps/\"]",
        "img[src*=\"steamcdn-a.opskins.media/steamcommunity/public/images/apps/\"]",
        "img[src*=\"steamdb.info/static/camo/apps/\"]",
    ].filter((s) => settings.attributes.find((a) => s.includes(`[${a}`))).map((s) => `${s}:not(.swi)`)
        .join(", ");

    const subSelector = [
        "[href*=\"steamdb.info/sub/\"]",
        "[href*=\"store.steampowered.com/sub/\"]",
    ].map((s) => `${s}:not(.swi)`).join(", ");

    let delaySWI;
    const doSWI = (delay = 750) => {
        if (delaySWI) {
            clearTimeout(delaySWI);
        }

        delaySWI = setTimeout(() => {
            if (settings.dynamicContent !== "ping") {
                console.log("[Steam Web Integration] Executing");
            }

            clearTimeout(delaySWI);
            $(appSelector, document.body).get()
                .forEach((elem) => doApp(elem, wishlist, ownedApps, ignoredApps, followedApps, decommissioned, limited, cards, bundles, dlc, lcs, dlcs, dlclcs, llcs, clcs, blcs));
            $(subSelector, document.body).get()
                .forEach((elem) => doSub(elem, ownedPackages, lcs), 0);
        }, delay);
    };

    const clearSWI = () => {
        console.log("[Steam Web Integration] Clearing");
        $(".swi-block").remove();
        $(".swi").removeClass("swi");
    };

    const reloadSWI = () => {
        clearSWI();
        doSWI(0);
    };

    $(document).ready(() => {
        doSWI(0);

        GM_registerMenuCommand("Run again", () => doSWI(0));
        GM_registerMenuCommand("Clear all", clearSWI);
        GM_registerMenuCommand("Clear and run (reload)", reloadSWI);

        unsafeWindow.doSWI = doSWI;
        unsafeWindow.clearSWI = clearSWI;
        unsafeWindow.reloadSWI = reloadSWI;

        if (settings.dynamicContent === "disabled") {
            return;
        }

        if (settings.dynamicContent === "observe") {
            $("body").observe({ "added": true, "attributes": true, "attributeFilter": settings.attributes }, appSelector, () => doSWI());
            $("body").observe({ "added": true, "attributes": true, "attributeFilter": ["href"] }, subSelector, () => doSWI());
        } else if (settings.dynamicContent === "ping") {
            setInterval(doSWI, settings.pingInterval);
        }
    });
}

function processUserData(userdata) {
    const ignoredApps = arrayToObject(Object.keys(userdata.rgIgnoredApps)); // change 0 values to 1
    const ownedApps = arrayToObject(userdata.rgOwnedApps);
    const ownedPackages = arrayToObject(userdata.rgOwnedPackages);
    const followedApps = arrayToObject(userdata.rgFollowedApps);
    const wishlist = arrayToObject(userdata.rgWishlist);
    return { ignoredApps, ownedApps, ownedPackages, followedApps, wishlist };
}

function refresh() {
    const cachedJson = GM_getValue("swi_data", null);
    let lastCached = GM_getValue("swi_last", 0);

    if (cachedJson && Date.now() - lastCached < settings.userRefreshInterval * 60000) {
        let userdata = JSON.parse(cachedJson);
        if (userdata.rgOwnedApps) { // fix old data format
            userdata = processUserData(userdata);
        }

        refreshDecommissioned((decommissioned) => refreshDLC((dlc) => refreshLimited((limited) => refreshCards((cards) => refreshBundles((bundles) => integrate(userdata, decommissioned, cards, bundles, limited, dlc, lastCached))))));
        return;
    }

    GM_xmlhttpRequest({
        "method": "GET",
        "url":    `https://store.steampowered.com/dynamicstore/userdata/?t=${Date.now()}`,
        "onload": (response) => {
            let userdata = JSON.parse(response.responseText);

            if (userdata.rgOwnedApps.length === 0 && userdata.rgOwnedPackages.length === 0) { // not logged in
                if (!cachedJson) {
                    console.log("[Steam Web Integration] No cached information available. Please login to Steam to fix this.");
                    return;
                }

                userdata = JSON.parse(cachedJson);
            } else {
                userdata = processUserData(userdata);
                lastCached = Date.now();
                GM_setValue("swi_data", JSON.stringify(userdata));
                GM_setValue("swi_last", lastCached);
            }

            refreshDecommissioned((decommissioned) => refreshDLC((dlc) => refreshLimited((limited) => refreshCards((cards) => refreshBundles((bundles) => integrate(userdata, decommissioned, cards, bundles, limited, dlc, lastCached))))));
        },
    });
}

function init() {
    const settingsUrl = "https://revadike.com/swi/settings";

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
        "dynamicContent":                "observe",
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

    settings = JSON.parse(GM_getValue("swi_settings", JSON.stringify(defaults)));
    Object.keys(defaults).forEach((setting) => {
        if (settings[setting] !== undefined) {
            return;
        }

        settings[setting] = defaults[setting];
    });

    const stylesheet = `
        .swi-block {
            display: inline-block;
            line-height: initial;
            font-size: ${settings.iconsScale}em;
            font-weight: ${settings.iconsBold ? "bold" : "normal"};
        }
        .swi-block.swi-boxed {
            background: rgba(${convertToRGB(settings.boxColor).join(", ")}, ${settings.boxOpacity});
            border-radius: 5px;
            margin: auto 4px auto 4px;
            padding: 2px 4px 2px 4px;
            position: relative;
        }
        .swi-block > span {
            cursor: help;
            margin: 2px;
        }
        .swi-block > span > a {
            cursor: help;
            text-decoration: none;
        }
    `;

    if (unsafeWindow.location.href.startsWith(settingsUrl)) {
        unsafeWindow.onChange = onChange;
        // eslint-disable-next-line camelcase
        unsafeWindow.scriptInfo = GM_info.script;
        unsafeWindow.settings = settings;
        $(document).ready(displaySettings);
    } else {
        const matchUrl = settings.blackList.split("\n").find((url) => unsafeWindow.location.href.includes(url.trim()));
        if ((settings.whiteListMode && matchUrl) || (!settings.whiteListMode && !matchUrl)) {
            boxNode = createBoxNode();
            GM_addStyle(stylesheet);
            refresh();
        }
    }

    // Open the setup page on any web page.
    GM_registerMenuCommand("Change settings", () => unsafeWindow.open(settingsUrl, "_blank"));

    // Factory reset on any web page.
    GM_registerMenuCommand("Factory reset", factoryReset);
}

init();
// ==/Code==
