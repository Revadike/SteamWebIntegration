// ==UserScript==
// @name         Steam Web Integration
// @icon         https://store.steampowered.com/favicon.ico
// @namespace    Royalgamer06
// @author       Revadike
// @collaborator Black3ird
// @collaborator Lex
// @collaborator Luckz
// @version      1.8.1
// @description  Check every web page for game, dlc and package links to the steam store and mark using icons whether it's owned, unowned, wishlisted, ignored (not interested), removed/delisted (decommissioned), has cards, or is bundled.
// @include      /^https?\:\/\/.+/
// @exclude      /^https?\:\/\/(.+.steampowered|steamcommunity).com\/(?!groups\/groupbuys).*/
// @grant        unsafeWindow
// @grant        GM.registerMenuCommand
// @grant        GM.xmlHttpRequest
// @grant        GM.openInTab
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-start
// @connect      store.steampowered.com
// @connect      steam-tracker.com
// @connect      bartervg.com
// @require      https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @require      https://raw.githubusercontent.com/kapetan/jquery-observe/master/jquery-observe.js
// @homepageURL  https://www.steamgifts.com/discussion/y9vVm/
// @supportURL   https://github.com/Revadike/SteamWebIntegration/issues/
// @updateURL    https://github.com/Revadike/SteamWebIntegration/raw/master/Steam%20Web%20Integration.user.js
// @downloadURL  https://github.com/Revadike/SteamWebIntegration/raw/master/Steam%20Web%20Integration.user.js
// ==/UserScript==
"use strict";

// ==Configuration==
const prefix = false; //                            Prefix (true) instead of suffix (false) position icon.
const wantIgnores = true; //                        Whether (true) or not (false) you want to display an extra icon for ignored (not interested) apps.
const wantDecommissioned = true; //                 Whether (true) or not (false) you want to display an extra icon for removed or delisted (decommissioned) apps.
const wantCards = true; //                          Whether (true) or not (false) you want to display an extra icon for apps with cards.
const wantBundles = true; //                        Whether (true) or not (false) you want to display an extra icon for previously bundled apps.
const ignoredIcon = `&#128683;&#xFE0E;`; //         HTML entity code for '🛇' (default).
const ignoredColor = `grey`; //                     Color of the icon for ignored (not interested) apps.
const wishlistIcon = `&#10084;`; //                 HTML entity code for '❤' (default).
const wishlistColor = `hotpink`; //                 Color of the icon for wishlisted apps.
const ownedIcon = `&#10004;`; //                    HTML entity code for '✔' (default).
const ownedColor = `green`; //                      Color of the icon for owned apps and subs.
const unownedIcon = `&#10008;`; //                  HTML entity code for '✘' (default).
const unownedColor = `red`; //                      Color of the icon for unowned apps and subs.
const decommissionedIcon = `&#9760;`; //            HTML entity code for '☠' (default).
const decommissionedColor = `initial`; //           Color of the icon for removed or delisted apps and subs.
const cardIcon = `&#x1F0A1`; //                     HTML entity code for '🂡' (default). ♠ ("&spades;") is an alternative if this symbol is unavailable.
const cardColor = `blue`; //                        Color of the icon for cards.
const bundleIcon = `&#127873;&#xFE0E;`; //          HTML entity code for '🎁︎' (default). Barter.vg uses the symbol '✽' ("&#10045;").
const bundleColor = `yellow`; //                    Color of the icon for bundled apps.
const userRefreshInterval = 0; //                   Number of minutes to wait to refresh cached userdata. 0 = always stay up-to-date.
const decommissionedRefreshInterval = 60 * 24; //   Number of minutes to wait to refresh cached userdata. 0 = always stay up-to-date, but not recommended.
const cardsRefreshInterval = 60 * 24 * 2; //        Number of minutes to wait to refresh cached trading card data. 0 = always stay up-to-date, but not recommended.
const bundlesRefreshInterval = 60 * 24 * 2; //      Number of minutes to wait to refresh cached bundle data. 0 = always stay up-to-date, but not recommended.
const dateOverride = false; //                      Force date display in the YYYY-MM-DD HH:MM:SS style; otherwise matches system locale.
// ==/Configuration==

// ==Code==
// eslint-disable-next-line no-multi-assign
this.$ = this.jQuery = jQuery.noConflict(true);
GM.registerMenuCommand(`Configuration: CTRL + click on script`, () => true);
refresh();

function refresh() {
    const cachedJson = GM_getValue(`swi_data`, null);
    const lastCached = GM_getValue(`swi_last`, 0);

    if (cachedJson && Date.now() - lastCached < userRefreshInterval * 60000) {
        refreshDecommissioned((decommissioned) => refreshCards((cards) => refreshBundles((bundles) => init(JSON.parse(cachedJson), decommissioned, cards, bundles))));
        return;
    }

    const v = parseInt(GM_getValue(`swi_v`, `1`)) + 1;
    GM.xmlHttpRequest({
        "method": `GET`,
        "url": `https://store.steampowered.com/dynamicstore/userdata/?v=${v}`,
        "onload": (response) => {
            GM_setValue(`swi_v`, v);
            refreshDecommissioned((decommissioned) => refreshCards((cards) => refreshBundles((bundles) => init(JSON.parse(response.responseText), decommissioned, cards, bundles))));
        }
    });
}

function init(userdata, decommissioned, cards, bundles) {
    let ignoredApps = Object.keys(userdata.rgIgnoredApps).map((a) => parseInt(a, 10));
    let ownedApps = userdata.rgOwnedApps;
    let ownedPackages = userdata.rgOwnedPackages;
    let wishlist = userdata.rgWishlist;
    let lastCached = GM_getValue(`swi_last`, 0);

    if (ownedApps.length === 0 && ownedPackages.length === 0 && ignoredApps.length === 0 && wishlist.length === 0) {
        const parsedCachedJson = JSON.parse(GM_getValue(`swi_data`, null));
        ignoredApps = parsedCachedJson.rgIgnoredApps;
        ownedApps = parsedCachedJson.rgOwnedApps;
        ownedPackages = parsedCachedJson.rgOwnedPackages;
        wishlist = parsedCachedJson.rgWishlist;
    } else {
        lastCached = Date.now();
        GM_setValue(`swi_last`, lastCached);
        GM_setValue(`swi_data`, JSON.stringify(userdata));
    }

    const lcs = dateOverride ? (new Date(lastCached)).toLocaleString(`sv-SE`) : (new Date(lastCached)).toLocaleString();
    const dlcs = (new Date(GM_getValue(`swi_decommissioned_last`, 0))).toLocaleString(dateOverride ? `sv-SE` : undefined);
    const clcs = (new Date(GM_getValue(`swi_tradingcards_last`, 0))).toLocaleString(dateOverride ? `sv-SE` : undefined);
    const blcs = (new Date(GM_getValue(`swi_bundles_last`, 0))).toLocaleString(dateOverride ? `sv-SE` : undefined);

    const appSelector = [`[href*="store.steampowered.com/app/"]`,
        `[href*="store.steampowered.com/agecheck/app/"]`,
        `[href*="steamcommunity.com/app/"]`,
        `[href*="steamdb.info/app/"]`,
        `img[src*="cdn.akamai.steamstatic.com/steam/apps/"]`,
        `img[src*="steamcdn-a.akamaihd.net/steam/apps/"]`,
        `img[src*="cdn.edgecast.steamstatic.com/steam/apps/"]`,
        `img[src*="steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/"]`,
        `img[src*="steamdb.info/static/camo/apps/"]`].map((s) => `${s}:not(.swi)`).join(`, `);
    const subSelector = [`[href*="store.steampowered.com/sub/"]`,
        `[href*="steamdb.info/sub/"]`].map((s) => `${s}:not(.swi)`).join(`, `);

    let delaySWI = null;
    const doSWI = () => {
        if (delaySWI) {
            clearTimeout(delaySWI);
            delay = null;
        }

        delaySWI = setTimeout(() => {
            console.log("[Steam Web Integration] Executing");
            clearTimeout(delaySWI);
            delaySWI = null
            $(appSelector).get().forEach((elem) => doApp(elem, wishlist, ownedApps, ignoredApps, decommissioned, cards, bundles, lcs, dlcs, clcs, blcs));
            $(subSelector).get().forEach((elem) => doSub(elem, ownedPackages, lcs), 0);
        }, 300);
    };

    $(document).ready(() => {
        doSWI();
        $(document).observe(`added`, appSelector, doSWI);
        $(document).observe(`added`, subSelector, doSWI);
        GM.registerMenuCommand(`Run manually (again)`, doSWI);
        unsafeWindow.doSWI = doSWI;
    });
}

function refreshDecommissioned(callback) {
    if (!wantDecommissioned) {
        callback();
        return;
    }

    const cachedDecommissioned = JSON.parse(GM_getValue(`swi_decommissioned`, null));
    const lastCachedDecommissioned = GM_getValue(`swi_decommissioned_last`, 0);
    if (cachedDecommissioned && Date.now() - lastCachedDecommissioned < decommissionedRefreshInterval * 60000) {
        callback(cachedDecommissioned);
        return;
    }

    GM.xmlHttpRequest({
        "method": `GET`,
        "url": `https://steam-tracker.com/api?action=GetAppListV3`,
        "timeout": 30000,
        "onload": (response) => {
            console.log(response);
            let json = null;
            try {
                json = JSON.parse(response.responseText);
                if (json.success) {
                    GM_setValue(`swi_decommissioned`, JSON.stringify(json.removed_apps));
                    GM_setValue(`swi_decommissioned_last`, Date.now());
                }
                callback(json.removed_apps);
                return;
            } catch (e) {
                console.log(`Unable to parse removed steam games data. Using cached data...`, e);
                callback(cachedDecommissioned);
                return;
            }
        },
        "onerror": () => {
            console.log(`An error occurred while refreshing removed steam games data. Using cached data...`);
            callback(cachedDecommissioned);
        },
        "ontimeout": () => {
            console.log(`It took too long to refresh removed steam games data. Using cached data...`);
            callback(cachedDecommissioned);
        }
    });
}

function refreshCards(callback) {
    if (!wantCards) {
        callback();
        return;
    }

    const cachedCards = JSON.parse(GM_getValue(`swi_tradingcards`, null));
    const lastCachedCards = parseInt(GM_getValue(`swi_tradingcards_last`, 0)) || 1;
    if (cachedCards && Object.keys(cachedCards).length > 7000 && Object.values(cachedCards)[0].marketable && Date.now() - lastCachedCards < cardsRefreshInterval * 60000) {
        callback(cachedCards);
        return;
    }

    GM.xmlHttpRequest({
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
                }
                callback(json);
                return;
            } catch (error) {
                console.log(`Unable to parse Barter.vg trading cards data. Using cached data...`, error);
                callback(cachedCards);
                return;
            }
        },
        "onerror": (response) => {
            console.log(`An error occurred while refreshing Barter.vg trading cards data. Using cached data...`, response);
            callback(cachedCards);
        },
        "ontimeout": () => {
            console.log(`It took too long to refresh Barter.vg trading cards data. Using cached data...`);
            callback(cachedCards);
        }
    });
}

function refreshBundles(callback) {
    if (!wantBundles) {
        callback();
        return;
    }

    const cachedBundles = JSON.parse(GM_getValue(`swi_bundles`, null));
    const lastCachedBundles = parseInt(GM_getValue(`swi_bundles_last`, 0)) || 1;
    if (cachedBundles && Object.keys(cachedBundles).length > 7000 && Object.values(cachedBundles)[0].bundles && Date.now() - lastCachedBundles < bundlesRefreshInterval * 60000) {
        callback(cachedBundles);
        return;
    }

    GM.xmlHttpRequest({
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
                }
                callback(json);
                return;
            } catch (error) {
                console.log(`Unable to parse Barter.vg bundles data. Using cached data...`, error);
                callback(cachedBundles);
                return;
            }
        },
        "onerror": (response) => {
            console.log(`An error occurred while refreshing Barter.vg bundles data. Using cached data...`, response);
            callback(cachedBundles);
        },
        "ontimeout": () => {
            console.log(`It took too long to refresh Barter.vg bundles data. Using cached data...`);
            callback(cachedBundles);
        }
    });
}

function doApp(elem, wishlist, ownedApps, ignoredApps, decommissioned, cards, bundles, lcs, dlcs, clcs, blcs) {
    $(elem).addClass(`swi`);
    const appID = elem.href ? parseInt(stripURI(elem.href.split(`app/`)[1])) : parseInt(stripURI(elem.src.split(`apps/`)[1]));
    if (isNaN(appID)) {
        return;
    }

    setTimeout(() => {
        let html;

        if (ownedApps.includes(appID)) { // if owned
            html = genHTML(ownedColor, `Game or DLC (${appID}) owned`, lcs, ownedIcon); // ✔
        } else if (wishlist.includes(appID)) { // if not owned and wishlisted
            html = genHTML(wishlistColor, `Game or DLC (${appID}) wishlisted`, lcs, wishlistIcon); // ❤
        } else { // else not owned and not wishlisted
            html = genHTML(unownedColor, `Game or DLC (${appID}) not owned`, lcs, unownedIcon); // ✘
        }

        if (wantIgnores && ignoredApps.includes(appID)) { // if ignored and enabled
            html += genHTML(ignoredColor, `Game or DLC (${appID}) ignored`, lcs, ignoredIcon); // 🛇
        }

        if (wantDecommissioned && decommissioned) { // if decommissioned and have cache or new data
            const app = decommissioned.find((obj) => obj.appid === appID.toString());
            if (app) { // if decommissioned?
                html += genHTML(decommissionedColor, `The ${app.type} '${app.name.replace(/'/g, ``)}' (${appID}) is ${app.category.toLowerCase()} and has only ${app.count} confirmed owners on Steam`, dlcs, decommissionedIcon, `https://steam-tracker.com/app/${appID}/`); // 🗑
            }
        }

        if (wantCards && cards[appID] && cards[appID].cards && cards[appID].cards > 0) { // if has cards and enabled
            html += genHTML(cardColor, `Game (${appID}) has ${cards[appID].cards}${cards[appID].marketable ? ` ` : ` un`}marketable cards`, clcs, cardIcon, `https://www.steamcardexchange.net/index.php?gamepage-appid-${appID}`);
        }

        if (wantBundles && bundles[appID] && bundles[appID].bundles && bundles[appID].bundles > 0) { // if is bundled and enabled
            html += genHTML(bundleColor, `Game (${appID}) has been in ${bundles[appID].bundles} bundles`, blcs, bundleIcon, `https://barter.vg/steam/app/${appID}/#bundles`);
        }

        if (prefix) {
            $(elem).before(html);
        } else {
            $(elem).after(html);
        }

        $(elem).parent().css(`overflow`, `visible`);
    }, 0);
}

function doSub(elem, ownedPackages, lcs) {
    $(elem).addClass(`swi`);
    const subID = parseInt(stripURI(elem.href.split(`sub/`)[1]));
    if (isNaN(subID)) {
        return;
    }

    setTimeout(() => {
        let html;

        if (ownedPackages.includes(subID)) { // if owned
            html = genHTML(ownedColor, `Package (${subID}) owned`, lcs, ownedIcon); // ✔
        } else { // else not owned
            html = genHTML(unownedColor, `Package (${subID}) not owned`, lcs, unownedIcon); // ✖
        }

        if (prefix) {
            $(elem).before(html);
        } else {
            $(elem).after(html);
        }

        $(elem).parent().css(`overflow`, `visible`);
    }, 0);
}

function stripURI(uri) {
    return uri.split(`/`)[0].split(`?`)[0].split(`#`)[0];
}

function genHTML(color, str, lcs, icon, link) {
    if (link) {
        return `<span style="cursor: help;" title="${str}\nLast updated: ${lcs}"> <a style="color: ${color} !important; text-decoration: none;" href="${link}" target="_blank">${icon}</a></span>`;
    }

    return `<span style="color: ${color} !important; cursor: help;" title="${str} on Steam\nLast updated: ${lcs}"> ${icon}</span>`;
}
// ==/Code==
