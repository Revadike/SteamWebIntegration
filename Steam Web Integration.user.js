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
// @exclude      /^https?\:\/\/(.+.steampowered|steamcommunity).com\/(?!groups\/groupbuys).*/
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
// @version      1.11.5
// ==/UserScript==

// ==Code==
// eslint-disable-next-line no-multi-assign
this.$ = this.jQuery = jQuery.noConflict(true);
let settings;
let boxNode;

function factoryReset() {
    if (unsafeWindow.confirm(`Are you sure you want to reset all settings and cached data?`)) {
        const keys = GM_listValues();
        keys.forEach((key) => GM_deleteValue(key));
        console.log(`[Steam Web Integration] Factory reset completed!`);
        unsafeWindow.alert(`Factory reset completed!`);
    }
}

function displaySettings() {
    const { name, version, author } = GM_info.script;
    $(`#title`).text(`${name} (${version}) by ${author}`);
    $(`#settings`).show();
    $(`#notinstalled`).hide();

    Object.keys(settings).forEach((setting) => {
        const value = settings[setting];
        if (typeof value === `boolean`) {
            $(`#${setting}`).prop(`checked`, value);
        } else {
            $(`#${setting}`).val(value);
        }
    });
}

function showToast() {
    $(`#snackbar`).addClass(`show`);
    setTimeout(() => $(`#snackbar`).removeClass(`show`), 3000);
}

function onChange(elem) {
    const name = $(elem).attr(`name`);
    const val = $(elem).val();

    if (elem.type === `checkbox`) {
        settings[name] = $(elem).prop(`checked`);
    } else {
        settings[elem.name] = Number.isFinite(val) ? parseInt(val, 10) : val;
    }

    GM_setValue(`swi_settings`, JSON.stringify(settings));
    showToast();
}

function createBoxNode() {
    return $(`<div/>`, {
        "class": `swi-block${settings.boxed ? ` swi-boxed` : ``}`
    });
}

function getIconHTML(color, str, lcs, icon, link) {
    const { name, version, author } = GM_info.script;
    const titlePlus = `\nLast updated at ${lcs}\n${name} (${version}) by ${author}`;
    if (link) {
        return `<span title="${str}\n${titlePlus}"><a style="color: ${color} !important;" href="${link}" target="_blank">${icon}</a></span>`;
    }

    return `<span style="color: ${color} !important;" title="${str} on Steam\n${titlePlus}">${icon}</span>`;
}

function getBoxNode(html, appID, subID) {
    const node = boxNode.clone(false, false);
    if (subID) {
        node.attr(`data-subid`, subID);
    } else {
        node.attr(`data-appid`, appID);
    }
    node.html(html);
    return node;
}

function refreshDecommissioned(callback) {
    if (!settings.wantDecommissioned) {
        callback();
        return;
    }

    let cachedDecommissioned = JSON.parse(GM_getValue(`swi_decommissioned`, null));
    if (Array.isArray(cachedDecommissioned)) { // TODO: temporary code to transition from Array to Object; can delete this in ~2022 and change 'let' above back to 'const'
        cachedDecommissioned = null;
    }
    const lastCachedDecommissioned = GM_getValue(`swi_decommissioned_last`, 0);
    if (cachedDecommissioned && Date.now() - lastCachedDecommissioned < settings.decommissionedRefreshInterval * 60000) {
        callback(cachedDecommissioned);
        return;
    }

    GM_xmlhttpRequest({
        "method": `GET`,
        "url": `https://steam-tracker.com/api?action=GetAppListV3`,
        "timeout": 30000,
        "onload": (response) => {
            let json = null;
            try {
                json = JSON.parse(response.responseText);
                if (json.success) {
                    const responseAsObject = json.removed_apps.reduce((obj, item) => (obj[item.appid] = item, obj), {}); // convert to object
                    // could delete item.appid from each entry to save minor storage space, but might hurt performance and increase complexity?
                    GM_setValue(`swi_decommissioned`, JSON.stringify(responseAsObject));
                    GM_setValue(`swi_decommissioned_last`, Date.now());
                    callback(responseAsObject);
                    return;
                }
            } catch (error) {
                console.log(`[Steam Web Integration] Unable to parse removed steam games data. Using cached data...`, error);
            }
            callback(cachedDecommissioned);
        },
        "onerror": () => {
            console.log(`[Steam Web Integration] An error occurred while refreshing removed steam games data. Using cached data...`);
            callback(cachedDecommissioned);
        },
        "ontimeout": () => {
            console.log(`[Steam Web Integration] It took too long to refresh removed steam games data. Using cached data...`);
            callback(cachedDecommissioned);
        }
    });
}

function refreshDLC(callback) {
    if (!settings.wantDLC) {
        callback();
        return;
    }

    const cachedDLC = JSON.parse(GM_getValue(`swi_dlc`, null));
    const lastCachedDLC = parseInt(GM_getValue(`swi_dlc_last`, 0), 10) || 1;
    if (cachedDLC && Object.keys(cachedDLC).length > 7000 && Date.now() - lastCachedDLC < settings.dlcRefreshInterval * 60000) {
        callback(cachedDLC);
        return;
    }

    GM_xmlhttpRequest({
        "method": `GET`,
        "url": `https://bartervg.com/browse/dlc/json/`,
        "timeout": 30000,
        "onload": (response) => {
            let json = null;
            try {
                json = JSON.parse(response.responseText);
                if (Object.keys(json).length > 7000) { // sanity check
                    GM_setValue(`swi_dlc`, JSON.stringify(json));
                    GM_setValue(`swi_dlc_last`, Date.now());
                    callback(json);
                    return;
                }
            } catch (error) {
                console.log(`[Steam Web Integration] Unable to parse Barter.vg downloadable content data. Using cached data...`, error);
            }
            callback(cachedDLC);
        },
        "onerror": (response) => {
            console.log(`[Steam Web Integration] An error occurred while refreshing Barter.vg downloadable content data. Using cached data...`, response);
            callback(cachedDLC);
        },
        "ontimeout": () => {
            console.log(`[Steam Web Integration] It took too long to refresh Barter.vg downloadable content data. Using cached data...`);
            callback(cachedDLC);
        }
    });
}

function refreshLimited(callback) {
    if (!settings.wantLimited) {
        callback();
        return;
    }

    const cachedLimited = JSON.parse(GM_getValue(`swi_limited`, null));
    const lastCachedLimited = parseInt(GM_getValue(`swi_limited_last`, 0), 10) || 1;
    if (cachedLimited && Object.keys(cachedLimited).length > 7000 && Date.now() - lastCachedLimited < settings.limitedRefreshInterval * 60000) {
        callback(cachedLimited);
        return;
    }

    GM_xmlhttpRequest({
        "method": `GET`,
        "url": `https://bartervg.com/browse/tag/481/json/`,
        "timeout": 30000,
        "onload": (response) => {
            let json = null;
            try {
                json = JSON.parse(response.responseText);
                if (Object.keys(json).length > 7000) { // sanity check
                    GM_setValue(`swi_limited`, JSON.stringify(json));
                    GM_setValue(`swi_limited_last`, Date.now());
                    callback(json);
                    return;
                }
            } catch (error) {
                console.log(`[Steam Web Integration] Unable to parse Barter.vg low confidence metric data. Using cached data...`, error);
            }
            callback(cachedLimited);
        },
        "onerror": (response) => {
            console.log(`[Steam Web Integration] An error occurred while refreshing Barter.vg low confidence metric data. Using cached data...`, response);
            callback(cachedLimited);
        },
        "ontimeout": () => {
            console.log(`[Steam Web Integration] It took too long to refresh Barter.vg low confidence metric data. Using cached data...`);
            callback(cachedLimited);
        }
    });
}

function refreshCards(callback) {
    if (!settings.wantCards) {
        callback();
        return;
    }

    const cachedCards = JSON.parse(GM_getValue(`swi_tradingcards`, null));
    const lastCachedCards = parseInt(GM_getValue(`swi_tradingcards_last`, 0), 10) || 1;
    if (cachedCards && Object.keys(cachedCards).length > 7000 && Object.values(cachedCards)[0].marketable && Date.now() - lastCachedCards < settings.cardsRefreshInterval * 60000) {
        callback(cachedCards);
        return;
    }

    GM_xmlhttpRequest({
        "method": `GET`,
        "url": `https://bartervg.com/browse/cards/json/`,
        "timeout": 30000,
        "onload": (response) => {
            let json = null;
            try {
                json = JSON.parse(response.responseText);
                if (Object.keys(json).length > 7000) { // sanity check
                    GM_setValue(`swi_tradingcards`, JSON.stringify(json));
                    GM_setValue(`swi_tradingcards_last`, Date.now());
                    callback(json);
                    return;
                }
            } catch (error) {
                console.log(`[Steam Web Integration] Unable to parse Barter.vg trading cards data. Using cached data...`, error);
            }
            callback(cachedCards);
        },
        "onerror": (response) => {
            console.log(`[Steam Web Integration] An error occurred while refreshing Barter.vg trading cards data. Using cached data...`, response);
            callback(cachedCards);
        },
        "ontimeout": () => {
            console.log(`[Steam Web Integration] It took too long to refresh Barter.vg trading cards data. Using cached data...`);
            callback(cachedCards);
        }
    });
}

function refreshBundles(callback) {
    if (!settings.wantBundles) {
        callback();
        return;
    }

    const cachedBundles = JSON.parse(GM_getValue(`swi_bundles`, null));
    const lastCachedBundles = parseInt(GM_getValue(`swi_bundles_last`, 0), 10) || 1;
    if (cachedBundles && Object.keys(cachedBundles).length > 7000 && Object.values(cachedBundles)[0].bundles && Date.now() - lastCachedBundles < settings.bundlesRefreshInterval * 60000) {
        callback(cachedBundles);
        return;
    }

    GM_xmlhttpRequest({
        "method": `GET`,
        "url": `https://bartervg.com/browse/bundles/json/`,
        "timeout": 30000,
        "onload": (response) => {
            let json = null;
            try {
                json = JSON.parse(response.responseText);
                if (Object.keys(json).length > 7000) { // sanity check
                    GM_setValue(`swi_bundles`, JSON.stringify(json));
                    GM_setValue(`swi_bundles_last`, Date.now());
                    callback(json);
                    return;
                }
            } catch (error) {
                console.log(`[Steam Web Integration] Unable to parse Barter.vg bundles data. Using cached data...`, error);
            }
            callback(cachedBundles);
        },
        "onerror": (response) => {
            console.log(`[Steam Web Integration] An error occurred while refreshing Barter.vg bundles data. Using cached data...`, response);
            callback(cachedBundles);
        },
        "ontimeout": () => {
            console.log(`[Steam Web Integration] It took too long to refresh Barter.vg bundles data. Using cached data...`);
            callback(cachedBundles);
        }
    });
}

function doApp(elem, wishlist, ownedApps, ignoredApps, followedApps, decommissioned, limited, cards, bundles, dlc, lcs, dlcs, dlclcs, llcs, clcs, blcs) {
    $(elem).addClass(`swi`);

    const attr = settings.attributes.find((a) => /a(pps?)?\/[0-9]+/g.test($(elem).attr(a)));
    if (!attr) {
        return;
    }

    const attrVal = $(elem).attr(attr);
    const appID = parseInt(attrVal.match(/a(?:pps?)?\/[0-9]+/g)[0].split(/a(?:pps?)?\//)[1], 10);
    if (Number.isNaN(appID)) {
        return;
    }

    setTimeout(() => {
        let html;
        let subject;
        if (dlc && dlc[appID]) {
            subject = `DLC`;
        } else if (!dlc) {
            subject = `Game or DLC`;
        } else {
            subject = `Game`;
        }

        if (ownedApps && ownedApps.includes(appID)) { // if owned
            html = getIconHTML(settings.ownedColor, `${subject} (${appID}) owned`, lcs, settings.ownedIcon); // ✔
        } else if (wishlist.includes(appID)) { // if not owned and wishlisted
            html = getIconHTML(settings.wishlistColor, `${subject} (${appID}) wishlisted`, lcs, settings.wishlistIcon); // ❤
        } else { // else not owned and not wishlisted
            html = getIconHTML(settings.unownedColor, `${subject} (${appID}) not owned`, lcs, settings.unownedIcon); // ✘
        }

        if (settings.wantFollowed && followedApps && followedApps.includes(appID)) {
            html += getIconHTML(settings.followedColor, `${subject} (${appID}) followed`, lcs, settings.followedIcon); // ★
        }

        if (settings.wantIgnores && ignoredApps && ignoredApps.includes(appID)) { // if ignored and enabled
            html += getIconHTML(settings.ignoredColor, `${subject} (${appID}) ignored`, llcs, settings.ignoredIcon); // 🛇
        }

        if (settings.wantDLC && dlc && dlc[appID]) { // if DLC and enabled
            const base = dlc[appID].base_appID;
            const ownsBase = ownedApps.includes(base);
            html += getIconHTML(settings.dlcColor, `${subject} (${appID}) is downloadable content for an ${ownsBase ? `` : `un`}owned base game (${base})`, dlclcs, settings.dlcIcon); // ⇩
        }

        if (settings.wantDecommissioned && decommissioned && decommissioned[appID]) { // if decommissioned and enabled
            const app = decommissioned[appID];
            html += getIconHTML(settings.decommissionedColor, `The ${app.type} '${app.name.replace(/"|'/g, ``)}' (${appID}) is ${app.category.toLowerCase()} and has only ${app.count} confirmed owner${app.count === 1 ? `` : `s`} on Steam`, dlcs, settings.decommissionedIcon, `https://steam-tracker.com/app/${appID}/`); // 🗑
        }

        if (settings.wantLimited && limited && limited[appID]) { // if limited and enabled
            html += getIconHTML(settings.limitedColor, `Game (${appID}) has profile features limited`, llcs, settings.limitedIcon); // ⚙
        }

        if (settings.wantCards && cards && cards[appID] && cards[appID].cards && cards[appID].cards > 0) { // if has cards and enabled
            html += getIconHTML(settings.cardColor, `Game (${appID}) has ${cards[appID].cards} ${cards[appID].marketable ? `` : `un`}marketable card${cards[appID].cards === 1 ? `` : `s`}`, clcs, settings.cardIcon, `https://www.steamcardexchange.net/index.php?gamepage-appid-${appID}`);
        }

        if (settings.wantBundles && bundles && bundles[appID] && bundles[appID].bundles && bundles[appID].bundles > 0) { // if bundled and enabled
            html += getIconHTML(settings.bundleColor, `Game (${appID}) has been in ${bundles[appID].bundles} bundle${bundles[appID].bundles === 1 ? `` : `s`}`, blcs, settings.bundleIcon, `https://barter.vg/steam/app/${appID}/#bundles`);
        }

        if (settings.prefix) {
            $(elem).before(getBoxNode(html, appID));
        } else {
            $(elem).after(getBoxNode(html, appID));
        }

        $(elem).parent().css(`overflow`, `visible`);
    }, 0);
}

function doSub(elem, ownedPackages, lcs) {
    $(elem).addClass(`swi`);

    const attr = settings.attributes.find((a) => /sub\/[0-9]+/g.test($(elem).attr(a)));
    if (!attr) {
        return;
    }

    const attrVal = $(elem).attr(attr);
    const subID = parseInt(attrVal.match(/sub\/[0-9]+/g)[0].split(`sub/`)[1], 10);
    if (Number.isNaN(subID)) {
        return;
    }

    setTimeout(() => {
        let html;

        if (ownedPackages.includes(subID)) { // if owned
            html = getIconHTML(settings.ownedColor, `Package (${subID}) owned`, lcs, settings.ownedIcon); // ✔
        } else { // else not owned
            html = getIconHTML(settings.unownedColor, `Package (${subID}) not owned`, lcs, settings.unownedIcon); // ✖
        }

        if (settings.prefix) {
            $(elem).before(getBoxNode(html, undefined, subID));
        } else {
            $(elem).after(getBoxNode(html, undefined, subID));
        }

        $(elem).parent().css(`overflow`, `visible`);
    }, 0);
}

function integrate(userdata, decommissioned, cards, bundles, limited, dlc, lastCached) {
    const ignoredApps = Object.keys(userdata.rgIgnoredApps).map((a) => parseInt(a, 10));
    const ownedApps = userdata.rgOwnedApps;
    const ownedPackages = userdata.rgOwnedPackages;
    const followedApps = userdata.rgFollowedApps;
    const wishlist = userdata.rgWishlist;

    const lcs = settings.dateOverride ? new Date(lastCached).toLocaleString(`sv-SE`) : new Date(lastCached).toLocaleString();
    const dlcs = new Date(GM_getValue(`swi_decommissioned_last`, 0)).toLocaleString(settings.dateOverride ? `sv-SE` : undefined);
    const dlclcs = new Date(GM_getValue(`swi_dlc_last`, 0)).toLocaleString(settings.dateOverride ? `sv-SE` : undefined);
    const llcs = new Date(GM_getValue(`swi_limited_last`, 0)).toLocaleString(settings.dateOverride ? `sv-SE` : undefined);
    const clcs = new Date(GM_getValue(`swi_tradingcards_last`, 0)).toLocaleString(settings.dateOverride ? `sv-SE` : undefined);
    const blcs = new Date(GM_getValue(`swi_bundles_last`, 0)).toLocaleString(settings.dateOverride ? `sv-SE` : undefined);

    const appSelector = [
        `[href*="steamcommunity.com/app/"]`,
        `[href*="steamdb.info/app/"]`,
        `[href*="store.steampowered.com/agecheck/app/"]`,
        `[href*="store.steampowered.com/app/"]`,
        `[href*="s.team/a/"]`,
        `[style*="cdn.akamai.steamstatic.com/steam/apps/"]`,
        `[style*="cdn.edgecast.steamstatic.com/steam/apps/"]`,
        `[style*="steamcdn-a.akamaihd.net/steam/apps/"]`,
        `[style*="steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/"]`,
        `[style*="cdn.cloudflare.steamstatic.com/steam/apps/"]`,
        `[style*="cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/"]`,
        `[style*="steamcdn-a.opskins.media/steam/apps/"]`,
        `[style*="steamcdn-a.opskins.media/steamcommunity/public/images/apps/"]`,
        `[style*="steamdb.info/static/camo/apps/"]`,
        `img[src*="cdn.akamai.steamstatic.com/steam/apps/"]`,
        `img[src*="cdn.edgecast.steamstatic.com/steam/apps/"]`,
        `img[src*="steamcdn-a.akamaihd.net/steam/apps/"]`,
        `img[src*="steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/"]`,
        `img[src*="cdn.cloudflare.steamstatic.com/steam/apps/"]`,
        `img[src*="cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/"]`,
        `img[src*="steamcdn-a.opskins.media/steam/apps/"]`,
        `img[src*="steamcdn-a.opskins.media/steamcommunity/public/images/apps/"]`,
        `img[src*="steamdb.info/static/camo/apps/"]`
    ].filter((s) => settings.attributes.find((a) => s.includes(`[${a}`))).map((s) => `${s}:not(.swi)`).join(`, `);

    const subSelector = [
        `[href*="steamdb.info/sub/"]`,
        `[href*="store.steampowered.com/sub/"]`
    ].map((s) => `${s}:not(.swi)`).join(`, `);

    let delaySWI;
    const doSWI = (delay = 750) => {
        if (delaySWI) {
            clearTimeout(delaySWI);
        }

        delaySWI = setTimeout(() => {
            if (settings.dynamicContent !== `ping`) {
                console.log(`[Steam Web Integration] Executing`);
            }

            clearTimeout(delaySWI);
            $(appSelector, document.body).get().forEach((elem) => doApp(elem, wishlist, ownedApps, ignoredApps, followedApps, decommissioned, limited, cards, bundles, dlc, lcs, dlcs, dlclcs, llcs, clcs, blcs));
            $(subSelector, document.body).get().forEach((elem) => doSub(elem, ownedPackages, lcs), 0);
        }, delay);
    };

    const clearSWI = () => {
        console.log(`[Steam Web Integration] Clearing`);
        $(`.swi-block`).remove();
        $(`.swi`).removeClass(`swi`);
    };

    const reloadSWI = () => {
        clearSWI();
        doSWI(0);
    };

    $(document).ready(() => {
        doSWI(0);

        GM_registerMenuCommand(`Run again`, () => doSWI(0));
        GM_registerMenuCommand(`Clear all`, clearSWI);
        GM_registerMenuCommand(`Clear and run (reload)`, reloadSWI);

        unsafeWindow.doSWI = doSWI;
        unsafeWindow.clearSWI = clearSWI;
        unsafeWindow.reloadSWI = reloadSWI;

        if (settings.dynamicContent === `disabled`) {
            return;
        }

        if (settings.dynamicContent === `observe`) {
            $(`body`).observe({ "added": true, "attributes": true, "attributeFilter": settings.attributes }, appSelector, () => doSWI());
            $(`body`).observe({ "added": true, "attributes": true, "attributeFilter": [`href`] }, subSelector, () => doSWI());
        } else if (settings.dynamicContent === `ping`) {
            setInterval(doSWI, 1500);
        }
    });
}

function refresh() {
    const cachedJson = GM_getValue(`swi_data`, null);
    let lastCached = GM_getValue(`swi_last`, 0);

    if (cachedJson && Date.now() - lastCached < settings.userRefreshInterval * 60000) {
        const userdata = JSON.parse(cachedJson);
        refreshDecommissioned((decommissioned) => refreshDLC((dlc) => refreshLimited((limited) => refreshCards((cards) => refreshBundles((bundles) => integrate(userdata, decommissioned, cards, bundles, limited, dlc, lastCached))))));
        return;
    }

    GM_xmlhttpRequest({
        "method": `GET`,
        "url": `https://store.steampowered.com/dynamicstore/userdata/?t=${Date.now()}`,
        "onload": (response) => {
            let userdata = JSON.parse(response.responseText);

            if (userdata.rgOwnedApps.length === 0 && userdata.rgOwnedPackages.length === 0 && userdata.rgIgnoredApps.length === 0 && userdata.rgWishlist.length === 0 && userdata.rgFollowedApps.length === 0) { // not logged in
                if (!cachedJson) {
                    console.log(`[Steam Web Integration] No cached information available. Please login to Steam to fix this.`);
                    return;
                }

                userdata = JSON.parse(cachedJson);
            } else {
                lastCached = Date.now();
                GM_setValue(`swi_last`, lastCached);
                GM_setValue(`swi_data`, JSON.stringify(userdata));
            }

            refreshDecommissioned((decommissioned) => refreshDLC((dlc) => refreshLimited((limited) => refreshCards((cards) => refreshBundles((bundles) => integrate(userdata, decommissioned, cards, bundles, limited, dlc, lastCached))))));
        }
    });
}

function init() {
    const settingsuri = `https://revadike.com/swi/settings`;

    const defaults = {
        "attributes": [`href`, `src`, `style`],
        "blackList": ``,
        "boxed": true,
        "bundleColor": `#ffff00`,
        "bundleIcon": `&#127873;&#xFE0E;`,
        "bundlesRefreshInterval": 2880,
        "cardColor": `#0000ff`,
        "cardIcon": `&#x1F0A1`,
        "cardsRefreshInterval": 2880,
        "dateOverride": false,
        "decommissionedColor": `#ffffff`,
        "decommissionedIcon": `&#9760;`,
        "decommissionedRefreshInterval": 1440,
        "dlcColor": `#a655b2`,
        "dlcIcon": `&#8681;`,
        "dlcRefreshInterval": 1440,
        "dynamicContent": `observe`,
        "followedColor": `#f7dc6f`,
        "followedIcon": `&#9733;`,
        "ignoredColor": `#808080`,
        "ignoredIcon": `&#128683;&#xFE0E;`,
        "limitedColor": `#00ffff`,
        "limitedIcon": `&#9881;`,
        "limitedRefreshInterval": 2880,
        "ownedColor": `#008000`,
        "ownedIcon": `&#10004;`,
        "prefix": false,
        "unownedColor": `#ff0000`,
        "unownedIcon": `&#10008;`,
        "userRefreshInterval": 1,
        "wantBundles": true,
        "wantCards": true,
        "wantDecommissioned": true,
        "wantDLC": true,
        "wantFollowed": true,
        "wantIgnores": true,
        "wantLimited": true,
        "whiteListMode": false,
        "wishlistColor": `#ff69b4`,
        "wishlistIcon": `&#10084;`
    };

    const stylesheet = `
            .swi-block {
                display: inline-block;
                line-height: initial;
            }
            .swi-block.swi-boxed {
                background: rgba(0, 0, 0, 0.7);
                border-radius: 5px;
                margin: auto 4px auto 4px;
                padding: 2px 4px 2px 4px;
                position: relative;
            }
            .swi-block span {
                cursor: help;
                margin: 2px;
            }
            .swi-block a {
                text-decoration: none;
            }
        `;

    settings = JSON.parse(GM_getValue(`swi_settings`, JSON.stringify(defaults)));
    Object.keys(defaults).forEach((setting) => {
        if (settings[setting] !== undefined) {
            return;
        }

        settings[setting] = defaults[setting];
    });

    if (unsafeWindow.location.href.startsWith(settingsuri)) {
        unsafeWindow.onChange = onChange;
        unsafeWindow.scriptInfo = GM_info.script;
        unsafeWindow.settings = settings;
        $(document).ready(displaySettings);
    } else {
        const matchUrl = settings.blackList.split(`\n`).find((url) => unsafeWindow.location.href.includes(url.trim()));
        if (settings.whiteListMode && matchUrl || !settings.whiteListMode && !matchUrl) {
            boxNode = createBoxNode();
            GM_addStyle(stylesheet);
            refresh();
        }
    }

    // Open the setup page on any web page.
    GM_registerMenuCommand(`Change settings`, () => unsafeWindow.open(settingsuri, `_blank`));

    // Factory reset on any web page.
    GM_registerMenuCommand(`Factory reset`, factoryReset);
}

init();
// ==/Code==